import React, { Component } from "react";
import { Link } from "react-router-dom";
import { MDBDataTable } from "mdbreact";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";

import "./ContentIndex.css";

export default class ContentIndex extends Component {
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
        field: "tableId",
      },
      {
        label: "Status",
        field: "status",
      },
      {
        label: "",
        field: "tagging"
      }
    ],
    tables: [],
    loading: true,
    softUpdating: false,
  };

  componentDidMount() {
    this.loadData().then();
  }

  componentWillUnmount() {
  }

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
      const { tables } = await ky.post(`/headerTaggingIndex`).json();
      this.setState({ tables, loading: false });
    } catch (error) {
      console.log(error);
    }
  };

  render() {
    const { tables, loading, softUpdating, columns } = this.state;
    if (loading) return <Spinner animation="border"/>;

    const rowsWithButtons = tables.map((row, index) => {
      const { tableId, status, pdfName, page } = row;
      const { softUpdating } = this.state;

      return {
        ...row,
        index: index + 1,
        pdfLink: (
          <Button
            size="sm"
            variant="secondary"
            href={`/extraction/${encodeURIComponent(pdfName)}/${page}`}
            target="_blank"
            disabled={softUpdating}
          >
            Open&nbsp;PDF
          </Button>
        ),
        tagging: (
          <Button
            size="sm"
            variant={status === "done" ? "primary" : "warning"}
            href={`/tagging/${tableId}`}
            disabled={softUpdating}
          >
            {status}
          </Button>
        ),
      };
    });

    return (
      <Container fluid>
        <Helmet>
          <title>Content Index</title>
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
