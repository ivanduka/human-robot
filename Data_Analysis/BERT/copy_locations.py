from sqlalchemy import create_engine
import pandas as pd
import json
from pathlib import Path
import re
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

def copy_locations_down():
    get_query = '''
        SELECT tableId, rowIndex, number
        FROM locations;
    '''
    insert_query = f"INSERT INTO locations (number) VALUES (%s);"
    with engine.connect() as conn:
        df = pd.read_sql(get_query, conn)
        for i, row in enumerate(df.itertuples(), 1):
            if i >= 2:
                print(i, row.number)
                # if row.tableId[i] == row.tableId[i-1] and row.number[i] =="":
                #     print("do this")

    # insert_query = f"INSERT INTO locations (number) VALUES (%s);"

    #     for table in tables:
    #         t = json.loads(table.combinedConText)
    #         last_vec = t[1][-3]
    #         last_gis = t[1][-2]
    #         last_topic = t[1][-1]
    #         for i, row in enumerate(t):
    #             vec = row[-3]
    #             gis = row[-2]
    #             topic = row[-1]
    #             if i >= 2:
    #                 if vec == "":
    #                     t[i][-3] = last_vec
    #                 if gis == "":
    #                     t[i][-2] = last_gis
    #                 if topic == "":
    #                     t[i][-1] = last_topic
    #                 last_vec = t[i][-3]
    #                 last_gis = t[i][-2]
    #                 last_topic = t[i][-1]

    #         conn.execute(set_query, (json.dumps(t), table.tableId))
    # print(f"Done copying VEC, GIS, Topic for {len(tables)} tables.")

if __name__ == "__main__":
    copy_locations_down()