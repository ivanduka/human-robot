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
    get_jsons = '''
        SELECT t.tableId, t.combinedConText
        FROM tables t
                 LEFT JOIN tables_tags tt
                           ON tt.tableId = t.tableId AND tt.tagId = 4
                 LEFT JOIN pdfs p ON t.pdfName = p.pdfName
        WHERE combinedConText IS NOT NULL
          AND tt.tableId IS NULL
          AND p.latest = 1
        GROUP BY t.tableId;
    '''
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


def populate_issues_table():
    get_tables = 'SELECT tableId, combinedConText FROM tables WHERE headers_tagged = 1;'
    get_tags = "SELECT header_idx, htag FROM headers_htags WHERE tableId = %s;"
    insert_query = "INSERT INTO issues (tableId, rowIndex, content) VALUES (%s, %s, %s);"

    def update_query(col):
        return f"UPDATE issues SET {col} = %s WHERE tableId = %s AND rowIndex = %s;"

    with engine.connect() as conn:
        tables = conn.execute(get_tables)
        for table in list(tables):
            table_id = table[0]
            full_table_content = json.loads(table[1])
            headers = full_table_content[0]
            tags = list(conn.execute(get_tags, (table_id,)))
            for row_index in range(1, len(full_table_content)):
                row = full_table_content[row_index]
                conn.execute(insert_query, (table_id, row_index, json.dumps([headers, row])))
                for tag in tags:
                    header_index = tag[0]
                    header_tag = tag[1].replace(' ', '_')  # 'loc kp' => 'loc_kp'
                    content = row[header_index]
                    conn.execute(update_query(header_tag), (content, table_id, row_index))
    print("all done")


def populate_latest_column():
    projects_query = 'SELECT application_id FROM projects;'
    highest_year_query = '''
        SELECT monitoring_year FROM pdfs WHERE application_id = %s ORDER BY monitoring_year DESC LIMIT 1;
    '''
    update_latest_query = 'UPDATE pdfs SET latest = 1 WHERE application_id = %s AND monitoring_year = %s;'
    with engine.connect() as conn:
        projects = [project[0] for project in conn.execute(projects_query)]
        for project in projects:
            highest_year = list(conn.execute(highest_year_query, (project,)))[0][0]
            conn.execute(update_latest_query, (project, highest_year))
    print("All done")


# def clear_issues():
#     with engine.connect()as conn:
#         conn.execute("DELETE FROM ISSUES WHERE true;")

def get_tag_permutations():
    get_tables = 'SELECT tableId, combinedConText FROM tables WHERE headers_tagged = 1;'
    get_index_tags = "SELECT header_idx, htag FROM headers_htags WHERE tableId = %s ORDER BY header_idx;"

    permutations_index_tag = {}
    permutations_index_tag_cols = {}
    permutations_tags = {}
    with engine.connect() as conn:
        tables = conn.execute(get_tables)
        for table in tables:
            table_id = table[0]
            col_count = len(json.loads(table[1])[0])
            index_tags = list(conn.execute(get_index_tags, (table_id,)))

            key_tag = ""
            key_index_tag = ""
            key_index_tag_col = f'({col_count} columns)'

            for i, _ in enumerate(index_tags):
                if i == 0:
                    key_index_tag_col += " "
                if i > 0:
                    key_tag += " + "
                    key_index_tag += " + "
                    key_index_tag_col += " + "
                idx = index_tags[i][0]
                tag_name = index_tags[i][1]
                key_tag += f'{tag_name}'
                key_index_tag += f'{idx} {tag_name}'
                key_index_tag_col += f'{idx} {tag_name}'
            if key_tag in permutations_tags:
                permutations_tags[key_tag][0] += 1
            else:
                permutations_tags[key_tag] = [1, table_id]
            if key_index_tag_col in permutations_index_tag_cols:
                permutations_index_tag_cols[key_index_tag_col][0] += 1
            else:
                permutations_index_tag_cols[key_index_tag_col] = [1, table_id]
            if key_index_tag in permutations_index_tag:
                permutations_index_tag[key_index_tag][0] += 1
            else:
                permutations_index_tag[key_index_tag] = [1, table_id]

        def print_results(dictionary, variant):
            dictionary = sorted(dictionary.items(), key=lambda x: x[1][0], reverse=True)
            print(f"{len(dictionary)} {variant} permutations:\n")
            for tag, data in dictionary:
                count = data[0]
                example = data[1]
                print(f"{count}:\t{tag} (example tableId {example})")
            print()

        print_results(permutations_tags, "tag")
        print_results(permutations_index_tag, "tag+index")
        print_results(permutations_index_tag_cols, "tag+index+num_cols")


if __name__ == "__main__":
    # check_changes_in_headers()
    # populate_latest_column()
    # populate_headers_table()
    # populate_issues_table()
    get_tag_permutations()
    pass
