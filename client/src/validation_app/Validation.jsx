import React, { Component } from "react";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
  state = {
    pdfName: null,
    csvs: [],
    tables: [],
    loading: true,
    tableId: null,
  };

  componentDidMount() {
    const { pdfName } = this.props.match.params;
    this.setState({ pdfName });
    this.loadData(pdfName);
  }

  loadData = async pdfName => {
    this.setState({ loading: true });

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

  render() {
    const { pdfName, csvs, loading, currentTable } = this.state;

    const webPageTitle = (
      <Helmet>
        <title>{pdfName}</title>
      </Helmet>
    );

    // const currentCsvs = csvs
    //   .filter(csv => csv.tableId === currentTable.tableId)
    //   .map(csv => <li>{JSON.stringify(csv)}</li>);

    const mainBlock = (
      <React.Fragment>
        {webPageTitle}
        <Button onClick={this.prevTable}>Prev Table</Button>
        <Button onClick={this.nextTable}>Next Table</Button>
        <div>{pdfName}</div>
        {/* <ul>{currentCsvs}</ul> */}
      </React.Fragment>
    );

    return loading ? <Spinner animation="border" /> : mainBlock;
  }
}
