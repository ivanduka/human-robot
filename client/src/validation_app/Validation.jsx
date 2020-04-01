import React, { Component } from "react";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
  state = {
    pdfName: null,
    csvs: [],
    loading: false,
    tableId: null
  };

  componentDidMount() {
    const { pdfName } = this.props.match.params;
    this.setState({ pdfName });
    this.loadData(pdfName);
  }

  loadData = async pdfName => {
    this.setState({ loading: true });

    if (!pdfName) {
      pdfName = this.state.pdfName;
    }

    try {
      const req = await fetch(`/getValidationCSVs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfName })
      });
      const data = await req.json();
      const { error, results } = data;
      if (error || req.status !== 200) throw new Error(JSON.stringify(data));

      const tableId = results.length > 0 ? results[0].tableId : null;
      this.setState({ loading: false, csvs: results, tableId });
    } catch (e) {
      alert(e);
    }
  };

  render() {
    const { pdfName } = this.state;
    const webPageTitle = (
      <Helmet>
        <title>{pdfName}</title>
      </Helmet>
    );

    return (
      <React.Fragment>
        {webPageTitle}
        <div>{pdfName}</div>
      </React.Fragment>
    );
  }
}
