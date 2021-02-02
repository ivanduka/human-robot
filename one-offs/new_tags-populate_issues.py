from processing import engine
import json

target_table_id = '0c200808-9563-467f-b74f-2d4b73c53fc4'
target_tags = ['issue sec', 'vec sec']


def update_issues(table_id, tag_indexes, full_table_content):
    def update_query(col):
        return f"UPDATE issues SET {col} = %s WHERE tableId = %s AND rowIndex = %s;"

    with engine.connect() as conn:
        for tag_name, tag_index in tag_indexes.items():
            tag_name = tag_name.replace(' ', '_')  # 'loc kp' => 'loc_kp'
            query = update_query(tag_name)
            for i, table_row in enumerate(full_table_content):
                cell_content = table_row[tag_index]
                row_index = i + 1  # rows numeration starts from 1 in 'issues' table!
                result = conn.execute(query, (cell_content, table_id, row_index))
                if result.rowcount == 0:
                    print("error!")
    print('all done')


def get_text_by_table_id(table_id):
    query = '''
        SELECT combinedConText
        FROM tables
        WHERE tableId = %s;
    '''
    with engine.connect() as conn:
        tables = conn.execute(query, table_id)
    full_table_content = json.loads(list(tables)[0][0])
    return full_table_content[1:]  # exclude the headers row


def get_tag_index(table_id, tag):
    query = '''
        SELECT header_idx
        FROM headers_htags
        WHERE tableId = %s
        AND htag = %s;
    '''
    with engine.connect() as conn:
        result = conn.execute(query, (table_id, tag))
    idx = list(result)[0][0]
    return idx


def get_tag_indexes(table_id, tags):
    tag_indexes = {}
    for tag in tags:
        tag_indexes[tag] = get_tag_index(table_id, tag)
    return tag_indexes


if __name__ == "__main__":
    indexes = get_tag_indexes(target_table_id, target_tags)
    table_text = get_text_by_table_id(target_table_id)
    update_issues(target_table_id, indexes, table_text)
