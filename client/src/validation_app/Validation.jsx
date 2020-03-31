import React, { Component } from "react";
import { generatePath, Link } from "react-router-dom";
import { Button, Spinner, Alert, Form } from "react-bootstrap";
import { Helmet } from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
  state = { pdfName: null };

  componentDidMount() {
    const { pdfName } = this.props.match.params;
    this.setState({ pdfName });
    this.loadData(pdfName);
  }

  loadData() {}

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
        <div>hello!</div>
      </React.Fragment>
    );
  }
}
