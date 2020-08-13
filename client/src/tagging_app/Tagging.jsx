import React, { Component } from "react";
import ky from "ky";
import { Link } from "react-router-dom";
import { Button, Spinner, Container, Row, Col, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Tagging.css";

export default class Tagging extends Component {
  state = {
    pdfName: "",
    tableTitle: "",
    page: 0,
    tableId: "",
    rows: [],
    headers: [],
    softUpdating: false,
    loading: true,
    tableTags: [],
    allTags: [],
  };

  componentDidMount() {
    const { tableId } = this.props.match.params;
    this.setState({ tableId });
    this.loadData(tableId).then();
  }

  softLoadData = async () => {
    this.setState({ softUpdating: true });
    await this.loadData(this.state.tableId);
    this.setState({ softUpdating: false });
  };

  loadData = async (tableId) => {
    try {
      const json = { tableId };
      const result = await ky.post("/getHeaderTagging", { json }).json();
      let { table, tableTags, allTags } = result;

      if (table.length !== 1) {
        this.props.history.replace({
          pathname: "/content_index",
        });
        return;
      }

      const { combinedConText, page, pdfName, tableTitle } = table[0];
      this.setState({
        rows: combinedConText.slice(1),
        page,
        pdfName,
        tableTags,
        allTags,
        tableTitle,
        headers: combinedConText[0],
        loading: false,
      });
    } catch (error) {
      console.log(error);
    }
  };

  render() {
    let {
      pdfName,
      tableTitle,
      page,
      tableId,
      rows,
      headers,
      softUpdating,
      loading,
      tableTags,
      allTags,
    } = this.state;

    if (loading) return <Spinner animation="border"/>;

    const topButtons = (
      <Col>
        <Link to="/processing_index">
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
      </Col>
    );

    const tableInfo = (
      <Col>
        <p>
          PDF Name: <strong>{pdfName}</strong>
        </p>
        <p>
          Head Table ID: <strong>{tableId}</strong>, Page: <strong>{page}</strong>
        </p>
        <p>
          Table Name: <strong>{tableTitle}</strong>
        </p>
      </Col>
    );

    return (
      <React.Fragment>
        <Helmet>
          <title>Tagging: {pdfName}</title>
        </Helmet>
        <Container fluid>
          <Row>{topButtons}</Row>
          <Row>{tableInfo}</Row>
          {null}
        </Container>
      </React.Fragment>
    );
  }
}
