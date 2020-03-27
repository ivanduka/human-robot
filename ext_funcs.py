def extract_image(args):
    table, engine, pdf_files_folder, jpg_tables_folder = args
    table_id = table["tableId"]
    pdf_name = table["pdfName"]
    
    
    # try:
    #     pdf_file_path = pdf_files_folder.joinpath(f"{table.fileId}.pdf")

    #     with Image(filename=f"{pdf_file_path.resolve()}[{table.page - 1}]", resolution=600) as img:
    #         left = int(table.pdfX1 * img.width / table.pdfWidth)
    #         top = int((table.pdfHeight - table.pdfY1) * img.height / table.pdfHeight)
    #         right = int(table.pdfX2 * img.width / table.pdfWidth)
    #         bottom = int((table.pdfHeight - table.pdfY2) * img.height / table.pdfHeight)
    #         img.crop(left=left, top=top, right=right, bottom=bottom)
    #         img.format = "jpg"
    #         img.save(filename=jpg_tables_folder_path.joinpath(f"{table.uuid}.jpg"))
    #         print(f"Extracted table ID {table.uuid} to image")
    # except Exception as e:
    #     print(f"==== Error extracting table ID {table.uuid}  ======")
    #     print(e)
    #     print(f"======================================")
    #     return
    