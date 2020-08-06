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
                        # print(item)
                        print(f'"{first_headers[idx]}" vs')
                        print(f'"{headers[idx]}" for "{head_id}" on level "{level}"')
                        print()
                        discrepancies = True
            if discrepancies:
                print("\n=======================================================\n")


if __name__ == "__main__":
    check_changes_in_headers()
