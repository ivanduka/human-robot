from processing import engine
import json
import re


def check_changes_in_headers():
    def normalize(s):
        return re.sub(r"(<s>\d+</s>)|(</?s>)|([^a-z0-9])", "", s.lower())

    more_than_one_table_query = '''
            SELECT headTable
            FROM tables
            WHERE relevancy = 1
            GROUP BY headTable
            HAVING count(headTable) > 1
            ORDER BY count(headTable) DESC;
    '''
    query = '''
        SELECT level, accepted_text
        FROM tables t
                 LEFT JOIN csvs c ON t.correct_csv = c.csvId
                 LEFT JOIN tables_tags tt ON (t.tableId = tt.tableId AND tt.tagId = 1)
        WHERE relevancy = 1
          AND tt.tagId IS NULL
          AND headTable = %s
        ORDER BY headTable, level;
    '''
    with engine.connect() as conn:
        head_ids = [head_id[0] for head_id in conn.execute(more_than_one_table_query)]

        for head_id in head_ids:
            results = conn.execute(query, (head_id,))
            data = []
            for item in results:
                table = json.loads(item[1])
                if len(table) > 0:
                    data.append((item[0], table[0]))

            discrepancies = False
            first_headers = data[0][1]
            for item in data:
                (level, headers) = item
                for idx, _ in enumerate(headers):
                    if normalize(headers[idx]) != normalize(first_headers[idx]):
                        print(f'"{first_headers[idx]}" vs')
                        print(f'"{headers[idx]}" for "{head_id}" on level "{level}"')
                        print()
                        discrepancies = True
            if discrepancies:
                print("=======================================================\n")


def populate_headers_table():
    get_jsons = "SELECT tableId, combinedConText FROM tables WHERE combinedConText IS NOT NULL;"
    get_query = "SELECT tableId, header_idx, header_title FROM headers WHERE tableId = %s AND header_idx = %s;"
    insert_query = "INSERT INTO headers (tableId, header_idx, header_title) VALUES (%s, %s, %s);"
    update_query = "UPDATE headers SET header_title = %s WHERE tableId = %s AND header_idx = %s;"

    with engine.connect() as conn:
        jsons = conn.execute(get_jsons)
        for j in jsons:
            table_id = j[0]
            table = json.loads(j[1])
            headers = table[0]
            for header_idx, header_title in enumerate(headers):
                existing = list(conn.execute(get_query, (table_id, header_idx)))
                if len(existing) > 0:
                    if existing[0][2] == header_title:
                        continue
                    conn.execute(update_query, (header_title, table_id, header_idx))
                    print(f"updated '{existing[0][2]}' to '{header_title}' at index {header_idx} in {table_id}")
                    continue
                conn.execute(insert_query, (table_id, header_idx, header_title))
    print("all done")


if __name__ == "__main__":
    # check_changes_in_headers()
    populate_headers_table()
