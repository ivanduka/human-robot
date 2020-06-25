import React, { Component } from "react";
import ky from "ky";
import { Link } from "react-router-dom";
import { Button, Spinner, Container, Row, Col, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Concat.css";

export default class Concat extends Component {
  state = {
    pdfName: "",
    tableTitle: "",
    page: 0,
    headTable: "",
    tables: [],
    softUpdating: false,
    concatenatedText: [],
    showConcatenated: false,
    combinedConText: [],
    showCombinedConText: false,
  };

  componentDidMount() {
    const { headTable } = this.props.match.params;
    this.setState({ headTable });
    this.loadData(headTable).then();
  }

  reloadData = async () => {
    this.setState({ pdfName: "" });
    await this.loadData(this.state.headTable);
  };

  loadData = async (headTable) => {
    try {
      const json = { headTable };
      const result = await ky.post("/getConcatSequence", { json }).json();
      let { tables, head } = result;

      if (head.length !== 1) {
        this.props.history.replace({
          pathname: "/processing_index",
        });
        return;
      }

      const { tableTitle, pdfName, page, concatenatedText, combinedConText } = head[0];
      this.setState({ tableTitle, pdfName, page, tables, concatenatedText, combinedConText });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  setAppendStatus = async (csvId, appendStatus) => {
    try {
      const { tables } = this.state;
      this.setState({ softUpdating: true });
      await ky.post("/setAppendStatus", { json: { csvId, appendStatus } }).json();
      const updatedTables = tables.map((t) => (t.csvId === csvId ? { ...t, appendStatus } : t));
      this.setState({ tables: updatedTables, softUpdating: false });
    } catch (error) {
      console.log(error);
      alert(error);
    }
  };

  toggleConcatenatedView = async (showConcatenated) => {
    this.setState({ showConcatenated });
  };

  toggleCheckboxChange = async (event) => {
    this.setState({ showCombinedConText: event.target.checked });
  };

  render() {
    let {
      pdfName,
      tableTitle,
      page,
      headTable,
      tables,
      softUpdating,
      concatenatedText,
      showConcatenated,
      combinedConText,
      showCombinedConText,
    } = this.state;
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
          disabled={softUpdating || (!showConcatenated && concatenatedText.length === 0)}
          onClick={() => this.toggleConcatenatedView(!showConcatenated)}
        >
          {showConcatenated ? "Show Original" : "Show Concatenated"}
        </Button>
        {showConcatenated ? (
          <Form.Check
            inline
            type="checkbox"
            value="combinedConText"
            label="Show Combined Concatenated Text"
            checked={showCombinedConText}
            onChange={this.toggleCheckboxChange}
          />
        ) : null}
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

    const tableControls = (appendStatus, csvId) => (
      <React.Fragment>
        <Button
          size="sm"
          variant="primary"
          onClick={() => this.setAppendStatus(csvId, 1)}
          disabled={softUpdating || appendStatus === 1}
        >
          Standalone Table
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => this.setAppendStatus(csvId, 2)}
          disabled={softUpdating || appendStatus === 2}
        >
          Add First Row to Previous Table's Last Row
        </Button>
        <Button
          size="sm"
          variant="info"
          onClick={() => this.setAppendStatus(csvId, 0)}
          disabled={softUpdating || appendStatus === 0}
        >
          Unset
        </Button>
      </React.Fragment>
    );

    const constructTable = ({ accepted_text, noHeaders, appendStatus, isFirstTable, nextTableAppendStatus }) => (
      <table>
        <tbody>
          {accepted_text.map((row, rowIndex) => {
            let className = "";
            if (appendStatus !== 0 || isFirstTable) {
              className = "green";
            }
            if (noHeaders === 0 && rowIndex === 0 && !isFirstTable) {
              className = "red";
            }
            if (
              (rowIndex === accepted_text.length - 1 && nextTableAppendStatus === 2) ||
              (rowIndex === 0 && noHeaders === 1 && appendStatus === 2) ||
              (rowIndex === 1 && noHeaders === 0 && appendStatus === 2)
            ) {
              className = "yellow";
            }
            return (
              <tr key={rowIndex} className={className}>
                {row.map((col, index) => (
                  <td key={index}>{col}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    const tableRow = (
      { level, csvId, accepted_text, noHeaders, appendStatus, tableId },
      isFirstTable,
      nextTableAppendStatus,
    ) => (
      <React.Fragment>
        <div>
          {level === 1 ? null : tableControls(appendStatus, csvId)}
          <strong>
            {level} / {tables.length}:{" "}
            <a href={`/validation/${pdfName}/${tableId}`} rel="noopener noreferrer" target="_blank">
              {tableId}
            </a>
          </strong>
        </div>
        <div>{constructTable({ accepted_text, noHeaders, appendStatus, isFirstTable, nextTableAppendStatus })}</div>
      </React.Fragment>
    );

    const tablesBlock =
      showConcatenated && concatenatedText.length > 0 ? (
        <Row key={headTable} className="concatTableRow">
          {tableRow(
            {
              level: 1,
              csvId: "",
              accepted_text: showCombinedConText ? combinedConText : concatenatedText,
              tableId: headTable,
            },
            true,
            1,
          )}
        </Row>
      ) : (
        tables.map((t, idx) => (
          <Row key={t.tableId} className="concatTableRow">
            {tableRow(t, idx === 0, idx < tables.length - 1 ? tables[idx + 1].appendStatus : 0)}
          </Row>
        ))
      );

    return (
      <React.Fragment>
        <Helmet>
          <title>Concat: {pdfName}</title>
        </Helmet>
        <Container fluid>
          <Row>{topButtons}</Row>
          <Row>{tableInfo}</Row>
          {tablesBlock}
        </Container>
      </React.Fragment>
    );
  }
}
