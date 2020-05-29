import re
import PyPDF2
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import text, create_engine
from multiprocessing import Pool
import os
import pandas as pd
import time
from tika import parser
from wand.image import Image
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
import camelot
from uuid import uuid4
import traceback
import json
import numpy as np

pdfs_and_projects_file = Path("pdfs_table.csv")
pdf_files_folder = Path("//luxor/data/board/Dev/PCMR/pdf_files")
csv_tables_folder = Path("//luxor/data/board/Dev/PCMR/csv_tables")
jpg_tables_folder = Path("//luxor/data/board/Dev/PCMR/jpg_tables")

if not pdf_files_folder.exists():
    raise Exception(f"{pdf_files_folder} does not exist!")
elif not jpg_tables_folder.exists():
    raise Exception(f"{jpg_tables_folder} does not exist!")
elif not csv_tables_folder.exists():
    raise Exception(f"{csv_tables_folder} does not exist!")

load_dotenv()
host = os.getenv("DB_HOST")
database = os.getenv("DB_DATABASE")
user = os.getenv("DB_USER")
password = os.getenv("DB_PASS")
engine_string = f"mysql+mysqldb://{user}:{password}@{host}/{database}?charset=utf8mb4"
engine = create_engine(engine_string)
engine2_string = f"mssql+pyodbc://psql23cap/CS_Prod?driver=SQL+Server+Native+Client+11.0"
engine2 = create_engine(engine2_string)


############################################################################
# The following code is for importing PDFs to the DB to commence capturing
############################################################################


def insert_pdf(args):
    buf = StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        pdf_path, engine_string_, engine2_string_ = args
        pdf_path = Path(pdf_path)
        engine_ = create_engine(engine_string_)
        engine2_ = create_engine(engine2_string_)

        def get_number_of_pages():
            with pdf_path.open("rb") as pdf:
                reader = PyPDF2.PdfFileReader(pdf)
                if reader.isEncrypted:
                    reader.decrypt("")
                total_pages = reader.getNumPages()
                return total_pages

        def check_if_file_is_in_db_already():
            with engine_.connect() as conn_:
                stmt = text("SELECT * FROM pcmr.pdfs WHERE pdfName = :pdf_name;")
                result_ = conn_.execute(stmt, {"pdf_name": pdf_path.stem})
                return True if result_.rowcount > 0 else False

        # noinspection SqlResolve
        def get_pdf_metadata():
            stmt = text("SELECT ParentID, DataID, CreateDate FROM Regulatory_Untrusted._RegDocs.DTreeCore"
                        " WHERE Name LIKE :file_name;")
            with engine2_.connect() as conn_:
                df = pd.read_sql(stmt, conn_, params={"file_name": pdf_path.stem + "%"})
            return df.to_dict("records")[0]

        try:
            if check_if_file_is_in_db_already():
                return

            metadata = get_pdf_metadata()
            metadata["pdf_name"] = pdf_path.stem
            metadata["pdf_size"] = int(pdf_path.stat().st_size / 1024 / 1024 * 100) / 100
            metadata["total_pages"] = get_number_of_pages()
            metadata["xmlContent"] = parser.from_file(str(pdf_path), xmlContent=True)["content"]

            with engine_.connect() as conn:
                statement = text("INSERT INTO pdfs (pdfId, pdfName, pdfSize, filingId, date, totalPages, xmlContent) " +
                                 "VALUE (:DataID,:pdf_name,:pdf_size,:ParentID,:CreateDate,:total_pages, :xmlContent);")
                result = conn.execute(statement, metadata)
            print(f"{pdf_path.stem}: successfully inserted {result.rowcount} rows")
        except Exception as e:
            print(f"{pdf_path.stem}: ERROR! {e}")
            traceback.print_tb(e.__traceback__)
        finally:
            return buf.getvalue()


def insert_pdfs():
    pdf_files = list(pdf_files_folder.glob("*.pdf"))
    args = [(pdf, engine_string, engine2_string) for pdf in pdf_files]
    print(f"Items to process: {len(args)}")
    start_time = time.time()

    # Sequential mode
    # for arg in args[:]:
    #     result = insert_pdf(arg)
    #     print(result[:-1])

    # Multiprocessing mode
    with Pool() as pool:
        results = pool.map(insert_pdf, args, chunksize=1)
    for result in results:
        print(result, end='', flush=True)

    duration = round(time.time() - start_time)
    print(
        f"Done {len(args)} in {duration} seconds ({round(duration / 60, 2)} min or {round(duration / 3600, 2)} hours)"
    )


#############################################################################
# The following code is for processing the tables after capturing is done
#############################################################################


# CAREFUL! DELETES **ALL** THE TABLES!!!
# def delete_all_tables():
#     with engine.connect() as conn:
#         result = conn.execute("DELETE FROM tables;")
#         print(f"Deleted {result.rowcount} tables from DB")


# CAREFUL! DELETES **ALL** THE CSVs AND JPGs, and resets the CORRECT_CSV fields!!!
# noinspection SqlWithoutWhere
def delete_csvs_and_images():
    with engine.connect() as conn:
        result = conn.execute("DELETE FROM csvs;")
        print(f"Deleted {result.rowcount} csvs from DB")
        result = conn.execute("UPDATE tables SET csvsExtracted = NULL WHERE csvsExtracted IS NOT NULL;")
        print(f"Reset {result.rowcount} tables (csvsExtracted) from DB")
        csvs = list(csv_tables_folder.glob("*.csv"))
        for f in csvs:
            f.unlink()
        print(f"Deleted {len(csvs)} CSV files")

        result = conn.execute("UPDATE tables SET correct_csv = NULL WHERE correct_csv IS NOT NULL;")
        print(f"Reset {result.rowcount} tables (correct_csv) from DB")

        result = conn.execute("UPDATE tables SET imageExtracted = NULL WHERE imageExtracted IS NOT NULL;")
        print(f"Reset {result.rowcount} tables (imageExtracted) from DB")
        csvs = list(jpg_tables_folder.glob("*.jpg"))
        for f in csvs:
            f.unlink()
        print(f"Deleted {len(csvs)} JPG files")


def populate_coordinate(table):
    try:
        with engine.connect() as conn:
            pdf = pdf_files_folder.joinpath(f"{table['pdfName']}.pdf").resolve()
            with Image(filename=f"{pdf}[{table['page'] - 1}]") as i:
                pdf_width = i.width
                pdf_height = i.height

            x1 = int(table["x1"] * pdf_width / table["pageWidth"])
            x2 = int(table["x2"] * pdf_width / table["pageWidth"])
            y1 = int(table["y1"] * pdf_height / table["pageHeight"])
            y2 = int(table["y2"] * pdf_height / table["pageHeight"])

            query = (f"UPDATE tables SET pdfWidth={pdf_width}, pdfHeight={pdf_height}, pdfX1={x1}," +
                     f"pdfX2={x2}, pdfY1={y1}, pdfY2={y2} WHERE tableId='{table['tableId']}';")
            conn.execute(query)
    except Exception as e:
        print(f"Error for {table['pdfName']} - page {table['page']}: {e}")


def populate_coordinates():
    start_time = time.time()
    statement = text("SELECT * FROM tables WHERE pdfX1 IS NULL;")
    with engine.connect() as conn:
        df = pd.read_sql(statement, conn)
    tables = df.to_dict("records")
    print(f"Populating coordinates on {len(tables)} tables:")

    # for table in tables:
    #     populate_coordinate(table)

    with Pool() as pool:
        pool.map(populate_coordinate, tables, chunksize=1)

    dur = round(time.time() - start_time)
    print(f"Done {len(tables)} in {dur} seconds ({round(dur / 60, 2)} min or {round(dur / 3600, 2)} hours)")


def extract_image(args):
    buf = StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        table, engine_string_, pdf_files_folder_string, jpg_tables_folder_string = args
        pdf_files_folder_ = Path(pdf_files_folder_string)
        jpg_tables_folder_ = Path(jpg_tables_folder_string)
        engine_ = create_engine(engine_string_)

        try:
            pdf_file_path = pdf_files_folder_.joinpath(f'{table["pdfName"]}.pdf')
            img_arg_string = f'{pdf_file_path.resolve()}[{table["page"] - 1}]'
            with Image(filename=img_arg_string, resolution=300) as img:
                left = round(table["pdfX1"] * img.width / table["pdfWidth"])
                top = round((table["pdfHeight"] - table["pdfY1"]) * img.height / table["pdfHeight"])
                right = round(table["pdfX2"] * img.width / table["pdfWidth"])
                bottom = round((table["pdfHeight"] - table["pdfY2"]) * img.height / table["pdfHeight"])
                img.crop(left=left, top=top, right=right, bottom=bottom)
                img.format = "jpg"
                img.save(filename=jpg_tables_folder_.joinpath(f'{table["tableId"]}.jpg'))
                with engine_.connect() as conn:
                    statement = text("UPDATE tables SET imageExtracted = 'done' WHERE tableId = :tableId;")
                    conn.execute(statement, {"tableId": table["tableId"]})
        except Exception as e:
            print(f'Error extracting {table["tableId"]}: {e}')
            traceback.print_tb(e.__traceback__)
        finally:
            return buf.getvalue()


def extract_images():
    statement = text("SELECT * FROM tables WHERE imageExtracted IS NULL AND pdfX1 IS NOT NULL;")
    with engine.connect() as conn:
        df = pd.read_sql(statement, conn)
        tables = df.to_dict("records")

    args = [(table, engine_string, str(pdf_files_folder),
             str(jpg_tables_folder)) for table in tables]

    print(f"Extracting {len(args)} images:")
    start_time = time.time()

    # Sequential mode
    # results = [ext_funcs.extract_image(arg) for arg in args]

    # Multiprocessing mode
    with Pool() as pool:
        results = pool.map(extract_image, args, chunksize=1)

    for result in results:
        print(result, end='', flush=True)

    dur = round(time.time() - start_time)
    print(f"Done {len(args)} in {dur} seconds ({round(dur / 60, 2)} min or {round(dur / 3600, 2)} hours)")


def create_args_for_csv_extraction():
    statement = text("SELECT * FROM tables WHERE pdfX1 IS NOT NULL AND csvsExtracted IS NULL;")
    with engine.connect() as conn:
        df = pd.read_sql(statement, conn)
        tables = df.to_dict("records")

    args = [(table, engine_string, str(pdf_files_folder),
             str(csv_tables_folder)) for table in tables]
    return args


def extract_csv(args):
    # noinspection PyTypeChecker
    def cleanup_df(df):
        def row_has_content(row):
            r = re.compile(r"\S")  # Any non-whitespace character
            for cell in row:
                if r.search(cell):
                    return True
            return False

        def remove_cid(rows_):
            r = re.compile(r"\(cid:\d+\)")
            return [[re.sub(r, " ", cell) for cell in row] for row in rows_]

        output = df.values.tolist()
        output = remove_cid(output)
        output = [row for row in output if row_has_content(row)]
        output = pd.DataFrame(output).T.values.tolist()
        output = [row for row in output if row_has_content(row)]
        output = pd.DataFrame(output).T
        return output

    buf = StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        table, engine_string_, pdf_files_folder_string, csv_tables_folder_string = args
        pdf_files_folder_ = Path(pdf_files_folder_string)
        csv_tables_folder_ = Path(csv_tables_folder_string)
        engine_ = create_engine(engine_string_)

        def save_table(tables_, method_):
            if not tables_ or len(tables_) != 1:
                return print(f"{table['tableId']}: ERROR! found {len(tables_)} tables with {method_}")
            csv_id = str(uuid4())
            csv_table = tables_[0]
            csv_file_name = csv_tables_folder_.joinpath(f"{csv_id}.csv")
            df = csv_table.df
            df = cleanup_df(df)
            csv_rows, csv_columns = df.shape
            if csv_rows == 0 or csv_columns == 0:
                return
            csv_headers = json.dumps(df.iloc[0].tolist())
            csv_text = df.to_json(None, orient='values')
            df.to_csv(csv_file_name, index=False, header=False, encoding="utf-8-sig")

            with engine_.connect() as conn_:
                stmt = text(
                    "INSERT INTO csvs (csvId, tableId, method, csvHeaders, csvRows, csvColumns, csvText) " +
                    "VALUE (:csvId, :tableId, :method, :csvHeaders, :csvRows, :csvColumns, :csvText);")
                params = {"csvId": csv_id, "tableId": table["tableId"], "method": method_, "csvHeaders": csv_headers,
                          "csvRows": csv_rows, "csvColumns": csv_columns, "csvText": csv_text}
                conn_.execute(stmt, params)

        try:
            pdf_file_path = pdf_files_folder_.joinpath(f"{table['pdfName']}.pdf")
            table_areas = [f"{table['pdfX1']},{table['pdfY1']},{table['pdfX2']},{table['pdfY2']}"]

            try:
                method = "lattice-v"
                tables = camelot.read_pdf(str(pdf_file_path), table_areas=table_areas, pages=str(table['page']),
                                          strip_text='\n', line_scale=40, flag_size=True, copy_text=['v'], )
                save_table(tables, method)
            except Exception as e:
                t_id = table['tableId']
                p = table['page']
                print(f"Table {t_id} csvs extraction error on page {p} with method {method}: {e}")

            try:
                method = "stream"
                tables = camelot.read_pdf(str(pdf_file_path), table_areas=table_areas, pages=str(table['page']),
                                          strip_text='\n', flavor="stream", flag_size=True)
                save_table(tables, method)
            except Exception as e:
                t_id = table['tableId']
                p = table['page']
                print(f"Table {t_id} csvs extraction error on page {p} with method {method}: {e}")

            with engine_.connect() as conn:
                statement = text("UPDATE tables SET csvsExtracted = 'done' WHERE tableId = :tableId;")
                conn.execute(statement, {"tableId": table['tableId']})
        except Exception as e:
            print(f"Table {table['tableId']} csvs extraction error on page {table['page']}: {e}")
            traceback.print_tb(e.__traceback__)
        finally:
            return buf.getvalue()


def extract_csvs():
    statement = text("SELECT * FROM tables WHERE pdfX1 IS NOT NULL AND csvsExtracted IS NULL;")
    with engine.connect() as conn:
        df = pd.read_sql(statement, conn)
        tables = df.to_dict("records")

    args = [(table, engine_string, str(pdf_files_folder),
             str(csv_tables_folder)) for table in tables]

    print(f"Extracting CSVs for {len(args)} tables:")
    start_time = time.time()

    # Sequential mode
    # for arg in args:
    #     print(extract_csv(arg))

    # Multiprocessing mode
    with Pool() as pool:
        results = pool.map(extract_csv, args, chunksize=1)
    for result in results:
        print(result, end='', flush=True)

    dur = round(time.time() - start_time)
    print(f"Done {len(args)} in {dur} seconds ({round(dur / 60, 2)} min or {round(dur / 3600, 2)} hours)")


def add_csv_manually(table_id, csv_id, csv_path):
    if not Path(csv_path).exists():
        return print(f"{table_id} does not exist!")
    csv_file_name = csv_tables_folder.joinpath(f"{csv_id}.csv")
    df = pd.read_csv(csv_path, header=None)
    df = df.replace({np.nan: None})
    csv_rows, csv_columns = df.shape
    csv_headers = json.dumps(df.iloc[0].tolist())
    csv_text = df.to_json(None, orient='values')
    df.to_csv(csv_file_name, index=False, header=False, encoding="utf-8-sig")

    with engine.connect() as conn:
        stmt = text(
            "INSERT INTO csvs (csvId, tableId, method, csvHeaders, csvRows, csvColumns, csvText) " +
            "VALUE (:csvId, :tableId, :method, :csvHeaders, :csvRows, :csvColumns, :csvText);")
        params = {"csvId": csv_id, "tableId": table_id, "method": "manual", "csvHeaders": csv_headers,
                  "csvRows": csv_rows, "csvColumns": csv_columns, "csvText": csv_text}
        conn.execute(stmt, params)
    print(f"Inserted CSV ID {csv_id} for table {table_id}")


def apply_default_validation(table_id):
    preferred_method = "lattice-v"

    def set_default(csv):
        stmt = "UPDATE tables SET correct_csv = %s WHERE tableId = %s;"
        with engine.connect() as conn_:
            result = conn_.execute(stmt, (csv.csvId, table_id))
            if result.rowcount != 1:
                raise Exception(f"Error setting up the default correct_csv for {table_id}")

    query = "SELECT t.tableId, c.csvId, c.method FROM tables t LEFT JOIN csvs c " \
            "USING(tableId) WHERE t.tableId = %s ORDER BY method;"
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params=(table_id,))

    # handling the only option or if the first row is the preferred method
    if df.shape[0] == 1 or df.iloc[0].method == preferred_method:
        return set_default(df.iloc[0])

    if df.iloc[1].method == preferred_method:
        return set_default(df.iloc[1])

    raise Exception(f"Invalid arguments for {table_id}")


def apply_default_validations():
    stmt = "SELECT tableId FROM tables WHERE csvsExtracted = 'done' AND correct_csv IS NULL and relevancy = 1;"
    with engine.connect() as conn:
        df = pd.read_sql(stmt, conn)
    table_ids = df["tableId"].tolist()

    print(f"Applying default validation for {len(table_ids)} tables:")

    # for table_id in table_ids:
    #     apply_default_validation(table_id)

    with Pool() as pool:
        pool.map(apply_default_validation, table_ids, chunksize=1)

    print(f"Done {len(table_ids)}.")


def delete_unreferenced_csvs_and_jpgs():
    print(f"Starting the cleanup of unreferenced CSVs and JPGs...")
    stmt1 = "SELECT csvId FROM csvs;"
    stmt2 = "SELECT tableId FROM tables;"
    with engine.connect() as conn:
        df1 = pd.read_sql(stmt1, conn)
        df2 = pd.read_sql(stmt2, conn)
    csv_ids = set(df1["csvId"].tolist())
    table_ids = set(df2["tableId"].tolist())

    csvs = csv_tables_folder.glob("*.csv")
    jpgs = jpg_tables_folder.glob("*.jpg")

    counter1 = 0
    for csv in csvs:
        if csv.stem not in csv_ids:
            print(f"Removing CSV {csv}")
            counter1 += 1
            csv.unlink()
    counter2 = 0
    for jpg in jpgs:
        if jpg.stem not in table_ids:
            print(f"Removing JPG {jpg}")
            counter2 += 1
            jpg.unlink()

    print(f"Removed {counter1} unreferenced CSVs and {counter2} unreferenced JPGs")


def populate_projects():
    df = pd.read_csv(pdfs_and_projects_file, encoding="cp1252", header=0)
    stmt = "INSERT INTO projects (application_title, application_title_short, application_id) VALUES (%s,%s,%s)"

    items = set()
    with engine.connect() as conn:
        for row in df.itertuples():
            application_id = int(re.search(r"\d+$", row.ApplicationLink).group())
            if application_id in items:
                continue
            items.add(application_id)
            conn.execute(stmt, (row.ApplicationTitle, row.ApplicationTitleShort, application_id))


def populate_submitter():
    df = pd.read_csv(pdfs_and_projects_file, encoding="cp1252", header=0)
    stmt = "UPDATE pdfs SET submitter=%s, application_id=%s WHERE pdfId = %s"

    with engine.connect() as conn:
        for row in df.itertuples():
            if row.pdfId == 601829:
                print(row)
            application_id = int(re.search(r"\d+$", row.ApplicationLink).group())
            conn.execute(stmt, (row.pdfSubmitter, application_id, row.pdfId))


if __name__ == "__main__":
    # populate_projects()
    # insert_pdfs()
    # populate_submitter()

    # delete_csvs_and_images()
    # populate_coordinates()
    # extract_csvs()
    # extract_images()
    # add_csv_manually("c6a472e2-8b94-4f9c-ab4f-2f61ec743a11", "cd9113d6-4870-414e-a86d-c7ee40611c1e",
    #                  r"B-14R Appendix MPLA-SAPL IR 43 b) - TERA Post Construction (A1A3A2)_page.97.csv")
    # apply_default_validations()

    # delete_unreferenced_csvs_and_jpgs()
    pass
