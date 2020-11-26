from sqlalchemy import create_engine
from ast import literal_eval
import pandas as pd
import os

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

if __name__ == "__main__":
    #populate_consultant_table()
    #populate_pdfsconsultants_table()
    #populate_location_table()
    insert_pipelineName()