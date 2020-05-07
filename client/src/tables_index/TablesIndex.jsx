import React, {Component} from "react";
import {Link} from "react-router-dom";
import {MDBDataTable} from "mdbreact";
import {Container, Row, Col, Button, Spinner} from "react-bootstrap";
import {Helmet} from "react-helmet";

import "./TablesIndex.css";

export default class ExtractionIndex extends Component {
    state = {
        columns: [
            {
                label: "PDF ID",
                field: "pdfId",
                sort: "asc",
                width: 100,
            },
            {
                label: "PDF Name",
                field: "pdfName",
                sort: "asc",
                width: 50,
            },

            {
                label: "PDF Size (MB)",
                field: "pdfSize",
                sort: "asc",
                width: 100,
            },
            {
                label: "Filing ID",
                field: "filingId",
                sort: "asc",
                width: 100,
            },
            {
                label: "Submission Date",
                field: "date",
                sort: "asc",
                width: 150,
            },
            {
                label: "Total Pages",
                field: "totalPages",
                sort: "asc",
                width: 100,
            },
            {
                label: "",
                field: "capturingLink",
                sort: "asc",
                width: 100,
            },
            {
                label: "Tables Captured",
                field: "tableCount",
                sort: "asc",
                width: 100,
            },
            {
                label: "Status",
                field: "status",
                sort: "asc",
                width: 100,
            },
            {
                label: "",
                field: "validatingLink",
                sort: "asc",
                width: 100,
            },
            {
                label: "Tables Validated",
                field: "tablesValidated",
                sort: "asc",
                width: 100,
            },
            {
                label: "Tables Irrelevant",
                field: "tablesIrrelevant",
                sort: "asc",
                width: 100,
            },
            {
                label: "Tables Not Validated",
                field: "tablesNotValidated",
                sort: "asc",
                width: 100,
            },
        ],
        rows: null,
        loading: true,
        softUpdating: false,
    };

    componentDidMount() {
        this.loadData();
        window.addEventListener("focus", this.softLoadData)
    }

    componentWillUnmount() {
        window.removeEventListener("focus", this.softLoadData)
    }

    softLoadData = async () => {
        this.setState({softUpdating: true})
        await this.loadData(true)
        this.setState({softUpdating: false})

    }

    loadData = async (notFirstLoad) => {
        if (!notFirstLoad) {
            this.setState({loading: true});
        }

        try {
            const result = await fetch(`/table_index`)
            const {results} = await result.json()
            const rows = results.map((row) => ({
                    ...row,
                    date: new Date(row.date).toISOString().split("T")[0],
                    capturingLink: (
                        <Button size="sm" variant={row.status ? "warning" : "primary"} href={`/extraction/${row.pdfName}`}
                                target="blank_">
                            Capture
                        </Button>
                    ),
                    validatingLink: (
                        <Button size="sm" variant="info" href={`/validation/${row.pdfName}`} target="blank_">
                            Capture
                        </Button>
                    ),
                }))
            ;
            this.setState({rows, loading: false});
        } catch (err) {
            console.log(err)
            alert(err);
        }
    };

    render() {
        const {rows, columns, loading, softUpdating} = this.state;
        const table = loading ? (
            <Spinner animation="border"/>
        ) : (
            <MDBDataTable
                striped
                small
                bordered
                entries={10000}
                entriesOptions={[10, 100, 1000, 10000]}
                exportToCSV={true}
                hover
                noBottomColumns
                order={["pdfId", "asc"]}
                theadColor="indigo"
                theadTextWhite
                tbodyColor="darkgray"
                data={{rows, columns}}
            />
        );

        return (
            <Container fluid>
                <Helmet>
                    <title>Index of PDF files</title>
                </Helmet>
                <Row>
                    <Col>
                        <Link to="/">
                            <Button size="sm" variant="info">
                                Back to home
                            </Button>
                        </Link>
                        {softUpdating
                            ? <Spinner animation="border"/>
                            : <Button size="sm" variant="primary" onClick={this.softLoadData}> Refresh Data </Button>}
                    </Col>
                </Row>
                <Row>
                    <Col>{table}</Col>
                </Row>
            </Container>
        );
    }
}
