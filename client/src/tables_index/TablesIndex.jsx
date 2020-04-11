import React, { Component } from "react";
import { Link, Redirect } from "react-router-dom";
import { MDBDataTable } from "mdbreact";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";

import "./TablesIndex.css";

export default class ExtractionIndex extends Component {
  state = {
    columns: [
      {
        label: "PDF ID",
        field: "pdfId",
        sort: "asc",
        width: 100,
      },
      {
        label: "PDF Name",
        field: "pdfName",
        sort: "asc",
        width: 50,
      },

      {
        label: "PDF Size (MB)",
        field: "pdfSize",
        sort: "asc",
        width: 100,
      },
      {
        label: "Filing ID",
        field: "filingId",
        sort: "asc",
        width: 100,
      },
      {
        label: "Sumbission Date",
        field: "date",
        sort: "asc",
        width: 150,
      },
      {
        label: "Total Pages",
        field: "totalPages",
        sort: "asc",
        width: 100,
      },
      {
        label: "",
        field: "capturingLink",
        sort: "asc",
        width: 100,
      },
      {
        label: "Tables Captured",
        field: "tableCount",
        sort: "asc",
        width: 100,
      },
      {
        label: "Status",
        field: "status",
        sort: "asc",
        width: 100,
      },
      {
        label: "",
        field: "validatingLink",
        sort: "asc",
        width: 100,
      },
      {
        label: "Tables Validated",
        field: "tablesValidated",
        sort: "asc",
        width: 100,
      },
      {
        label: "Tables Not Validated",
        field: "tablesNotValidated",
        sort: "asc",
        width: 100,
      },
    ],
    rows: null,
    loading: true,
  };

  componentDidMount() {
    this.loadData();
  }

  handleCapturingLink = (pdfName) => {
    this.props.history.push({
      pathname: "/extraction/" + pdfName,
    });
  };

  handleValidatingLink = (pdfName) => {
    this.props.history.push({
      pathname: "/validation/" + pdfName,
    });
  };

  componentWillUnmount() {}

  loadData = () => {
    this.setState({ loading: true });
    fetch(`/table_index`)
      .then((res) => res.json())
      .then(({ error, results }) => {
        if (error) {
          return alert(JSON.stringify(error));
        }
        const rows = results.map((row) => ({
          ...row,
          date: new Date(row.date).toISOString().split("T")[0],
          capturingLink: (
            <Button
              variant={row.status ? "warning" : "primary"}
              size="sm"
              onClick={() => this.handleCapturingLink(row.pdfName)}
            >
              Capture
            </Button>
          ),
          validatingLink: (
            <Button variant="info" size="sm" onClick={() => this.handleValidatingLink(row.pdfName)}>
              Validate
            </Button>
          ),
          tablesNotValidated: row.tableCount - row.tablesValidated,
        }));
        this.setState({ rows, loading: false });
      });
  };

  render() {
    const { rows, columns, loading } = this.state;
    const table = loading ? (
      <Spinner animation="border" />
    ) : (
      <MDBDataTable
        striped
        small
        bordered
        entries={10000}
        entriesOptions={[10, 100, 1000, 10000]}
        exportToCSV={true}
        hover
        noBottomColumns
        order={["pdfId", "asc"]}
        theadColor="indigo"
        theadTextWhite
        tbodyColor="darkgray"
        data={{ rows, columns }}
      />
    );

    return (
      <Container fluid>
        <Helmet>
          <title>Index of PDF files</title>
        </Helmet>
        <Row>
          <Col>
            <Link to="/">
              <Button size="sm" variant="info">
                Back to home
              </Button>
            </Link>
            <Button size="sm" variant="primary" onClick={this.loadData}>
              Refresh Data
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>{table}</Col>
        </Row>
      </Container>
    );
  }
}
