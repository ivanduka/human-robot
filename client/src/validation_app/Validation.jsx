import React, { Component } from "react";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form, Container, Row, Col } from "react-bootstrap";
import { Helmet } from "react-helmet";
import Papa from "papaparse";
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
    this.setState(() => ({ loading: true, imageLoaded: false, csvs: [], tables: [] }));

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
      let csvs = dataCsvs.results;

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

      const csvDataPromise = csvId =>
        new Promise(resolve => {
          Papa.parse(`/csv/${csvId}.csv`, {
            download: true,
            complete(results) {
              resolve(results.data);
            },
            skipEmptyLines: true,
          });
        });

      csvs = await Promise.all(
        csvs
          .filter(csv => csv.tableId === tableId)
          .sort((a, b) => a.method.localeCompare(b.method))
          .map(csv => ({ ...csv, data: csvDataPromise(csv.csvId) }))
          .map(async csv => ({ ...csv, data: await csv.data })),
      );

      this.setState({ loading: false, csvs, tables, tableId });
    } catch (e) {
      console.log(e);
      alert(e);
    }
  };

  prevTable = () => {
    const { tables, tableId } = this.state;
    const currentIndex = tables.findIndex(t => t.tableId === tableId);
    if (currentIndex === 0) return;
    this.setState({ tableId: tables[currentIndex - 1].tableId });
    this.loadData();
  };

  nextTable = () => {
    const { tables, tableId } = this.state;
    const currentIndex = tables.findIndex(t => t.tableId === tableId);
    if (currentIndex === tables.length - 1) return;
    this.setState({ tableId: tables[currentIndex + 1].tableId });
    this.loadData();
  };

  imageOnLoad = () => {
    this.setState({ imageLoaded: true });
  };

  setResult = async (tableId, csvId) => {
    this.setState({ loading: true });

    const res = await fetch("/setValidation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tableId, csvId }),
    });

    const { error, results } = await res.json();

    if (error || res.status !== 200) throw new Error(JSON.stringify({ error, results }));

    this.loadData();
  };

  render() {
    const { pdfName, csvs, tables, loading, tableId, imageLoaded } = this.state;
    if (loading) {
      return <Spinner animation="border" />;
    }

    if (!tableId) {
      return <Alert variant="danger">Not tables captured/extracted for this PDF</Alert>;
    }

    const currentIndex = tables.findIndex(t => t.tableId === tableId);
    const { continuationOf, correct_csv, tableTitle, page } = tables[currentIndex];

    const conTable = continuationOf ? tables.find(t => t.tableId === continuationOf) : null;
    const conTableBlock = continuationOf ? (
      <p>
        <strong>Continuation Table Name: </strong>
        {conTable.tableTitle}, <strong>Continuation Table ID: </strong>
        {conTable.tableId}
      </p>
    ) : null;

    const constructTable = table => (
      <table>
        <tbody>
          {table.map(row => (
            <tr>
              {row.map(col => (
                <td>{col}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );

    const csvsBlock = csvs.map(({ csvId, method, data }) => (
      <div className="mb-5" key={csvId}>
        <h6 className="ml-2">
          <strong>Method: </strong>
          {method}
        </h6>
        <p className="ml-2">
          <strong>CSV ID: </strong>
          {csvId}
        </p>
        <Button variant="success" size="sm" className="ml-2" onClick={() => this.setResult(tableId, csvId)}>
          Select
        </Button>
        <div className={csvId === correct_csv ? "ml-2 mr-2 correct" : "ml-2 mr-2 bg-light"}>{constructTable(data)}</div>
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
            <Link to="/tables_index">
              <Button className="ml-0" size="sm" variant="info">
                Back to Index
              </Button>
            </Link>
            <Button size="sm" variant="info" onClick={() => this.loadData()}>
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
            <div className="border border-dark">
              {csvsBlock}
              <Button variant="warning" size="sm" className="ml-2" onClick={() => this.setResult(tableId, null)}>
                Unset Validation
              </Button>
            </div>
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
