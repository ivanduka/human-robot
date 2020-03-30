from wand.image import Image
from sqlalchemy import text, create_engine
from io import StringIO
import sys
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path


def extract_image(args):
    buf = StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        table, engine_string, pdf_files_folder_string, jpg_tables_folder_string = args
        pdf_files_folder = Path(pdf_files_folder_string)
        jpg_tables_folder = Path(jpg_tables_folder_string)
        engine = create_engine(engine_string)

        try:
            pdf_file_path = pdf_files_folder.joinpath(
                f'{table["pdfName"]}.pdf')
            img_arg_string = f'{pdf_file_path.resolve()}[{table["page"] - 1}]'
            with Image(filename=img_arg_string, resolution=300) as img:
                left = round(table["pdfX1"] * img.width / table["pdfWidth"])
                top = round((table["pdfHeight"] - table["pdfY1"])
                            * img.height / table["pdfHeight"])
                right = round(table["pdfX2"] * img.width / table["pdfWidth"])
                bottom = round(
                    (table["pdfHeight"] - table["pdfY2"]) * img.height / table["pdfHeight"])
                img.crop(left=left, top=top, right=right, bottom=bottom)
                img.format = "jpg"
                img.save(filename=jpg_tables_folder.joinpath(
                    f'{table["tableId"]}.jpg'))
                with engine.connect() as conn:
                    statement = text(
                        "UPDATE tables SET imageExtracted = 'done' WHERE tableId = :tableId;")
                    result = conn.execute(
                        statement, {"tableId": table["tableId"]})
                print(
                    f'Successfully inserted {result.rowcount} rows for {table["tableId"]}')
        except Exception as e:
            print(f'Error extracting {table["tableId"]}: {e}')
        finally:
            return buf.getvalue()
