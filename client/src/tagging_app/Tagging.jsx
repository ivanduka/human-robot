import React, { Component } from "react";
import ky from "ky";
import { Link } from "react-router-dom";
import { Button, Spinner, Container, Row, Col } from "react-bootstrap";
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
    doneStatus: true,
    showAllRows: true,
    showTopRows: 10,
    empties: [],
    regexp: RegExp(`[a-zA-Z0-9]`),
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

      const { combinedConText, page, pdfName, tableTitle, headers_tagged } = table[0];
      const rows = combinedConText.slice(1);
      const headers = combinedConText[0];


      const empties = Array(headers.length).fill(0);

      for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < empties.length; col += 1) {
          if (!this.state.regexp.test(rows[row][col])) {
            console.log(row, col, rows[row][col]);
            empties[col] += 1;
          }
        }
      }

      this.setState({
        rows,
        page,
        pdfName,
        tableTags,
        allTags,
        tableTitle,
        doneStatus: headers_tagged === 1,
        headers,
        loading: false,
        empties,
      });
    } catch (error) {
      console.log(error);
    }
  };

  setDoneStatus = async (newStatus) => {
    try {
      const { tableId } = this.state;
      this.setState({ softUpdating: true });
      await ky.post("/setHeaderTaggingStatus", { json: { tableId, newStatus } }).json();
      this.setState({ doneStatus: newStatus, softUpdating: false });
    } catch (error) {
      console.log(error);
    }
  };

  tagColumn = async (headerIndex, hTag) => {
    try {
      const { tableId } = this.state;
      this.setState({ softUpdating: true });
      await ky.post("/setHeaderTag", { json: { tableId, headerIndex, hTag } }).json();
      const tableTags = this.state.tableTags.slice();
      tableTags.push({ headerIndex, htag: hTag });
      this.setState({ tableTags, softUpdating: false });
    } catch (error) {
      console.log(error);
    }
  };

  unTagColumn = async (headerIndex, hTag) => {
    try {
      const { tableId } = this.state;
      this.setState({ softUpdating: true });
      await ky.post("/removeHeaderTag", { json: { tableId, headerIndex, hTag } }).json();
      const tableTags = this.state.tableTags.filter(tt => !(tt.htag === hTag && tt.headerIndex === headerIndex));
      this.setState({ tableTags, softUpdating: false });
    } catch (error) {
      console.log(error);
    }
  };

  toggleShowAllRows = (showAllRows) => {
    this.setState({ showAllRows });
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
      doneStatus,
      showAllRows,
      showTopRows,
      empties,
      regexp,
    } = this.state;

    if (!showAllRows && rows.length > showTopRows) {
      rows = rows.slice(0, showTopRows);
    }

    if (loading) return <Spinner animation="border"/>;

    const isEnabled = (headerIndex, htag, maxTags) => {
      const selected = tableTags.filter(tt => tt.htag === htag);
      const tagged = isTagged(headerIndex, htag);
      return tagged || selected.length < maxTags;
    };
    const isTagged = (headerIndex, htag) => tableTags.find(tt => tt.headerIndex === headerIndex && tt.htag === htag);

    const tableBody = (
      <table className="equal">
        <thead>
        <tr>
          {headers.map((_, headerIndex) => (
            <th key={headerIndex}>
              {allTags.map(({ htag, maxTags }, tagIndex) => {
                  const setFunc = () => this.tagColumn(headerIndex, htag);
                  const delFunc = () => this.unTagColumn(headerIndex, htag);
                  const enabled = isEnabled(headerIndex, htag, maxTags);
                  const tagged = isTagged(headerIndex, htag);

                  return (<div key={tagIndex}>
                    <Button
                      disabled={softUpdating || !enabled || doneStatus}
                      size="sm"
                      variant={tagged ? "success" : "light"}
                      onClick={tagged ? delFunc : setFunc}>
                      {htag}
                    </Button>
                  </div>);
                },
              )}
            </th>
          ))}
        </tr>
        <tr>
          {empties.map((emptyCount, colIndex) => (
            <th key={colIndex} className={emptyCount > 0 ? "red" : null}>
              {emptyCount === this.state.rows.length ? "all " : null}{emptyCount} empty
            </th>
          ))}
        </tr>
        <tr>
          {headers.map((header, headerIndex) => {
            const used = tableTags.find(tt => tt.headerIndex === headerIndex);
            return <th key={headerIndex} className={used ? "green bold" : "grey bold"}>{header}</th>;
          })}
        </tr>
        </thead>
        <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => {
              const used = tableTags.find(tt => tt.headerIndex === cellIndex);
              const empty = !regexp.test(cell);
              return <td key={cellIndex} className={empty ? "red" : used ? "green" : "grey"}>{cell}</td>;
            })}
          </tr>
        ))}
        </tbody>
      </table>
    );

    const topButtons = (
      <Col>
        <Link to="/content_index">
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
        <Button size="sm" variant="secondary" disabled={softUpdating || this.state.rows.length <= showTopRows}
                onClick={() => this.toggleShowAllRows(!showAllRows)}>
          {this.state.rows.length <= showTopRows
            ? `Showing all ${this.state.rows.length} rows`
            : showAllRows
              ? `Show top ${showTopRows} out of ${this.state.rows.length} rows`
              : `Show all ${this.state.rows.length} rows`}
        </Button>
        <Button
          size="sm"
          variant={doneStatus ? "secondary" : "warning"}
          disabled={softUpdating}
          onClick={() => this.setDoneStatus(!doneStatus).then()}>
          {doneStatus ? "Unlock Table" : "Lock Table"}
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
          <Row>
            {tableBody}
          </Row>
        </Container>
      </React.Fragment>
    );
  }
}
