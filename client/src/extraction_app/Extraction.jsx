import React, { Component } from "react";
import { Document, Page } from "react-pdf/dist/entry.webpack";
import { uuid } from "uuidv4";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Extraction.css";

export default class Extraction extends Component {
  state = {
    numPages: null,
    pageNumber: null,
    width: null,
    height: null,
    pageHeight: null,
    pageWidth: null,
    pdfName: null,
    tableId: uuid(),
    x1: null,
    y1: null,
    x2: null,
    y2: null,
    tableTitle: null,
    continuationOf: null,
    tables: null,
    pagesWithTables: null,
    locked: "locked",
    locking: false
  };

  componentDidUpdate(prevProps) {
    if (
      this.props.match.params.pageNumber !== prevProps.match.params.pageNumber
    ) {
      let { pdfName, pageNumber } = this.props.match.params;
      this.loadTables(pdfName);
      this.setState({ pdfName, pageNumber: parseInt(pageNumber) });
      this.loadPdfStatus(pdfName);
    }
  }

  componentDidMount() {
    const { pdfName, pageNumber } = this.props.match.params;
    this.loadTables(pdfName);
    this.setState({ pdfName, pageNumber: parseInt(pageNumber) });
    this.loadPdfStatus(pdfName);
    window.onresize = this.updatePageDimensions;
    document.addEventListener("keydown", this.handleKeys);
    document.addEventListener("copy", this.handleCopy);
  }

  componentWillUnmount() {
    window.onresize = null;
    document.removeEventListener("keydown", this.handleKeys);
    document.removeEventListener("copy", this.handleCopy);
  }

  handleSave = async () => {
    const {
      tableId,
      pageNumber,
      tableTitle,
      pdfName,
      x1,
      x2,
      y1,
      y2,
      width,
      height,
      continuationOf
    } = this.state;

    if (!tableTitle || !x1 || !tableTitle.trim()) {
      return alert("Please copy/enter the table title and select the table!");
    }

    try {
      const req = await fetch(`/insertTable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          page: pageNumber,
          tableTitle: tableTitle.trim(),
          pdfName,
          x1,
          x2,
          y1,
          y2,
          pageWidth: width,
          pageHeight: height,
          continuationOf
        })
      });

      const data = await req.json();
      const { error, results } = data;
      if (error || req.status !== 200) throw new Error(JSON.stringify(data));

      this.clearRectangle();
      this.setState({ tableTitle: null });
      this.loadTables();
    } catch (e) {
      alert(e);
    }
  };

  loadTables = async pdfName => {
    this.setState({ tables: null });

    if (!pdfName) {
      pdfName = this.state.pdfName;
    }

    try {
      const req = await fetch(`/getTables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfName })
      });

      const data = await req.json();
      const { error, results } = data;
      if (error || req.status !== 200) throw new Error(JSON.stringify(data));

      this.setState({ tables: results });
      this.drawTables(results);
    } catch (e) {
      alert(e);
    }
  };

  loadPdfStatus = async pdfName => {
    this.setState({ locked: "locked", locking: true });

    try {
      const req = await fetch(`/getPdfStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfName })
      });

      const data = await req.json();
      const { error, results } = data;
      if (error || req.status !== 200) throw new Error(JSON.stringify(data));

      const { status } = results[0];
      this.setState({ locked: status, locking: false });
    } catch (e) {
      alert(e);
    }
  };

  setPdfStatus = async () => {
    const { pdfName, locked } = this.state;
    if (
      window.confirm(
        `Do you really want to ${
          locked ? "unlock" : "lock"
        } the file for change?`
      )
    ) {
      this.setState({ locked: true, locking: true });

      try {
        const req = await fetch(`/setPdfStatus`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfName,
            status: locked === "locked" ? "" : "locked"
          })
        });

        const data = await req.json();
        const { error, results } = data;
        if (error || req.status !== 200) throw new Error(JSON.stringify(data));

        this.setState(() => ({
          locked: locked === "locked" ? "" : "locked",
          locking: false
        }));
      } catch (e) {
        alert(e);
      }
    }
  };

  handleCopy = e => {
    const tableTitle = window
      .getSelection()
      .toString()
      .trim();
    window.getSelection().empty();
    e.clipboardData.setData("text/plain", tableTitle);
    e.preventDefault();
    this.setState(() => ({ tableTitle }));
    this.clearRectangle();
  };

  handleKeys = event => {
    if (
      event.shiftKey &&
      (event.key === "KeyS" || event.key.toLowerCase() === "s")
    ) {
      this.handleSave();
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
    this.clearRectangle();
    this.setupDisplaying();
    this.drawTables();
  };

  setupDisplaying = () => {
    let existingCanvasElement = document.querySelector("#displaying");
    if (existingCanvasElement) {
      existingCanvasElement.parentElement.removeChild(existingCanvasElement);
    }
    const drawingCanvas = document.querySelector("#drawing");
    const canvasElement = document.createElement("canvas");
    canvasElement.id = "displaying";
    drawingCanvas.parentNode.insertBefore(
      canvasElement,
      drawingCanvas.nextSibling
    );

    const { width, height } = drawingCanvas.getBoundingClientRect();
    canvasElement.setAttribute("height", height);
    canvasElement.setAttribute("width", width);
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

    const { top, left, width, height } = pdfCanvas.getBoundingClientRect();
    const ctx = canvasElement.getContext("2d");
    let lastMouseX = 0;
    let lastMouseY = 0;
    let newMouseX = 0;
    let newMouseY = 0;
    let mouseIsPressed = false;
    canvasElement.setAttribute("height", height);
    canvasElement.setAttribute("width", width);

    page.addEventListener("mousedown", e => {
      this.clearRectangle();
      const rect = pdfCanvas.getBoundingClientRect();
      lastMouseX = e.clientX - rect.left;
      lastMouseY = e.clientY - rect.top;
      mouseIsPressed = true;
    });

    page.addEventListener("mouseup", () => {
      mouseIsPressed = false;
      if (lastMouseX === newMouseX || lastMouseY === newMouseY) {
        return this.clearRectangle();
      }

      this.setState(() => ({
        tableId: uuid(),
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

  clearRectangle = () => {
    const canvasElement = document.querySelector(`#drawing`);
    if (canvasElement) {
      const ctx = canvasElement.getContext("2d");
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
    this.setState(() => ({
      tableId: uuid(),
      x1: null,
      x2: null,
      y1: null,
      y2: null,
      width: null,
      height: null
    }));
  };

  updatePageDimensions = () => {
    const page = document.querySelector(".react-pdf__Page");

    if (page) {
      const controlsWidth = 5 + 400 + 5 + 1;
      const pageHorBorders = 1;
      const pageVerBorders = 1;

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

  previousPage = () => this.changePage(-1);
  nextPage = () => this.changePage(1);

  changePage = offset => {
    let pageUpdated = true;

    this.setState(prevState => {
      const pageNumber = prevState.pageNumber + offset;

      if (pageNumber < 1 || pageNumber > prevState.numPages) {
        pageUpdated = false;
        return;
      }

      this.props.history.replace({
        pathname: generatePath(this.props.match.path, {
          pageNumber: pageNumber,
          pdfName: prevState.pdfName
        })
      });

      return { pageNumber };
    });

    if (pageUpdated) {
      this.loadTables();
    }
  };

  handleDelete = async tableId => {
    if (window.confirm(`Do you really want to delete ${tableId}?`)) {
      try {
        const req = await fetch(`/deleteTable`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId })
        });

        const data = await req.json();
        const { error, results } = data;
        if (error || req.status !== 200) throw new Error(JSON.stringify(data));

        this.loadTables();
      } catch (e) {
        alert(e);
      }
    }
  };

  drawTables = tables => {
    const tablesArray = tables || this.state.tables;
    const canvas = document.querySelector("#displaying");
    if (!canvas || !tablesArray || tablesArray.length === 0) return;

    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const { pageNumber } = this.state;

    for (let table of tablesArray) {
      const { x1, x2, y1, y2, page, pageHeight, pageWidth } = table;
      if (page !== pageNumber) continue;
      const newX1 = (x1 * width) / pageWidth;
      const newX2 = (x2 * width) / pageWidth;
      const newY1 = height - (y1 * height) / pageHeight;
      const newY2 = height - (y2 * height) / pageHeight;
      ctx.beginPath();
      const rectWidth = newX2 - newX1;
      const rectHeight = newY2 - newY1;
      ctx.rect(newX1, newY1, rectWidth, rectHeight);
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  handleContinuationChange(event) {
    const continuationOf = event.target.value || null;
    if (continuationOf) {
      const { tableTitle } = this.state.tables.find(
        table => table.tableId === continuationOf
      );
      return this.setState({ continuationOf, tableTitle });
    }
    this.setState({ continuationOf, tableTitle: null });
  }

  handleTableTitleChange = event => {
    this.setState({ tableTitle: event.target.value });
  };

  render() {
    const {
      numPages,
      pageNumber,
      pageHeight,
      pageWidth,
      pdfName,
      tableTitle,
      tables,
      x1,
      x2,
      y1,
      y2,
      width,
      height,
      locked,
      locking,
      continuationOf
    } = this.state;

    const prevPageTables = tables
      ? tables
          .filter(table => pageNumber - table.page === 1)
          .map(({ tableId, tableTitle }) => (
            <option value={tableId} key={tableId}>
              {tableTitle} ({tableId})
            </option>
          ))
      : [];

    const continuationOfSelect = (
      <Form.Control
        as="select"
        value={continuationOf || ""}
        size="sm"
        onChange={e => this.handleContinuationChange(e)}
      >
        <option value="">not a continuation</option>
        {prevPageTables}
      </Form.Control>
    );

    const continuation = tableId =>
      `${
        tables.find(table => table.tableId === tableId)["tableTitle"]
      } (${tableId})`;

    const coordinates = x1
      ? `${Math.round(x1)}:${Math.round(y1)} => ${Math.round(x2)}:${Math.round(
          y2
        )} (page ${Math.round(width)}x${Math.round(height)})`
      : "[NOT SELECTED YET]";

    const webPageTitle = (
      <Helmet>
        <title>{`${pdfName}: page ${pageNumber}`}</title>
      </Helmet>
    );

    const tablesBlock = tables ? (
      tables.length === 0 ? (
        <div className="table_block">No tables saved for this PDF yet.</div>
      ) : (
        tables.map(
          (
            { tableId, page, x1, x2, y1, y2, continuationOf, tableTitle },
            i
          ) => (
            <div
              className={[
                "table_block",
                page === pageNumber ? "current" : null
              ].join(" ")}
              key={i}
            >
              <div>
                <strong>
                  <Link to={`/extraction/${pdfName}/${page}`}>
                    {tableTitle}
                  </Link>
                </strong>
              </div>
              <div>
                Table ID: <strong>{tableId}</strong>
              </div>
              <div>
                Page <strong>{page}</strong>, Coordinates:{" "}
                <strong>
                  {x1}:{y1}=>{x2}:{y2}
                </strong>
              </div>
              {continuationOf ? (
                <div>
                  Continuation Of:{" "}
                  <strong>{continuation(continuationOf)}</strong>
                </div>
              ) : null}
              {page === pageNumber && !locked ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => this.handleDelete(tableId)}
                >
                  Delete Table
                </Button>
              ) : null}
            </div>
          )
        )
      )
    ) : (
      <Spinner animation="border" />
    );

    const newTableBlock = (
      <div className="table_block">
        <div>
          PDF Name: <strong>"{pdfName}"</strong>
        </div>
        <div>
          Page{" "}
          <strong>
            {pageNumber || <Spinner animation="border" />} of{" "}
            {numPages || <Spinner animation="border" />}
          </strong>
        </div>
        <div>
          <Form.Control
            size="sm"
            as="textarea"
            rows="2"
            placeholder="Select the table title on the page and copy it (CTRL+C) or just edit here"
            value={tableTitle || ""}
            onChange={this.handleTableTitleChange}
          />
        </div>
        <div>
          Coordinates: <strong>{coordinates}</strong>
        </div>
        <div>{prevPageTables.length > 0 ? continuationOfSelect : null}</div>
        <Button
          onClick={this.handleSave}
          variant="success"
          size="sm"
          disabled={!(tableTitle && x1 && tableTitle.trim())}
        >
          Save (SHIFT+S)
        </Button>
      </div>
    );

    const lockButton = (
      <Button
        size="sm"
        variant={locked ? "warning" : "success"}
        onClick={this.setPdfStatus}
      >
        {locked ? "Unlock PDF" : "Lock PDF"}
      </Button>
    );

    const topControls = (
      <div className="controls">
        <div>
          <Link to="/tables_index">
            <Button size="sm" variant="info">
              Back to Index
            </Button>
          </Link>
          {lockButton}
        </div>
        {locking ? (
          <Spinner animation="border" />
        ) : (
          <React.Fragment>
            <div>
              <Button
                variant="secondary"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={this.previousPage}
              >
                Previous Page (LEFT)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pageNumber >= numPages}
                onClick={this.nextPage}
              >
                Next Page (RIGHT)
              </Button>
            </div>
            {locked ? null : newTableBlock}
            <div>{tablesBlock}</div>
          </React.Fragment>
        )}
      </div>
    );

    const pdfDocument = (
      <Document
        file={`${process.env.PUBLIC_URL}/pdf/${pdfName}.pdf`}
        onLoadSuccess={this.onDocumentLoadSuccess}
        loading={<Spinner animation="border" />}
      >
        <Page
          pageNumber={pageNumber}
          height={pageHeight}
          width={pageWidth}
          renderAnnotationLayer={false}
          loading={<Spinner animation="border" />}
          onRenderSuccess={this.pageIsRendered}
          error={<Alert variant="danger">Could not load the page :(</Alert>}
        />
      </Document>
    );

    return (
      <React.Fragment>
        {webPageTitle}
        {topControls}
        {pdfDocument}
      </React.Fragment>
    );
  }
}