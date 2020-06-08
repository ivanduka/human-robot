import React, { Component } from "react";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";
import { Link } from "react-router-dom";
import { MDBDataTable } from "mdbreact";

import "./ManualHelper.css";

export default class ManualHelper extends Component {
  state = {
    columns: [
      {
        label: "#",
        field: "index",
      },
      {
        label: "CSV ID",
        field: "correct_csv",
      },
      {
        label: "",
        field: "fileLink",
      },
      {
        label: "Table ID",
        field: "tableId",
      },
      {
        label: "",
        field: "tableLink",
      },
      {
        label: "PDF Name",
        field: "pdfName",
      },
      {
        label: "",
        field: "pdfLink",
      },
      {
        label: "Page",
        field: "page",
      },
      {
        label: "Status",
        field: "status",
      },
    ],
    data: [],
    loading: false,
    updating: false,
    showAll: false,
  };

  componentDidMount() {
    this.loadData().then();
  }

  softUpdate = async () => {
    this.setState({ updating: true });
    await this.loadData(true);
    this.setState({ updating: false });
  };

  loadData = async (notFirstUpdate) => {
    try {
      if (!notFirstUpdate) this.setState({ loading: true });
      const { data } = await ky.post(`/manualHelper`).json();
      this.setState({ data, loading: false });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  toggleShowAll = async (showAll) => {
    this.setState({ showAll });
    this.softUpdate();
  };

  downloadCSV = async (csvId) => {
    const l = `/csv/${csvId}.csv`;
    const file = await ky.get(l).text;
    console.log(file);
  };

  render() {
    const { data, columns, loading, updating, showAll } = this.state;
    if (loading) return <Spinner animation="border" />;

    const rows = data
      .filter((row) => showAll || row.status !== "done")
      .map((row, index) => ({
        ...row,
        index: index + 1,
        status: row.status,
        pdfLink: (
          <Button
            size="sm"
            variant="primary"
            href={`/extraction/${row.pdfName}/${row.page}`}
            rel="noreferrer noopener"
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
            href={`${process.env.PUBLIC_URL}/validation/${row.pdfName}/${row.tableId}`}
            rel="noreferrer noopener"
            target="_blank"
            disabled={this.state.softUpdating}
          >
            Open&nbsp;Table
          </Button>
        ),
        fileLink: (
          <Button
            size="sm"
            variant="info"
            href={`${process.env.PUBLIC_URL}/csv/${row.correct_csv}.csv`}
            rel="noreferrer noopener"
            target="_blank"
            disabled={this.state.softUpdating}
          >
            Open&nbsp;CSV
          </Button>
        ),
      }));

    return (
      <React.Fragment>
        <Helmet>
          <title>Manual Processing Helper</title>
        </Helmet>
        <Container fluid>
          <Row>
            <Col>
              <Link to="/">
                <Button size="sm" variant="info" disabled={updating}>
                  Back to home
                </Button>
              </Link>
              <Button onClick={this.softUpdate} size="sm" disabled={updating}>
                Refresh Data
              </Button>
              <Button onClick={() => this.toggleShowAll(!showAll)} variant="secondary" size="sm" disabled={updating}>
                {showAll ? "Hide Done" : "Show All"}
              </Button>
            </Col>
          </Row>
          <Row>
            <Col></Col>
          </Row>
          <Row>
            <Col>
              <MDBDataTable
                paging={false}
                striped
                small
                bordered
                entries={9999999}
                hover
                noBottomColumns
                theadColor="indigo"
                theadTextWhite
                tbodyColor="darkgray"
                data={{ rows, columns }}
                order={["status", "asc"]}
              />
            </Col>
          </Row>
        </Container>
      </React.Fragment>
    );
  }
}
