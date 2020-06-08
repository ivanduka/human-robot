from processing import engine
import pandas as pd
import json
from pathlib import Path
import io
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


def db(table, processed_text):
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
    fixes = {"egal Land Description": "Legal Land Description", "nvironmental Issues": "Environmental Issues"}
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


def processing():
    tables = get_tables()
    print(f"Got {len(tables)} tables to process")
    clear_processed()
    print("Cleaned up the DB")

    counter = 0

    for t in tables:
        accepted_text = t.table

        # Fixing known problems with headers
        accepted_text = fix_cutoff_heading(accepted_text)

        def remove_tags(*removing_tags):
            for tag in removing_tags:
                if tag in t.all_tags:
                    t.all_tags.remove(tag)
                if tag in t.tags:
                    t.tags.remove(tag)

        # removing non-functional headers
        remove_tags(1, 2, 3, 4)

        # Dealing with manually processed tables
        if t.all_manual:  # remove after we have those
            continue  # remove after we have those
        if 13 in t.tags:
            db(t, load(t.csv_id))
            counter += 1
            continue
        remove_tags(13)

        # `pass-through` tables that need no transformation
        if len(t.all_tags) == 0:
            # db(t, accepted_text)
            # counter += 1
            continue

        # tables with notes (removing last row and first column)
        if 6 in t.tags:
            accepted_text = remove_notes(accepted_text)
        remove_tags(6)

        if 7 in t.tags:
            accepted_text = delete_first_row(accepted_text)
        remove_tags(7)

        if 8 in t.tags:
            accepted_text = delete_last_row(accepted_text)
        remove_tags(8)

        if 9 in t.tags:
            accepted_text = delete_first_column(accepted_text)
        remove_tags(9)

        if 10 in t.tags:
            accepted_text = delete_last_column(accepted_text)
        remove_tags(10)

        if 11 in t.tags:
            accepted_text = headers_two_rows(accepted_text)
            counter += 1
            db(t, accepted_text)
        remove_tags(11)

    print(f"Done {counter} tables; {len(tables) - counter} were not processed.")


if __name__ == "__main__":
    test_manuals()
    processing()
    pass
