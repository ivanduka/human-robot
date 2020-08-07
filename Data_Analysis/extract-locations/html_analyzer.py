# -*- coding: utf-8 -*-
"""
This file contains the functions used to parse the html documents to extract
useful information (such as tagging figures, detecting table of contents, etc.)
"""

import re
import math
import collections

import gis_converter
import util


LABEL_HEADINGS =        ('plate', 'figure', 'photo', 'image', 'table', 'appendix')
LABEL_HEADINGS_PLURAL = ('plates', 'figures', 'photos', 'images', 'tables', 'appendices')

"""
Regex for matching table and figure captions.
First group matches entire text, second group matches caption type 
(table, figure, etc.) and third and fourth group matches caption 
identifier (2.2, A, A-2, etc.)

Matches: 
'table 2.2', 'table 4', 'Table 22.111', 'Table 1-1', 'Table B3', 
'table B-3', 'Table A', 'table C3', 'table C.3', 'table C3test', 
'table C-3test', 'table A:title', 'table 1: test'

Does not match:
'table AB', 'table', 'tables', 'tablea test'

The idea is if a table has a single letter as its identifier, then there 
should be a space, an end of line, or a colon.
There should also be a space between 'table' and the letter.
This is to prevent lines like 'table of contents' from being picked up as 
'table o', or 'tables' from being matched.
"""
LABEL_REGEX = r'(?i)(({headings})\:?(?:(?:\s*((?:\d+(?:[\.\-]?\d+)*)|(?:[a-z](?:[\.\-]?\d+)+)))|(?:\s+([a-z])(?:$|[^a-z]))))'.replace('{headings}', '|'.join(LABEL_HEADINGS))


"""
Location regular expressions
"""


"""
==== regex analyser ====
https://regex101.com/
==== regex visualizer ====
https://regexper.com/

test cases (found in documents):
==== match: ====
SE and SW 2-13-3W2M Latitude and longitude 50.1N; 102.3002W Land tenure Lands owned by Enbridge
52.6412N; 111.2725W 
49.7384N; 101.2399W and 49.7475N; 1001.2399W
a-1-A/94-H-8to4-23-95-13W6M
A-1-A/2-F-1
a-1-A,94-H-8
d‐83‐C/94‐P‐8
4-23-95-13,W.6M
10‐04‐119‐12W6M
6‐5‐109‐12W6M
a-1-A/94-H-8to4-23-95-13W6M
NE17-9-28WPMandSE20-9-28WPM
Alberta(10‐04‐119‐12‐W6M).
SE30-42-9W4M
SW1-40-5W4M
(SE3-7-14WPM)
a-1-A,94-H-8to4-23-95-13,W.6M
Catb‐99‐H/94‐I‐8,totheexistingHuskyFireCreekgasprocessingfacilitylocatedinAlbertaat6‐5‐109‐12W6M(Figure1).
tedȱinȱAlbertaȱatȱ6Ȭ5Ȭ109Ȭ12ȱW6M.ȱTheȱp
53°55'59.772"N
43°47’57”N
om Lat: 49.738174, 
23‐14‐30W1M

==== don't match: ====
5.1.2  Waterbody Crossings...
0.023 N/A
250.827.3778 N/A
15°34'30"W1

==== match even at end of file: ====
49.7384N; 101.2399W and 49.7475N; 1001.2399W
"""


"""
Regex for matching latitude/longitude location coordinates, in Decimal Degrees.

First capturing group is degrees, second group is [NWSE].

Matches:
'50.1 N;', '102.3002 W'

Does not match:
'5.1.2  Waterbody', '3 N/A'

Since spaces are used to determine if match is valid, one should not remove 
spaces from text before searching. This regex should use cleaned (non-latin
replaced with spaces) text. This regex should not join lines together (unlikely
to span multiple lines)
"""
LAT_LONG_DD_1_REGEX = r'(\d{1,3}(?:\.\d+))\s*([NWSE](?=[^a-z0-9]|$))'


"""
Regex for matching latitude/longitude location coordinates, in Decimal Degrees,
but without NWSE.

First capturing group is direction ('latitude', 'long', etc.), second group is degrees.

Matches:
'Lat: 49.738174', 'Long: -94.663485'

Spaces should not be removed before searching. This regex should use cleaned 
(non-latin replaced with spaces) text. This regex should join lines together
(likely to span multiple lines)
"""
LAT_LONG_DD_2_REGEX = r'(?i)(lat|long|latitude|longitude)[:\s]+(-?\d{1,3}(?:\.\d+))'


"""
Regex for matching latitude/longitude location coordinates, in Degrees Minutes Seconds.

Capturing groups are Degrees, Minutes, Seconds, and direction (NWSE), respectively.

Matches:
'53°55'59.772"N', '53°55'59.772''S', '43°47’57”N'

Spaces should be removed before searching. This regex should use cleaned 
(non-latin replaced with spaces) text. This regex should join lines together (since
this pattern is fairly restrictive, joining lines together shouldn't produce any
additional false matches)
"""
LAT_LONG_DMS_REGEX = r'(\d{1,3}(?:\.\d+)?)[°](\d+(?:\.\d+)?)[\'’](\d+(?:\.\d+)?)[\'\"\’\”]+([NWSE])'


"""
Regex for matching Dominion Land Survey (DLS) location identifiers.

Capturing groups are legal subdivision, section, delimiter, township, range, and meridian, respectively.
The delimiter group should be discarded.
Note that legal subdivision is optional. For more information:
https://www.ihsenergy.ca/support/documentation_ca/Harmony_Enterprise/2018_2/content/html_files/ref_materials/general_concepts/gis_theory/gis_theory.htm

Matches:
'23‐14‐30W1M', '4-23-95-13W6M', '4-23-95-13,W.6M', 'NE17-9-28WPM'

Spaces should be removed from text before searching. This regex should use raw text from
the html, since occasionally delimiters get converted to strange, unpredictable
characters. This regex should join lines together (likely to span multiple
lines)
"""
DLS_REGEX = r'(?P<lsd>(?:1[1-6]|0?[1-9])(?=[^a-zA-Z0-9])|(?:NW|NE|SW|SE))?[^a-zA-Z0-9]?(?P<section>\d{1,3})(?P<delim>[^a-zA-Z0-9])(?P<township>\d{1,3})(?P=delim)(?P<range>\d{1,3})\s*[^a-zA-Z0-9]?W[^a-zA-Z0-9]?(?P<meridian>[0-9P])M?'


"""
Regex for matching National Topographic System (NTS) location identifiers.

Capturing groups are quarter units, delimiter units, blocks, series numbers, map areas, and map sheets, respectively.
The delimiter group should be discarded.
For more information:
https://www.ihsenergy.ca/support/documentation_ca/Harmony_Enterprise/2018_2/content/html_files/ref_materials/general_concepts/gis_theory/gis_theory.htm

Matches:
'a-1-A/94-H-8', 'a-1-A,94-H-8'

Spaces should be removed from text before searching. This regex should use raw text from
the html, since occasionally delimiters get converted to strange, unpredictable
characters. This regex should not join lines together (unlikely to span multiple
lines)
"""
NTS_REGEX = r'([a-dA-D])(?P<delim>[^a-zA-Z0-9])(\d{1,3})(?P=delim)([a-lA-L])[^a-zA-Z0-9](\d{1,3})(?P=delim)([a-pA-P])(?P=delim)(1[1-6]|0?[1-9])'


"""
Regex for matching MLV (Mainline Valve) locations.

First capturing group represents the valve number, second group represents
distance offset, and third group represents the units (if provided) of the
offset (ex. "km").

Matches:
'MLV47+11.40', 'MLV1216+10.3km', 'MLV1217'

Spaces should be removed from text before searching. This regex should use cleaned 
(non-latin replaced with spaces) text. This regex should join lines together (since
this pattern is fairly restrictive, joining lines together shouldn't produce any
additional false matches)
"""
MLV_REGEX = 'MLV\)?(\d+)(?:\+(\d+(?:\.\d+)?)(km|m)?)?'




"""
A container for data about labels in html documents.
Fields:
    "center":       a (x, y) tuple of floats representing the approximate
                    center location of the label on the page. x-y
                    origin is at the bottom-left corner of the page, and y 
                    increases up the page.
    "first_line":   a html_page.html_line named tuple representing the 
                    first line identified in the label.
    "text":         a string representing the full text of the label.
"""
html_label = collections.namedtuple('html_label', 'center, first_line, text')


"""
A container for data about an image and its associated label.
Fields:
    "image_data":   a named tuple representing the image data. Format is defined
                    in html_page.html_image
    "label":        a named tuple representing the label for the image, or None if no
                    label was identified. Format is defined in html_analyzer.html_label
    "toc_label":    a string representing the label extracted from the table
                    of contents of the document, or None if no label was identified
                    or no table of contents was found
"""
html_image_tagged = collections.namedtuple('html_image_tagged', 'image_data, label, toc_label')


"""
A container for lat-long coordinates.
Fields:
    "N":    float representing the degrees North, in decimal degrees
    "W":    float representing the degrees West, in decimal degrees
    "text": the string representation of the coordinate, in the format 
            "<decimal degrees North> N, <decimal degrees West> W"
            (example: "55.95307856111531 N, 112.2166888073394 W")
"""
lat_long_coordinate = collections.namedtuple('lat_long_coordinate', 'N, W, text')


"""
A container for Dominion Land Survey (DLS) locations.
Fields:
    "legal_subdivision":    int or string representing the legal subdivision, or None if not given
    "section":              int representing the section
    "township":             int representing the township 
    "range":                int representing the range
    "meridian":             int or string indicating the meridian west of which this location
                            is describing
    "text":                 string representation of the location code, in the format 
                            "<legal_subdivision>-<section>-<township>-<range>-W<meridian>M"
                            if legal_subdivision is not None, otherwise in the format
                            "<section>-<township>-<range>-W<meridian>M"
                            (examples: "SE-23-81-16-W4M", "33-16-19-W2M")
    "lat_long":             html_analyzer.lat_long_coordinate representing the approximate
                            latitude longitude coordinate of the center of this location
"""
dls_location = collections.namedtuple('dls_location', 'legal_subdivision, section, township, range, meridian, text, lat_long')


"""
A container for National Topographic Sysem (NTS) locations.
Fields:
    "quarter_unit":     str representing the quarter unit
    "unit":             int representing the unit
    "block":            str representing the block
    "series_number":    int representing the series number
    "map_area":         str representing the map area
    "map_sheet":        int representing the map sheet
    "text":             string representation of the location code, in the format
                        "<quarter_unit>-<unit>-<block>/<series_number>-<map_area>-<map_sheet>"
                        (example: "a-76-K/94-A-12")
    "lat_long":         html_analyzer.lat_long_coordinate representing the approximate
                        latitude longitude coordinate of the center of this location
"""
nts_location = collections.namedtuple('nts_location', 'quarter_unit, unit, block, series_number, map_area, map_sheet, text, lat_long')


"""
A container for Mainline Valve (MLV) locations.
Currently no known way to convert to latitude-longitude from public resources.

Fields:
    "valve":    int representing the valve location
    "offset":   int or float representing the offset in km
    "text":     string representation of the location code
"""
mlv_location = collections.namedtuple('mlv_location', 'valve, offset, text')


def get_line_extent(lines, initial_line_index, html_document, merge_strategy='height', additional_check=None):
    """
    Attempts to extract the entire set of lines associated with an
    initial line. For example, a table caption may span two lines:
        TABLE 7 SUMMARY OF WORKS WITHIN 30 m OF WATERCOURSES, 
        WATERBODIES AND WETLANDS
    This method attempts to get all the lines associated with the caption
    based on similarity with the starting line.
    
    Parameters
    ----------
    lines: list
        a list of html_page.html_line lines to extract the extent from
    initial_line_index: int
        the index of the starting line in the lines list
    html_document: html_document.html_document
        the html document from which the lines were extracted from. Needed
        for css styles
    merge_strategy: str or None (optional, default='height')
        the strategy to use when detecting the extent of a line:
        'height' (default): after detecting the starting line, keep going
                            until we encounter a line with a different height
                            than the starting line
        'font-size':        after detecting the starting line, keep going
                            until we encounter a line that uses a font-size
                            not used in the starting line
        None:               no default checks are performed. Function user should
                            define their own check through the additional_check
                            parameter
    additional_check: function (optional, default=None)
        an additional check to apply to each line. The function should
        take two arguments: the starting line and the line to check against. Both
        arguments will be named tuples defined in html_page.html_line.
        It should return False if the extraction should be stopped (discarding
        the current line) and True otherwise.
        
    Returns
    ----------
    list
        a list of html_page.html_line elements representing the extent of
        the initial line
    """
    # if the line index provided exceeds the length of the list of lines, return
    if initial_line_index >= len(lines): return []
    
    # get the starting line
    starting_line = lines[initial_line_index]
    
    # initialize the extent of the starting line as a list containing
    # the starting line
    extent = [starting_line]
    
    # prepare variables used by the merging strategies
    if merge_strategy == 'font-size':
        ff, fs, fc = html_document.get_font_info(starting_line.html)
    elif merge_strategy == 'height':
        _,_,_, label_height = starting_line.bbox
    
    # create a counter for the current line index we are on
    search_line_number = initial_line_index + 1
    
    while search_line_number < len(lines):
        next_line = lines[search_line_number]
        
        # if line has little content, likely a sub or superscript. Don't
        # stop search in this case
        if len(next_line.text) > 3:
            # decide to keep going or break based on merge strategy
            if merge_strategy == 'font-size':
                _ff, _fs, _fc = html_document.get_font_info(next_line.html)
                if not _fs.issubset(fs):
                    break
            elif merge_strategy == 'height':
                _,_,_, label_height_ = next_line.bbox
                if label_height_ != label_height:
                    break
        
        # decide to keep going or break based on the provided additional check
        # function
        if additional_check and not additional_check(starting_line, next_line):
            break
        
        # add the line to the extent
        extent.append(next_line)
        search_line_number += 1
        
    return extent


def get_toc_pages(html_doc):
    """
    Detects the table of contents in a html document and returns the
    most likely range of pages for the table of contents.
    
    Many ideas were taken from this paper (though machine learning is not
    used within this method): 
    https://www.researchgate.net/publication/239731942_Table_of_Content_detection_using_Machine_Learning
    
    Parameters
    ----------
    html_doc: html_document.html_document
        the html document to extract the table of content pages from
    
    Returns
    ----------
    list
        a list representing the most likely range of pages for the
        table of contents. Elements of this list are html_page.html_page
        tuples
    list
        a list representing the most likely range of pages for the
        table of contents. Elements of this list are integers representing
        page indices
    """
    toc_page_numbers = []
    
    # indicates if the first page of the table of contents has been found
    title_found = False
    
    for page_number, page in enumerate(html_doc.pages):
        # decide if a page is part of the table of contents or not
        
        # number of rows on the page that are likely to belong to a table
        # of contents
        likely_toc_rows = 0
        # boolean value indicating if we are almost certain the page belongs
        # to the table of contents (for example, if we find a line with "table of contents"
        # in it)
        certain_page_is_toc = False
        for line_number, line_data in enumerate(page.lines):
            line_text = line_data.text.lower().strip()
            if line_text.isspace() or line_text == '': continue
        
            # check if any line contains 'table of contents' or 'list of tables', 'list of figures', etc.
            if any([text in line_text for text in ['table of contents'] + ['list of {}'.format(heading) for heading in LABEL_HEADINGS_PLURAL]]):
                certain_page_is_toc = True
                break
            
            # check if dotted lines appear in text, since rows in toc usually contain long dotted lines
            dotted_line = ''.join(re.findall(r'\.{2,}', line_text))
            if float(len(dotted_line)) / float(len(line_text)) > 0.3:
                certain_page_is_toc = True
                break
            
            # check if line ends with a number, since rows in toc usually end with page number
            # can expand this to check if line starts with certain key words (table, figure, section, etc.)
            if re.search(r'\d+$', line_text):
                likely_toc_rows += 1
                continue
        
        title_found = title_found or certain_page_is_toc
        
        if title_found:
            if certain_page_is_toc or (len(page.lines) > 10 and float(likely_toc_rows) / float(len(page.lines)) > 0.3):
                # page is likely part of the table of contents. Add it to the page numbers of
                # the table of contents, unless the first page of the table of contents has already been found
                # and this page is not a consecutive continuation of it
                if len(toc_page_numbers) == 0 or toc_page_numbers[-1] == page_number - 1:
                    toc_page_numbers.append(page_number)
                else:
                    # reached end of table of contents
                    break


    return list(map(lambda page_no: html_doc.pages[page_no], toc_page_numbers)), toc_page_numbers


def construct_toc(page):
    """
    Attempts to extract the rows of the table of contents in the page. This
    is necessary because very often rows in the table of contents span
    multiple lines.
    
    For example, the two lines
    "Table 1: A long table" and
    "title................2"
    would ideally be merged into one row.
    
    Parameters
    ----------
    page: html_page.html_page
        the page to construct the table of content rows from. The page should
        be detected to be part of the table of contents from the 'html_analyzer.get_toc_pages'
        function.
    
    Returns
    ----------
    list
        a list of strings representing the rows in the table of contents
    """
    page_text = page.text_lines
    # reconstruct rows in toc
    toc_rows = []
    # variable to store the current row we are extracting
    current_row = None
    for line in page_text:
        # detect if this line starts a label (such as 'table 1.1')
        has_label = bool(re.search(LABEL_REGEX, line))
        if bool(re.search(r'\.{2,}', line)):
            # this line has a long span of periods ("......."). If
            # the current row has a label, then merge the
            # previous row and this one into one row. Otherwise, add
            # this line as its own row.
            if current_row:
                toc_rows.append(current_row + ' ' + line)
                current_row = None
            else:
                toc_rows.append(line)
        else:
            # this line does not have a long span of periods. If
            # the current row has a label, and this line
            # also has a label, do not merge this line into the current row. 
            # If the current row has a label and this line
            # does not have a label, merge this line into the current row. 
            # If the current row does not have a label and this line
            # has a label, then set this line as the current row.
            if current_row:
                if has_label:
                    toc_rows.append(current_row)
                    current_row = line
                else:
                    current_row += ' ' + line
            else:
                if has_label:
                    current_row = line
    
    # reached the end of lines on the page, add the current row
    if current_row:
        toc_rows.append(current_row)
   
    return toc_rows


def extract_toc_labels(page):
    """
    Attempts to extract labels from the table of contents page. For example,
    the row 'Table 1 Environmental Effects.............2' contains the label
    'table1': 'Environmental Effects'
    
    Parameters
    ----------
    page: html_page.html_page
        the page to extract table of contents labels from. The page should
        be detected to be part of the table of contents from the 'html_analyzer.get_toc_pages'
        function.
        
    Returns
    ----------
    dict
        a dictionary mapping identifiers (such as 'table1') to labels (such as
        'Environmental Effects'). Identifiers have spaces removed and are in 
        lower-case. This makes them easier to use later.
    """
    # get a list of strings representing the rows of the table of contents
    # on this page
    toc_rows = construct_toc(page)
    
    labels = {}
    for row in toc_rows:
        # find the label corresponding to this row
        rx = re.findall(LABEL_REGEX, row)
        if len(rx) > 0:
            rx = rx[0]
            identifier = rx[2] if rx[2] != '' else rx[3]
            string_ahead = row.split(rx[0])[1]
            # remove everything after the ..... portion when extracting
            # the label text
            string_ahead = re.sub(r'(?:\.{2,})+.*', '', string_ahead)
            
            # map the label identifier to the label text
            labels[str(rx[1]).lower() + str(identifier).lower()] = string_ahead.strip()
            
    return labels


def extract_title(html_doc):
    """
    Attempts to get the title of the document.
    
    Parameters
    ----------
    html_doc: html_document.html_document
        the html document to extract the title from
        
    Returns
    ----------
    str or None
        the best guess at the title of the document, or None
        if no title was identified
    """
    # list of lines belonging to the title, or None if no title was found yet
    title_lines = None
    
    
    for page in html_doc.pages[:3]:
        """
            First strategy: attempt to detect title or subject labels on page
        """
        for i, line in enumerate(page.lines):
            if line.text.lower().startswith(('subject', 'title', 'project title', 're:')):
                if i == len(page.lines) - 1:
                    title_lines = [line]
                else:
                    # if there are less than 4 words on this line, this line probably
                    # doesn't contain the actual title, so we start from the following
                    # line to get the title
                    if len(line.text.split(' ')) >= 4:
                        title_lines = get_line_extent(page.lines, i, html_doc)
                    else:
                        title_lines = [line] + get_line_extent(page.lines, i + 1, html_doc)
                break
        
        if title_lines: break
        
        """
            Second strategy: attempt to detect elements of a letter.
            It has been noticed that the subject of the letter is often placed
            after the greeting line.
        """
        for i, line in enumerate(page.lines):
            if line.text.lower().startswith(('dear', 'to:')):
                if i < len(page.lines) - 1:
                    title_lines = get_line_extent(page.lines, i + 1, html_doc)
                    break
        
        if title_lines: break
    
    
    if not title_lines:
        """
            Third strategy: find first page with any text on it, then extract the
            tallest lines on the page.
        """
        
        # find the first page with any text on it
        first_text_page = None
        for page in html_doc.pages:
            if len(page.text_lines) > 0:
                first_text_page = page
                break
        
        if not first_text_page: return None
        
        # shallow copy of lines so we can sort and modify the list without
        # changing the page
        lines_copy = first_text_page.lines[:]
        lines_to_check = lines_copy
        
        # get the top 1 or 2 heights on the page
        heights = list(sorted(set([line.bbox[3] for line in lines_to_check]), reverse=True))
        if len(heights) > 2:
            valid_heights = heights[:2]
        else:
            valid_heights = heights[:1]
        
        # get the first set of lines on the page with the top 1 or 2 heights
        # on the page, and use these lines as the title
        title_lines = []
        found_start = False
        for line in lines_to_check:
            if line.bbox[3] in valid_heights:
                found_start = True
                title_lines.append(line)
            else:
                if found_start:
                    break
                    
                    
    # construct text from lines
    title_text = ''
    for line in title_lines:
        title_text += line.text + '\n'
    
    return title_text[:-1]


def lines_to_label(lines):
    """
    Converts a list of html_page.html_line tuples to a single
    html_analyzer.html_label tuple.
    
    Parameters
    ----------
    lines: list
        a list of html_page.html_line named tuples
    
    Returns
    ----------
    html_analyzer.html_label
        the label constructed from the lines
    """
    label_text = ''
    for line in lines:
        label_text += line.text + ' '
    
    label_text = label_text.strip()
            
    return html_label(
            center=lines[0].center,
            first_line=lines[0],
            text=label_text
        )

      
def extract_labels(page, merge_strategy='height'):
    """
    Attempts to extract labels and captions on the page. A line is considered
    a label if it matches the regex html_analyzer.LABEL_REGEX.
    
    Parameters
    ----------
    page: html_page.html_page
        the page to extract labels from
    merge_strategy: str (default: 'height')
        the strategy to use when detecting how many lines a label spans.
        For valid values and explanations please see the function 
        html_analyzer.get_line_extent.
    
    Returns
    ----------
    list
        a list of the labels identified on the page. Labels are stored as
        named tuples defined in html_analyzer.html_label.
    """
    labels = []
    # extract possible labels
    for line_number, line_data in enumerate(page.lines):
        # try to match the label regex with this line. If a match is found,
        # this line is likely a label.
        if bool(re.match(LABEL_REGEX, line_data.text)):
            # include the set of lines following this line with the label. When searching
            # for the extent of this label, stop the search if we encounter
            # another line that appears to be a label too.
            extent = get_line_extent(
                    page.lines, line_number, page.html_document, merge_strategy=merge_strategy,
                    additional_check = lambda _, check_line: not bool(re.match(LABEL_REGEX, check_line.text))
                    )
            
            labels.append(lines_to_label(extent))
    
    return labels


def tag_images(page, images, labels, toc_labels, previous_page_tagged_images=None):
    """
    Attempts to tag every image on a page using the page labels, as well as
    some other methods.
    
    Parameters
    ----------
    page: html_page.html_page
        the page from which the images and labels were extracted from
    images: list
        a list of images on the page. The elements of this list are named
        tuples defined in html_page.html_image. The images should be
        sorted in the order they appear on the page (so the first image is
        the top-most one)
    labels: list
        a list of labels identified on the page. The elements of this list
        are named tuples defined in html_analyzer.html_label
    toc_labels: dict
        a dictionary of labels identified from the table of contents of the
        document. The dictionary should map identifier to label. For more
        information see the function html_analyzer.extract_toc_labels.
    previous_page_tagged_images: list or None
        a list of html_analyzer.html_image_tagged tuples representing the 
        images on the previous page with their associated labels. This
        parameter should be the return value of this function, applied on
        the previous page in the document
        
    Returns
    ----------
    list
        a list of named tuples representing the images on the page with their 
        associated label. Format of these tuples is defined in 
        html_analyzer.html_image_tagged. The list preserves the same
        order as the images parameter
    """
    # numpy cannot find the index of an image in an array, so we
    # need to explicitly include the index.
    
    # list of tuples with the first element representing the label index in
    # the original list, and the second element as the actual label.
    labels_containers = []
    for i in range(len(labels)):
        labels_containers.append(('label-{}'.format(i), labels[i]))
        
    # list of tuples with the first element representing the image index in
    # the original list, and the second element as the actual image.
    images_containers = []
    for i in range(len(images)):
        images_containers.append(('image-{}'.format(i), images[i]))
        
    # sort page elements (images + labels) by their vertical order on the page
    page_elements = labels_containers + images_containers
    page_elements.sort(key=lambda el: el[1].center[1])
    
    # check if labels can be determined from the layout of the page
    
    # this offset integer is either -1, 0, or 1. It tells us how the page
    # images and labels are laid out.
    label_search_offset = 0
    if len(page_elements) > 1:
        if page_elements[0] in labels_containers and page_elements[-1] not in labels_containers:
            # the first element on this page is a label, and the last element is an image.
            # this tells us that the page layout is likely <label> <image> <label> <image> ... <label> <image>.
            # when trying to tag images, we will try to use the directly preceding element on the page.
            label_search_offset = -1
        elif page_elements[0] not in labels_containers and page_elements[-1] in labels_containers:
            # the first element on this page is an image, and the last element is a label.
            # this tells us that the page layout is likely <image> <label> <image> <label> ... <image> <label>.
            # when trying to tag images, we will try to use the directly succeeding element on the page.
            label_search_offset = 1
    
    # list of all images with their tags
    images_tagged = []
    for img_container in images_containers:
        img_id, img = img_container
        # by default, use the closest valid label
        use_distance_search = True
        # if a layout was detected, attempt to use the layout to find the label
        if label_search_offset != 0:
            img_index = util.linear_search(page_elements, lambda el: el[0] == img_id)
            # check the page element is actually a label. If it is not a label, then
            # the layout prediction was false and we should just use distance search.
            if page_elements[img_index + label_search_offset] in labels_containers:
                img_label = page_elements[img_index + label_search_offset][1]
                # check label is valid
                if img.is_table != img_label.text.lower().startswith(('table', 'appendix')):
                    use_distance_search = True
                else:
                    use_distance_search = False
        
        if use_distance_search:
            # attempt to find the closest valid label for the image
            
            img_is_table = img.is_table
            
            labels_copy = labels[:]
            # discard labels inside the table (since sometimes tables will mention other tables),
            # unless this produces an empty list
            if img_is_table:
                labels_outside_of_table = list(filter(lambda label: not util.bbox_contains(img.bbox, label.center), labels_copy))
                if len(labels_outside_of_table) > 0: labels_copy = labels_outside_of_table[:]
            
            img_x, img_y = img.center
            
            img_label = None
            
            while not img_label and len(labels_copy) > 0:
                # get closest label
                img_label_check = min(labels_copy, key=lambda label: math.sqrt(math.pow(img_x - label.center[0], 2.0) + math.pow(img_y - label.center[1], 2.0)))
                        
                # check if img_label_check is valid
                img_label_for_table = img_label_check.text.lower().startswith(('table', 'appendix'))
                
                if bool(img_is_table) != bool(img_label_for_table):
                    # invalid
                    labels_copy.remove(img_label_check)
                else:
                    # valid
                    img_label = img_label_check
                    break
        
        toc_label = None
        
        if not img_label:
            """
            Attempt alternative methods to caption images if previous methods failed
            """
            # attempt to detect if table is a continuation of the last table on the previous page
            if img.is_table and previous_page_tagged_images is not None and len(previous_page_tagged_images) > 0:
                previous_page_tables = list(filter(lambda tagged_image: tagged_image.image_data.is_table, previous_page_tagged_images))
                if len(previous_page_tables) > 0:
                    last_table_on_previous_page = previous_page_tables[-1]
                    if abs(img.bbox[2] - last_table_on_previous_page.image_data.bbox[2]) < 5:
                        # this table shares the same width as the last table on the previous page,
                        # making it a likely candidate to be the next part of the table
                        img_label = last_table_on_previous_page.label
                        
            # attempt to detect if image is a large map or diagram. From inspection it appears
            # that these diagrams typically have their caption as a large font in the bottom
            # section of the page, so we use the largest text on the bottom fifth of the page
            # as the caption
            if not img.is_table and len(page.lines) > 0 and util.bbox_size(img.bbox) / (page.page_width * page.page_height) >= 0.7:
                # get lines in lower third of page
                lines_lower = list(filter(lambda line: line.bbox[1] <= page.page_height / 5.0, page.lines))
                if len(lines_lower) == 0: lines_lower = page.lines[:]
                
                while not img_label or (len(re.findall('[a-z]', img_label.text.lower())) < 5 and len(lines_lower) > 0):
                    # get tallest line (max height size) in this section of the page
                    tallest_line = max(lines_lower, key=lambda line: line.max_font_size)
                    lines_lower.remove(tallest_line)
                    img_label = lines_to_label(get_line_extent(page.lines, page.lines.index(tallest_line), page.html_document))
        
        if img_label:
            """
            Attempt to find the identifier in the table of contents
            """
            img_label_text = img_label.text
            # extract identifier from label, then check if it exists in the table
            # of contents. If it does, then include this label as well in the
            # output.
            rx = re.findall(LABEL_REGEX, img_label_text)
            if len(rx) > 0:
                rx = rx[0]
                identifier = rx[2] if rx[2] != '' else rx[3]
                try:
                    toc_label = toc_labels[str(rx[1]).lower() + str(identifier).lower()]
                except KeyError:
                    pass
            else:
                pass
        images_tagged.append(html_image_tagged(
            image_data=img,
            label=img_label,
            toc_label=toc_label
        ))
    
    return images_tagged


def find_location_tags_from_text(raw_text, cleaned_text):
    """
    Attempts to find location tags in the page.
    Location systems checked: 
        Latitude/Longitude, 
        Dominion Land Survey (DLS), 
        National Topographic System (NTS),
        Mainline Valve (MLV).
    
    The regex used in this function is defined in:
        html_analyzer.LAT_LONG_DD_1_REGEX,
        html_analyzer.LAT_LONG_DD_2_REGEX,
        html_analyzer.LAT_LONG_DMS_REGEX,
        html_analyzer.DLS_REGEX,
        html_analyzer.NTS_REGEX,
        html_analyzer.MLV_REGEX
        
    
    Parameters
    ----------
    raw_text: list
        a list of strings representing the text rows on the page. Text should be raw. 
        'Raw' means the function util.clean_text has not been applied on the string.
    cleaned_text: str
        a list of strings representing the text rows on the page. Text should be clean.
        'Cleaned' means the function util.clean_text has been applied on the string.
    
    Returns
    ----------
    list
        a list of lat/long coordinates extracted from page. Elements of list
        are named tuples of type html_analyzer.lat_long_coordinate
    list
        a list of DLS tags extracted from page. Elements of list are named
        tuples of type html_analyzer.dls_location
    list
        a list of NTS tags extracted from page. Elements of list are named
        tuples of type html_analyzer.nts_location
    list
        a list of MLV tags extracted from page. Elements of list are named
        tuples of type html_analyzer.mlv_location
    """
    
    # lists of all locations extracted from the page    
    lat_long_tags_result = []
    dls_tags_result = []
    nts_tags_result = []
    mlv_tags_result = []
    
    """
    Extract all latitude-longitude coordinates
    """
    lat_long_tags = []
    for line in cleaned_text:
        lat_long_tags += re.findall(LAT_LONG_DD_1_REGEX, line)
        
    
    lat_long_tags_2 = re.findall(LAT_LONG_DD_2_REGEX, ' '.join(cleaned_text))
    for tag in lat_long_tags_2:
        # depending on if the coordinate is positive or negative, convert to NWSE
        abs_degrees = abs(float(tag[1]))
        if tag[0].lower() in ('lat', 'latitude'):
            if float(tag[1]) > 0:
                lat_long_tags.append((abs_degrees, 'N'))
            else:
                lat_long_tags.append((abs_degrees, 'S'))
        else:
            if float(tag[1]) > 0:
                lat_long_tags.append((abs_degrees, 'E'))
            else:
                lat_long_tags.append((abs_degrees, 'W'))
    
    lat_long_tags_3 = re.findall(LAT_LONG_DMS_REGEX, re.sub('\s+', '', ' '.join(cleaned_text)))
    
    for tag in lat_long_tags_3:
        degrees, minutes, seconds = float(tag[0]), float(tag[1]), float(tag[2])
        # if latitude/longitude coordinates are unreasonably large, we
        # probably included too many digits in the beginning from a
        # previous line. Remove the first digit until the coordinate makes
        # sense.
        if tag[3] in ('N', 'S'):
            degrees = util.truncate_to_abs_value(degrees, 90.0)
        else:
            degrees = util.truncate_to_abs_value(degrees, 180.0)
        # convert to decimal degrees
        lat_long_tags.append((degrees + (minutes / 60) + (seconds / 3600), tag[3]))
    
    # check that there is a least one latitude coordinate and one longitude coordinate
    # on the page. Otherwise, the regex was probably unsuccessful and we cannot use
    # the result.
    if not ((len(list(filter(lambda tag: tag[1] in ('N', 'S'), lat_long_tags))) > 0 and 
        len(list(filter(lambda tag: tag[1] in ('W', 'E'), lat_long_tags))) > 0)):
        lat_long_tags = []
        
    # match lat-long tags together to create html_analyzer.lat_long_coordinate
    # tuples
    lat_long_tags_unmatched = lat_long_tags[:]
    while len(lat_long_tags_unmatched) >= 2:
        tag = lat_long_tags_unmatched.pop(0)
        if tag[1] in ('N', 'S'):
            pair = lat_long_tags_unmatched[0]
            if pair[1] in ('W', 'E'):
                N = float(tag[0]) if tag[1] == 'N' else -1 * float(tag[0])
                W = float(pair[0]) if pair[1] == 'W' else -1 * float(pair[0])
                
                # if latitude/longitude coordinates are unreasonably large, we
                # probably included too many digits in the beginning from a
                # previous line. Remove the first digit until the coordinate
                # makes sense.
                N = util.truncate_to_abs_value(N, 90.0)
                W = util.truncate_to_abs_value(W, 180.0)
                
                lat_long_tags_result.append(lat_long_coordinate(
                        N=N,
                        W=W,
                        text='{} N, {} W'.format(N, W)
                    ))
                lat_long_tags_unmatched.pop(0)
    
    
    """
    Extract all DLS locations
    """
    dls_tags = re.findall(DLS_REGEX, re.sub('\s+', '', ' '.join(raw_text)))
        
    for tag in dls_tags:
        try:
            legal_subdivision = int(tag[0])
            # remove the first digit from the legal subdivision until it
            # makes sense. We do this because sometimes the regex includes
            # too many digits from a previous line.
            legal_subdivision = util.truncate_to_abs_value(legal_subdivision, 16)
        except ValueError:
            if tag[0] != '':
                legal_subdivision = tag[0]
            else:
                legal_subdivision = None
            
        section, township, range_ = int(tag[1]), int(tag[3]), int(tag[4])
        
        # the meridian can be an integer or 'P'.
        try:
            meridian = int(tag[5])
        except ValueError:
            meridian = tag[5]
        
        # get string representation of the DLS location
        if legal_subdivision is None:
            string = '{}-{}-{}-W{}M'.format(section, township, range_, meridian)
        else:
            string = '{}-{}-{}-{}-W{}M'.format(legal_subdivision, section, township, range_, meridian)
        
        # convert DLS location to a latitude-longitude coordinate
        lat_long_representation = gis_converter.dls_to_lat_long(legal_subdivision, section, township, range_, meridian)
        
        dls_tags_result.append(dls_location(
                legal_subdivision=legal_subdivision, 
                section=section, 
                township=township, 
                range=range_, 
                meridian=meridian, 
                text=string, 
                lat_long=lat_long_representation
            ))
    
    """
    Extract all NTS locations
    """
    nts_tags = []
    for line in raw_text:
        nts_tags += re.findall(NTS_REGEX, re.sub('\s+', '', line))
        
    for tag in nts_tags:
        quarter_unit, unit, block, series_number, map_area, map_sheet = tag[0].lower(), int(tag[2]), tag[3].upper(), int(tag[4]), tag[5].upper(), int(tag[6])
        string = '{}-{}-{}/{}-{}-{}'.format(quarter_unit, unit, block, series_number, map_area, map_sheet)
        
        # convert NTS location to a latitude-longitude coordinate
        lat_long_representation = gis_converter.nts_to_latlong(quarter_unit, unit, block, series_number, map_area, map_sheet)
        if lat_long_representation is None:
            print('Warning: {} NTS tag is not valid'.format(string))
        else:
            nts_tags_result.append(nts_location(
                    quarter_unit=quarter_unit, 
                    unit=unit, 
                    block=block, 
                    series_number=series_number, 
                    map_area=map_area, 
                    map_sheet=map_sheet,
                    text=string,
                    lat_long=lat_long_representation
                ))
        
    
    """
    mlv
    """
    for tag in re.findall(MLV_REGEX, re.sub('\s+', '', ' '.join(cleaned_text))):
        valve_no, offset, units = tag
        if offset == "":
            string = 'MLV {}'.format(valve_no)
        else:
            string = 'MLV {} + {}'.format(valve_no, offset) + units
        
        mlv_tags_result.append(mlv_location(
                valve=valve_no,
                offset=offset,
                text=string
            ))
            
            
    return lat_long_tags_result, dls_tags_result, nts_tags_result, mlv_tags_result


def find_location_tags(page):
    """
    Convenience function, calls html_analyzer.find_location_tags_from_text
    using the text in the page. For more information see the docstring
    for html_analyzer.find_location_tags_from_text.
    """
    
    return find_location_tags_from_text(page.raw_lines, page.text_lines)
