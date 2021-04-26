from sqlalchemy import create_engine
from ast import literal_eval
import pandas as pd
import os
import re

# Importing environmental variables library that reads from the .env file
from dotenv import load_dotenv

# Loading key-value pairs from the .env file into the OS environment
load_dotenv()

# Reading the key-value pairs from the OS environment
user = os.getenv("DB_USER")
password = os.getenv("DB_PASS")
db_hostname = os.getenv("DB_HOST")
db_name = os.getenv("DB_DATABASE")

# Using those variables in the connection string using "F" strings
conn_string = f"mysql+mysqldb://{user}:{password}@{db_hostname}/{db_name}?charset=utf8mb4"
engine = create_engine(conn_string)

def read_data():
    df = pd.read_csv('consultant_name.csv')
    df.consultant_name = df.consultant_name.apply(lambda s: literal_eval(s))
    return df

def consultant_set():
    data = read_data()
    consultants = []
    for row in data.itertuples():
        for consultant in row.consultant_name:
            consultants.append(consultant) if consultant not in consultants else consultants
    return consultants


def populate_consultant_table():
    consultant_list = consultant_set()
    insert_query = f"INSERT INTO consultants (consultantName) VALUES (%s);"
    with engine.connect() as conn:
        for consultant in consultant_list:
            conn.execute(insert_query, (consultant))            
    print("Done")

def populate_pdfsconsultants_table():
    insert_pdfname_consultant_query = 'INSERT INTO pdfsconsultants (pdfName, consultantName) VALUES (%s, %s);'
    data = read_data()
    consultant_dict = dict(zip(data.pdfName, data.consultant_name))
    with engine.connect() as conn:
        for pdfname, consultants in consultant_dict.items():
            for consultant in consultants:
                conn.execute(insert_pdfname_consultant_query, (pdfname, consultant))
                print(f"Added {consultant} for {pdfname}")
    print("Done")

def populate_location_table():
    df = pd.read_csv("locations.csv", encoding='utf8')
    df.to_sql('locations', con = engine,index=False,if_exists='append')
    print("Done")

def read_pipelinedata():
    df = pd.read_csv('pipelineName.csv')
    return df
    
def insert_pipelineName():
    set_query = 'UPDATE issues SET pipelineName = %s WHERE tableId = %s;'
    data = read_pipelinedata()
    pipelineName_dict = dict(zip(data.tableId, data.pipelineName))
    with engine.connect() as conn:
        for tableId, pipelineName in pipelineName_dict.items():
            conn.execute(set_query, (pipelineName, tableId))
            print(f"Added {pipelineName} for {tableId}")
    print("Done")

def populate_landuse_table():
    df = pd.read_csv("landUse.csv", encoding='utf8')
    df.to_sql('landuse', con = engine,index=False,if_exists='append')
    print("Done")

def read_complete_issues():
    query = "SELECT distinct i.tableId, i.rowIndex, i.vec_pri, i.vec_sec, i.status_bin, i.status, i.status_txt, i.issue_pri, i.issue_sec, p.company, pc.consultantName, pr.application_title_short FROM issues i LEFT JOIN locations l ON i.tableId = l.tableId and i.rowIndex = l.rowIndex LEFT JOIN tables t ON i.tableId = t.headTable LEFT JOIN pdfs p ON t.pdfName = p.pdfName LEFT JOIN projects pr ON p.application_id = pr.application_id LEFT JOIN pdfsconsultants pc ON p.pdfName = pc.pdfName LEFT JOIN tables_tags tt ON t.tableId = tt.tableId WHERE locFormat = 'DLS' AND i.issue_pri NOT IN ('-', '?', 'ESC') AND CONCAT(i.issue_pri,i.issue_sec) <> '----' AND CONCAT(i.issue_pri,i.issue_sec) <> '' AND status_bin NOT IN ('--', '-', '') AND status_bin IS NOT NULL;"
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    return df

def update_status_column():
    data = read_complete_issues().to_dict('records')
    resolved_words = ['resolved', 'r', 'no issue', 'no issues']
    unresolved_words = ['unresolved', 'u']
    for item in data:
        for resolved_word in resolved_words:
            if re.search(r'\b' + resolved_word + r'\b', item['status_bin'].lower()):
                item['status'] = 'Resolved'
            else:
                for unresolved_word in unresolved_words:
                    if re.search(r'\b' + unresolved_word + r'\b', item['status_bin'].lower()):
                        item['status'] = 'Unresolved'
    update_status_query = 'UPDATE issues SET status = %s WHERE tableId = %s and rowIndex = %s;'
    with engine.connect() as conn:
        for item in data:
            conn.execute(update_status_query, (item['status'], item['tableId'], item['rowIndex']))
    print("Done")

def read_landUseCompany():
    df = pd.read_csv('land_use_company.csv', encoding='cp1252')
    return df
    
def insert_standardizedLandUse():
    set_query = 'UPDATE issues SET land_use_standardized = %s WHERE land_use = %s;'
    data = read_landUseCompany()
    landUseCompany_dict = dict(zip(data.land_use, data.standardized_land_use))
    with engine.connect() as conn:
        for land_use, standardized_land_use in landUseCompany_dict.items():
            conn.execute(set_query, (standardized_land_use, land_use))
            print(f"Added {standardized_land_use} for {land_use}")
    print('Done')

def read_parsed_issues_data():
    os.chdir('c:\\Users\\t1nipun\\Desktop\\PCMR\\human-robot\\Data_Analysis')
    df = pd.read_csv('issue_parsed_clean.csv', keep_default_na = False)
    return df

def populate_issues_parsed_table():
    insert_parsed_issue = 'INSERT INTO issues_parsed (tableId, rowIndex, rowCounter, status_txt, issue_parsed) VALUES (%s, %s, %s, %s, %s);'
    data = read_parsed_issues_data()
    with engine.connect() as conn:
        for row in data.itertuples():
            conn.execute(insert_parsed_issue, (row.tableId, row.rowIndex, row.rowCounter, row.status_txt, row.issues))
    print("Done")

def read_bert_status_labels():
    os.chdir('c:\\Users\\t1nipun\\Desktop\\PCMR\\human-robot\\Data_Analysis')
    df = pd.read_csv('status_labels.csv', encoding='utf-8-sig', keep_default_na = False)
    return df

def populate_bert_status_labels():
    read_issues_query = "SELECT * FROM pcmr.issues where tableId NOT IN ('02db9f91-572a-44af-9858-4add101353c1','03bfc26a-c6d0-4761-b8f5-47acf2290d02', '082134c0-6a4b-425b-a4ae-e79acd7316cb', '0d10a967-88d6-42e5-9bd7-309f24022b5f', '333e1e53-8897-41fa-acbd-86be8afb31c7', '35bd2caf-562c-4d14-a5d6-373f168b4acb', '397db969-9996-4d9e-bb05-6df69d0fe4a4', '417546c4-dacf-4c12-ae75-4dc4e656e198', '491c36c1-82d4-46ae-a684-470915a5659b', '60b3993d-7075-4790-8519-ba8193579754', '64a7ba33-ceee-4593-87a3-8f08dd46c8f4', '67691780-af41-414b-a0c2-aa33a3442cdc', '6a2f1370-1cd5-4ebb-a4bd-a1fe9d5a516a', '6b437f67-967b-4ef6-bd28-5ac8d39138e4', '77cc0b8d-8244-4622-8d9d-a56daf6069e8', '8bb683d9-f7ee-4a54-ad3d-dddc61ccdfcf', '9476acc2-294a-4cd6-a952-8274aedb645a', 'a6623233-9c9f-436b-ad11-0987ab3825e7', 'c04807de-2df1-4d26-9352-70d3cb6cb10b', 'cb197d7e-3ef6-4ee0-93d1-504c7286b580', 'f143c6b8-cf77-41c1-88b2-e7c97ba657c1', 'f2ebd484-4ec2-4481-907d-17334ca4657f', 'f4db9fc5-3a73-499a-ab1e-ab643530ea99', 'fdb3d057-943a-4fab-99ac-1f4eed471512', '44a33e5f-d99e-48ef-ad56-bbb516ec8796', 'bfafbfd0-8bb5-4283-8f5e-dd7cbcec480c');"
    update_bert_status_query = 'UPDATE issues SET status = %s WHERE tableId = %s and rowIndex = %s;'
    with engine.connect() as conn:
        issues_df = pd.read_sql(read_issues_query, conn)
        for row in issues_df.itertuples():
            if pd.isna(row.status):
                data = read_bert_status_labels()
                for issue in data.itertuples():
                    conn.execute(update_bert_status_query, (issue.status, issue.tableId, issue.rowIndex))
    print("Done")

def populate_status_issue_parsed():
    update_bert_status_query = 'UPDATE issues_parsed SET status_issue_parsed = %s WHERE tableId = %s and rowIndex = %s and rowCounter = %s;'
    data = read_bert_status_labels()
    with engine.connect() as conn:
        for issue in data.itertuples():
            conn.execute(update_bert_status_query, (issue.status, issue.tableId, issue.rowIndex, issue.rowCounter))
    print('Done')

def populate_prob_issues_table():
    update_bert_status_query = 'UPDATE issues SET unres_prob = %s, res_prob = %s WHERE tableId = %s and rowIndex = %s;'
    data = read_bert_status_labels()
    with engine.connect() as conn:
        for issue in data.itertuples():
            try:
                conn.execute(update_bert_status_query, (issue.unresolved_prob, issue.resolved_prob, issue.tableId, issue.rowIndex))
            except:
                pass
    print("Done")

def populate_prob_issue_parsed_table():
    update_bert_status_query = 'UPDATE issues_parsed SET status_issue_parsed = %s, unres_prob = %s, res_prob = %s WHERE tableId = %s and rowIndex = %s and rowCounter = %s;'
    data = read_bert_status_labels()
    with engine.connect() as conn:
        for issue in data.itertuples():
            conn.execute(update_bert_status_query, (issue.status, issue.unresolved_prob, issue.resolved_prob, issue.tableId, issue.rowIndex, issue.rowCounter))
    print('Done')

def delete_status_labels_issues_table():
    update_status_query = 'UPDATE issues SET status = NULL, unres_prob = NULL, res_prob = NULL WHERE tableId = %s;'
    read_tables_query = "SELECT * FROM pcmr.issues where tableId IN ('02db9f91-572a-44af-9858-4add101353c1','03bfc26a-c6d0-4761-b8f5-47acf2290d02', '082134c0-6a4b-425b-a4ae-e79acd7316cb', '0d10a967-88d6-42e5-9bd7-309f24022b5f', '333e1e53-8897-41fa-acbd-86be8afb31c7', '35bd2caf-562c-4d14-a5d6-373f168b4acb', '397db969-9996-4d9e-bb05-6df69d0fe4a4', '417546c4-dacf-4c12-ae75-4dc4e656e198', '491c36c1-82d4-46ae-a684-470915a5659b', '60b3993d-7075-4790-8519-ba8193579754', '64a7ba33-ceee-4593-87a3-8f08dd46c8f4', '67691780-af41-414b-a0c2-aa33a3442cdc', '6a2f1370-1cd5-4ebb-a4bd-a1fe9d5a516a', '6b437f67-967b-4ef6-bd28-5ac8d39138e4', '77cc0b8d-8244-4622-8d9d-a56daf6069e8', '8bb683d9-f7ee-4a54-ad3d-dddc61ccdfcf', '9476acc2-294a-4cd6-a952-8274aedb645a', 'a6623233-9c9f-436b-ad11-0987ab3825e7', 'c04807de-2df1-4d26-9352-70d3cb6cb10b', 'cb197d7e-3ef6-4ee0-93d1-504c7286b580', 'f143c6b8-cf77-41c1-88b2-e7c97ba657c1', 'f2ebd484-4ec2-4481-907d-17334ca4657f', 'f4db9fc5-3a73-499a-ab1e-ab643530ea99', 'fdb3d057-943a-4fab-99ac-1f4eed471512', '44a33e5f-d99e-48ef-ad56-bbb516ec8796', 'bfafbfd0-8bb5-4283-8f5e-dd7cbcec480c');"
    with engine.connect() as conn:
        df = pd.read_sql(read_tables_query, conn)
        for row in df.itertuples():
            conn.execute(update_status_query, (row.tableId))
    print('Done')


if __name__ == "__main__":
    #populate_consultant_table()
    #populate_pdfsconsultants_table()
    #populate_location_table()
    #insert_pipelineName()
    #populate_landuse_table()
    #read_complete_issues()
    #update_status_column()
    #insert_standardizedLandUse()
    #read_parsed_issues_data()
    #populate_issues_parsed_table()
    #read_bert_status_labels()
    #populate_bert_status_labels()
    #populate_status_issue_parsed()
    delete_status_labels_issues_table()
    #populate_prob_issues_table()
    #populate_prob_issue_parsed_table()