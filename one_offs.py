from processing import engine
import pandas as pd
import json
from pathlib import Path

pdfs_and_projects_file = Path("pdfs_table.csv")

def add_companies():
    df = pd.read_csv(pdfs_and_projects_file, encoding="cp1251")
    query = "UPDATE pdfs SET company = %s WHERE pdfId = %s;"
    with engine.connect() as conn:
        for row in df.itertuples():
            result = conn.execute(query, (row.pdfCompany, row.pdfId))
            if result.rowcount != 1:
                raise Exception(f"Problem with {row}")
    print("Done")

if __name__ == "__main__":
    add_companies()