from processing import engine
import pandas as pd
import json
from pathlib import Path
import io

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
    query = "UPDATE csvs SET processed_text = %s WHERE csvId = %s;"
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
    return df.to_json(None, orient='values', indent=2)


def test_manuals():
    for manual_csv in manual_csvs:
        try:
            pd.read_csv(manual_csvs_folder.joinpath(manual_csv + ".csv"), header=None, encoding="cp1252")
        except Exception as e:
            print(f"ERROR! {manual_csv}.csv: {str(e).strip()}")


def processing():
    tables = get_tables()
    print(f"Got {len(tables)} tables to process")
    clear_processed()
    print("cleaned up the DB")

    counter = 0
    manuals = 0

    for table in tables:
        all_tags = table.all_tags
        tags = table.tags

        # Dealing with manually processed tables
        if table.all_manual:
            manuals += 1
            continue
        if 13 in tags:
            # db(table, load(table.csv_id))
            manuals += 1
            continue
        if 13 in all_tags:
            table.all_tags.remove(13)

        # `pass-through` tables that need no transformation
        if (len(all_tags) == 1) and (2 in all_tags or 3 in all_tags):
            db(table, table.table)
            counter += 1
            continue

    print(f"Done {counter} tables; {len(tables) - counter} were not processed.")
    print(manuals)


if __name__ == "__main__":
    # test_manuals()
    processing()
    pass
