import React, { Component } from "react";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form, Container, Row, Col } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
  state = {
    pdfName: null,
    csvs: [],
    tables: [],
    loading: true,
    tableId: null,
    imageLoaded: false,
  };

  componentDidMount() {
    const { pdfName } = this.props.match.params;
    this.setState({ pdfName });
    this.loadData(pdfName);
  }

  loadData = async pdfName => {
    this.setState({ loading: true, imageLoaded: false });

    if (!pdfName) {
      pdfName = this.state.pdfName;
    }

    try {
      const req1 = fetch(`/getValidationCSVs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfName }),
      });

      const req2 = fetch(`/getValidationTables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfName }),
      });

      const [reqCsvs, reqTables] = await Promise.all([req1, req2]);

      const dataCsvs = await reqCsvs.json();
      const errorCsvs = dataCsvs.error;
      const csvs = dataCsvs.results;

      const dataTables = await reqTables.json();
      const errorTables = dataTables.error;
      const tables = dataTables.results;

      if (errorCsvs || reqCsvs.status !== 200) throw new Error(JSON.stringify(dataCsvs));
      if (errorTables || reqTables.status !== 200) throw new Error(JSON.stringify(dataTables));

      const tableId = tables.find(table => table.tableId === this.state.tableId)
        ? this.state.tableId
        : tables.length > 0
        ? tables[0].tableId
        : null;

      this.setState({ loading: false, csvs, tables, tableId });
    } catch (e) {
      alert(e);
    }
  };

  prevTable = () => {};
  nextTable = () => {
    const { csvs, currentTable } = this.state;
  };

  imageOnLoad = () => {
    this.setState({ imageLoaded: true });
  };

  render() {
    const { pdfName, csvs, tables, loading, tableId, imageLoaded } = this.state;
    const currentIndex = tableId ? tables.findIndex(t => t.tableId === tableId) : -1;
    const { continuationOf, correct_csv, tableTitle, page } = tableId ? tables[currentIndex] : {};

    const conTable = continuationOf ? tables.find(t => t.tableId === continuationOf) : null;
    const conTableBlock = continuationOf ? (
      <p>
        <strong>Continuation Table Name: </strong>
        {conTable.tableTitle}, <strong>Continuation Table ID: </strong>
        {conTable.tableId}
      </p>
    ) : null;

    const csvsBlock = csvs
      .filter(c => c.tableId === tableId)
      .map(({ csvId, method }) => (
        <div className="border" key={csvId}>
          <h6>
            <strong>Method: </strong>
            {method}
          </h6>
          <p>
            <strong>CSV ID: </strong>
            {csvId}
          </p>
          TABLE
        </div>
      ));

    const webPageTitle = (
      <Helmet>
        <title>{pdfName}</title>
      </Helmet>
    );

    const mainBlock = (
      <Container fluid>
        <Row>
          <Col>
            <Button className="ml-0" size="sm" variant="info">
              Back to Tables Index
            </Button>
            <Button size="sm" variant="info">
              Refresh Data
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            <p>
              <strong>PDF Name: </strong>
              {pdfName}, <strong>Page: </strong> {page}
            </p>
          </Col>
          <Col>
            <p>
              <strong>Table: </strong> {currentIndex + 1} of {tables.length}
            </p>
          </Col>
        </Row>
        <Row>
          <Col>
            <p>
              <strong>Table Name: </strong>
              {tableTitle}, <strong>Table ID: </strong>
              {tableId}
            </p>
            {conTableBlock}
          </Col>
        </Row>
        <Row>
          <Col>
            <Button className="ml-0" size="sm" variant="info" onClick={this.prevTable}>
              Prev Table
            </Button>
            <Button size="sm" variant="info" onClick={this.nextTable}>
              Next Table
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            <img
              src={`/jpg/${tableId}.jpg`}
              className="img-fluid border border-dark sticky"
              style={imageLoaded ? {} : { visibility: "hidden" }}
              onLoad={this.imageOnLoad}
            />
          </Col>
          <Col>
            <div className="border">{csvsBlock}</div>
          </Col>
        </Row>
      </Container>
    );

    return (
      <React.Fragment>
        {webPageTitle}
        {loading ? (
          <Spinner animation="border" />
        ) : tableId ? (
          mainBlock
        ) : (
          <Alert variant="danger">Not tables captured/extracted for this PDF</Alert>
        )}
      </React.Fragment>
    );

    return;
  }
}
