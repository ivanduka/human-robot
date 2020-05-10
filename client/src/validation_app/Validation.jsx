import React, {Component} from "react";
import ky from 'ky';
import {Link} from "react-router-dom";
import {Button, Spinner, Alert, Container, Row, Col, Form} from "react-bootstrap";
import {Helmet} from "react-helmet";
import "./Validation.css";

export default class Validation extends Component {
    state = {
        pdfName: null,
        csvs: [],
        tables: [],
        loading: true,
        tableId: null,
        tags: [],
        imageLoaded: false,
        softLoading: false,
    };

    componentDidMount() {
        const {pdfName} = this.props.match.params;
        this.setState({pdfName});
        this.loadData(pdfName);
        document.addEventListener("keydown", this.handleKeys);
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.handleKeys);
    }

    handleKeys = (event) => {
        if (event.key === "KeyA" || event.key.toLowerCase() === "a") {
            this.prevTable();
            event.preventDefault();
        }

        if (event.key === "KeyD" || event.key.toLowerCase() === "d") {
            this.nextTable();
            event.preventDefault();
        }
    };

    prevTable = () => {
        const {tables, tableId} = this.state;
        const currentIndex = tables.findIndex((t) => t.tableId === tableId);
        if (currentIndex === 0) return;
        this.setState({tableId: tables[currentIndex - 1].tableId, imageLoaded: false});
        this.softLoadData();
    };

    nextTable = () => {
        const {tables, tableId} = this.state;
        const currentIndex = tables.findIndex((t) => t.tableId === tableId);
        if (currentIndex === tables.length - 1) return;
        this.setState({tableId: tables[currentIndex + 1].tableId, imageLoaded: false});
        this.softLoadData();
    };

    goToTable = (event) => {
        const {tables} = this.state;
        const {value} = event.target;
        this.setState({tableId: tables[value - 1].tableId, imageLoaded: false});
        this.softLoadData()
    }

    imageOnLoad = () => {
        this.setState({imageLoaded: true});
    };

    softLoadData = async () => {
        this.setState({softUpdating: true})
        await this.loadData(null, true)
        this.setState({softUpdating: false})
    }

    loadData = async (pdfName, notFirstLoading) => {
        if (!notFirstLoading) {
            this.setState({loading: true, imageLoaded: false})
        }

        if (!pdfName) {
            pdfName = this.state.pdfName;
        }

        try {
            const json = {pdfName}
            const res1 = ky.post(`/getValidationCSVs`, {json}).json();
            const res2 = ky.post(`/getValidationTables`, {json}).json();
            const res3 = ky.post("/getValidationTags", {json}).json();

            const [csvsResult, tables, tagsResult] = await Promise.all([res1, res2, res3]);

            const tableId = tables.find((table) => table.tableId === this.state.tableId)
                ? this.state.tableId
                : tables.length > 0
                    ? tables[0].tableId
                    : null;

            const csvs = csvsResult
                .filter((csv) => csv.tableId === tableId)
                .sort((a, b) => a.method.localeCompare(b.method))

            const tags = tagsResult.filter(t => t.tableId === tableId)

            this.setState({loading: false, csvs, tables, tableId, tags});
            console.log({csvs, tables, tags});

            // Pre-loading all the images for all the tables of the current PDF
            if (!notFirstLoading) {
                tables.forEach(t => {
                    const img = new Image();
                    img.src = `/jpg/${t.tableId}.jpg`;
                })
            }
        } catch (error) {
            console.log(error)
            alert(error)
        }
    };

    setValidation = async (tableId, csvId, doNotUpdateAfter) => {
        try {
            const json = {tableId, csvId}
            const res = await ky.post("/setValidation", {json}).json();
            console.log(res)

            if (!doNotUpdateAfter) {
                this.softLoadData()
            }
        } catch (error) {
            console.log(error)
            alert(error)
        }
    };

    setRelevancy = async (tableId, relevancy) => {
        try {
            const promise1 = ky.post("/setRelevancy", {json: {tableId, relevancy}}).json();
            const promise2 = this.setValidation(tableId, null, true);

            const [res,] = await Promise.all([promise1, promise2])
            console.log(res)
            this.softLoadData()
        } catch (error) {
            console.log(error)
            alert(error)
        }
    }

    tagUntagTable = async (tableId, tagId, set, isHeadTable) => {
        try {
            const json = {tableId, tagId, set, isHeadTable}
            const res = await ky.post("/tagUntagTable", {json}).json();

            console.log(res)
            this.softLoadData()
        } catch (error) {
            console.log(error);
            alert(error);
        }
    }

    render() {
        const {pdfName, csvs, tables, loading, tableId, imageLoaded, tags, softUpdating} = this.state;

        if (loading) {
            return <Spinner animation="border"/>;
        }

        if (!tableId) {
            return <Alert variant="danger">Not tables captured/extracted for this PDF</Alert>;
        }

        const currentIndex = tables.findIndex((t) => t.tableId === tableId);
        const {continuationOf, correct_csv, tableTitle, page, relevancy} = tables[currentIndex];

        const isHeadTable = continuationOf == null
            ? tables.find(t => t.continuationOf === tableId) != null
            : false;

        const conTable = continuationOf ? tables.find((t) => t.tableId === continuationOf) : null;
        const conTableBlock = continuationOf ? (
            <p>
                Continuation Table Name: <strong>{conTable.tableTitle}</strong>, Continuation Table
                ID: <strong>{conTable.tableId}</strong>
            </p>
        ) : <p>(this table is not a continuation)</p>;

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

        const csvsBlock = csvs.map(({csvId, method, csvText}) => (
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
                    onClick={() => this.setValidation(tableId, csvId)}
                >
                    Select
                </Button>
                <div
                    className={
                        csvId === correct_csv ? "ml-2 mr-2 correct" : correct_csv ? "ml-2 mr-2 incorrect" : "ml-2 mr-2 bg-light"
                    }
                >
                    {constructTable(csvText)}
                </div>
            </div>
        ));

        const webPageTitle = (
            <Helmet>
                <title>{pdfName}</title>
            </Helmet>
        );

        const tagsBlock =
            <div className="mb-5">
                {tags.map(t =>
                    (<Button key={t.tagId} size="sm" variant={t.count === 0 ? "outline-dark" : "success"}
                             onClick={() => this.tagUntagTable(tableId, t.tagId, t.count === 0, isHeadTable)}>
                        {t.tagName}
                    </Button>)
                )
                }
                {isHeadTable
                    ? <p className="ml-2">
                        <strong>(this is a head table and the tags will be applied to the whole chain)</strong>
                    </p>
                    : null}
            </div>


        const csvsArea = relevancy === 0
            ? <div className="border border-dark">
                <Alert className="m-2" variant="warning">The table is marked as irrelevant</Alert>
                <Button className="m-2" size="sm" variant="warning" onClick={() => this.setRelevancy(tableId, 1)}>
                    MARK TABLE AS RELEVANT
                </Button>
            </div>
            : <div className="border border-dark">
                <Button className="m-2 mb-5" size="sm" variant="danger" onClick={() => this.setRelevancy(tableId, 0)}>
                    MARK TABLE AS IRRELEVANT
                </Button>
                {tagsBlock}
                {csvsBlock}
                <Button
                    disabled={!correct_csv}
                    variant="warning"
                    size="sm"
                    className="ml-2 mb-3"
                    onClick={() => this.setValidation(tableId, null)}
                >
                    Unset Validation
                </Button>
            </div>

        const tableSelect = (
            <Form.Control
                as="select"
                value={currentIndex + 1}
                size="sm"
                onChange={(e) => this.goToTable(e)}
                className="dropdown"
            >
                {tables.map((t, index) => (
                    <option value={index + 1} key={index + 1}>
                        {index + 1} (p.{t.page})
                    </option>
                ))}
            </Form.Control>
        );

        const mainBlock = (
            <Container fluid>
                <Row>
                    <Col>
                        <Link to="/tables_index">
                            <Button className="ml-0" size="sm" variant="info">
                                Back to Index
                            </Button>
                        </Link>
                        {softUpdating
                            ? <Spinner animation="border"/>
                            : <Button size="sm" variant="primary" onClick={this.softLoadData}> Refresh Data </Button>}
                        <Button size="sm" variant="dark" href={`/extraction/${pdfName}/${page}`} target="blank_">
                            Open PDF
                        </Button>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <p>
                            PDF Name: <strong>{pdfName}</strong>, Page: <strong>{page}</strong>
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
                            Prev Table (A)
                        </Button>
                        <strong>Table: </strong> {tableSelect} of {tables.length}
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={this.nextTable}
                            disabled={currentIndex + 1 === tables.length}
                        >
                            Next Table (D)
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
