import React from "react";
import { BrowserRouter, Switch, Route, Link, useLocation, Redirect } from "react-router-dom";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Helmet } from "react-helmet";

import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap-css-only/css/bootstrap.min.css";
import "mdbreact/dist/css/mdb.css";
import "./App.css";

import Extraction from "./extraction_app/Extraction";
import TablesIndex from "./tables_index/TablesIndex";
import Validation from "./validation_app/Validation";
import ProcessingIndex from "./processing_index/ProcessingIndex";
import Processing from "./processing_app/Processing";
import ProcessingHelper from "./processing_helper/ProcessingHelper";
import ManualHelper from "./manual_helper/ManualHelper";
import Concat from "./concat_app/Concat"
import ContentIndex from "./content_index/ContentIndex";

const App = () => (
  <BrowserRouter>
    <Switch>
      <Route exact path="/processing_helper" component={ProcessingHelper} />
      <Route exact path="/manual_helper" component={ManualHelper} />
      <Route exact path="/tables_index" component={TablesIndex} />
      <Route exact path="/processing_index" component={ProcessingIndex} />
      <Route path="/processing/:headTable" component={Processing} />
      <Route path="/extraction/:pdfName/:pageNumber" component={Extraction} />
      <Redirect from="/extraction/:pdfName" to="/extraction/:pdfName/1" />
      <Route path="/validation/:pdfName/:tableId?" component={Validation} />
      <Route path="/concatenation/:headTable" component={Concat} />
      <Route exact path="/content_index" component={ContentIndex} />
      <Route exact path="/" component={Home} />
      <Route path="*" component={NoMatch} />
    </Switch>
  </BrowserRouter>
);

const Home = () => {
  return (
    <Container>
      <Helmet>
        <title>Application Index</title>
      </Helmet>
      <Row>
        <Col>
          <h3>Available Options:</h3>
          <div>
            <Link to="/tables_index">
              <Button variant="primary">PDFs Index</Button>
            </Link>
          </div>
          <div>
            <Link to="/processing_index">
              <Button variant="primary">Processing Index</Button>
            </Link>
          </div>
          <div>
            <Link to="/processing_helper">
              <Button variant="primary">Processing Helper</Button>
            </Link>
          </div>
          <div>
            <Link to="/manual_helper">
              <Button variant="primary">Manual Processing Helper</Button>
            </Link>
          </div>
          <div>
            <Link to="/content_index">
              <Button variant="primary">Content Index</Button>
            </Link>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

function NoMatch() {
  let location = useLocation();
  return (
    <h3>
      No match for <code>{location.pathname}</code>
    </h3>
  );
}

export default App;
