import React, { Component } from "react";
import ky from "ky";
import { Link } from "react-router-dom";
import { Button, Spinner, Container, Row, Col } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Processing.css";

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
  ) : null;

export default class Processing extends Component {
  state = {
    pdfName: "",
    tableTitle: "",
    page: 0,
    headTable: "",
    tables: [],
    softUpdating: false,
    tagsList: [],
  };

  componentDidMount() {
    const { headTable } = this.props.match.params;
    this.setState({ headTable });
    this.loadData(headTable).then();
    document.addEventListener("keydown", this.handleKeys);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeys);
  }

  handleKeys = (event) => {
    if (this.state.softUpdating) return;

    if (event.key === "KeyA" || event.key.toLowerCase() === "a") {
      console.log("scrolling up...");
      event.preventDefault();
    }

    if (event.key === "KeyD" || event.key.toLowerCase() === "d") {
      console.log("scrolling down...");
      event.preventDefault();
    }
  };

  reloadData = async () => {
    this.setState({ pdfName: "" });
    await this.loadData(this.state.headTable);
  };

  loadData = async (headTable) => {
    try {
      const json = { headTable };
      const result = await ky.post("/getSequence", { json }).json();
      const { tables, tagsList, head } = result;

      if (head.length !== 1) {
        this.props.history.replace({
          pathname: "/processing_index",
        });
        return;
      }

      const { tableTitle, pdfName, page } = head[0];
      this.setState({ tableTitle, pdfName, page, tagsList, tables });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  render() {
    const { pdfName, tableTitle, page, headTable, tables, softUpdating, tagsList } = this.state;
    const numTables = tables.length;
    if (pdfName === "") return <Spinner animation="border" />;

    const topButtons = (
      <Col>
        <Link to="/tables_index">
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
        <Button
          size="sm"
          variant="light"
          href={`/validation/${pdfName}/${headTable}`}
          target="blank_"
          disabled={softUpdating}
        >
          Open Validation
        </Button>
        <Button size="sm" variant="primary" disabled={softUpdating} onClick={this.reloadData}>
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
          Head Table ID: <strong>{headTable}</strong>, Page: <strong>{page}</strong>, Total Tables In Sequence:{" "}
          <strong>{numTables}</strong>
        </p>
        <p>
          Table Name: <strong>{tableTitle}</strong>
        </p>
      </Col>
    );

    const tagsBlock = (tags, csvId) =>
      tagsList.map(({ tagId, tagName }) => (
        <Button
          key={tagId}
          size="sm"
          variant={tags.includes(tagId) ? "success" : "outline-dark"}
          onClick={() => console.log(tagId, csvId)}
          disabled={softUpdating}
        >
          {tagName}
        </Button>
      ));

    const tableRow = ({ csvText, accepted_text, csvId, level, processed_text, tableId, tags, tdd_status }) => (
      <React.Fragment>
        <div className="displayRow">
          <div className="displayColumn">
            <p>
              <strong>{level}</strong>, Table ID: <strong>{tableId}</strong>, CSV ID: <strong>{csvId}</strong>
            </p>
            {tagsBlock(tags, csvId)}
          </div>
        </div>
        <div className="displayRow">
          <div className="displayColumn">
            <div>original:</div>
            <div>{constructTable(csvText)}</div>
            <div>accepted:</div>
            <div>{constructTable(accepted_text)}</div>
          </div>
          <div className="displayColumn">
            <div>processed:</div>
            <div>{constructTable(processed_text)}</div>
          </div>
        </div>
      </React.Fragment>
    );

    return (
      <React.Fragment>
        <Helmet>
          <title>{pdfName}</title>
        </Helmet>
        <Container fluid>
          <Row>{topButtons}</Row>
          <Row>{tableInfo}</Row>
          {tables.map((t) => (
            <Row key={t.tableId} className="tableRow">
              {tableRow(t)}
            </Row>
          ))}
        </Container>
      </React.Fragment>
    );
  }
}
