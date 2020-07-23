import React, { Component } from "react";
import { Link } from "react-router-dom";
import { MDBDataTable } from "mdbreact";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";

import "./ProcessingIndex.css";

const statuses = {
  "done": "success",
  "3. DONE": "success",
  "single table": "success",
  "2. NOT STARTED": "secondary",
  "1. IN PROGRESS": "warning",
  "pending": "warning",
};

export default class ExtractionIndex extends Component {
  state = {
    columns: [
      {
        label: "#",
        field: "index",
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
        label: "Accepted",
        field: "accepted",
      },
      {
        label: "Processed",
        field: "processed",
      },
      {
        label: "Total Tables",
        field: "totalTables",
      },
      {
        label: "All Manuals",
        field: "allManuals",
      },
      {
        label: "Processing",
        field: "status",
      },
      {
        label: "Concatenation",
        field: "concatenation",
      },
    ],
    rows: null,
    loading: true,
    softUpdating: false,
    showOnlyProcessed: false,
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

  toggleShowOnlyProcessed = async (enable) => {
    this.setState({ showOnlyProcessed: enable });
    await this.softLoadData();
  };

  render() {
    const { columns, loading, softUpdating, showOnlyProcessed } = this.state;
    const rows = showOnlyProcessed ? this.state.rows.filter((r) => r.processed > 0) : this.state.rows;
    if (loading) return <Spinner animation="border" />;

    const rowsWithButtons = rows.map((row, index) => {
      const { appendStatus, status, headTable, pdfName, page } = row;
      const { softUpdating } = this.state;
      const concatStatus = appendStatus === "disabled" ? "Not All Accepted" : appendStatus;

      return {
        ...row,
        index: index + 1,
        status: (
          <Button
            variant={statuses[status]}
            size="sm"
            href={`/processing/${headTable}`}
            target="_blank"
            disabled={softUpdating}
          >
            {row.status}
          </Button>
        ),
        pdfLink: (
          <Button
            size="sm"
            variant="primary"
            href={`/extraction/${encodeURIComponent(pdfName)}/${page}`}
            target="_blank"
            disabled={softUpdating}
          >
            Open&nbsp;PDF
          </Button>
        ),
        tableLink: (
          <Button
            size="sm"
            variant="secondary"
            href={`/validation/${encodeURIComponent(pdfName)}/${headTable}`}
            target="_blank"
            disabled={softUpdating}
          >
            Open&nbsp;Table
          </Button>
        ),
        concatenation: (
          <Button
            size="sm"
            variant={statuses[appendStatus]}
            href={`/concatenation/${headTable}`}
            target="_blank"
            disabled={softUpdating || appendStatus === "disabled" || appendStatus === "single table"}
          >
            {concatStatus}
          </Button>
        ),
      };
    });

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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => this.toggleShowOnlyProcessed(!showOnlyProcessed)}
              disabled={softUpdating}
            >
              {showOnlyProcessed ? "Show All" : "Show Only Processed"}
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
