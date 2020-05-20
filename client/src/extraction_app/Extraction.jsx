import React, { Component } from "react";
import { Document, Page } from "react-pdf/dist/entry.webpack";
import { uuid } from "uuidv4";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Extraction.css";
import ky from "ky";

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
    scrollingAfterUpdate: false,
    softUpdating: false,
  };

  componentDidUpdate(prevProps, prevState) {
    if (this.props.match.params.pageNumber !== prevProps.match.params.pageNumber) {
      let { pdfName, pageNumber } = this.props.match.params;
      pdfName = decodeURIComponent(pdfName);
      this.loadTables(pdfName);
      this.setState({ pdfName, pageNumber: parseInt(pageNumber) });
      this.loadPdfStatus(pdfName);
    }
    const current = document.querySelector(".current");
    if (current && this.state.scrollingAfterUpdate) {
      this.setState({ scrollingAfterUpdate: false });
      current.scrollIntoView();
    }
  }

  componentDidMount() {
    let { pdfName, pageNumber } = this.props.match.params;
    pdfName = decodeURIComponent(pdfName);
    this.loadTables(pdfName);
    this.setState({ pdfName, pageNumber: parseInt(pageNumber) });
    this.loadPdfStatus(pdfName);
    window.onresize = this.updatePageDimensions;
    document.addEventListener("keydown", this.handleKeys);
    document.addEventListener("copy", this.handleCopy);
    window.addEventListener("focus", this.softLoadData);
  }

  componentWillUnmount() {
    window.onresize = null;
    document.removeEventListener("keydown", this.handleKeys);
    document.removeEventListener("copy", this.handleCopy);
    window.removeEventListener("focus", this.softLoadData);
  }

  softLoadData = async () => {
    this.setState({ softUpdating: true });
    await Promise.all([this.loadTables(), this.loadPdfStatus()]);
    this.setState({ softUpdating: false });
  };

  handleSave = async () => {
    const { tableId, pageNumber, tableTitle, pdfName, x1, x2, y1, y2, width, height, continuationOf } = this.state;

    if (!tableTitle || !x1 || !tableTitle.trim()) {
      return alert("Please copy/enter the table title and select the table!");
    }

    try {
      const json = {
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
        continuationOf,
      };
      await ky.post(`/insertTable`, { json }).json();
      this.clearRectangle();
      this.setState({ tableTitle: null, continuationOf: null });
      await this.loadTables();
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  loadTables = async (pdfName) => {
    this.setState({ tables: null });

    if (!pdfName) {
      pdfName = this.state.pdfName;
    }

    try {
      const json = { pdfName };
      const tables = await ky.post(`/getExtractionTables`, { json }).json();
      this.setState({ tables, scrollingAfterUpdate: true });
      this.drawTables(tables);
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  loadPdfStatus = async (pdfName) => {
    if (!pdfName) {
      pdfName = this.state.pdfName;
    }

    try {
      const json = { pdfName };
      const results = await ky.post(`/getPdfStatus`, { json }).json();
      const { status } = results[0];
      this.setState({ locked: status });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  setPdfStatus = async () => {
    const { pdfName, locked } = this.state;
    if (window.confirm(`Do you really want to ${locked ? "unlock" : "lock"} the file for change?`)) {
      this.setState({ locked: true, locking: true });

      try {
        const status = locked === "locked" ? "" : "locked";
        const json = { pdfName, status };
        await ky.post(`/setPdfStatus`, { json }).json();
        this.setState(() => ({ locked: status, locking: false }));
      } catch (error) {
        console.log(error);
        alert(error);
      }
    }
  };

  handleCopy = (e) => {
    const rgx = /[^a-z0-9.,:()[\]{}=+\-_*&^%$#@!`~\\|;'’"/?><]+/gi;
    const tableTitle = window.getSelection().toString().replace(rgx, " ").trim();

    window.getSelection().empty();
    if (e.clipboardData) {
      e.clipboardData.setData("text/plain", tableTitle);
    }
    e.preventDefault();
    this.setState(() => ({ tableTitle }));
    this.clearRectangle();
  };

  handleKeys = (event) => {
    if (event.shiftKey && (event.key === "KeyS" || event.key.toLowerCase() === "s")) {
      this.handleSave();
      event.preventDefault();
    }

    if (event.shiftKey && (event.key === "KeyQ" || event.key.toLowerCase() === "q")) {
      this.handleQuickSaveAsContinuation();
      event.preventDefault();
    }

    if (event.shiftKey && (event.key === "KeyA" || event.key.toLowerCase() === "a")) {
      this.previousPage();
      event.preventDefault();
    }

    if (event.shiftKey && (event.key === "KeyD" || event.key.toLowerCase() === "d")) {
      this.nextPage();
      event.preventDefault();
    }

    if (event.shiftKey && (event.key === "KeyC" || event.key.toLowerCase() === "c")) {
      this.handleCopy(event);
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
    drawingCanvas.parentNode.insertBefore(canvasElement, drawingCanvas.nextSibling);

    const { width, height } = drawingCanvas.getBoundingClientRect();
    canvasElement.setAttribute("height", String(height));
    canvasElement.setAttribute("width", String(width));
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
    canvasElement.setAttribute("height", String(height));
    canvasElement.setAttribute("width", String(width));

    page.addEventListener("mousedown", (e) => {
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

      let x1 = lastMouseX;
      let x2 = newMouseX;
      let y1 = height - lastMouseY;
      let y2 = height - newMouseY;

      if (x1 < x2 && y1 < y2) {
        [y1, y2] = [y2, y1];
      } else if (x1 > x2 && y1 > y2) {
        [x1, x2] = [x2, x1];
      } else if (x1 > x2 && y1 < y2) {
        [y1, y2] = [y2, y1];
        [x1, x2] = [x2, x1];
      }

      this.setState(() => ({
        tableId: uuid(),
        x1,
        y1,
        x2,
        y2,
        width,
        height,
      }));
    });

    page.addEventListener("mousemove", (e) => {
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
      height: null,
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

  onDocumentLoadSuccess = (document) => {
    const { numPages } = document;
    this.setState({ numPages });
  };

  previousPage = () => this.changePage(-1);
  nextPage = () => this.changePage(1);

  changePage = (offset) => {
    let pageUpdated = true;

    this.setState((prevState) => {
      const pageNumber = prevState.pageNumber + offset;

      if (pageNumber < 1 || pageNumber > prevState.numPages) {
        pageUpdated = false;
        return;
      }

      this.props.history.replace({
        pathname: generatePath(this.props.match.path, {
          pageNumber: pageNumber,
          pdfName: prevState.pdfName,
        }),
      });

      return { pageNumber };
    });

    if (pageUpdated) {
      this.loadTables();
    }
  };

  handleDelete = async (tableId) => {
    if (window.confirm(`Do you really want to delete ${tableId}?`)) {
      try {
        const req = await fetch(`/deleteTable`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId }),
        });

        const data = await req.json();
        const { error } = data;
        if (error || req.status !== 200) return alert(JSON.stringify(data));

        this.clearRectangle();
        await this.loadTables();
      } catch (e) {
        alert(e);
      }
    }
  };

  drawTables = (tables) => {
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
      const { tableTitle } = this.state.tables.find((table) => table.tableId === continuationOf);
      return this.setState({ continuationOf, tableTitle });
    }
    this.setState({ continuationOf, tableTitle: null });
  }

  handleTableTitleChange = (event) => {
    this.setState({ tableTitle: event.target.value });
  };

  handleQuickSaveAsContinuation = () => {
    const { tables, pageNumber } = this.state;
    const prevPageTables = tables.filter((t) => pageNumber - t.page === 1);
    if (prevPageTables.length === 0) {
      alert("No tables on the previous page were found!");
      return;
    } else if (prevPageTables.length !== 1) {
      alert("More than one table on the previous page was found! Use the regular save function!");
      return;
    }
    const { tableTitle, tableId } = prevPageTables[0];
    this.setState({ tableTitle, continuationOf: tableId }, () => {
      this.handleSave();
      this.nextPage();
    });
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
      continuationOf,
      softUpdating,
    } = this.state;

    const continuations = new Set();
    if (tables) {
      for (let table of tables) {
        continuations.add(table.continuationOf);
      }
    }

    const prevPageTables = tables
      ? tables
          .filter(
            (table) =>
              (pageNumber - table.page === 1 || pageNumber === table.page) && !continuations.has(table.tableId),
          )
          .map(({ tableId, tableTitle, page }) => (
            <option value={tableId} key={tableId}>
              {pageNumber === page ? "(this page)" : "(prev page)"} {tableTitle} ({tableId})
            </option>
          ))
      : [];

    const continuationOfSelect = (
      <Form.Control
        as="select"
        value={continuationOf || ""}
        size="sm"
        onChange={(e) => this.handleContinuationChange(e)}
      >
        <option value="">not a continuation</option>
        {prevPageTables}
      </Form.Control>
    );

    const continuation = (tableId) => {
      const contTable = tables.find((table) => table.tableId === tableId);
      return contTable ? `${contTable["tableTitle"]} (${tableId})` : `(${tableId})`;
    };

    const coordinates = x1
      ? `${Math.round(x1)}:${Math.round(y1)} => ${Math.round(x2)}:${Math.round(y2)} (page ${Math.round(
          width,
        )}x${Math.round(height)})`
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
        tables.map(({ tableId, page, x1, x2, y1, y2, continuationOf, tableTitle }, i) => (
          <div className={["table_block", page === pageNumber ? "current" : null].join(" ")} key={i}>
            <div>
              <strong>
                <Link to={`/extraction/${pdfName}/${page}`}>{tableTitle}</Link>
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
                Continuation Of: <strong>{continuation(continuationOf)}</strong>
              </div>
            ) : null}
            {page === pageNumber && !locked ? (
              <Button variant="danger" size="sm" onClick={() => this.handleDelete(tableId)}>
                Delete Table
              </Button>
            ) : null}
          </div>
        ))
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
            {pageNumber || <Spinner animation="border" />} of {numPages || <Spinner animation="border" />}
          </strong>
        </div>
        <div>
          <Form.Control
            size="sm"
            as="textarea"
            rows="2"
            placeholder="Select the table title on the page and copy it (CTRL+C or SHIFT+C) or just edit here"
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
        <Button onClick={this.handleQuickSaveAsContinuation} variant="warning" size="sm">
          Save as a cont.(SHIFT+Q)
        </Button>
      </div>
    );

    const topControls = (
      <div className="controls">
        <div>
          <Link to="/tables_index">
            <Button size="sm" variant="info" disabled={softUpdating}>
              Back to Index
            </Button>
          </Link>
          <Button size="sm" variant="primary" onClick={this.softLoadData} disabled={softUpdating}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant={locked ? "warning" : "success"}
            onClick={this.setPdfStatus}
            disabled={softUpdating}
          >
            {locked ? "Unlock PDF" : "Lock PDF"}
          </Button>
        </div>
        <div>
          <Button variant="secondary" size="sm" disabled={softUpdating || pageNumber <= 1} onClick={this.previousPage}>
            Previous Page (SHIFT+A)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={softUpdating || pageNumber >= numPages}
            onClick={this.nextPage}
          >
            Next Page (SHIFT+D)
          </Button>
        </div>
        {locked ? null : newTableBlock}
        <div>{tablesBlock}</div>
      </div>
    );

    const pdfDocument = (
      <Document
        file={pdfName ? `${process.env.PUBLIC_URL}/pdf/${encodeURIComponent(pdfName)}.pdf` : null}
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
