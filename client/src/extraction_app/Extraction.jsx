import React, { Component } from "react";
import { Document, Page } from "react-pdf/dist/entry.webpack";
import "./Extraction.css";
import Spinner from "../spinner/Spinner";

export default class Extraction extends Component {
  state = {
    numPages: null,
    pageNumber: 1,
    pageHeight: null,
    pageWidth: null
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
    window.onresize = this.updatePageDimensions;
  }

  componentWillUnmount() {
    window.onresize = null;
  }

  onDocumentLoadSuccess = document => {
    const { numPages } = document;
    this.setState({
      numPages,
      pageNumber: 1
    });
  };

  changePage = offset =>
    this.setState(prevState => ({
      pageNumber: prevState.pageNumber + offset
    }));

  previousPage = () => this.changePage(-1);

  nextPage = () => this.changePage(1);

  render() {
    const { numPages, pageNumber, pageHeight, pageWidth } = this.state;

    return (
      <React.Fragment>
        <div className="controls">
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
          file={`${process.env.PUBLIC_URL}/pdf/sample.pdf`}
          onLoadSuccess={this.onDocumentLoadSuccess}
          loading={Spinner}
        >
          <Page
            pageNumber={pageNumber}
            height={pageHeight}
            width={pageWidth}
            loading={Spinner}
            onRenderSuccess={this.pageIsRendered}
          />
        </Document>
      </React.Fragment>
    );
  }
}
