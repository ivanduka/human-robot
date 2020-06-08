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
  ) : (
    "[NO DATA]"
  );

const tablesAreEqual = (t1, t2) => {
  if (t1 === null || t2 === null || t1.length !== t2.length) return false;
  for (let row = 0; row < t1.length; row++) {
    if (t1[row].length !== t2[row].length) return false;
    for (let cell = 0; cell < t1[row].length; cell++) {
      if (t1[row][cell] !== t2[row][cell]) return false;
    }
  }
  return true;
};

const original = "Original";
const image = "Image";
const accepted = "Previously Accepted";
const processed = "Processed";

export default class Processing extends Component {
  state = {
    pdfName: "",
    tableTitle: "",
    page: 0,
    headTable: "",
    tables: [],
    softUpdating: false,
    tagsList: [],
    showAccepted: false,
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
      let { tables, tagsList, head } = result;
      tables = tables.map((t) => ({
        ...t,
        mode: t.accepted_text === null ? original : accepted,
      }));

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

  changeView = (tableId, newMode) => {
    const tables = this.state.tables.map((t) => (t.tableId === tableId ? { ...t, mode: newMode } : t));
    this.setState({ tables });
  };

  changeViewAccepted = (showAccepted) => {
    this.setState({ showAccepted });
  };

  setAccepted = async (csvId, newAccepted) => {
    try {
      const { tables } = this.state;
      const { accepted_text } = tables.find((t) => t.csvId === csvId);
      if (
        (newAccepted === null || accepted_text !== null) &&
        !window.confirm(
          newAccepted === null
            ? "Do you really want to unset the accepted result?"
            : "Do you really want to overwrite accepted result?",
        )
      ) {
        return;
      }
      this.setState({ softUpdating: true });
      await ky.post("/setAccepted", { json: { csvId, newAccepted } }).json();
      const updatedTables = tables.map((t) =>
        t.csvId === csvId
          ? {
              ...t,
              accepted_text: newAccepted,
              mode: newAccepted === null ? original : accepted,
            }
          : t,
      );
      this.setState({ tables: updatedTables, softUpdating: false });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  render() {
    const { pdfName, tableTitle, page, headTable, tables, softUpdating, tagsList, showAccepted } = this.state;
    const numTables = tables.length;
    if (pdfName === "") return <Spinner animation="border" />;

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
        <Button
          size="sm"
          variant="secondary"
          disabled={softUpdating}
          onClick={() => this.changeViewAccepted(!showAccepted)}
        >
          {(showAccepted ? "Hide" : "Show") + " Accepted/Not Processed Tables"}
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
          disabled
        >
          {tagName}
        </Button>
      ));

    const display = (table) => {
      if (table.mode === image) {
        return (
          <img
            src={`/jpg/${table.tableId}.jpg`}
            className="img-fluid border border-dark"
            alt="Table screenshot from the PDF file"
          />
        );
      }
      if (table.mode === accepted) {
        return constructTable(table.accepted_text);
      }
      return constructTable(table.csvText);
    };

    const btn = (table, mode) => (
      <Button
        size="sm"
        variant="primary"
        onClick={() => this.changeView(table.tableId, mode)}
        disabled={softUpdating || table.mode === mode}
      >
        {mode}
      </Button>
    );

    const originalButtons = (t) => (
      <div>
        {btn(t, original)}
        {btn(t, image)}
        {t.accepted_text ? btn(t, accepted) : null}
        {t.accepted_text ? (
          <Button size="sm" variant="danger" onClick={() => this.setAccepted(t.csvId, null)} disabled={softUpdating}>
            Unset Accepted
          </Button>
        ) : null}
      </div>
    );

    const processedButton = (t) => (
      <div>
        <Button
          size="sm"
          variant="success"
          onClick={() => this.setAccepted(t.csvId, t.processed_text)}
          disabled={softUpdating || tablesAreEqual(t.accepted_text, t.processed_text) || t.processed_text === null}
        >
          Set As Accepted
        </Button>
      </div>
    );

    const tableRow = (t) => {
      const showTable = showAccepted || (t.accepted_text === null && t.processed_text !== null);
      return (
        <React.Fragment>
          <div
            className={
              "displayRow " + (t.processed_text ? null : " notProcessed ") + (t.accepted_text ? " hasAccepted " : null)
            }
          >
            <div className="displayColumn">
              <p>
                <strong>{t.level}</strong>, Table ID:{" "}
                <a href={`/validation/${pdfName}/${t.tableId}`} target="_blank" rel="noreferrer noopener">
                  <strong>{t.tableId}</strong>
                </a>
                , CSV ID: <strong>{t.csvId}</strong>
              </p>
              {showTable ? tagsBlock(t.tags, t.csvId) : null}
            </div>
          </div>
          {showTable ? (
            <div
              className={
                "displayRow " + (t.processed_text ? null : " notProcessed ") + (t.accepted_text ? "hasAccepted" : null)
              }
            >
              <div className="displayColumn">
                <h3>{t.mode}</h3>
                {originalButtons(t)}
                <div>{display(t)}</div>
              </div>
              <div className="displayColumn">
                <h3>{processed}:</h3>
                {processedButton(t)}
                <div>{constructTable(t.processed_text)}</div>
              </div>
            </div>
          ) : null}
        </React.Fragment>
      );
    };

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
