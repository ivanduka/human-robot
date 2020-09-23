import pandas as pd
import numpy as np
import os
import re
import string, unicodedata
import contractions
import codecs
import nltk
from nltk import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
import spacy
import en_core_web_sm
import time
import gensim
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt
import sys
from gensim.models import Word2Vec
nlp = en_core_web_sm.load()
nlp.max_length = 600000000

#################################################
# Building Text Corpus
#################################################

def get_esa_text():
    """Extract ESA Text from text files"""
    esa_text = []
    files = os.listdir("G:/Post Construction/ESA_text")
    for file in files:
        with codecs.open("G:/Post Construction/ESA_text/" + file,'r', encoding='utf-8-sig') as corpus:
            input_str = corpus.read()
            esa_text.append(input_str)
    return esa_text

def get_pcmr_text():
    """Extract PCMR Text from text files"""
    pcmr_text = []
    files = os.listdir("G:/Post Construction/PDF_text")
    for file in files:
        with codecs.open("G:/Post Construction/PDF_text/" + file,'r', encoding='utf-8-sig') as corpus:
            input_str = corpus.read()
            pcmr_text.append(input_str)
    return pcmr_text

def combine_text():
    """combine text string from ESA and PCMR text"""
    esa_corpus = get_esa_text()
    pcmr_corpus = get_pcmr_text()
    corpus = esa_corpus + pcmr_corpus
    return corpus

#################################################
# Preprocessing and Normalizing Text Corpus
#################################################

def replace_contractions(text):
    """Replace contractions in string of text"""
    return contractions.fix(text)

def remove_non_ascii(text):
    """Remove non-ASCII characters from text string i.e. converting accented characters/letters"""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8', 'ignore')
    return text

def to_lowercase(text):
    """Convert all characters to lowercase from text string"""
    text = text.lower()
    return text

def lemmatize_text(text):
    """convert word in the text string to its root form"""
    text = nlp(text)
    text = ' '.join([word.lemma_ if word.lemma_ != '-PRON-' else word.text for word in text])
    return text

def remove_special_characters(text, remove_digits = False):
    """Removing non-alphanumeric characters and symbols or even ocasionally numeric characters"""
    pattern = r'[^a-zA-z0-9\s]' if not remove_digits else r'[^a-zA-z\s]'
    text = re.sub(pattern, '', text)
    return text

def remove_stopwords(text):
    """Remove stop words from text string"""
    stopword_list = nltk.corpus.stopwords.words('english')     
    return ' '.join(word for word in text.split() if word not in stopword_list)

def normalize_text_corpus(corpus):
    """Normalize each document in the corpus"""
    start_time = time.time()
    normalized_corpus = []
    corpus_size = len(combine_text())
    for doc in corpus:
        doc = replace_contractions(doc)
        doc = remove_non_ascii(doc)
        doc = to_lowercase(doc)
        doc = lemmatize_text(doc)
        doc = remove_special_characters(doc, remove_digits = True)
        doc = remove_stopwords(doc)
        normalized_corpus.append(doc)
    dur = round(time.time() - start_time)
    print(f"Normalized text from {corpus_size} documents in {dur} seconds ({round(dur / 60, 2)} min or {round(dur / 3600, 2)} hours)")
    return normalized_corpus

#################################################
# Tokenizing and removing too short and too long tokens
#################################################

def sent_to_words(sentences):
    """using Gensim's simple text preprocessing to convert document into a list of tokens, ignoring tokens that are too short or too long"""
    start_time = time.time()
    for sentence in sentences:
        yield(gensim.utils.simple_preprocess(str(sentence), deacc=False))
    dur = round(time.time() - start_time)
    print(f"Tokenization and further preprocessing completed in {dur} seconds ({round(dur / 60, 2)} min or {round(dur / 3600, 2)} hours)")

#################################################
# Calling text corpus preparation and text preprocessing and normalizing function 
#################################################
normalized_tokens = list(sent_to_words(normalize_text_corpus(combine_text())))
tokens = 0
for i in normalized_tokens:
    tokens += len(i)
print(f"Total tokens in the final corpus: {tokens}")

#################################################
# Uisng Gensim Library to build bi-grams
#################################################

def make_bigrams(normalized_tokens):
    """ create bigrams froms normalized tokens corpus"""
    bigram = gensim.models.Phrases(normalized_tokens, min_count = 20, threshold = 16)
    bigram_mod = gensim.models.phrases.Phraser(bigram)
    return [bigram_mod[doc] for doc in normalized_tokens]

#min_count: ignore all words and bigrams with total collected count lower than this
#threshold represents a score threshold for forming the phrases (higher means fewer phrases). A phrase of words a followed by b is accepted if the score of the phrase is greater than threshold

#normalized_tokens_bigrams = make_bigrams(normalized_tokens)

###############################################
# Set values for various parameters
###############################################

feature_size = 100    # word vector 
window_context = 15   # context window size i.e. maximum distance between current and predicted word within a sentence
min_word_count = 10   # Words that appear only once or twice in a billion-word corpus are probably uninteresting typos and garbage. In addition, there’s not enough data to make any meaningful training on those words, so it’s best to ignore them
#sample = 1e-3         # The threshold for configuring which higher-frequency words are randomly downsampled, useful range is (0, 1e-5).
learning_rate = 0.01  # the initial learning rate
iterations = 5        # Number of iterations over the corpus

###############################################
# Create and train the model
###############################################
start_time = time.time()
w2v_model = Word2Vec(min_count = min_word_count,
                     window = window_context,
                     size = feature_size,
                     sg = 1,
                     negative = 5,
                     alpha = learning_rate,
                     iter = iterations,
                     workers = 4)
w2v_model.build_vocab(normalized_tokens)
w2v_model.train(normalized_tokens, total_examples=w2v_model.corpus_count, epochs = w2v_model.iter)
dur = round(time.time() - start_time)
print(f"Word2vec model creation and training completed in {dur} seconds ({round(dur / 60, 2)} min or {round(dur / 3600, 2)} hours)")

###############################################
# define root words
###############################################

vec_lst = ['physical','physical_environment', 'soil', 'soil_productivity', 'vegetation', 'water', 'water_quantity', 'water_quality', 'fish', 'fish_habitat', 'wetland', 'wildlife', 'wildlife_habitat', 'specie', 'specie_risk', 'air', 'air_quality', 'acoustic_environment', 'acoustic', 'heritage', 'heritage_resource', 'access', 'navigation', 'navigation_safety']
sub_cat_vec_lst = ['erosion', 'coarse_fragments', 'subsidence', 'topsoil_admixing', 'compaction', 'topsoil_loss', 'watercourse', 'vegetation_establishment', 'invasive', 'plants', 'weeds', 'rare', 'stream', 'stream_channel', 'stream_bank', 'stream_bank', 'riparian', 'riparian_vegetation','riparian_vegetation_establishment']
vec_sub_cat = []
vec_lst.extend(sub_cat_vec_lst)
vec_sub_cat.extend(vec_lst)

###############################################
# Convert dictionary with root word as key and context words as values
###############################################

root_word_dict = {}
for root_word in vec_sub_cat:
    try:
        context_words = w2v_model.wv.most_similar(positive = [root_word],topn = 25)
        root_word_dict[root_word] = context_words
    except:
        root_word_dict[root_word] = 'The word is not in vocabulary'

###############################################
# Convert dictionary into a dataframe and then to csv
###############################################

word2vec_df = pd.DataFrame.from_dict(root_word_dict)
word2vec_df.to_csv('word2vec_unigrams.csv', encoding = 'utf-8-sig')

###############################################
# Visualizing the root words in 2-D space
###############################################
similar_words = {search_term: [item[0] for item in w2v_model.wv.most_similar([search_term], topn = 3)] for search_term in ['soil', 'erosion','vegetation', 'water', 'fish', 'wetland', 'wildlife', 'specie', 'air']}
def tsne_plot(model):
    "Create TSNE model and plot it"
    words = sum([[k] + v for k, v in similar_words.items()], [])
    wvs = w2v_model.wv[words]
    tsne_model = TSNE(perplexity = 2, n_components = 2, n_iter = 10000, random_state = 0)
    np.set_printoptions(suppress = True)
    T = tsne_model.fit_transform(wvs)
    labels = words
    plt.figure(figsize=(14, 8))
    plt.scatter(T[:, 0], T[:, 1], c = 'orange', edgecolors = 'r')
    for label, x, y in zip(labels, T[:, 0], T[:, 1]):
        plt.annotate(label, xy=(x+1, y+1), xytext=(0, 0), textcoords='offset points')
    return plt.show()

tsne_plot(w2v_model)