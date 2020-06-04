import React, { Component } from "react";
import { Container, Row, Col, Button, Spinner } from "react-bootstrap";
import { Helmet } from "react-helmet";
import ky from "ky";
import SyntaxHighlighter from "react-syntax-highlighter";
import { monokai } from "react-syntax-highlighter/dist/esm/styles/hljs";

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
    query: "",
  };

  componentDidMount() {
    this.loadData().then();
  }

  loadData = async () => {
    try {
      this.setState({ loading: true });
      const { data, query } = await ky.post(`/processingHelper`).json();
      this.setState({ data, query, loading: false });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  render() {
    const { data, loading, query } = this.state;
    if (loading) return <Spinner animation="border" />;

    const tables = data.map((t) => (
      <div className="itemRow" key={t.tableId}>
        <div>
          <strong>
            <a href={`/validation/${t.pdfName}/${t.tableId}`} target="_blank" rel="noreferrer">
              {t.tableId}
            </a>
            ; level: {t.level}; tags: {JSON.stringify(t.tags.sort())}; all_tags: {JSON.stringify(t.all_tags.sort())}
          </strong>
        </div>
        <div>{constructTable(t.csvText)}</div>
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
              <Button onClick={this.loadData} size="sm" disabled={loading}>
                Refresh Data
              </Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <div>
                <h4>Query ({data.length} results):</h4>
              </div>
              <SyntaxHighlighter language="sql" style={monokai}>
                {query.trim()}
              </SyntaxHighlighter>
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
