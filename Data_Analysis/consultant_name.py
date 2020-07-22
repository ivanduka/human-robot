######################################################### 
#  Import Packages
#########################################################

from sqlalchemy import text, create_engine
import pandas as pd
from PIL import Image 
import pytesseract 
from pdf2image import convert_from_path 
import os
import time
import fitz
import re
from multiprocessing import Pool

#########################################################
#  Initialize Database Connection
#########################################################

from dotenv import load_dotenv
load_dotenv()
user = os.getenv("DB_USER")
password = os.getenv("DB_PASS")
db_hostname = os.getenv("DB_HOST")
db_name = os.getenv("DB_DATABASE")
conn_string = f"mysql+mysqldb://{user}:{password}@{db_hostname}/{db_name}?charset=utf8mb4"
engine = create_engine(conn_string)

#########################################################
#  Make list of consultant names from the excel file
#########################################################

consultant_name_df = pd.read_excel('G:/Post Construction/metadata csvs/consultants.xlsx', encoding = 'utf-8-sig')
consultant_name_lst = consultant_name_df["consultant_name"].tolist()
with engine.connect() as conn: ## with context manager with, we don't have to close the connection everytime we run queries
    query1 = "SELECT * FROM pdfs;"
    df1 = pd.read_sql(query1, conn)
    

#########################################################
#  Consultant Name Extraction Step 1: Reading Consultant Name from First Page followed by manually adding Consultant Names to mapping dictionary
#########################################################

def img_to_text(file):
    main_consultant_name = []
    pytesseract.pytesseract.tesseract_cmd = r'C:\Users\t1nipun\AppData\Local\Tesseract-OCR\tesseract.exe'
    pages = convert_from_path("G:/Post Construction/PCMR_All/" + file + '.pdf', 500, last_page= 1)
    for page in pages:
        filename = file +'_Page1.jpg'
        page.save("C:/Users/t1nipun/Desktop/PCMR/human-robot/Data_Analysis/pdf_firstpage_img/" + filename, 'JPEG')
        text = str(((pytesseract.image_to_string(Image.open("C:/Users/t1nipun/Desktop/PCMR/human-robot/Data_Analysis/pdf_firstpage_img/" + filename))))).lower().replace('\n\n',' ')
        consultant_name = []
        for name in consultant_name_lst:
            if name.lower() in text:
                consultant_name.append(name)
        main_consultant_name.append(consultant_name)
    return main_consultant_name
    

def process_handler():
    with engine.connect() as conn: ## with context manager with, we don't have to close the connection everytime we run queries
        query1 = "SELECT * FROM pdfs;"
        df1 = pd.read_sql(query1, conn)
    files = [file for file in df1['pdfName']]
    start_time = time.time()
    
# Sequential Process
# for file in files:
#     img_to_text(file)

    with Pool() as pool:
        results = pool.map(img_to_text, files)
    for result in results:
        print(result)

    duration = round(time.time() - start_time)
    print(f'Whole Process completed in {duration} second(s)')

if __name__ == "__main__":
    process_handler()





# df1['consultant_name'] = main_consultant_name
# df2 = df1.copy()
# mapping_dict = df2.groupby('filingId')['consultant_name'].apply(lambda x: x.values.tolist()).to_dict()


# # %%
# def flatten(lst_of_lsts):
#     output = []
#     for element in lst_of_lsts:
#         if type(element) == list:
#             output.extend(element)
#     return list(set(output))


# # %%
# newdict = {key: flatten(value) for key, value in mapping_dict.items()}
# newdict.update(dict.fromkeys([786189,877284,786042,2672072,590454,961080,2671945,2897123,3096796], ['TERA Environmental Consultants']))
# newdict.update(dict.fromkeys([775971,2412030,2671966], ['Golder Associates']))
# newdict.update(dict.fromkeys([2661335,3179528,3737775], ['AMEC Environment & Infrastructure']))
# newdict.update(dict.fromkeys([2661447,3754527], ['Triton Environmental Consultants']))
# newdict.update(dict.fromkeys([541474,601828], ['AMEC Earth & Environmental']))
# newdict.update(dict.fromkeys([2909564,2908414,3179688,3462570], ['Paragon Soil and Environmental Consulting']))
# newdict.update(dict.fromkeys([781909], ['SLR Consulting']))
# newdict.update(dict.fromkeys([2909462], ['CCI']))
# newdict.update(dict.fromkeys([3464752,3747552], ['Paragon Soil and Environmental Consulting', 'Golder Associates']))

# df2['consultant_name'] = df2['filingId'].map(newdict)

# # %% [markdown]
# # #### Consultant Name Extraction Step 2: Reading Consultant Name from Second and Third Page (in case Second page is blank)

# # %%
# def clean(my_str):
#     my_new_str = re.sub(r"[^a-zA-Z0-9-&]+",' ', my_str)
#     return my_new_str


# # %%
# start = time.time()
# for line, row in enumerate(df2.itertuples(),1):  ## use head method with dataframe in order to slice the data when using itertuples() example df1.head(2).itertuples()
#     if len(row.consultant_name) ==0:
#         try:
#             pdf_file = open('G:/Dev/PCMR/pdf_files/' + row.pdfName + '.pdf', 'rb').read()
#             pdf_doc = fitz.open('pdf', pdf_file)
#         except:
#             print('File: {} failed to open'.format(row.pdfName))
#         page_content = ""
#         for page_number in range(pdf_doc.pageCount):
#             page_content += pdf_doc.loadPage(page_number).getText("text").lower()
#         page_content = clean(page_content)
#         if "table of contents" not in page_content or len(pdf_doc.loadPage(1).getText("text")) == 0:
#             lookup_content = pdf_doc.loadPage(2).getText("text").lower()
#             lookup_content = clean(lookup_content)
#         else:
#             lookup_content = pdf_doc.loadPage(1).getText("text").lower()
#             lookup_content = clean(lookup_content)
#         consultant_name_step2 = []
#         for name in consultant_name_lst:
#             if name.lower() in lookup_content:
#                 consultant_name_step2.append(name)
#         df2.set_value(row.Index, 'consultant_name', consultant_name_step2) # reference: https://stackoverflow.com/questions/43222878/iterate-over-pandas-dataframe-and-update-the-value-attributeerror-cant-set-a
# end = time.time()
# print(f'Runtime is {end - start}')

# # %% [markdown]
# # #### Consultant Name Extraction Step 3: Manual step

# # %%
# exception_list = ['A97613-3', 'A97613-4', 'A97613-5']
# for line, row in enumerate(df2.itertuples(),1):  ## use head method with dataframe in order to slice the data when using itertuples() example df1.head(2).itertuples()
#     consultant_name_step3 = []
#     if len(row.consultant_name) == 0 and not any(substring in row.pdfName[:8] for substring in exception_list): 
#         consultant_name_step3.append('In-house Consulting: ' + row.company)
#         df2.set_value(row.Index, 'consultant_name', consultant_name_step3)
# df2.loc[df2.pdfName.str[:8] == 'A97613-3', 'consultant_name'] = pd.Series([['CCI']]*df2.shape[0])
# df2.loc[df2.pdfName.str[:8] == 'A97613-4', 'consultant_name'] = pd.Series([['CCI']]*df2.shape[0])
# df2.loc[df2.pdfName.str[:8] == 'A97613-5', 'consultant_name'] = pd.Series([['Paragon Soil and Environmental Consulting']]*df2.shape[0])
# columns  = ['pdfId', 'pdfName', 'filingId', 'totalPages', 'application_id', 'submitter', 'company', 'consultant_name']
# df2.to_csv('consultant_name.csv', encoding = 'utf-8-sig', columns = columns)


# # %%
# '''pdf_name = []
# main_consultant_name_step2 = []
# for line, row in enumerate(df2.itertuples(),1):  ## use head method with dataframe in order to slice the data when using itertuples() example df1.head(2).itertuples()
#     if len(row.consultant_name) == 0:
#         pdf_file = open('G:/Dev/PCMR/pdf_files/' + row.pdfName + '.pdf', 'rb')
#         read_pdf = PyPDF2.PdfFileReader(pdf_file)
#         if 'table of contents' not in row.xmlContent.lower():
#             page_content = read_pdf.getPage(2).extractText().lower()
#             Research = re.search(string,page_content)
#             print(row.pdfName,Research)     
#         pd
#         text = row.xmlContent.lower().strip().split("table of contents")
#         text_tuple = '_'.join(text[:1]), '_'.join(text[1:])
#         text_before_TOC = text_tuple[0]
#         consultant_name_step2 = []
#         for name in consultant_name_lst:
#             if name.lower() in text_before_TOC:
#                 consultant_name_step2.append(name)
#         main_consultant_name_step2.append(consultant_name_step2)
#                 #df1.set_value(row.Index, 'consultant_name', name) # reference: https://stackoverflow.com/questions/43222878/iterate-over-pandas-dataframe-and-update-the-value-attributeerror-cant-set-a'''
