import React, { Component } from "react";
import { Link } from "react-router-dom";
import { MDBDataTable } from "mdbreact";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap-css-only/css/bootstrap.min.css";
import "mdbreact/dist/css/mdb.css";

import Spinner from "../spinner/Spinner";

export default class ExtractionIndex extends Component {
  state = {
    columns: [
      {
        label: "PDF ID",
        field: "pdfId",
        sort: "asc",
        width: 100
      },
      {
        label: "PDF Name",
        field: "pdfName",
        sort: "asc",
        width: 100
      },
      {
        label: "PDF Size (MB)",
        field: "pdfSize",
        sort: "asc",
        width: 100
      },
      {
        label: "Filing ID",
        field: "filingId",
        sort: "asc",
        width: 100
      },
      {
        label: "Sumbission Date",
        field: "date",
        sort: "asc",
        width: 150
      },
      {
        label: "Total Pages",
        field: "totalPages",
        sort: "asc",
        width: 100
      },
      {
        label: "Status",
        field: "status",
        sort: "asc",
        width: 100
      }
    ],
    rows: null
  };

  componentDidMount() {
    this.loadData();
  }

  componentWillUnmount() {}

  loadData = () => {
    fetch(`/extraction_index`)
      .then(res => res.json())
      .then(({ error, results }) => {
        if (error) {
          return alert(error);
        }
        this.setState({ rows: results });
      });
  };

  render() {
    const { rows, columns } = this.state;
    const table = rows ? (
      <MDBDataTable striped bordered data={{ rows, columns }} />
    ) : (
      <Spinner />
    );

    return (
      <div>
        <Link to="/">HOME</Link>
        <div>Index of Files:</div>
        <Link to="/extraction/2445104">2445104</Link>
        {table}
      </div>
    );
  }
}
