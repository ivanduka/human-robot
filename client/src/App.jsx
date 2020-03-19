import React, { Component } from "react";
import { Document, Page } from "react-pdf/dist/entry.webpack";
import "./App.css";
import Spinner from "./spinner/Spinner";

const fixTextLayer = () => {
  const canvas = document.querySelector(".react-pdf__Page__canvas");
  const text = document.querySelector(".react-pdf__Page__textContent");
  const { style } = text;
  style.width = canvas.style.width;
  style.top = "0";
  style.left = "0";
  style.transform = "";
  // style.color = "unset"; // TEMPORARILY - ONLY FOR DEBUGGING!
};

export default class Test extends Component {
  state = {
    numPages: null,
    pageNumber: 1,
    pageHeight: null
  };

  updateWindowHeight = () => {
    this.setState({ pageHeight: window.innerHeight });
  };

  componentDidMount() {
    this.updateWindowHeight();

   window.onresize = this.updateWindowHeight;
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
    const { numPages, pageNumber, pageHeight } = this.state;

    return (
      <React.Fragment>
        <div>
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
            loading={Spinner}
            onRenderSuccess={fixTextLayer}
          />
        </Document>
      </React.Fragment>
    );
  }
}
