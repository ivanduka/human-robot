from processing import engine
import json
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

skip = [
    '03bfc26a-c6d0-4761-b8f5-47acf2290d02-20',
    '093f120b-9df7-480b-8ae3-2854a3b33c84-1'
]


def make_regexps(keywords_list):
    result = {}
    for vec, words_strings in keywords_list.items():
        flat_list = []
        for words_string in words_strings:
            words = words_string.split(" ")
            for word in words:
                flat_list.append(word.lower())

        reg = rf"\b({'|'.join(flat_list)})\b"
        result[vec] = re.compile(reg)
    return result


def get_issues():
    query = '''
    SELECT tableId, rowIndex, issue_pri, issue_sec
    FROM issues WHERE issue_pri IS NOT NULL OR issue_sec IS NOT NULL;
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
            # r = re.compile(r"\(cid:\d+\)")
            # return [[re.sub(r, " ", cell) for cell in row] for row in rows_]

            text = re.sub(reg, " ", f"{issue_pri} {issue_sec}".lower()).strip()
            results.append((table_id, row_index, text))
        return results


def classify_issue(regexp_list, issue_obj, i, n):
    table_id = issue_obj[0]
    row_index = issue_obj[1]
    text = issue_obj[2]
    if f"{table_id}-{row_index}" in skip:
        return ""
    for vec, regexp in regexp_list.items():
        if regexp.search(text):
            return vec
    print(f"Processed {i} items out of {n}. NOT FOUND FOR:")
    print(f"'{table_id}-{row_index}'")
    print(text)
    exit(1)


def run_classification():
    issues = get_issues()
    regexps = make_regexps(keywords)
    total = len(issues)
    for index, issue in enumerate(issues):
        classify_issue(regexps, issue, index, total)
    print("ALL FOUND!")


if __name__ == "__main__":
    run_classification()
    # while True:
    #     menu = qprompt.Menu()
    #     menu.add("p", "Previous")
    #     menu.add("n", "Next")
    #     menu.add("q", "Quit")
    #     choice = menu.show(returns="desc")
    #     text = ''
    #     while text == '':
    #         text = qprompt.ask_str("what? ")
    #     print(choice, text)
