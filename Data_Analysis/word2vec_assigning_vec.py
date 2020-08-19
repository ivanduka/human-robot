from sqlalchemy import create_engine
import pandas as pd
import os
from pathlib import Path
import nltk
import re
import string, unicodedata
import nltk
import contractions
import inflect
from nltk import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import spacy
import en_core_web_sm
nlp = en_core_web_sm.load()
nlp.max_length = 6000000 
# Importing environmental variables library that reads from the .env file
from dotenv import load_dotenv

# Loading key-value pairs from the .env file into the OS environment
load_dotenv()

# Reading the key-value pairs from the OS environment
user = os.getenv("DB_USER")
password = os.getenv("DB_PASS")
db_hostname = os.getenv("DB_HOST")


def get_esa_text():
    db_name = os.getenv("DB_DATABASE_ESA")
    conn_string = f"mysql+mysqldb://{user}:{password}@{db_hostname}/{db_name}?charset=utf8mb4"
    engine = create_engine(conn_string)

    with engine.connect() as conn:
        query = "SELECT * FROM pages_normal_txt;"
        data = pd.read_sql(query, conn)
    return ' '.join(data.clean_content)

def get_pcmr_text():
    
    return ' '.join(data.clean_content)
    
        
final_text = get_esa_text()
print(len(final_text))



sample = """
1.0 INTRODUCTION AND PROJECT DESCRIPTION 

In December 2010, NOVA Gas Transmission Ltd. (NGTL), a wholly owned subsidiary 
of TransCanada PipeLines Limited (TransCanada), received National Energy Board 
(NEB) Order XG-N081-11-2010, pursuant to Section 58 of the NEB Act granting 
approval for the construction and operation of the Watino Crossover and Calais 
Extension Pipeline Project (the Project). 

TransCanada committed to the Post-Construction Monitoring Program (PCMP) for the 
Project during the first and second growing seasons following pipeline construction.  The 
first year report was submitted on February 1, 2013 detailing the findings of the 2012 
assessment.  The assessment and reporting was completed by Tera Environmental 
Consultants (TERA) of Calgary, Alberta (TERA, 2013).  The recommendations from this 
report were accepted and TransCanada implemented the Post construction Reclamation 
Monitoring (PCRM) program.  The PCRM program addressed all issues identified in the 
2013 PCMP report and completed full ROW assessments in May 2013. 

The Project Team is comprised of company representatives who had a role performing 
work on the Project and may be contacted should PCMP issues or concerns arise.  

Contact information of Project Team members is provided below: 
"""

def replace_contractions(text):
    """Replace contractions in string of text"""
    return contractions.fix(text)

def remove_non_ascii(text):
    """Remove non-ASCII characters from list of tokenized words i.e. converting accented characters/letters"""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8', 'ignore')
    return text

def to_lowercase(text):
    """Convert all characters to lowercase from list of tokenized words"""
    text = text.lower()
    return text

def lemmatize_text(text):        
    text = nlp(text)
    text = ' '.join([word.lemma_ if word.lemma_ != '-PRON-' else word.text for word in text])
    return text
    
def normalize_before_tokenization(text):
    text = replace_contractions(text)
    text = remove_non_ascii(text)
    text = to_lowercase(text)
    text = lemmatize_text(text)
    return text

sample = normalize_before_tokenization(sample)

words = nltk.word_tokenize(sample)

def remove_punctuation(words):
    """Remove punctuation from list of tokenized words"""
    new_words = []
    for word in words:
        new_word = re.sub(r'[^\w\s]', '', word)
        if new_word != '':
            new_words.append(new_word)
    return new_words

def replace_numbers(words):
    """Replace all interger occurrences in list of tokenized words with textual representation"""
    p = inflect.engine()
    new_words = []
    for word in words:
        if word.isdigit():
            new_word = p.number_to_words(word)
            new_words.append(new_word)
        else:
            new_words.append(word)
    return new_words

def remove_stopwords(words):
    """Remove stop words from list of tokenized words"""
    new_words = []
    for word in words:
        if word not in stopwords.words('english'):
            new_words.append(word)
    return new_words

def normalize_after_tokenization(words):
    words = remove_punctuation(words)
    words = replace_numbers(words)
    words = remove_stopwords(words)
    return words

words = normalize_after_tokenization(words)
print(words)
