# -*- coding: utf-8 -*-
"""
This file contains utility functions used for the more low-level analysis of
html documents, such as image extraction and html traversal.
"""

import bs4

#import cv2
import numpy as np
import re

import itertools
import networkx

def linear_search(l, condition):
    """
    Returns the index of the list for the first element that satisfies the 
    condition, or None if no elements satisfy the condition
    
    Parameters
    ----------
    l: list
        the list to search
    condition: function
        the condition function to search for. Should return True or False
    
    Returns
    ----------
    int or None
       the index of the first element that satisfies the condition, or None
       if no elements satisfy the condition
    """
    for i, element in enumerate(l):
        if condition(element):
            return i
    
    return None


def get_max_or_none(a, b):
    if a is None: return b
    if b is None: return a
    return max(a, b)


def get_min_or_none(a, b):
    if a is None: return b
    if b is None: return a
    return min(a, b)


def truncate_to_abs_value(val, goal):
    """
    Truncates a number's digits from the most significant digit, until
    the absolute value of the number does not exceed the goal.
    
    For example:
        truncate_to_abs_value(123, 5) = 3
        truncate_to_abs_value(-11, 1) = -1
    """
    while abs(val) > goal:
        val = float(str(val)[1:]) if val > 0 else -1 * float(str(abs(val))[1:])
        
    if val == 0: return None
    
    return val


"""
A note about bounding box representations:
    The functions in this file use a 2D coordinate system with the x-y
    origin at the top-left corner and y increases down the image.
    Consider the box with endpoints (1, 1), (1, 3), (2, 3), (2, 1). This box
    can be represented in a lot of ways. There are two representations these
    functions use:
        (x, y, w, h) representation: this representation specifies the top-left
        corner of the box and its width and height. For the example box, this
        representation would be (1, 1, 1, 2)
        (ulx, uly, lrx, lry) representation: this representation specifies the
        upper-left and lower-right corners of the box. For the example box,
        this representation would be (1, 1, 2, 3)
"""


def bbox_size(bbox):
    """
    Gets the size of a bounding box.
    
    Parameters
    ----------
    bbox: tuple or list
        the bounding box. Must be in (x, y, w, h) form.
    
    Returns
    ----------
    float
        the size of the box
    """
    return float(bbox[2] * bbox[3])


def bbox_contains(bbox, point):
    """
    Returns if a given point is contained within a box. If a point is on a border of
    the box, it is considered contained.
    
    Parameters
    ----------
    bbox: tuple or list
        the box. Must be in (x, y, w, h) form.
    point: tuple or list
        the point to check if it is contained within the box. Must be in
        (x, y) form.
    
    Returns
    ----------
    boolean
        if the point is contained within the box.
    """
    
    return point[0] >= bbox[0] and point[0] <= bbox[0] + bbox[2] and point[1] >= bbox[1] and point[1] <= bbox[1] + bbox[3]


def _bbox_to_coords(bbox):
    """
    Transforms (x, y, w, h) representation of a bounding box to 
    (ulx, uly, lrx, lry) representation.
    
    Parameters
    ----------
    bbox: tuple or list
        the bounding box. Must be in (x, y, w, h) form
    
    Returns
    ----------
    tuple
        the same bounding box in (ulx, uly, lrx, lry) representation
    """
    return (bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3])


def _contains(big_rect, small_rect):
    """
    Checks if a rectangle is contained within another.
    Two identical rectangles are considered contained within eachother.
    
    Parameters
    ----------
    big_rect: tuple or list
        the box to check if the other box is contained within it. Must be
        in (x, y, w, h) form
    small_rect: tuple or list
        the box to check if it is contained within the other box. Must be
        in (x, y, w, h) form.
    
    Returns
    ----------
    boolean
        if the rectangle (small_rect) is contained within the other
        rectangle (big_rect)
    """
    # if the widths and heights make it impossible for the small rectangle to be
    # contained in the larger one, return False
    if small_rect[2] > big_rect[2] or small_rect[3] > big_rect[3]: return False
    
    # convert to (ulx, uly, lrx, lry) form to make things easier
    big_rect_ulx, big_rect_uly, big_rect_lrx, big_rect_lry = _bbox_to_coords(big_rect)
    small_rect_ulx, small_rect_uly, small_rect_lrx, small_rect_lry = _bbox_to_coords(small_rect)
    
    return small_rect_ulx >= big_rect_ulx and small_rect_uly >= big_rect_uly and small_rect_lrx <= big_rect_lrx and small_rect_lry <= big_rect_lry


def _overlap1D(intv1, intv2):
    """
    Returns if two one-dimensional intervals overlap. Overlapping
    on the boundaries is considered overlapping.
    
    Parameters
    ----------
    intv1: tuple or list
        a 1-D range (for example, [0, 2] means 0 to 2)
    intv2: tuple or list
        a 1-D range
    
    Returns
    ----------
    boolean
        if the ranges overlap
    """
    return intv1[1] >= intv2[0] and intv2[1] >= intv1[0]

    
# bboxes should be in coordinate representation
def _overlap(bbox1, bbox2):
    """
    Returns if two boxes overlap. Overlapping on boundaries is considered
    overlapping.
    
    Parameteres
    ----------
    bbox1: tuple or list
        a box in (ulx, uly, lrx, lry) form
    bbox2: tuple or list
        a box in (ulx, uly, lrx, lry) form
    
    Returns
    ----------
    boolean
        if the two boxes overlap
    """
    return _overlap1D((bbox1[1], bbox1[3]), (bbox2[1], bbox2[3])) and _overlap1D((bbox1[0], bbox1[2]), (bbox2[0], bbox2[2]))


def _merge_overlapping_bboxes(bboxes):
    """
    Merges overlapping boxes.
    
    Parameters
    ----------
    bboxes: list
        a list of tuples representing the boxes to merge. The boxes should
        be in (x, y, w, h) representation
        
    Returns
    ----------
    list
        a list of boxes with overlapping boxes merged. If a group of boxes
        were detected as overlapping, they get replaced by their collective 
        bounding box. Boxes this list are in (x, y, w, h) representation
    """
    
    # approach: construct a graph with nodes as bboxes and edges representing
    # if two bboxes overlap. then get connected components of the graph.
    # finally, merge each connected component into a single bbox using maximum
    # bounds.
    
    
    # convert bboxes (x, y, w, h) representation to (ulx, uly, lrx, lry) form
    bboxes = list(map(lambda bbox: _bbox_to_coords(bbox), bboxes))
    
    # use the indices of the boxes in the list as nodes
    index_list = list(range(len(bboxes)))
    # initialize graph with self-loops
    edges = list(map(lambda i: (i, i), index_list))
    
    for i1, i2 in itertools.combinations(index_list, 2):
        # add an edge between two boxes if they overlap
        bbox1, bbox2 = bboxes[i1], bboxes[i2]
        if _overlap(bbox1, bbox2):
            edges.append((i1, i2))
            
    # get connected components
    G = networkx.Graph()
    G.add_edges_from(edges)
    connected_components = networkx.connected_components(G)
    
    # reconstruct bboxes (in (x, y, w, h) format)
    merged_bboxes = []
    for cc in connected_components:
        # convert indices back to bboxes
        bbox_components = list(map(lambda i: bboxes[i], cc))
        
        # get maximum bounds
        ulx = min(bbox_components, key=lambda coord: coord[0])[0]
        uly = min(bbox_components, key=lambda coord: coord[1])[1]
        lrx = max(bbox_components, key=lambda coord: coord[2])[2]
        lry = max(bbox_components, key=lambda coord: coord[3])[3]
        
        # convert back to width/height representation and add to output
        merged_bboxes.append((ulx, uly, lrx - ulx, lry - uly))
        
    return merged_bboxes


# filter bboxs contained in another bbox
def _remove_contained_bboxes(bboxes):
    """
    Filters out all boxes that are contained in another box
    
    Parameters
    ----------
    bboxes: list
        a list of tuples representing the boxes to filter. The boxes
        should be in (x, y, w, h) form.
        
    Returns
    ----------
    list
        a list of tuples representing the boxes, but with any boxes
        that are contained in another box removed. Boxes are in
        (x, y, w, h) form.
    """
    external_bboxes = []
    for i, bbox in enumerate(bboxes):
        # only add the box to the output if it is not contained in
        # any other box
        if all(n == i or not _contains(other_bbox, bbox)
                    for n, other_bbox in enumerate(bboxes)):
            external_bboxes.append(bbox)
            
    return external_bboxes


def get_trimmed_images(img, DEBUG_PATH=None):
    """
    Trims surrounding whitespace from image, and extracts all images contained
    within the image.
    
    This is necessary as images are often grouped together into a larger image
    in documents, so this function attempts to reverse that process.
    
    Some tips taken from https://stackoverflow.com/questions/56604151/python-extract-multiple-objects-from-image-opencv
    
    Parameters
    ----------
    img: cv2 image 
        the image for trimming and extraction
    DEBUG_PATH: str (optional, default=None)
        an optional path to output snapshots of checkpoints in the process
    
    Returns
    ----------
    list
        a list of dictionaries containing the extracted images. Each dictionary
        follows the following format:
            {
                "image": a cv2 image representing the actual image data
                "bbox":  a (x, y, w, h) tuple representing the bounding box of
                         the image, relative to the outer image. x-y origin is
                         at the top-left corner and y increases downwards.
                         NOTE: this x-y coordinate system is different from the
                         one used in html pages, so it needs to be converted
                         to the page coordinate system if neeeded.
            }
    """
    def _save_to_debug(img_debug, bboxes, contours, title):
        """
        Saves an image to a file for debugging. This function is only called
        if the DEBUG_PATH parameter is provided.
        """
        if bboxes or contours:
            img_debug = img_debug.copy()
            
            if bboxes:
                for bbox in bboxes:
                    x,y,w,h = bbox
                    cv2.rectangle(img_debug, (x, y), (x + w, y + h), (255, 0, 0), 3)
                    
            if contours:
                cv2.drawContours(img_debug, contours, -1, (0, 0, 255), 2)
        cv2.imwrite(DEBUG_PATH + title + '.png', img_debug)
    if DEBUG_PATH:
        _save_to_debug(img, None, None, "[0] original image")
    
    # apply some transformations to the image to prepare it
    orig = img
    img = img.copy()
    mask = cv2.inRange(img, lowerb=(0,0,0), upperb=(250,250,250))
    kernel = np.ones((10,10),np.uint8)
    dilate = cv2.dilate(mask, kernel, iterations=1)
# extra transforms, not useful for our purpose
#    blurred = cv2.GaussianBlur(mask, (3, 3), 0)    
#    canny = cv2.Canny(blurred, 120, 255, 1)
    
    if DEBUG_PATH: _save_to_debug(mask, None, None, "[1] prepare mask")
    if DEBUG_PATH: _save_to_debug(dilate, None, None, "[2] dilate")
    
    # Find contours
    contour_data = cv2.findContours(dilate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contour_data) == 3:
        _, contours, hierarchy = contour_data
    else:
        contours, hierarchy = contour_data
    
    # convert contours to bounding boxes
    bboxes = list(map(lambda c: cv2.boundingRect(c), contours))
    if DEBUG_PATH: _save_to_debug(orig, bboxes, contours, "[3] find contours and get bounding boxes")
    
    images = []
    
    if len(bboxes) >= 10:
        # There are too many images. We probably didn't split image correctly, 
        # so just return the full image.
        h, w, _ = orig.shape
        images.append({
                    'image': orig,
                    'bbox': (0,0,w,h)
                })
    else:
        # filter artifact bboxes (ones that are too small)
        bboxes = list(filter(lambda b: b[2] > 20 and b[3] > 20, bboxes))
        if DEBUG_PATH: _save_to_debug(orig, bboxes, None, "[4] filter boxes that are too small")
        
        # combine overlapping bboxes
        bboxes = _merge_overlapping_bboxes(bboxes)
        if DEBUG_PATH: _save_to_debug(orig, bboxes, None, "[5] merge overlapping boxes")
        
        # filter bboxes contained in another bbox
        bboxes = _remove_contained_bboxes(bboxes)
        if DEBUG_PATH: _save_to_debug(orig, bboxes, None, "[6] remove boxes contained in other boxes")
        
        # extract images from bboxes
        for bbox in bboxes:
            x,y,w,h = bbox
            
            ROI = orig[y:y+h, x:x+w]
            
            images.append({
                    'image': ROI,
                    'bbox': (x,y,w,h)
                })

    return images


def get_descendent_text(root):
    """
    Gets a string containing all text that is in the root or is in a descendant
    of the root.
    
    Parameters
    ----------
    root: bs4.element.NavigableString or bs4.element.Tag
        the root html element to extract text from
        
    Returns
    ----------
    str
        a string containing all the text in root or in the descendants of root
    """
    if type(root) == bs4.element.NavigableString:
        return str(root)
    elif type(root) == bs4.element.Tag:
        str_ = ""
        for content in root.contents:
            str_ += get_descendent_text(content)
        return str_
    

def clean_text(text):
    """
    Replaces all non-latin characters with a space, replaces non-breaking
    hyphens with a normal hyphen, and removes surrounding whitespace.
    
    Parameters
    ----------
    text: str
        a string to clean
    
    Returns
    ----------
    text: str
        the cleaned string
    """
    text = re.sub(r'[\‐\–\—]', '-', text)
    # https://stackoverflow.com/questions/23680976/python-removing-non-latin-characters
    return re.sub(r'[^\x00-\x7F°’”]', u' ', text).strip()

"""
    Functions for table detection
"""

def _is_vertical_or_horizontal(line):
    """
    Returns if line is completely vertical or horizontal, within an accuracy
    of 1 pixel. The line parameter should be in (x1, y1, x2, y2) form.
    """
    x1, y1, x2, y2 = line[0]
    if abs(x1 - x2) <= 1 or abs(y2 - y1) <= 1: return True
    return False


def _length(line):
    """
    Returns the Manhattan distance between the endpoints of the line.
    The line should be in (x1, y1, x2, y2) form.
    """
    x1, y1, x2, y2 = line[0]
    
    return abs(x1 - x2) + abs(y1 - y2)


def skeletonize(img):
    """
        Not used, but could be helpful. Attempts to skeletonize an image.
        Adapted from:
        https://gist.github.com/jsheedy/3913ab49d344fac4d02bcc887ba4277d
    """
    img = img.copy()
    skel = img.copy()
    
    skel[:,:] = 0
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3,3))
    
    #num_iterations = 0
    while True:
        #num_iterations += 1
        eroded = cv2.morphologyEx(img, cv2.MORPH_ERODE, kernel)
        temp = cv2.morphologyEx(eroded, cv2.MORPH_DILATE, kernel)
        temp  = cv2.subtract(img, temp)
        skel = cv2.bitwise_or(skel, temp)
        img[:,:] = eroded[:,:]
        if cv2.countNonZero(img) == 0: #or num_iterations >= 3:
            break

    return skel
    

def detect_table(table_img, DEBUG_PATH=None):
    """
    Detects if the image is a table background or not.
    
    Parameters
    ----------
    table_img: cv2 image
        the image to detect if it is a table or not
    DEBUG_PATH: str (default: None)
        an optional path to output snapshots of checkpoints in the process
    
    Returns
    ----------
    bool:
        True if the image was detected as a table background, False otherwise
    """
    if DEBUG_PATH:
        def _save_to_debug(img_debug, title):
            """
            Function to output an intermediate image for debugging.
            """
            img_debug = img_debug.copy()
            cv2.imwrite(DEBUG_PATH + title + '.png', img_debug)
    
    # apply some transforms to the image to prepare it
    img = table_img.copy()
    if DEBUG_PATH: _save_to_debug(img, '[0] original')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if DEBUG_PATH: _save_to_debug(gray, '[1] grayscale')
    canny = cv2.Canny(gray, 100, 150, apertureSize=3)
    if DEBUG_PATH: _save_to_debug(canny, '[2] canny')
    morphology = canny
    
    
    # attempt hough lines probabilistic to get the lines detected in the image
    rho = 1 #1  # distance resolution in pixels of the Hough grid
    theta = np.pi / 180#180  # angular resolution in radians of the Hough grid
    threshold = 5  # minimum number of votes (intersections in Hough grid cell)
    min_line_length = 5  # minimum number of pixels making up a line
    max_line_gap = 10  # maximum gap in pixels between connectable line segments
    lines = cv2.HoughLinesP(image=morphology, rho=rho, theta=theta, threshold=threshold, lines=np.array([]), minLineLength=min_line_length, maxLineGap=max_line_gap)
    
    if DEBUG_PATH: 
        morphology = cv2.cvtColor(morphology, cv2.COLOR_GRAY2BGR)
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(morphology, (x1, y1), (x2, y2), (255, 0, 0), 2)
    
    # count the ratio of the length of horizontal/vertical lines
    # to the length of all lines. Lengths are approximate (using Manhattan distance)
    # since Euclidean distance is slower and not very necessary
    length_vh = 0
    length_total = 0
    if lines is None:
        return False
    for line in lines:
        length = _length(line)
        if _is_vertical_or_horizontal(line):
            length_vh += length
        length_total += length
    
    ratio = float(length_vh) / length_total
        
    if DEBUG_PATH: _save_to_debug(morphology, '[3] detect lines (ratio of vh lines={:.3f})'.format(ratio))
    
    return ratio >= 0.99

