import React, { Component } from "react";
import { Document, Page } from "react-pdf/dist/entry.webpack";
import { uuid } from "uuidv4";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";

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

  componentDidMount() {
    let { file, page } = this.props.match.params;
    if (page == null) {
      page = 1;
    }
    this.setState({ file, pageNumber: parseInt(page) });
    window.onresize = this.updatePageDimensions;

    document.addEventListener("keydown", this.handleKeys);
  }

  componentWillUnmount() {
    window.onresize = null;
    document.removeEventListener("keydown", this.handleKeys);
  }

  handleKeys = event => {
    if (
      event.altKey &&
      (event.key === "KeyS" || event.key.toLowerCase() === "s")
    ) {
      console.log("ALT+S");
      event.preventDefault();
    }

    if (event.code === "ArrowDown") {
      console.log("DOWN");
      event.preventDefault();
    }

    if (event.code === "ArrowUp") {
      console.log("UP");
      event.preventDefault();
    }

    if (event.code === "ArrowLeft") {
      this.previousPage();
      event.preventDefault();
    }

    if (event.code === "ArrowRight") {
      this.nextPage();
      event.preventDefault();
    }
  };

  pageIsRendered = () => {
    this.updatePageDimensions();
    this.setupDrawing();
  };

  setupDrawing = () => {
    let existingCanvasElement = document.querySelector("#drawing");
    if (existingCanvasElement) {
      existingCanvasElement.parentElement.removeChild(existingCanvasElement);
    }

    const page = document.querySelector(".react-pdf__Page");
    const pdfCanvas = document.querySelector(".react-pdf__Page__canvas");
    const canvasElement = document.createElement("canvas");
    canvasElement.id = "drawing";
    pdfCanvas.parentNode.insertBefore(canvasElement, pdfCanvas.nextSibling);

    const { top, left, width, height } = page.getBoundingClientRect();
    const ctx = canvasElement.getContext("2d");
    let lastMouseX = 0;
    let lastMouseY = 0;
    let newMouseX = 0;
    let newMouseY = 0;
    let mouseIsPressed = false;
    canvasElement.setAttribute("height", height);
    canvasElement.setAttribute("width", width);

    page.addEventListener("mousedown", e => {
      // this.clearRectangle();
      const rect = page.getBoundingClientRect();
      lastMouseX = e.clientX - rect.left;
      lastMouseY = e.clientY - rect.top;
      mouseIsPressed = true;
      console.log(lastMouseX, lastMouseY);
    });

    page.addEventListener("mouseup", () => {
      mouseIsPressed = false;

      if (lastMouseX === newMouseX && lastMouseY === newMouseY) {
        // return this.clearRectangle();
      }

      this.setState(() => ({
        uuid: uuid(),
        x1: lastMouseX,
        y1: height - lastMouseY,
        x2: newMouseX,
        y2: height - newMouseY,
        width,
        height
      }));
    });

    page.addEventListener("mousemove", e => {
      newMouseX = e.clientX - left;
      newMouseY = e.clientY - top;
      if (mouseIsPressed) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.beginPath();
        const rectWidth = newMouseX - lastMouseX;
        const rectHeight = newMouseY - lastMouseY;
        ctx.rect(lastMouseX, lastMouseY, rectWidth, rectHeight);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  };

  // clearRectangle = () => {
  //   const canvasElement = document.querySelector(".react-pdf__Page__canvas");
  //   if (canvasElement) {
  //     const ctx = canvasElement.getContext("2d");
  //     ctx.clearRect(
  //       0,
  //       0,
  //       parseInt(canvasElement.style.width),
  //       parseInt(canvasElement.style.height)
  //     );
  //   }
  //   this.setState(() => ({
  //     uuid: uuid(),
  //     x1: null,
  //     x2: null,
  //     y1: null,
  //     y2: null,
  //     height: null,
  //     width: null
  //   }));
  // };

  updatePageDimensions = () => {
    const page = document.querySelector(".react-pdf__Page");

    if (page) {
      const controlsWidth = 2 + 5 + 400 + 5 + 1;
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

  onDocumentLoadSuccess = document => {
    const { numPages } = document;
    this.setState({ numPages });
  };

  changePage = offset => {
    this.setState(prevState => {
      const pageNumber = prevState.pageNumber + offset;

      if (pageNumber < 1 || pageNumber > prevState.numPages) {
        return;
      }

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
        <Helmet>
          <title>{`${file}: page ${pageNumber}`}</title>
        </Helmet>
        <div className="controls">
          <Link to="/extraction">
            <Button size="sm" variant="info">
              Back to Index
            </Button>
          </Link>
          <p>
            <Button
              size="sm"
              disabled={pageNumber <= 1}
              onClick={this.previousPage}
            >
              Previous (LEFT)
            </Button>
            <Button
              size="sm"
              disabled={pageNumber >= numPages}
              onClick={this.nextPage}
            >
              Next (RIGHT)
            </Button>
            Page {pageNumber || (numPages ? 1 : "--")} of {numPages || "--"}
          </p>
        </div>
        <Document
          file={`${process.env.PUBLIC_URL}/pdf/${file}.pdf`}
          onLoadSuccess={this.onDocumentLoadSuccess}
          loading={<Spinner animation="border" />}
        >
          <Page
            pageNumber={pageNumber}
            height={pageHeight}
            width={pageWidth}
            loading={<Spinner animation="border" />}
            onRenderSuccess={this.pageIsRendered}
          />
        </Document>
      </React.Fragment>
    );
  }
}
