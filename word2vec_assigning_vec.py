from sqlalchemy import create_engine
import pandas as pd
import os
from pathlib import Path
import nltk
import re
import string, unicodedata
import contractions
import inflect
import codecs
from nltk import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
import spacy
import en_core_web_sm
import time
import gensim
from gensim.models import Word2Vec
import multiprocessing
nlp = en_core_web_sm.load()
nlp.max_length = 600000000
# Importing environmental variables library that reads from the .env file
from dotenv import load_dotenv

# Loading key-value pairs from the .env file into the OS environment
load_dotenv()

# Reading the key-value pairs from the OS environment
user = os.getenv("DB_USER")
password = os.getenv("DB_PASS")
db_hostname = os.getenv("DB_HOST")
db_name = os.getenv("DB_DATABASE_ESA")

sample = """construct the pulse because constructing helps to reduce the chance of cardiac arrest and constructed indivduals tend to live longer """

def get_esa_text():
    """Extract ESA text from MySQL Database"""
    conn_string = f"mysql+mysqldb://{user}:{password}@{db_hostname}/{db_name}?charset=utf8mb4"
    engine = create_engine(conn_string)
    with engine.connect() as conn:
        query = "SELECT * FROM pages_normal_txt;"
        data = pd.read_sql(query, conn)
    return ' '.join(data.clean_content)

def get_pcmr_text():
    """Extract PCMR Text from text files"""
    pcmr_text = []
    files = os.listdir("G:/Post Construction/PDF_text")
    for file in files:
        with codecs.open("G:/Post Construction/PDF_text/" + file,'r', encoding='utf-8-sig') as corpus:
            input_str = corpus.read()
            pcmr_text.append(input_str)
    return ' '.join(pcmr_text)

def combine_text():
    """combine text string from ESA and PCMR text"""
    esa_corpus = get_esa_text()
    pcmr_corpus = get_pcmr_text()
    return ' '.join([esa_corpus, pcmr_corpus])

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
    # start_time = time.time()
    text = nlp(text)
    # print(time.time() - start_time)
    # start_time = time.time()
    text = ' '.join([word.lemma_ if word.lemma_ != '-PRON-' else word.text for word in text])
    # print(time.time() - start_time)
    return text
    
def normalize_before_tokenization(text):
    text = replace_contractions(text)
    text = remove_non_ascii(text)
    text = to_lowercase(text)
    text = lemmatize_text(text)
    return text
    
    # # TODO: text => 12 work_items

    # work_items = ["","","","","","","","","","","",""]
    # with multiprocessing.Pool() as pool:
    #     results = pool.map(lemmatize_text, work_items, chunksize=1)
    # text = "".join(results)

    # return text

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

esa = get_esa_text()
print(len(esa))

pcmr = get_pcmr_text()
print(len(pcmr))

text_corpus = combine_text()
text_corpus
text_before_tokenization = normalize_before_tokenization(text_corpus)
corpus_words = nltk.word_tokenize(text_before_tokenization)
normalized_words = normalize_after_tokenization(corpus_words)



#################################################
# word2vec implementation
#################################################


def make_bigrams(normalized_tokens):
    """ create bigrams froms text corpus"""
    bigram = gensim.models.Phrases(normalized_tokens, min_count = 20, threshold = 16)
    bigram_mod = gensim.models.phrases.Phraser(bigram)
    return [bigram_mod[doc] for doc in normalized_tokens]

#min_count: ignore all words and bigrams with total collected count lower than this
#threshold represents a score threshold for forming the phrases (higher means fewer phrases). A phrase of words a followed by b is accepted if the score of the phrase is greater than threshold

#normalized_words_bigrams = make_bigrams(normalized_words)

###############################################
# Set values for various parameters
###############################################

feature_size = 100    # word vector 
window_context = 15   # context window size i.e. maximum distance between current and predicted word within a sentence
min_word_count = 10   # Words that appear only once or twice in a billion-word corpus are probably uninteresting typos and garbage. In addition, there’s not enough data to make any meaningful training on those words, so it’s best to ignore them
sample = 1e-3         # The threshold for configuring which higher-frequency words are randomly downsampled, useful range is (0, 1e-5).
learning_rate = 0.01  # the initial learning rate

###############################################
# Create and train the model
###############################################

w2v_model = Word2Vec(min_count = min_word_count,
                     window = window_context,
                     size = feature_size,
                     sample = sample,
                     sg = 1,
                     negative = 5,
                     alpha = learning_rate,
                     workers = 2)
w2v_model.build_vocab(normalized_words)
w2v_model.train(normalized_words, total_examples=w2v_model.corpus_count, epochs = w2v_model.iter)

###############################################
# define root words
###############################################
vec_lst = ['physical','physical_environment', 'soil', 'soil_productivity', 'vegetation', 'water', 'water_quantity', 'water_quality', 'fish', 'fish_habitat', 'wetlands', 'wildlife', 'wildlife_habitat', 'species', 'species_risk', 'air', 'air_quality', 'acoustic_environment', 'acoustic', 'heritage', 'heritage_resources', 'access', 'navigation']
sub_cat_vec_lst = ['erosion', 'coarse_fragments', 'subsidence', 'topsoil_admixing', 'compaction', 'topsoil_loss', 'watercourse', 'vegetation_re-establishment', 'invasive', 'plants', 'rare', 'stream', 'stream_channel', 'stream_channel_profile', 'stream_bank', 'stream_bank_stability', 'riparian', 'riparian_vegetation','riparian_vegetation_reestablishment', 'access', 'access_control']
vec_sub_cat = []
vec_lst.extend(sub_cat_vec_lst)
vec_sub_cat.extend(vec_lst)

###############################################
# Convert dictionary with root word as key and context words as values
###############################################

root_word_dict = {}
for root_word in vec_sub_cat:
    try:
        context_words = w2v_model.wv.most_similar(positive = [root_word],topn = 15)
        root_word_dict[root_word] = context_words
    except:
        root_word_dict[root_word] = 'The word is not in vocabulary'

###############################################
# Convert dictionary into a dataframe and then to csv
###############################################

word2vec_df = pd.DataFrame.from_dict(root_word_dict)
word2vec_df.to_csv('word2vec.csv', encoding = 'utf-8-sig')