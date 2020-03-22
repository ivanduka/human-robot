import React, { Component } from "react";
import { Document, Page } from "react-pdf/dist/entry.webpack";
import { uuid } from "uuidv4";
import { generatePath, Link } from "react-router-dom";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";

import "./Extraction.css";

export default class Extraction extends Component {
  state = {
    numPages: null,
    pageNumber: null,
    pageHeight: null,
    pageWidth: null,
    file: null,
    uuid: uuid(),
    x1: null,
    y1: null,
    x2: null,
    y2: null,
    width: null,
    height: null,
    tableTitle: null,
    continuationOf: null,
    tables: [],
    pagesWithTables: null
  };

  pageIsRendered = () => {
    this.fixTextLayer();
    this.updatePageDimensions();
  };

  fixTextLayer = () => {
    const canvas = document.querySelector(".react-pdf__Page__canvas");
    const text = document.querySelector(".react-pdf__Page__textContent");
    const { style } = text;
    style.width = canvas.style.width;
    style.top = "0";
    style.left = "0";
    style.transform = "";
    // style.color = "unset"; // TEMPORARILY - ONLY FOR DEBUGGING!
  };

  updatePageDimensions = () => {
    const page = document.querySelector(".react-pdf__Page");

    if (page) {
      const controlsWidth = 2 + 5 + 300 + 5 + 1;
      const pageHorBorders = 1 + 2;
      const pageVerBorders = 2 + 2;

      const { width, height } = page.getBoundingClientRect();
      const availableWidth = window.innerWidth - controlsWidth - pageHorBorders;
      const availableHeight = window.innerHeight - pageVerBorders;

      const widthFactor = availableWidth / width;
      const heightFactor = availableHeight / height;

      if (widthFactor < heightFactor) {
        this.setState({ pageHeight: null, pageWidth: availableWidth });
      } else {
        this.setState({ pageHeight: availableHeight, pageWidth: null });
      }
    }
  };

  componentDidMount() {
    let { file, page } = this.props.match.params;
    console.log(this.props.match.params);
    if (page == null) {
      page = 1;
    }
    this.setState({ file, pageNumber: parseInt(page) });
    window.onresize = this.updatePageDimensions;
  }

  componentWillUnmount() {
    window.onresize = null;
  }

  onDocumentLoadSuccess = document => {
    const { numPages } = document;
    this.setState({ numPages });
  };

  changePage = offset => {
    this.setState(prevState => {
      const pageNumber = prevState.pageNumber + offset;
      this.props.history.replace({
        pathname: generatePath(this.props.match.path, {
          page: pageNumber,
          file: prevState.file
        })
      });
      return { pageNumber };
    });
  };

  previousPage = () => this.changePage(-1);

  nextPage = () => this.changePage(1);

  render() {
    const { numPages, pageNumber, pageHeight, pageWidth, file } = this.state;

    return (
      <React.Fragment>
        <div className="controls">
          <Link to="/extraction">Back to Index</Link>
          <p>
            Page {pageNumber || (numPages ? 1 : "--")} of {numPages || "--"}
          </p>
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={this.previousPage}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={pageNumber >= numPages}
            onClick={this.nextPage}
          >
            Next
          </button>
        </div>
        <Document
          file={`${process.env.PUBLIC_URL}/pdf/${file}.pdf`}
          onLoadSuccess={this.onDocumentLoadSuccess}
        >
          <Page
            pageNumber={pageNumber}
            height={pageHeight}
            width={pageWidth}
            onRenderSuccess={this.pageIsRendered}
          />
        </Document>
      </React.Fragment>
    );
  }
}
