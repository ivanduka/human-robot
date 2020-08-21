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
    showAllRows: false,
    showTopRows: 10,
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
      this.setState({
        rows: combinedConText.slice(1),
        page,
        pdfName,
        tableTags,
        allTags,
        tableTitle,
        doneStatus: headers_tagged === 1,
        headers: combinedConText[0],
        loading: false,
      });
    } catch (error) {
      console.log(error);
    }
  };

  setDoneStatus = async (newStatus) => {
    try {
      const { tableId, tableTags, allTags } = this.state;
      const mandatoryTags = allTags.filter(t => t.optional === 0).map(t => t.htag);
      for (const tag of mandatoryTags) {
        if (!tableTags.find(t => t.htag === tag)) {
          return alert(`Not all mandatory tags are tagged (for example, '${tag}')!`);
        }
      }
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
      const tableTags = this.state.tableTags.filter(tt => tt.htag !== hTag);
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
    } = this.state;

    if (!showAllRows && rows.length > showTopRows) {
      rows = rows.slice(0, showTopRows);
    }

    if (loading) return <Spinner animation="border"/>;

    const isEnabled = (headerIndex, htag) => {
      const selected = tableTags.find(tt => tt.htag === htag);
      return !selected || selected.headerIndex === headerIndex;
    };
    const isTagged = (headerIndex, htag) => tableTags.find(tt => tt.headerIndex === headerIndex && tt.htag === htag);
    const isAnyTagged = htag => tableTags.find(tt => tt.htag === htag);

    const tableBody = (
      <table className="equal">
        <thead>
        <tr className="flexible">
          {headers.map((_, headerIndex) => (
            <th key={headerIndex}>
              {allTags.map(({ htag, optional }, tagIndex) => {
                  const setFunc = () => this.tagColumn(headerIndex, htag);
                  const delFunc = () => this.unTagColumn(headerIndex, htag);
                  const enabled = isEnabled(headerIndex, htag);
                  const tagged = isTagged(headerIndex, htag);
                  const anyIsTagged = isAnyTagged(htag);

                  return (<div key={tagIndex}>
                    <Button
                      disabled={softUpdating || !enabled || doneStatus}
                      size="sm"
                      variant={tagged ? "success" : anyIsTagged ? "light" : optional === 1 ? "light" : "primary"}
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
          {headers.map((header, headerIndex) => {
            const used = tableTags.find(tt => tt.headerIndex === headerIndex);
            return <th key={headerIndex} className={used ? "green" : "grey"}>{header}</th>;
          })}
        </tr>
        </thead>
        <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => {
              const used = tableTags.find(tt => tt.headerIndex === cellIndex);
              return <td key={cellIndex} className={used ? "green" : "grey"}>{cell}</td>;
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
        <Button size="sm" variant="secondary" disabled={softUpdating} onClick={() => this.toggleShowAllRows(!showAllRows)}>
          {showAllRows ? `Show top ${showTopRows} rows` : `Show all ${this.state.rows.length} rows`}
        </Button>
        <Button size="sm" variant={doneStatus ? "secondary" : "warning"} disabled={softUpdating} onClick={() => {
          this.setDoneStatus(!doneStatus).then();
        }}>
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
