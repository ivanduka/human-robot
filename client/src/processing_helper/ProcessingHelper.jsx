import React, { Component } from "react";
import { Container, Row, Col, Button, Spinner, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";
import { Link } from "react-router-dom";

import "./ProcessingHelper.css";

const constructTable = (table) =>
  table ? (
    <table>
      <tbody>
        {table.map((row, idx) => (
          <tr key={idx}>
            {row.map((col, index) => (
              <td key={index}>{col}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    "[NO DATA]"
  );

export default class ProcessingHelper extends Component {
  state = {
    data: [],
    loading: false,
    updating: false,
    showProcessed: false,
    tagId: 0,
    tags: [],
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
      const { tagId } = this.state;
      if (!notFirstUpdate) this.setState({ loading: true });
      const { data, tags } = await ky.post(`/processingHelper`, { json: { tagId } }).json();
      this.setState({ data, tags, loading: false });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  changeTag = async (e) => {
    const tagId = e.target.value;
    this.setState({ tagId }, () => this.softUpdate());
  };

  toggleProcessed = async (showProcessed) => {
    this.setState({ showProcessed });
  };

  render() {
    const { data, loading, tagId, tags, showProcessed, updating } = this.state;
    if (loading) return <Spinner animation="border" />;

    const tables = data.map((t) => (
      <div className="itemRow" key={t.tableId}>
        <div>
          <strong>
            {updating ? (
              t.tableId
            ) : (
              <Link to={`/validation/${t.pdfName}/${t.tableId}`} target="_blank" rel="noreferrer">
                {t.tableId}
              </Link>
            )}
            ; level: {t.level}; tags: {JSON.stringify(t.tags.sort())}; all_tags: {JSON.stringify(t.all_tags.sort())}
          </strong>
        </div>
        <div>{constructTable(showProcessed ? t.processed_text : t.csvText)}</div>
      </div>
    ));

    return (
      <React.Fragment>
        <Helmet>
          <title>Helper</title>
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
              <Button
                variant="secondary"
                onClick={() => this.toggleProcessed(!showProcessed)}
                size="sm"
                disabled={updating}
              >
                {showProcessed ? "Show Original" : "Show Processed"}
              </Button>
              <Form.Control
                as="select"
                value={tagId}
                size="sm"
                onChange={(e) => this.changeTag(e)}
                className="dropdown"
                disabled={updating}
              >
                <option value='0'>select a tag</option>
                {tags.map((t) => (
                  <option value={t.tagId} key={t.tagId}>
                    {t.tagId}: {t.tagName}
                  </option>
                ))}
              </Form.Control>
              {updating ? ` loading...` : ` (${data.length} results)`}
            </Col>
          </Row>
          <Row className="tableRow2">
            <Col>{tables}</Col>
          </Row>
        </Container>
      </React.Fragment>
    );
  }
}
