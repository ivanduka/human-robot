from processing import engine
import pandas as pd
import json
from pathlib import Path
import re

manual_csvs_folder = Path("//luxor/data/board/Dev/PCMR/manual_csv")
manual_csvs = [c.stem for c in manual_csvs_folder.glob("*.csv")]


class Table:
    def __init__(self, table):
        self.table_id = table.tableId
        self.head_table = table.headTable
        self.csv_id = table.correct_csv
        self.table = json.loads(table.csvText)
        self.all_tags = set(json.loads(table.all_tags))
        self.tags = set(json.loads(table.tags))
        self.all_manual = table.all_manual == 'true'


def get_tables():
    query = '''
        WITH heads_tags AS (
            SELECT t.headTable, tt.tagId
            FROM tables t
                    LEFT JOIN tables_tags tt
                            ON t.tableId = tt.tableId
            WHERE relevancy = 1
            GROUP BY tt.tagId, t.headTable
        ),
            heads_tags_json AS (
                SELECT headTable, JSON_ARRAYAGG(tagId) AS all_tags
                FROM heads_tags
                GROUP BY headTable
            ),
            all_manuals AS (
                SELECT t.headTable
                FROM tables t
                        LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
                WHERE relevancy = 1
                GROUP BY t.headTable
                HAVING count(tt.tagId) > 0
                    AND count(t.tableId) = count(tt.tagId)
            )
        SELECT t.tableId,
            t.headTable,
            t.correct_csv,
            c.csvText,
            htj.all_tags,
            JSON_ARRAYAGG(tt.tagId)                   AS tags,
            IF(am.headTable IS NULL, 'false', 'true') AS all_manual
        FROM tables t
                LEFT JOIN heads_tags_json htj ON htj.headTable = t.headTable
                LEFT JOIN csvs c ON t.correct_csv = c.csvId
                LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
                LEFT JOIN all_manuals am ON t.headTable = am.headTable
        WHERE t.relevancy = 1
        AND c.accepted_text IS NULL
        GROUP BY t.tableId;
    '''
    with engine.connect() as conn:
        tables_ = pd.read_sql(query, conn).itertuples()
        tables_ = [Table(t_) for t_ in tables_]
    return tables_


def save_to_db(table, processed_text):
    query = "UPDATE csvs SET processed_text = CAST(%s AS json) WHERE csvId = %s;"
    with engine.connect() as conn:
        result = conn.execute(query, (json.dumps(processed_text), table.csv_id))
        if result.rowcount != 1:
            raise Exception(f"{table.csvId}: {result.rowcount} rows changed!")


# noinspection SqlWithoutWhere
def clear_processed():
    with engine.connect() as conn:
        conn.execute('UPDATE csvs SET processed_text = NULL;')


def load(csv_id):
    df = pd.read_csv(manual_csvs_folder.joinpath(csv_id + ".csv"), header=None, encoding="cp1252")
    return json.loads(df.to_json(None, orient='values'))


def test_manuals():
    for manual_csv in manual_csvs:
        try:
            pd.read_csv(manual_csvs_folder.joinpath(manual_csv + ".csv"), header=None, encoding="cp1252")
        except Exception as e:
            print(f"ERROR! {manual_csv}.csv: {str(e).strip()}")
    print(f"Done testing {len(manual_csvs)} manual csvs")


def has_content(cell):
    return bool(re.search(r"\S", cell))


def empty_first_column(table):
    for row in table:
        if has_content(row[0]):
            return False
    return True


def delete_first_column(table):
    return [row[1:] for row in table]


def delete_first_row(table):
    return table[1:]


def delete_last_column(table):
    return [row[:-1] for row in table]


def delete_last_row(table):
    return table[0:-1]


# Removes notes by deleting last row and (if empty) first column
def remove_notes(table):
    table = delete_last_row(table)
    if empty_first_column(table):
        table = delete_first_column(table)
    return table


def fix_cutoff_heading(table):
    fixes = {
        "egal Land Description": "Legal Land Description",
        "nvironmental Issues": "Environmental Issues",
        "EnvironmentalIssues": "Environmental Issues"
    }
    for index1, row in enumerate(table):
        for index2, cell in enumerate(row):
            if cell in fixes:
                table[index1][index2] = fixes[cell]
    return table


def headers_two_rows(table):
    row1 = table[0]
    row2 = table[1]
    last_top_header = row1[0]
    for index in range(len(row1)):
        if has_content(row1[index]):
            last_top_header = row1[index]
        if last_top_header != row2[index]:
            table[1][index] = last_top_header + " " + row2[index]
    table = delete_first_row(table)
    return table


def add_three_columns(table):
    for i in range(len(table)):
        extension = ("VEC", "GIS", "Topic") if i == 0 else ("", "", "")
        table[i].extend(extension)
    return table


def detect_horizontals(table):
    horizontals = []
    for row_index, row in enumerate(table):
        if row_index > 0:
            is_horizontal = True
            for cell_index, cell in enumerate(row):
                if cell_index > 0 and has_content(cell):
                    is_horizontal = False
                    break
            if is_horizontal:
                horizontals.append((row[0], row_index))
    return horizontals


def copy_horizontals(table, horizontals, column_index):
    for VEC in horizontals:
        val = VEC[0]
        index = VEC[1]
        for i, row in enumerate(table):
            if i >= index:
                row[column_index] = val
    return table


def clean_horizontals(table, horizontals):
    horizontals.reverse()
    for VEC in horizontals:
        index = VEC[1]
        del table[index]
    return table


def transpose(table, horizontal_type, **first_row):
    columns = {"VEC": -3, "GIS": -2, "Topic": -1}
    if first_row:
        horizontals = [(table[0][0], 1)]
        table = delete_first_row(table)
        table = delete_last_column(table)
        table = delete_last_column(table)
        table = delete_last_column(table)
        table = add_three_columns(table)
        table = copy_horizontals(table, horizontals, columns[horizontal_type])
    else:
        horizontals = detect_horizontals(table)
        table = copy_horizontals(table, horizontals, columns[horizontal_type])
        table = clean_horizontals(table, horizontals)

    return table


def fix_nones(table):
    for row_index, row in enumerate(table):
        for cell_index, cell in enumerate(row):
            if cell is None:
                table[row_index][cell_index] = ""
    return table


def processing():
    tables = get_tables()
    counters = dict([(counter, 0) for counter in range(0, 16)])
    print(f"Got {len(tables)} tables to process")
    clear_processed()
    print("Cleaned up the DB")

    for t in tables:
        accepted_text = t.table

        # Fixing known problems with headers
        accepted_text = fix_nones(accepted_text)
        accepted_text = fix_cutoff_heading(accepted_text)

        # Dealing with manually processed tables
        if 13 in t.tags:
            save_to_db(t, load(t.csv_id))
            counters[13] += 1
            continue

        if 6 in t.tags:
            accepted_text = remove_notes(accepted_text)
            counters[6] += 1

        if 7 in t.tags:
            accepted_text = delete_first_row(accepted_text)
            counters[7] += 1
        if 8 in t.tags:
            accepted_text = delete_last_row(accepted_text)
            counters[8] += 1
        if 9 in t.tags:
            accepted_text = delete_first_column(accepted_text)
            counters[9] += 1
        if 10 in t.tags:
            accepted_text = delete_last_column(accepted_text)
            counters[10] += 1

        if 11 in t.tags:
            accepted_text = headers_two_rows(accepted_text)
            counters[11] += 1

        if any(x in t.all_tags for x in [5, 12, 14, 15]):
            accepted_text = add_three_columns(accepted_text)
            counters[0] += 1  # special case for adding 3 columns
        if 5 in t.tags:
            accepted_text = transpose(accepted_text, "VEC")
            counters[5] += 1
        if 14 in t.tags:
            accepted_text = transpose(accepted_text, "GIS")
            counters[14] += 1
        if 15 in t.tags:
            accepted_text = transpose(accepted_text, "Topic")
            counters[15] += 1
        if 12 in t.tags:
            accepted_text = transpose(accepted_text, "Topic", first_row=True)
            counters[12] += 1

        save_to_db(t, accepted_text)

    print(f"Done {len(tables)} tables.")
    print(counters)


def get_all_accepted_heads():
    query = '''
        SELECT headTable
        FROM TABLES t
                 INNER JOIN csvs c
                            ON t.correct_csv = c.csvId
        WHERE relevancy = 1
          AND concatenatedText IS NULL
        GROUP BY headTable
        HAVING count(headTable) = count(accepted_text);
    '''
    with engine.connect() as conn:
        tables = pd.read_sql(query, conn).itertuples()
        tables = [t.headTable for t in tables]
    return tables


def get_sequence(head_table_id):
    query = '''
        SELECT parentTable,
            c.csvId,
            t.tableId,
            if(tt.tagId IS NULL, 0, 1) AS no_headers,
            accepted_text,
            appendStatus
        FROM tables t
                INNER JOIN csvs c ON t.correct_csv = c.csvId
                LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 1
        WHERE headTable = %s
        ORDER BY level;
    '''
    with engine.connect() as conn:
        sequence = pd.read_sql(query, conn, params=(head_table_id,)).itertuples()
        sequence = [{'table_id': t.tableId, 'no_headers': t.no_headers == 1, "table": json.loads(t.accepted_text),
                     'csv_id': t.csvId, 'append_status': t.appendStatus} for t in sequence]
    return sequence


def check_equal_columns():
    heads = get_all_accepted_heads()
    for head in heads:
        sequence = get_sequence(head)
        cols = len(sequence[0]["table"][0])
        for t in sequence:
            table = t["table"]
            for row in table:
                if len(row) != cols:
                    csv = f"{t['csv_id']}.csv"
                    print(f'{len(row)} is not equal {cols} for tableId {t["table_id"]} (headTable {head}, {csv})')
                    print('All tables are checked for the same number of columns')


def get_all_accepted_and_marked():
    query = '''
        SELECT headTable
        FROM TABLES t
                 INNER JOIN csvs c
                            ON t.correct_csv = c.csvId
        GROUP BY headTable
        HAVING count(headTable) = count(accepted_text)
           AND sum(IF(appendStatus = 0, 0, 1)) + 1 = count(headTable)
        ORDER BY sum(IF(appendStatus = 0, 0, 1)) DESC;
    '''
    with engine.connect() as conn:
        tables = pd.read_sql(query, conn).itertuples()
        tables = [t.headTable for t in tables]
    return tables


def concatenate_tables():
    heads = get_all_accepted_and_marked()
    query = 'UPDATE tables SET concatenatedText = %s WHERE tableId = %s'
    with engine.connect() as conn:
        for head_id in heads[:]:
            sequence = get_sequence(head_id)
            result = sequence[0]['table']
            for t in sequence[1:]:
                table = t['table']
                if not t['no_headers']:
                    table = delete_first_row(table)
                if t['append_status'] == 2:
                    for index, cell in enumerate(table[0]):
                        if cell != '':
                            result[-1][index] = result[-1][index].strip() + ' ' + cell.strip()
                    table = delete_first_row(table)
                result.extend(table)
            result = conn.execute(query, (json.dumps(result), head_id))
            if result.rowcount != 1:
                raise Exception(f"Could not set for {head_id}")
    print(f'Done concatenating {len(heads)} table sequences.')


def _combine_concatenated_singles():
    get_query = '''
        SELECT tableId, concatenatedText
        FROM tables
        WHERE concatenatedText IS NOT NULL AND interPdfHeadTable IS NULL;
    '''
    set_query = 'UPDATE tables SET combinedConText = %s WHERE tableId = %s;'
    with engine.connect() as conn:
        singles = list(pd.read_sql(get_query, conn).itertuples())
        for single in singles:
            conn.execute(set_query, (single.concatenatedText, single.tableId))
    print(f'Done combining {len(singles)} single tables (pass through)')


def _combine_concatenated_doubles():
    get_heads_query = '''
        SELECT interPdfHeadTable
        FROM tables
        WHERE concatenatedText IS NOT NULL
          AND interPdfHeadTable IS NOT NULL
        GROUP BY interPdfHeadTable;
    '''
    get_sequence_query = '''
        SELECT concatenatedText
        FROM tables
        WHERE interPdfHeadTable = %s
        ORDER BY interPdfLevel;
    '''
    set_query = 'UPDATE tables SET combinedConText = %s WHERE tableId = %s;'
    with engine.connect() as conn:
        inter_pdf_heads = [head.interPdfHeadTable for head in pd.read_sql(get_heads_query, conn).itertuples()]
        for head_id in inter_pdf_heads:
            tables = [json.loads(table.concatenatedText) for table in
                      pd.read_sql(get_sequence_query, conn, params=(head_id,)).itertuples()]
            result = tables[0]
            for table in tables[1:]:
                t = delete_first_row(table)
                result.extend(t)
            conn.execute(set_query, (json.dumps(result), head_id))
    print(f'Done combining {len(inter_pdf_heads)} inter-PDF tables')


def combine_concatenated_tables():
    _combine_concatenated_singles()
    _combine_concatenated_doubles()


def convert_nones():
    query = 'SELECT csvId, accepted_text FROM csvs WHERE accepted_text IS NOT NULL;'
    query2 = 'UPDATE csvs SET accepted_text = %s WHERE csvId = %s;'
    with engine.connect() as conn:
        tables = pd.read_sql(query, conn).itertuples()
        tables = [(t.csvId, json.loads(t.accepted_text)) for t in tables]
        for table in tables:
            csv_id = table[0]
            new_text = json.dumps(fix_nones(table[1]))
            result = conn.execute(query2, (new_text, csv_id))
            if result.rowcount != 1:
                raise Exception(f"{csv_id}: {result.rowcount} rows changed!")


def print_stats():
    query_ = '''
        SELECT tableId, combinedConText
        FROM tables
        WHERE combinedConText IS NOT NULL;
    '''
    with engine.connect() as connection:
        tables_ = list(pd.read_sql(query_, connection).itertuples())
    maximum = 0
    minimum = 2 ** 31 - 1
    total = 0
    for table_ in tables_:
        length = len(json.loads(table_.combinedConText))
        total += length
        maximum = max(maximum, length)
        minimum = min(minimum, length)
    print(f"The longest table has {maximum} rows", )
    print(f"The smallest table has {minimum} rows")
    print(f"On average tables have {round(total / len(tables_))} rows")
    print(f"Total number of tables is {len(tables_)}")
    print(f"Total number of rows is {total}")


def copy_text_in_horizontals():
    get_query = '''
        SELECT t.tableId, t.combinedConText
        FROM tables t
                 INNER JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId IN (5, 12, 14, 15)
        WHERE combinedConText IS NOT NULL;
    '''
    set_query = 'UPDATE tables SET combinedConText = %s WHERE tableId = %s'
    with engine.connect() as conn:
        tables = list(pd.read_sql(get_query, conn).itertuples())
        for table in tables:
            t = json.loads(table.combinedConText)
            print(f'Working on {table.tableId} (length {len(t)})')
            last_vec = t[1][-3]
            last_gis = t[1][-2]
            last_topic = t[1][-1]
            for i, row in enumerate(t):
                vec = row[-3]
                gis = row[-2]
                topic = row[-1]
                if i >= 2:
                    if vec == "":
                        t[i][-3] = last_vec
                    if gis == "":
                        t[i][-2] = last_gis
                    if topic == "":
                        t[i][-1] = last_topic
                    last_vec = t[i][-3]
                    last_gis = t[i][-2]
                    last_topic = t[i][-1]

            conn.execute(set_query, (json.dumps(t), table.tableId))
    print(f"Done copying VEC, GIS, Topic for {len(tables)} tables.")


if __name__ == "__main__":
    test_manuals()
    processing()
    convert_nones()
    check_equal_columns()
    concatenate_tables()
    combine_concatenated_tables()
    print_stats()
    copy_text_in_horizontals()
