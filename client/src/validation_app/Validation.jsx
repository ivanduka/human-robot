import React, {Component} from "react";
import {Link} from "react-router-dom";
import {Button, Spinner, Alert, Container, Row, Col} from "react-bootstrap";
import {Helmet} from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
    state = {
        pdfName: null,
        csvs: [],
        tables: [],
        loading: true,
        tableId: null,
        imageLoaded: false,
    };

    componentDidMount() {
        const {pdfName} = this.props.match.params;
        this.setState({pdfName});
        document.addEventListener("keydown", this.handleKeys);
        this.loadData(pdfName);
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.handleKeys);
    }

    handleKeys = (event) => {
        if (event.code === "ArrowLeft") {
            this.prevTable();
            event.preventDefault();
        }

        if (event.code === "ArrowRight") {
            this.nextTable();
            event.preventDefault();
        }
    };

    loadData = async (pdfName, notFirstLoading) => {
        this.setState(() => (notFirstLoading ? {} : {loading: true, imageLoaded: false}));

        if (!pdfName) {
            pdfName = this.state.pdfName;
        }

        try {
            const req1 = fetch(`/getValidationCSVs`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({pdfName}),
            });

            const req2 = fetch(`/getValidationTables`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({pdfName}),
            });

            const [reqCsvs, reqTables] = await Promise.all([req1, req2]);

            const dataCsvs = await reqCsvs.json();
            const errorCsvs = dataCsvs.error;
            let csvs = dataCsvs.results;

            const dataTables = await reqTables.json();
            const errorTables = dataTables.error;
            const tables = dataTables.results;

            if (errorCsvs || reqCsvs.status !== 200) return alert(JSON.stringify(dataCsvs));
            if (errorTables || reqTables.status !== 200) return alert(JSON.stringify(dataTables));

            const tableId = tables.find((table) => table.tableId === this.state.tableId)
                ? this.state.tableId
                : tables.length > 0
                    ? tables[0].tableId
                    : null;

            csvs = csvs
                .filter((csv) => csv.tableId === tableId)
                .sort((a, b) => a.method.localeCompare(b.method))
                .map((csv) => ({...csv, data: csv["csvText"]}));

            this.setState({loading: false, csvs, tables, tableId});
        } catch (e) {
            alert(e);
        }
    };

    prevTable = () => {
        const {tables, tableId} = this.state;
        const currentIndex = tables.findIndex((t) => t.tableId === tableId);
        if (currentIndex === 0) return;
        this.setState({tableId: tables[currentIndex - 1].tableId, imageLoaded: false});
        this.loadData(null, true);
    };

    nextTable = () => {
        const {tables, tableId} = this.state;
        const currentIndex = tables.findIndex((t) => t.tableId === tableId);
        if (currentIndex === tables.length - 1) return;
        this.setState({tableId: tables[currentIndex + 1].tableId, imageLoaded: false});
        this.loadData(null, true);
    };

    imageOnLoad = () => {
        this.setState({imageLoaded: true});
    };

    setResult = async (tableId, csvId) => {
        const res = await fetch("/setValidation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({tableId, csvId}),
        });

        const {error, results} = await res.json();
        if (error || res.status !== 200) alert(JSON.stringify({error, results}));
        await this.loadData(null, true);
    };

    setRelevancy = async (tableId, relevancy) => {
        await this.setResult(tableId, null)

        const res = await fetch("/setRelevancy", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({tableId, relevancy}),
        });

        const {error, results} = await res.json();
        if (error || res.status !== 200) alert(JSON.stringify({error, results}));
        await this.loadData(null, true);
    }

    render() {
        const {pdfName, csvs, tables, loading, tableId, imageLoaded} = this.state;
        if (loading) {
            return <Spinner animation="border"/>;
        }

        if (!tableId) {
            return <Alert variant="danger">Not tables captured/extracted for this PDF</Alert>;
        }

        const currentIndex = tables.findIndex((t) => t.tableId === tableId);
        const {continuationOf, correct_csv, tableTitle, page, relevancy} = tables[currentIndex];

        const conTable = continuationOf ? tables.find((t) => t.tableId === continuationOf) : null;
        const conTableBlock = continuationOf ? (
            <p>
                Continuation Table Name: <strong>{conTable.tableTitle}</strong>, Continuation Table
                ID: <strong>{conTable.tableId}</strong>
            </p>
        ) : null;

        const constructTable = (table) => (
            <table>
                <tbody>
                {table.map((row, idx) => (
                    <tr key={idx}>
                        {row.map((col, index) => (<td key={index}>{col}</td>))}
                    </tr>
                ))}
                </tbody>
            </table>
        );

        const csvsBlock = csvs.map(({csvId, method, data}) => (
            <div className="mb-5" key={csvId}>
                <h6 className="ml-2">
                    <strong>Method: </strong>
                    {method}
                </h6>
                <p className="ml-2">
                    <strong>CSV ID: </strong>
                    {csvId}
                </p>
                <Button
                    variant="success"
                    size="sm"
                    disabled={csvId === correct_csv}
                    className="ml-2"
                    onClick={() => this.setResult(tableId, csvId)}
                >
                    Select
                </Button>
                <div
                    className={
                        csvId === correct_csv ? "ml-2 mr-2 correct" : correct_csv ? "ml-2 mr-2 incorrect" : "ml-2 mr-2 bg-light"
                    }
                >
                    {constructTable(data)}
                </div>
            </div>
        ));

        const webPageTitle = (
            <Helmet>
                <title>{pdfName}</title>
            </Helmet>
        );

        const csvsArea = relevancy === 0
            ? <div className="border border-dark">
                <Alert className="m-2" variant="warning">The table is marked as irrelevant</Alert>
                <Button className="m-2" size="sm" variant="warning" onClick={() => this.setRelevancy(tableId, 1)}>
                    MARK TABLE AS RELEVANT
                </Button>
            </div>
            : <div className="border border-dark">
                <Button className="m-2" size="sm" variant="danger" onClick={() => this.setRelevancy(tableId, 0)}>
                    MARK TABLE AS IRRELEVANT
                </Button>
                {csvsBlock}
                <Button
                    disabled={!correct_csv}
                    variant="warning"
                    size="sm"
                    className="ml-2 mb-3"
                    onClick={() => this.setResult(tableId, null)}
                >
                    Unset Validation
                </Button>
            </div>

        const mainBlock = (
            <Container fluid>
                <Row>
                    <Col>
                        <Link to="/tables_index">
                            <Button className="ml-0" size="sm" variant="info">
                                Back to Index
                            </Button>
                        </Link>
                        <Button size="sm" variant="primary" onClick={() => this.loadData()}>
                            Refresh Data
                        </Button>
                        <Button size="sm" variant="dark" href={`/extraction/${pdfName}/${page}`} target="blank_">
                            Open PDF
                        </Button>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <p>
                            <strong>PDF Name: </strong>
                            {pdfName}, <strong>Page: </strong> {page}
                        </p>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <p>
                            Table Name: <strong>{tableTitle}</strong>, Table ID: <strong>{tableId}</strong>
                        </p>
                        {conTableBlock}
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <Button
                            className="ml-0"
                            size="sm"
                            variant="secondary"
                            onClick={this.prevTable}
                            disabled={currentIndex + 1 === 1}
                        >
                            Prev Table
                        </Button>
                        <strong>Table: </strong> {currentIndex + 1} of {tables.length}
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={this.nextTable}
                            disabled={currentIndex + 1 === tables.length}
                        >
                            Next Table
                        </Button>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        {imageLoaded || <Spinner animation="border"/>}
                        <img
                            src={`/jpg/${tableId}.jpg`}
                            className="img-fluid border border-dark sticky"
                            style={imageLoaded ? {} : {visibility: "hidden"}}
                            onLoad={this.imageOnLoad}
                            alt="Table screenshot from the PDF file"/>
                    </Col>
                    <Col>
                        {csvsArea}
                    </Col>
                </Row>
            </Container>
        );

        return (
            <React.Fragment>
                {webPageTitle}
                {mainBlock}
            </React.Fragment>
        );
    }
}
