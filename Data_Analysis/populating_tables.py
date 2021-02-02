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

if __name__ == "__main__":
    #populate_consultant_table()
    #populate_pdfsconsultants_table()
    #populate_location_table()
    #insert_pipelineName()
    #populate_landuse_table()
    #read_complete_issues()
    #update_status_column()