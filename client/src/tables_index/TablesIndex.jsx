import React, { Component } from "react";
import { Link } from "react-router-dom";
import { MDBDataTable } from "mdbreact";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";

import "./TablesIndex.css";

export default class ExtractionIndex extends Component {
  state = {
    columns: [
      {
        label: "PDF ID",
        field: "pdfId",
      },
      {
        label: "PDF Name",
        field: "pdfName",
      },

      {
        label: "PDF Size (MB)",
        field: "pdfSize",
      },
      {
        label: "Filing ID",
        field: "filingId",
      },
      {
        label: "Submission Date",
        field: "date",
      },
      {
        label: "Total Pages",
        field: "totalPages",
      },
      {
        label: "",
        field: "capturingLink",
      },
      {
        label: "Tables Captured",
        field: "tableCount",
      },
      {
        label: "Status",
        field: "status",
      },
      {
        label: "",
        field: "validatingLink",
      },
      {
        label: "Tables Validated",
        field: "tablesValidated",
      },
      {
        label: "Tables Irrelevant",
        field: "tablesIrrelevant",
      },
      {
        label: "Tables Not Validated",
        field: "tablesNotValidated",
      },
    ],
    rows: null,
    loading: true,
    softUpdating: false,
  };

  componentDidMount() {
    this.loadData().then();
  }

  componentWillUnmount() {}

  softLoadData = async () => {
    this.setState({ softUpdating: true });
    await this.loadData(true);
    this.setState({ softUpdating: false });
  };

  loadData = async (notFirstLoad) => {
    if (!notFirstLoad) {
      this.setState({ loading: true });
    }

    try {
      const rows = await ky.post(`/tableIndex`).json();
      this.setState({ rows, loading: false });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  render() {
    const { rows, columns, loading, softUpdating } = this.state;
    if (loading) return <Spinner animation="border" />;

    const rowsWithButtons = rows.map((row) => ({
      ...row,
      date: new Date(row.date).toISOString().split("T")[0],
      capturingLink: (
        <Button
          variant={row.status ? "warning" : "primary"}
          size="sm"
          href={`/extraction/${row.pdfName}`}
          target="_blank"
          disabled={this.state.softUpdating}
        >
          Capture
        </Button>
      ),
      validatingLink: (
        <Button
          size="sm"
          variant={row["tablesNotValidated"] > 0 ? "primary" : "warning"}
          href={`/validation/${row.pdfName}`}
          target="_blank"
          disabled={this.state.softUpdating}
        >
          Validate
        </Button>
      ),
    }));

    return (
      <Container fluid>
        <Helmet>
          <title>Index of PDF files</title>
        </Helmet>
        <Row>
          <Col>
            <Link to="/">
              <Button size="sm" variant="info" disabled={softUpdating}>
                Back to home
              </Button>
            </Link>
            <Button size="sm" variant="primary" onClick={this.softLoadData} disabled={softUpdating}>
              {" "}
              Refresh Data{" "}
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
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
              data={{ rows: rowsWithButtons, columns }}
            />
          </Col>
        </Row>
      </Container>
    );
  }
}
