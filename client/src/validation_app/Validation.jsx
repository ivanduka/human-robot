import React, { Component } from "react";
import ky from "ky";
import { Link, generatePath } from "react-router-dom";
import { Button, Spinner, Alert, Container, Row, Col, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
  state = {
    pdfName: null,
    csvs: [],
    tables: [],
    loading: true,
    tableId: null,
    tags: [],
    imageLoaded: false,
    softUpdating: false,
    imagesLoading: false,
  };

  componentDidMount() {
    const { pdfName, tableId } = this.props.match.params;
    this.setState({ pdfName, pathTableId: tableId });
    this.loadData({ pdfName, pathTableId: tableId }).then();
    document.addEventListener("keydown", this.handleKeys);
  }

  componentDidUpdate(prevProps) {
    if (this.props.match.params.tableId !== prevProps.match.params.tableId) {
      let { tableId } = this.props.match.params;
      this.setState({ tableId });
      this.loadData({ tableId, notFirstLoading: true }).then();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeys);
  }

  handleKeys = (event) => {
    if (this.state.softUpdating) return;

    if (event.key === "KeyA" || event.key.toLowerCase() === "a") {
      this.prevTable();
      event.preventDefault();
    }

    if (event.key === "KeyD" || event.key.toLowerCase() === "d") {
      this.nextTable();
      event.preventDefault();
    }
  };

  prevTable = () => {
    const { tables, tableId, softUpdating } = this.state;
    if (softUpdating) return;
    const currentIndex = tables.findIndex((t) => t.tableId === tableId);
    if (currentIndex === 0) return;
    const newTableId = tables[currentIndex - 1].tableId;
    this.changeTable(newTableId);
  };

  nextTable = () => {
    const { tables, tableId, softUpdating } = this.state;
    if (softUpdating) return;
    const currentIndex = tables.findIndex((t) => t.tableId === tableId);
    if (currentIndex === tables.length - 1) return;
    const newTableId = tables[currentIndex + 1].tableId;
    this.changeTable(newTableId);
  };

  goToTable = (event) => {
    const { tables } = this.state;
    const { value } = event.target;
    const newTableId = tables[value - 1].tableId;
    this.changeTable(newTableId);
  };

  changeTable = (tableId) => {
    const { pdfName } = this.state;

    this.setState({ softUpdating: true }, () => {
      this.props.history.replace({
        pathname: generatePath(this.props.match.path, {
          tableId,
          pdfName,
        }),
      });

      this.setState({ tableId, softUpdating: false, imageLoaded: false });
    });
  };

  imageOnLoad = () => {
    this.setState({ imageLoaded: true });
  };

  softLoadData = async () => {
    this.setState({ softUpdating: true });
    await this.loadData({ notFirstLoading: true });
    this.setState({ softUpdating: false });
  };

  loadData = async ({ pdfName, notFirstLoading, pathTableId }) => {
    if (!notFirstLoading) {
      this.setState({ loading: true, imageLoaded: false });
    }

    if (!pdfName) {
      pdfName = this.state.pdfName;
    }

    try {
      const json = { pdfName, notFirstLoading };
      const result = await ky.post("/getValidationData", { json }).json();
      const tables = result.tables;
      const csvsResult = result.csvs;
      const tagsResult = result.tags;

      let tableId = this.state.tableId || pathTableId;
      const tableExists = tables.findIndex((t) => t.tableId === tableId) !== -1;
      if (!tableExists && tables && tables.length > 0) {
        tableId = tables[0].tableId;
        this.props.history.replace({
          pathname: generatePath(this.props.match.path, {
            tableId,
            pdfName,
          }),
        });
      } else if (!tableExists) {
        tableId = null;
        this.props.history.replace({
          pathname: generatePath(this.props.match.path, {
            tableId,
            pdfName,
          }),
        });
      }

      const csvsArray = csvsResult || this.state.csvs;
      const csvs = csvsArray.sort((a, b) => a.method.localeCompare(b.method));

      const tags = tagsResult.filter((t) => t.tableId === tableId);

      this.setState({ loading: false, csvs, tables, tableId, tags });

      // Pre-loading all the images for all the tables of the current PDF
      if (!notFirstLoading) {
        this.setState({ imagesLoading: true });

        const promises = tables.map(async (t) => {
          const img = new Image();
          img.src = `/jpg/${t.tableId}.jpg`;
          return new Promise((resolve) => (img.onload = async () => resolve(true)));
        });
        await Promise.all(promises);

        this.setState({ imagesLoading: false });
      }
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  setValidation = async ({ tableId, csvId, method, isHeadTable, doNotUpdateAfter }) => {
    try {
      const json = { tableId, csvId, method, isHeadTable };
      const res = await ky.post("/setValidation", { json }).json();
      console.log(res);

      if (!doNotUpdateAfter) {
        await this.softLoadData();
      }
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  setRelevancy = async (tableId, relevancy, isHeadTable) => {
    try {
      const promise1 = ky.post("/setRelevancy", { json: { tableId, relevancy, isHeadTable } }).json();
      const promise2 = this.setValidation({
        tableId,
        csvId: null,
        method: null,
        isHeadTable,
        doNotUpdateAfter: true,
      });

      const [res] = await Promise.all([promise1, promise2]);
      console.log(res);
      await this.softLoadData();
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  tagUntagTable = async (tableId, tagId, set, isHeadTable) => {
    try {
      const json = { tableId, tagId, set, isHeadTable };
      const res = await ky.post("/tagUntagTable", { json }).json();

      console.log(res);
      await this.softLoadData();
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  render() {
    const { pdfName, csvs, tables, loading, tableId, imageLoaded, tags, softUpdating, imagesLoading } = this.state;

    if (loading) {
      return <Spinner animation="border" />;
    }

    if (!tableId || !tables) {
      return <Alert variant="danger">No tables captured/extracted for this PDF</Alert>;
    }

    const currentIndex = tables.findIndex((t) => t.tableId === tableId);
    const { continuationOf, correct_csv, tableTitle, page, relevancy } = tables[currentIndex];

    const isHeadTable = continuationOf == null ? tables.findIndex((t) => t.continuationOf === tableId) !== -1 : false;

    // noinspection JSCheckFunctionSignatures
    const conTable = continuationOf ? tables.find((t) => t.tableId === continuationOf) : null;

    const conTableBlock = continuationOf ? (
      <p>
        Continuation Table Name: <strong>{conTable.tableTitle}</strong>, Continuation Table ID:{" "}
        <strong>{conTable.tableId}</strong>
      </p>
    ) : (
      <p>(this table is not a continuation)</p>
    );

    const constructTable = (table) => (
      <table>
        <tbody>
          {table.map((row, idx) => (
            <tr key={idx}>
              {row.map((col, index) => (
                <td key={index}>{col}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );

    const csvsBlock = csvs
      .filter((csv) => csv.tableId === tableId)
      .map(({ csvId, method, csvText }) => (
        <div className="mb-5" key={csvId}>
          <h6 className="ml-2">
            <strong>Method: </strong>
            {method}
          </h6>
          <p className="ml-2">
            <strong>CSV ID: </strong>
            {csvId}
          </p>
          <Button
            variant="success"
            size="sm"
            disabled={csvId === correct_csv || softUpdating}
            className="ml-2"
            onClick={() => this.setValidation({ tableId, csvId, method, isHeadTable })}
          >
            Select
          </Button>
          <div
            className={
              csvId === correct_csv ? "ml-2 mr-2 correct" : correct_csv ? "ml-2 mr-2 incorrect" : "ml-2 mr-2 bg-light"
            }
          >
            {constructTable(csvText)}
          </div>
        </div>
      ));

    const webPageTitle = (
      <Helmet>
        <title>{pdfName}</title>
      </Helmet>
    );

    const tagsBlock = (
      <div className="mb-5">
        {tags.map((t) => (
          <Button
            key={t.tagId}
            size="sm"
            variant={t.count === 0 ? "outline-dark" : "success"}
            onClick={() => this.tagUntagTable(tableId, t.tagId, t.count === 0, isHeadTable)}
            disabled={softUpdating}
          >
            {t.tagName}
          </Button>
        ))}
        {isHeadTable ? (
          <p className="ml-2">
            <strong>(this is a head table and the tags will be applied to the whole chain)</strong>
          </p>
        ) : null}
      </div>
    );

    const csvsArea =
      relevancy === 0 ? (
        <div className="border border-dark">
          <Alert className="m-2" variant="warning">
            The table is marked as irrelevant
          </Alert>
          <Button
            className="m-2"
            size="sm"
            variant="warning"
            disabled={softUpdating}
            onClick={() => this.setRelevancy(tableId, 1, isHeadTable)}
          >
            MARK TABLE AS RELEVANT
          </Button>
        </div>
      ) : (
        <div className="border border-dark">
          <Button
            className="m-2 mb-5"
            size="sm"
            variant="danger"
            disabled={softUpdating}
            onClick={() => this.setRelevancy(tableId, 0, isHeadTable)}
          >
            MARK TABLE AS IRRELEVANT
          </Button>
          {tagsBlock}
          {csvsBlock}
          <Button
            disabled={!correct_csv || softUpdating}
            variant="warning"
            size="sm"
            className="ml-2 mb-3"
            onClick={() => this.setValidation({ tableId, csvId: null, method: null, isHeadTable })}
          >
            Unset Validation
          </Button>
        </div>
      );

    const tableSelect = (
      <Form.Control
        as="select"
        value={currentIndex + 1}
        size="sm"
        onChange={(e) => this.goToTable(e)}
        className="dropdown"
        disabled={softUpdating}
      >
        {tables.map((t, index) => (
          <option value={index + 1} key={index + 1}>
            {index + 1} (p.{t.page})
          </option>
        ))}
      </Form.Control>
    );

    const mainBlock = (
      <Container fluid>
        <Row>
          <Col>
            <Link to="/tables_index">
              <Button className="ml-0" size="sm" variant="info" disabled={softUpdating}>
                Back to Index
              </Button>
            </Link>
            <Button
              size="sm"
              variant="dark"
              href={`/extraction/${pdfName}/${page}`}
              target="blank_"
              disabled={softUpdating}
            >
              Open PDF
            </Button>
            <Button size="sm" variant="primary" disabled={softUpdating} onClick={this.softLoadData}>
              Refresh Data
            </Button>
            <span className={imagesLoading ? "text-danger" : "text-success"}>
              {imagesLoading
                ? "Images are being preloaded (the app can be slow in the process until it's done)..."
                : "All images are preloaded! The app is working with the full speed!"}
            </span>
          </Col>
        </Row>
        <Row>
          <Col>
            <p>
              PDF Name: <strong>{pdfName}</strong>, Page: <strong>{page}</strong>
            </p>
          </Col>
        </Row>
        <Row>
          <Col>
            <p>
              Table Name: <strong>{tableTitle}</strong>, Table ID: <strong>{tableId}</strong>
            </p>
            {conTableBlock}
          </Col>
        </Row>
        <Row>
          <Col>
            <Button
              className="ml-0"
              size="sm"
              variant="secondary"
              onClick={this.prevTable}
              disabled={currentIndex + 1 === 1 || softUpdating}
            >
              Prev Table (A)
            </Button>
            <strong>Table: </strong> {tableSelect} of {tables.length}
            <Button
              size="sm"
              variant="secondary"
              onClick={this.nextTable}
              disabled={currentIndex + 1 === tables.length || softUpdating}
            >
              Next Table (D)
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            {imageLoaded || <Spinner animation="border" />}
            <img
              src={`/jpg/${tableId}.jpg`}
              className="img-fluid border border-dark sticky"
              style={imageLoaded ? {} : { visibility: "hidden" }}
              onLoad={this.imageOnLoad}
              alt="Table screenshot from the PDF file"
            />
          </Col>
          <Col>{csvsArea}</Col>
        </Row>
      </Container>
    );

    return (
      <React.Fragment>
        {webPageTitle}
        {mainBlock}
      </React.Fragment>
    );
  }
}
