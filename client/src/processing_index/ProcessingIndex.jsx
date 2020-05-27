import React, { Component } from "react";
import { Link } from "react-router-dom";
import { MDBDataTable } from "mdbreact";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";

import "./ProcessingIndex.css";

const statuses = {
  "errors": "danger",
  "OK": "success",
  "not_started": "light",
  "in_progress": "warning",
};

export default class ExtractionIndex extends Component {
  state = {
    columns: [
      {
        label: "PDF Name",
        field: "pdfName",
      },
      {
        label: "",
        field: "pdfLink",
      },
      {
        label: "Head Table ID",
        field: "headTable",
      },
      {
        label: "",
        field: "tableLink",
      },
      {
        label: "Errors Count",
        field: "errors",
      },
      {
        label: "No Results Count",
        field: "noResults",
      },
      {
        label: "OKs Count",
        field: "oks",
      },
      {
        label: "Total Tables In Sequence",
        field: "totalTables",
      },
      {
        label: "Status",
        field: "status",
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
      const rows = await ky.post(`/processingIndex`).json();
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
      status: (
        <Button
          variant={statuses[row.status]}
          size="sm"
          href={`/processing/${row.headTable}`}
          target="_blank"
          disabled={this.state.softUpdating}
        >
          {row.status}
        </Button>
      ),
      pdfLink: (
        <Button
          size="sm"
          variant="primary"
          href={`/extraction/${row.pdfName}/${row.page}`}
          target="_blank"
          disabled={this.state.softUpdating}
        >
          Open&nbsp;PDF
        </Button>
      ),
      tableLink: (
        <Button
          size="sm"
          variant="secondary"
          href={`/validation/${row.pdfName}/${row.headTable}`}
          target="_blank"
          disabled={this.state.softUpdating}
        >
          Open&nbsp;Table
        </Button>
      ),
    }));

    return (
      <Container fluid>
        <Helmet>
          <title>Index of Processing</title>
        </Helmet>
        <Row>
          <Col>
            <Link to="/">
              <Button size="sm" variant="info" disabled={softUpdating}>
                Back to home
              </Button>
            </Link>
            <Button size="sm" variant="primary" onClick={this.softLoadData} disabled={softUpdating}>
              Refresh Data
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            <MDBDataTable
              paging={false}
              striped
              small
              bordered
              entries={9999999}
              exportToCSV={true}
              hover
              noBottomColumns
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
