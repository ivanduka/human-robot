from wand.image import Image
from sqlalchemy import text, create_engine
from io import StringIO
import sys
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
import camelot
from uuid import uuid4


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
            print(f"found {len(tables)} tables with {method}")
            if len(tables) == 1:
                csv_id = str(uuid4())
                csv_file_name = csv_tables_folder.joinpath(f"{csv_id}.csv")
                tables[0].to_csv(csv_file_name, index=False, header=False, encoding="utf-8-sig")

                with engine.connect() as conn:
                    statement = text("INSERT INTO csvs (csvId, tableId, method) " +
                                     "VALUE (:csvId, :tableId, :method);")
                    result = conn.execute(statement, {"csvId": csv_id, "tableId": table["tableId"], "method": method})
                print(f"Successfully inserted {result.rowcount} rows for CSV {csv_id}")

        try:
            pdf_file_path = pdf_files_folder.joinpath(f"{table['pdfName']}.pdf")
            table_areas = [f"{table['pdfX1']},{table['pdfY1']},{table['pdfX2']},{table['pdfY2']}"]

            tables1 = camelot.read_pdf(
                str(pdf_file_path),
                table_areas=table_areas, pages=str(table['page']),
                strip_text='\n', line_scale=40, flag_size=True, copy_text=['v', 'h'],)
            save_table(tables1, "lattice")

            tables2 = camelot.read_pdf(str(pdf_file_path), table_areas=table_areas, pages=str(table['page']),
                                       strip_text='\n', flavor="stream", flag_size=True)
            save_table(tables2, "stream")

            with engine.connect() as conn:
                statement = text("UPDATE tables SET csvsExtracted = 'done' WHERE tableId = :tableId;")
                result = conn.execute(statement, {"tableId": table['tableId']})
            print(f"Successfully updated {result.rowcount} rows for table {table['tableId']}")
        except Exception as e:
            print(f'Error processing {table["tableId"]}: {e}')
        finally:
            return buf.getvalue()
