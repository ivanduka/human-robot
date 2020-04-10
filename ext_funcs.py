from wand.image import Image
from sqlalchemy import text, create_engine
from io import StringIO
import sys
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
import camelot
from uuid import uuid4
import pandas as pd
import traceback
import json
import re


def cleanup_df(df):
    r = re.compile("\S")  # Any non-whitespace character

    def row_has_content(row):
        for cell in row:
            if r.search(cell):
                return True
        return False

    result = df.values.tolist()
    result = [row for row in result if row_has_content(row)]
    result = pd.DataFrame(result).T.values.tolist()
    result = [row for row in result if row_has_content(row)]
    result = pd.DataFrame(result).T
    return result


def extract_image(args):
    buf = StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        table, engine_string, pdf_files_folder_string, jpg_tables_folder_string = args
        pdf_files_folder = Path(pdf_files_folder_string)
        jpg_tables_folder = Path(jpg_tables_folder_string)
        engine = create_engine(engine_string)

        try:
            pdf_file_path = pdf_files_folder.joinpath(f'{table["pdfName"]}.pdf')
            img_arg_string = f'{pdf_file_path.resolve()}[{table["page"] - 1}]'
            with Image(filename=img_arg_string, resolution=300) as img:
                left = round(table["pdfX1"] * img.width / table["pdfWidth"])
                top = round((table["pdfHeight"] - table["pdfY1"]) * img.height / table["pdfHeight"])
                right = round(table["pdfX2"] * img.width / table["pdfWidth"])
                bottom = round((table["pdfHeight"] - table["pdfY2"]) * img.height / table["pdfHeight"])
                img.crop(left=left, top=top, right=right, bottom=bottom)
                img.format = "jpg"
                img.save(filename=jpg_tables_folder.joinpath(f'{table["tableId"]}.jpg'))
                with engine.connect() as conn:
                    statement = text("UPDATE tables SET imageExtracted = 'done' WHERE tableId = :tableId;")
                    result = conn.execute(statement, {"tableId": table["tableId"]})
                print(f'Successfully inserted {result.rowcount} rows for {table["tableId"]}')
        except Exception as e:
            print(f'Error extracting {table["tableId"]}: {e}')
        finally:
            return buf.getvalue()


def extract_csv(args):
    buf = StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        table, engine_string, pdf_files_folder_string, csv_tables_folder_string = args
        pdf_files_folder = Path(pdf_files_folder_string)
        csv_tables_folder = Path(csv_tables_folder_string)
        engine = create_engine(engine_string)

        def save_table(tables, method):
            if len(tables) != 1:
                return print(f"{table['tableId']}: ERROR! found {len(tables)} tables with {method}")
            csv_id = str(uuid4())
            csv_table = tables[0]
            csv_file_name = csv_tables_folder.joinpath(f"{csv_id}.csv")
            df = csv_table.df
            df = cleanup_df(df)
            csv_rows, csv_columns = df.shape
            csv_headers = json.dumps(df.iloc[0].tolist())
            csv_text = df.to_json(None, orient='values')
            df.to_csv(csv_file_name, index=False, header=False, encoding="utf-8-sig")

            with engine.connect() as conn:
                statement = text(
                    "INSERT INTO csvs (csvId, tableId, method, csvHeaders, csvRows, csvColumns, csvText) " +
                    "VALUE (:csvId, :tableId, :method, :csvHeaders, :csvRows, :csvColumns, :csvText);")
                params = {"csvId": csv_id, "tableId": table["tableId"], "method": method, "csvHeaders": csv_headers,
                          "csvRows": csv_rows, "csvColumns": csv_columns, "csvText": csv_text}
                result = conn.execute(statement, params)

        try:
            pdf_file_path = pdf_files_folder.joinpath(f"{table['pdfName']}.pdf")
            table_areas = [f"{table['pdfX1']},{table['pdfY1']},{table['pdfX2']},{table['pdfY2']}"]

            tables = camelot.read_pdf(
                str(pdf_file_path),
                table_areas=table_areas, pages=str(table['page']),
                strip_text='\n', line_scale=40, flag_size=True, copy_text=['v'],)
            save_table(tables, "lattice-v")

            tables = camelot.read_pdf(str(pdf_file_path), table_areas=table_areas, pages=str(table['page']),
                                      strip_text='\n', flavor="stream", flag_size=True)
            save_table(tables, "stream")

            with engine.connect() as conn:
                statement = text("UPDATE tables SET csvsExtracted = 'done' WHERE tableId = :tableId;")
                result = conn.execute(statement, {"tableId": table['tableId']})
            print(f"{table['tableId']}: done")
        except Exception as e:
            print(f"{table['tableId']}: {e}")
            traceback.print_tb(e.__traceback__)
        finally:
            return buf.getvalue()
