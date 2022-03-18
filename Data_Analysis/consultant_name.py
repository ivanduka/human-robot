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
#  Consultant Name Extraction Step 1: Reading Consultant Name from First Page followed by manually adding Consultant Names to mapping dictionary
#########################################################
def get_pdf_metadata():
    """
    It returns a dataframe of all the pdfs in the database
    :return: A dataframe with the pdfs and their metadata.
    """
    with engine.connect() as conn:
        query1 = "SELECT * FROM pdfs;"
        df = pd.read_sql(query1, conn)
    return df
        
def get_pdf_names():
    """
    Get the names of all the pdf files in the directory
    :return: A list of the names of the pdf files.
    """
    data = get_pdf_metadata()
    files = [file for file in data['pdfName']]
    return files
    
def read_consultant_names():
    """
    Reads in a list of consultant names from an excel file
    :return: A list of consultant names.
    """
    consultant_name_df = pd.read_excel('G:/Post Construction/metadata csvs/consultants.xlsx', encoding = 'utf-8-sig')
    consultant_name_lst = consultant_name_df["consultant_name"].tolist()
    return consultant_name_lst


def img_to_text(file):
    """
    The function takes in a pdf file and converts it to a jpg file.
    Then it extracts the text from the jpg file and checks if any of the consultant names are present in
    the text.
    If they are present, it appends the consultant name to a list.
    
    :param file: The file name of the PDF file
    :return: A list of lists. Each list contains the names of the consultant(s) who are mentioned in the
    first page of the pdf.
    """
    main_consultant_name = []
    pytesseract.pytesseract.tesseract_cmd = r'C:\Users\t1nipun\AppData\Local\Tesseract-OCR\tesseract.exe'
    pages = convert_from_path("G:/Post Construction/PCMR_All/" + file + '.pdf', 500, last_page= 1)
    for page in pages:
        filename = file +'_Page1.jpg'
        page.save("C:/Users/t1nipun/Desktop/PCMR/human-robot/Data_Analysis/pdf_firstpage_img/" + filename, 'JPEG')
        text = str(((pytesseract.image_to_string(Image.open("C:/Users/t1nipun/Desktop/PCMR/human-robot/Data_Analysis/pdf_firstpage_img/" + filename))))).lower().replace('\n\n',' ')
        consultant_name = []
        names = read_consultant_names()
        for name in names:
            if name.lower() in text:
                consultant_name.append(name)
        main_consultant_name.append(consultant_name)
    return main_consultant_name
    

def process_handler():
    """
    This function takes in a list of pdf files and returns a list of consultant names
    :return: A list of names
    """
    start_time = time.time()

    ########################################################
    # Sequential Process
    ########################################################
    
    # for file in files:
    #     img_to_text(file)
    
    #######################################################
    # Parallel Processing
    #######################################################
    
    pdf_files = get_pdf_names()
    with Pool() as pool:
        results = pool.map(img_to_text, pdf_files, chunksize=1)
    main_consultant_names = []
    for result in results:
        for single_result in result:
            main_consultant_names.append(single_result)
        print(result)
    
    duration = round(time.time() - start_time)
    print(f'Step 1 completed in {round(duration/60, 2)} minutes')
    return main_consultant_names


if __name__ == "__main__":
    pcmr_consultant_list = read_consultant_names()
    print(pcmr_consultant_list)
    names = process_handler()
    data = get_pdf_metadata()
    data['consultant_name'] = names
    df2 = data.copy()

    mapping_dict = df2.groupby('filingId')['consultant_name'].apply(lambda x: x.values.tolist()).to_dict()


    #########################################################
    #  Flatten the list
    #########################################################
    def flatten(lst_of_lsts):
        """
        Given a list of lists, return a list of all the elements in the sublists
        
        :param lst_of_lsts: a list of lists
        :return: A list of all the unique elements in lst_of_lsts.
        """
        output = []
        for element in lst_of_lsts:
            if type(element) == list:
                output.extend(element)
        return list(set(output))


    #########################################################
    #  Manual Changes
    #########################################################
    newdict = {key: flatten(value) for key, value in mapping_dict.items()}
    newdict.update(dict.fromkeys([786189,877284,786042,2672072,590454,961080,2671945,2897123,3096796], ['TERA Environmental Consultants']))
    newdict.update(dict.fromkeys([775971,2412030,2671966], ['Golder Associates']))
    newdict.update(dict.fromkeys([2661335,3179528,3737775], ['AMEC Environment & Infrastructure']))
    newdict.update(dict.fromkeys([2661447,3754527], ['Triton Environmental Consultants']))
    newdict.update(dict.fromkeys([541474,601828, 678027], ['AMEC Earth & Environmental']))
    newdict.update(dict.fromkeys([2909564,2908414,3179688,3462570], ['Paragon Soil and Environmental Consulting']))
    newdict.update(dict.fromkeys([781909], ['SLR Consulting']))
    newdict.update(dict.fromkeys([2909462], ['CCI']))
    newdict.update(dict.fromkeys([915736], ['Stantec Consulting']))
    newdict.update(dict.fromkeys([3464752,3747552], ['Paragon Soil and Environmental Consulting', 'Golder Associates']))

    df2['consultant_name'] = df2['filingId'].map(newdict)

    #########################################################
    #  Consultant Name Extraction Step 2: Reading Consultant Name from Second and Third Page (in case Second page is blank)
    #########################################################
    
    def clean(my_str):
        """
        The function takes a string as input, and replaces any character that is not a-z, A-Z, 0-9, or a
        dash (-) with a space.
        
        :param my_str: the string you want to clean
        :return: A string with all non-alphanumeric characters replaced with a space.
        """
        my_new_str = re.sub(r"[^a-zA-Z0-9-&]+",' ', my_str)
        return my_new_str

    start = time.time()
    for line, row in enumerate(df2.itertuples(),1):  ## use head method with dataframe in order to slice the data when using itertuples() example df1.head(2).itertuples()
        if len(row.consultant_name) ==0:
            try:
                pdf_file = open('G:/Dev/PCMR/pdf_files/' + row.pdfName + '.pdf', 'rb').read()
                pdf_doc = fitz.open('pdf', pdf_file)
            except:
                print('File: {} failed to open'.format(row.pdfName))
            page_content = ""
            for page_number in range(pdf_doc.pageCount):
                page_content += pdf_doc.loadPage(page_number).getText("text").lower()
            page_content = clean(page_content)
            if "table of contents" not in page_content or len(pdf_doc.loadPage(1).getText("text")) == 0:
                lookup_content = pdf_doc.loadPage(2).getText("text").lower()
                lookup_content = clean(lookup_content)
            else:
                lookup_content = pdf_doc.loadPage(1).getText("text").lower()
                lookup_content = clean(lookup_content)
            consultant_name_step2 = []
            for name in pcmr_consultant_list:
                if name.lower() in lookup_content:
                    consultant_name_step2.append(name)
            df2.set_value(row.Index, 'consultant_name', consultant_name_step2) # reference: https://stackoverflow.com/questions/43222878/iterate-over-pandas-dataframe-and-update-the-value-attributeerror-cant-set-a
    end = time.time()
    print(f'Runtime is {end - start}')

    #########################################################
    #  Consultant Name Extraction Step 3: Manual step
    #########################################################
    

    exception_list = ['A97613-3', 'A97613-4', 'A97613-5']
    for line, row in enumerate(df2.itertuples(),1):  ## use head method with dataframe in order to slice the data when using itertuples() example df1.head(2).itertuples()
        consultant_name_step3 = []
        if len(row.consultant_name) == 0 and not any(substring in row.pdfName[:8] for substring in exception_list): 
            consultant_name_step3.append('In-house Consulting: ' + row.company)
            df2.set_value(row.Index, 'consultant_name', consultant_name_step3)
    df2.loc[df2.pdfName.str[:8] == 'A97613-3', 'consultant_name'] = pd.Series([['CCI']]*df2.shape[0])
    df2.loc[df2.pdfName.str[:8] == 'A97613-4', 'consultant_name'] = pd.Series([['CCI']]*df2.shape[0])
    df2.loc[df2.pdfName.str[:8] == 'A97613-5', 'consultant_name'] = pd.Series([['Paragon Soil and Environmental Consulting']]*df2.shape[0])
    columns  = ['pdfId', 'pdfName', 'filingId', 'totalPages', 'application_id', 'submitter', 'company', 'consultant_name']
    df2.to_csv('consultant_name1.csv', encoding = 'utf-8-sig', columns = columns)