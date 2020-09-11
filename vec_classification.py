from processing import engine
import re
import qprompt

# VECs and associated keywords
keywords = {
    "physical": ["physical"],
    "soil": ["soil erosion subsidence compaction"],
    "vegetation": ["vegetation thistle chamomile spurge ragweed weeds plant re-seeding"],
    "water": ["water drainage watercourse creek river"],
    "fish": ["fish"],
    "wetlands": ["wetland"],
    "wildlife": ["wildlife"],
    "species": ["species rare"],
    "air": ["air"],
    "acoustic": ["acoustic"],
    "heritage": ["heritage"],
    "navigation": ["navigation"],
}

generic_vec_name = 'generic'


def regexify(key_phrase):
    return re.compile(rf"\b{key_phrase.lower()}\b")


def get_vecs_and_keywords():
    vecs_query = 'SELECT vec, short_name FROM vecs ORDER BY test_order;'
    keywords_query = "SELECT key_phrase FROM keywords WHERE vec = %s;"
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
        SELECT tableId, rowIndex, issue_pri, issue_sec, vec
        FROM issues
        ORDER BY tableId, rowIndex;
    '''
    reg = re.compile(r"[^a-z0-9-']+")
    with engine.connect() as conn:
        rows = conn.execute(query)
        results = []
        for row in rows:
            table_id = row[0]
            row_index = row[1]
            issue_pri = row[2]
            issue_sec = row[3]
            vec = row[4]
            text = re.sub(reg, " ", f"{issue_pri} {issue_sec}".lower()).strip()
            results.append({"table_id": table_id, "row_index": row_index, "text": text, "prev_vec": vec})
        return results


def classify_issue(vecs, issue):
    for vec in vecs:
        for regexp in vec["keywords"]:
            if regexp.search(issue['text']):
                return vec['vec']
    return ""


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
    update_vec_query = 'UPDATE issues SET vec = %s WHERE tableId = %s AND rowIndex = %s;'
    add_new_keyword_query = 'INSERT INTO keywords (vec, key_phrase) VALUES (%s, %s);'
    issues = get_issues()
    vecs = get_vecs_and_keywords()
    total = len(issues)
    with engine.connect() as conn:
        for index, issue in enumerate(issues):
            if issue['prev_vec'] == generic_vec_name:
                continue
            while True:
                result = classify_issue(vecs, issue)
                if result != "":
                    conn.execute(update_vec_query, result, issue['table_id'], issue['row_index'])
                    break
                print(f"====================================")
                print(f"# Processed {index}/{total} issues")
                print(f"------------------------------------")
                print(f"Not found a match for {issue['table_id']} at {issue['row_index']} with text:")
                print(f"------------------------------------")
                print(issue['text'])
                print(f"====================================")
                vec, key_phrase = get_choice(vecs)
                if vec == generic_vec_name:
                    conn.execute(update_vec_query, generic_vec_name, issue['table_id'], issue['row_index'])
                    break
                conn.execute(add_new_keyword_query, (vec, key_phrase))
                for v in vecs:
                    if v['vec'] == vec:
                        v['keywords'].append(regexify(key_phrase))

    print("SUCCESS! ALL FOUND! :)")


if __name__ == "__main__":
    run_classification()
