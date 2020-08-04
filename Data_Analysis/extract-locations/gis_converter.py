# -*- coding: utf-8 -*-
"""
This file contains code used to convert DLS and NTS locations to
latitude and longitude coordinates.

Made from information from
http://www.fekete.com/SAN/WebHelp/FeketeHarmony/Harmony_WebHelp/Content/HTML_Files/Reference_Material/General_Concepts/GIS_Theory.htm
https://en.wikipedia.org/wiki/Dominion_Land_Survey

https://gis.stackexchange.com/questions/136461/calculating-lat-long-coordinates-from-dls-dominion-land-survey-location
https://gis.stackexchange.com/questions/142326/calculating-longitude-length-in-miles
https://open.canada.ca/data/en/fgpv_vpgf/055919c2-101e-4329-bfd7-1d0c333c0e62
"""

import math
import json
import html_analyzer

"""
Please change the following variables to where you have the input:
    NTS_TO_LATLONG_TXT:     the text file containing JSON data mapping
                            NTS identifiers to their latitude-longitude bounding
                            box
"""
NTS_TO_LATLONG_TXT = "nts_to_latlong.txt"


EARTH_RADIUS_MILES = 3958.8


# https://gis.stackexchange.com/questions/2951/algorithm-for-offsetting-a-latitude-longitude-by-some-amount-of-meters
def _offset_miles(latitude, longitude, miles_latitude, miles_longitude):
    """
    Given an original latitude-longitude coordinate and a distance offset, calculate
    the new latitude-longitude coordinate.
    
    More accurate calculations are probably available.
    
    Parameters
    ----------
    latitude: float
        the North direction latitude of the starting coordinate. Should be positive
    longitude: float
        the West direction latitude of the starting coordinate. Should be positive
    miles_latitude: float
        the North-South distance in miles to offset the coordinate, with North being positive
    miles_longitude: float
        the West-East distance in miles to offset the coordinate, with West being positive
    
    Returns
    ----------
    float
        the new North direction latitude coordinate
    float
        the new West direction longitude coordinate
    """
    latitude = latitude + math.degrees(miles_latitude / EARTH_RADIUS_MILES)
    longitude = longitude + math.degrees(miles_longitude / (EARTH_RADIUS_MILES * math.cos(math.radians(latitude))))
    
    return latitude, longitude


DLS_MERIDIAN_DEGREES = 4
DLS_BASELINE = 49
DLS_RANGE_WIDTH_MILES = 6
DLS_TOWNSHIP_WIDTH_MILES = 6
DLS_SECTION_WIDTH_MILES = 1
DLS_LSD_WIDTH_MILES = 0.25


def dls_meridian_to_longitude(meridian):
    """
    Gets the longitude in degrees West associated with the given meridian.
    
    Parameters
    ----------
    meridian: int or string
        the meridian to convert to degrees longitude, integer from 1 to 9
        or 'P' for Prime Meridian
    
    Returns
    ----------
    float
        the longitude in degrees West associated with the meridian
    """
    
    if meridian == 1 or meridian == 'P':
        return 97.45789
    else:
        return DLS_MERIDIAN_DEGREES * (meridian - 1) + 98


def dls_to_lat_long(legal_subdivision, section, township, range_, meridian):
    """
    Estimates a latitude-longitude coordinate from a given Dominion Land Survey
    (DLS) region.
    
    Assumes that the DLS location is in north-west hemisphere (N, W).
    
    Parameters
    ----------
    legal_subdivision:  int or string representing the legal subdivision, or None if not given
    section:            int representing the section
    township:           int representing the township 
    range_:             int representing the range
    meridian:           int or string indicating the meridian west of which this location
                        is describing
    
    Returns
    ----------
    html_analyzer.lat_long_coordinate:  html_analyzer.lat_long_coordinate representing the approximate
                                        latitude longitude coordinate of the center of this location
    """
    # calculate the longitudinal position of the meridian
    meridian_longitude = dls_meridian_to_longitude(meridian)
    
    # calculate the position of the range and township
    longitude_offset_miles_start = DLS_RANGE_WIDTH_MILES * (range_ - 1)
    latitude_offset_miles_start = DLS_TOWNSHIP_WIDTH_MILES * (township - 1)
    
    # calculate the position of the section
    if (int(section - 1) / 6) % 2 == 0:
        # section cells increase going West on this row
        longitude_offset_miles_start += (int(section - 1) % 6) * DLS_SECTION_WIDTH_MILES
    else:
        # section cells decrease going West on this row
        longitude_offset_miles_start += (6 - (int(section - 1) % 6) - 1) * DLS_SECTION_WIDTH_MILES
    
    latitude_offset_miles_start += (int(section - 1) / 6) * DLS_SECTION_WIDTH_MILES
    
    
    # calculate the position of the legal subdivision (LSD) (if it is used).
    # the location we have after calculating the legal subdivision represents the
    # south-east corner of the region. We use this location to find the middle
    # of the region.
    if legal_subdivision is not None:
        if type(legal_subdivision) == int:
            if (int(legal_subdivision - 1) / 4) % 2 == 0:
                # LSD cells increase going West on this row
                longitude_offset_miles_start += (int(legal_subdivision - 1) % 4) * DLS_LSD_WIDTH_MILES
            else:
                # LSD cells decrease going West on this row
                longitude_offset_miles_start += (4 - (int(legal_subdivision - 1) % 4) - 1) * DLS_LSD_WIDTH_MILES
            
            latitude_offset_miles_start += (int(legal_subdivision - 1) / 4) * DLS_LSD_WIDTH_MILES
            
            midpoint_offset_miles = DLS_LSD_WIDTH_MILES / 2
        else:
            if legal_subdivision[0] == 'N':
                latitude_offset_miles_start += 2 * DLS_LSD_WIDTH_MILES
            else:
                pass
            
            if legal_subdivision[1] == 'W':
                longitude_offset_miles_start += 2 * DLS_LSD_WIDTH_MILES
            else:
                pass
            
            midpoint_offset_miles = DLS_LSD_WIDTH_MILES
    else:
        midpoint_offset_miles = DLS_SECTION_WIDTH_MILES / 2
    
    # using the baseline and meridian, along with the offset from both in miles,
    # calculate the latitude-longitude location of the middle of the region
    lat, long = _offset_miles(DLS_BASELINE, meridian_longitude, latitude_offset_miles_start + midpoint_offset_miles, longitude_offset_miles_start + midpoint_offset_miles)
    
    return html_analyzer.lat_long_coordinate(
        N=lat,
        W=long,
        text='{} N, {} W'.format(lat, long)        
    )


# load the data file that can map an NTS identifier to its lat-long bounding box
with open(NTS_TO_LATLONG_TXT, 'r') as f:
    nts_to_latlong_dict = json.load(f)
    
    
def nts_to_latlong(quarter_unit, unit, block, series_number, map_area, map_sheet):
    """
    Estimates a latitude-longitude coordinate from a given National Topographic
    System (NTS) region.
    
    Assumes that the NTS location is in north-west hemisphere.
    
    Parameters
    ----------
    quarter_unit:     str representing the quarter unit
    unit:             int representing the unit
    block:            str representing the block
    series_number:    int representing the series number
    map_area:         str representing the map area
    map_sheet:        int representing the map sheet
    
    Returns
    ----------
    html_analyzer.lat_long_coordinate
    or None:                            html_analyzer.lat_long_coordinate representing the approximate
                                        latitude longitude coordinate of the center of this location,
                                        or None if the identifer could not be found
    """
    # get the identifier for the NTS region to use as a key to the dictionary
    # that maps NTS identifier to a bounding box
    bbox_id = '{:03d}{}{:02d}'.format(series_number, map_area.upper(), map_sheet)
    try:
        bbox = nts_to_latlong_dict[bbox_id]
    except KeyError:
        print('WARNING: Unknown NTS identifier ' + bbox_id)
        return None
    
    bbox_lat_height = abs(bbox[0] - bbox[2])
    bbox_long_width = abs(bbox[1] - bbox[3])
    
    # start at south-east corner
    corner_lat, corner_long = bbox[0], bbox[1]
    
    
    # calculate the position of the block
    
    # convert block to number from 0 to 11
    block = ord(block.upper()) - ord('A')
    if (int(block) / 4) % 2 == 0:
        # blocks increase going West on this row
        corner_long += (int(block) % 4) * bbox_long_width / 4.0
    else:
        # blocks decrease going West on this row
        corner_long += (4 - int(block) % 4 - 1) * bbox_long_width / 4.0
    
    corner_lat += (int(block) / 4) * bbox_lat_height / 3.0
    
    
    # calculate the position of the unit
    corner_long += ((unit - 1) % 10) * bbox_long_width / (4.0 * 10.0)
    corner_lat += ((unit - 1) / 10) * bbox_lat_height / (3.0 * 10.0)
    
    # calculate the position of the quarter_unit
    if quarter_unit.lower() in ('b', 'c'):
        corner_long += bbox_long_width / (4.0 * 10.0 * 2.0)
    
    if quarter_unit.lower() in ('c', 'd'):
        corner_lat += bbox_lat_height / (3.0 * 10.0 * 2.0)
    
    # using the position and offset, calculate the center of the NTS region
    lat, long = corner_lat + bbox_long_width / (3.0 * 10.0 * 2.0) / 2.0, corner_long + bbox_lat_height / (4.0 * 10.0 * 2.0) / 2.0
    
    return html_analyzer.lat_long_coordinate(
        N=lat,
        W=long,
        text='{} N, {} W'.format(lat, long)        
    )
    

