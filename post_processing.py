from processing import engine
import pandas as pd
import json


def get_heads():
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
             )
        SELECT t.tableId, t.headTable, t.correct_csv, c.csvText, htj.all_tags, JSON_ARRAYAGG(tt.tagId) AS tags
        FROM tables t
                 LEFT JOIN heads_tags_json htj ON htj.headTable = t.headTable
                 LEFT JOIN csvs c ON t.correct_csv = c.csvId
                 LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
        WHERE t.relevancy = 1
          AND c.accepted_text IS NULL
        GROUP BY t.tableId;
    '''
    with engine.connect() as conn:
        tables_ = pd.read_sql(query, conn).itertuples()
        tables_ = [{
            "tableId": t_.tableId,
            "headTable": t_.headTable,
            "csvId": t_.correct_csv,
            "table": json.loads(t_.csvText),
            "all_tags": set(json.loads(t_.all_tags)),
            "tags": set(json.loads(t_.tags))
        } for t_ in tables_]
    return tables_


if __name__ == "__main__":
    tables = get_heads()
    for t in tables:
        print(t)
