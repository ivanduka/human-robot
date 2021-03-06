from processing import engine
import re
import qprompt
from pathlib import Path
import json
import time
from datetime import datetime

generic_vec_name = 'generic'
keywords_backup = Path("vec_classification_backup.json")


def regexify(key_phrase):
    return re.compile(rf"\b{key_phrase.lower()}\b")


def get_vecs_and_keywords():
    vecs_query = 'SELECT vec, short_name FROM vecs ORDER BY test_order;'
    keywords_query = "SELECT key_phrase FROM keywords_simple WHERE vec = %s;"
    with engine.connect() as conn:
        result = conn.execute(vecs_query)
        vecs = [{"vec": row[0], "short_name": row[1]} for row in result]
        for vec in vecs:
            results = conn.execute(keywords_query, (vec["vec"]))
            regexps = [regexify(r[0]) for r in results]
            vec["keywords"] = regexps
        return vecs


def get_issues():
    query = f'''
        SELECT tableId, rowIndex, vec_pri, vec_sec, vec_simple, issue_pri, issue_sec, content
        FROM issues
        ORDER BY tableId, rowIndex;
    '''
    reg = re.compile(r"[^a-z0-9-']+")

    def clean(text):
        return re.sub(reg, " ", str(text).lower()).strip()

    with engine.connect() as conn:
        rows = conn.execute(query)
        results = []
        for row in rows:
            table_id = row[0]
            row_index = row[1]
            vec_pri = row[2]
            vec_sec = row[3]
            vec = row[4]
            issue_pri = row[5]
            issue_sec = row[6]
            content = row[7]
            vec_pri = clean(vec_pri)
            vec_sec = clean(vec_sec)
            issue_pri = clean(issue_pri)
            issue_sec = clean(issue_sec)
            content = clean(content)
            results.append({"table_id": table_id, "row_index": row_index, "vec_pri": vec_pri, "vec_sec": vec_sec,
                            'issue_pri': issue_pri, 'issue_sec': issue_sec, "prev_vec": vec, "content": content})
        return results


def classify_issue(vecs, issue):
    def classify(text):
        for v in vecs:
            for regexp in v["keywords"]:
                if regexp.search(text):
                    return v['vec'], regexp.pattern[2:-2]  # stripping '\b' from the beginning and end
        return "", ""

    for column in ["vec_pri", "vec_sec", "issue_pri", "issue_sec"]:
        vec, keyword = classify(issue[column])
        if vec != "":
            break
    return vec, keyword


def get_choice(vecs):
    menu = qprompt.Menu()
    for vec in vecs:
        menu.add(vec["short_name"], vec['vec'])
    choice = menu.show(returns="desc")
    key_phrase = ''
    if choice != generic_vec_name:
        while key_phrase == '':
            key_phrase = qprompt.ask_str("enter key phrase: ")
    return choice, key_phrase.lower()


def run_classification():
    start_time = time.time()
    print(f'{datetime.now()}\tClassifying...')

    update_vec_query = 'UPDATE issues SET vec_simple = %s, subvec_simple = %s WHERE tableId = %s AND rowIndex = %s;'
    add_new_keyword_query = 'INSERT INTO keywords_simple (vec, key_phrase) VALUES (%s, %s);'
    issues = get_issues()
    vecs = get_vecs_and_keywords()
    total = len(issues)
    with engine.connect() as conn:
        for index, issue in enumerate(issues):
            if issue['prev_vec'] == generic_vec_name:
                continue
            while True:
                result, keyword = classify_issue(vecs, issue)
                if result != "":
                    conn.execute(update_vec_query, (result, keyword, issue['table_id'], issue['row_index']))
                    break
                print(f"====================================")
                print(f"# Processed {index}/{total} issues")
                print(f"------------------------------------")
                print(f"Not found a match for {issue['table_id']} at row {issue['row_index']} with text:")
                print(f"------------------------------------")
                for item in ['vec_pri', 'vec_sec', 'issue_pri', 'issue_sec']:
                    print(f'{item}\t\t{issue[item]}')
                print(f"====================================")
                vec, key_phrase = get_choice(vecs)
                if vec == generic_vec_name:
                    conn.execute(update_vec_query, (generic_vec_name, "", issue['table_id'], issue['row_index']))
                    break
                conn.execute(add_new_keyword_query, (vec, key_phrase))
                for v in vecs:
                    if v['vec'] == vec:
                        v['keywords'].append(regexify(key_phrase))

    print(f"{datetime.now()}\tDone {total} in {int(time.time() - start_time)} seconds")


def save_keywords_to_json():
    vecs_query = "SELECT vec FROM vecs ORDER BY test_order;"
    keywords_query = "SELECT key_phrase FROM keywords_simple WHERE vec = %s;"
    with engine.connect() as conn:
        vecs_raw = conn.execute(vecs_query)
        vecs = {v[0]: [] for v in vecs_raw}
        for v in vecs:
            keywords = conn.execute(keywords_query, (v,))
            vecs[v] = [k[0] for k in keywords]
    with keywords_backup.open("w") as f:
        json.dump(vecs, f, indent="\t")
    print("Saved.")


def restore_keywords_from_json():
    insert_query = f"INSERT INTO keywords_simple (vec, key_phrase) VALUES (%s, %s);"
    with keywords_backup.open() as f:
        vecs = json.load(f)
    with engine.connect() as conn:
        for vec, keywords in vecs.items():
            for keyword in keywords:
                try:
                    conn.execute(insert_query, (vec, keyword))
                    print(f"Added {keyword} for {vec}")
                except:
                    print(f"Already in DB: {keyword} for {vec}")
    print("Done")


if __name__ == "__main__":
    run_classification()
    # save_keywords_to_json()  # CAREFUL!
    # restore_keywords_from_json()  # CAREFUL!
    pass
