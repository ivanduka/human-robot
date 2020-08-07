
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

import re
#import math
import collections
from typing import List, Any

import gis_converter
import util
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




def find_location_tags_from_text(tika_text, page_number):
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
    mlv_tags_result= []

    """
    Extract all latitude-longitude coordinates
    """
    lat_long_tags = []
    lat_long_tags += re.findall(LAT_LONG_DD_1_REGEX, tika_text)

    lat_long_tags_2 = re.findall(LAT_LONG_DD_2_REGEX, ' '.join(tika_text))
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

    lat_long_tags_3 = re.findall(LAT_LONG_DMS_REGEX, re.sub('\s+', '', ' '.join(tika_text)))

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
    dls_tags = re.findall(DLS_REGEX, re.sub('\s+', '', ' '.join(tika_text)))

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
    nts_tags += re.findall(NTS_REGEX, re.sub('\s+', '', tika_text))

    for tag in nts_tags:
        quarter_unit, unit, block, series_number, map_area, map_sheet = tag[0].lower(), int(tag[2]), tag[3].upper(), int(tag[4]), tag[5].upper(), int(tag[6])
        string = '{}-{}-{}/{}-{}-{}'.format(quarter_unit, unit, block, series_number, map_area, map_sheet)

        # convert NTS location to a latitude-longitude coordinate
        lat_long_representation = gis_converter.nts_to_latlong(quarter_unit, unit, block, series_number, map_area,
                                                               map_sheet)
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
    for tag in re.findall(MLV_REGEX, re.sub('\s+', '', ' '.join(tika_text))):
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