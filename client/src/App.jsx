import React from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation,
  Redirect
} from "react-router-dom";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Helmet } from "react-helmet";

import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap-css-only/css/bootstrap.min.css";
import "mdbreact/dist/css/mdb.css";
import "./App.css";

import Extraction from "./extraction/extraction_app/Extraction";
import ExtractionIndex from "./extraction/ExtractionIndex";

const App = () => (
  <Router>
    <Switch>
      <Route exact path="/extraction" component={ExtractionIndex} />
      <Route path="/extraction/:pdfName/:pageNumber" component={Extraction} />
      <Redirect from="/extraction/:pdfName" to="/extraction/:pdfName/1" />
      <Route exact path="/" component={Home} />
      <Route path="*" component={NoMatch} />
    </Switch>
  </Router>
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
          <Link to="/extraction">
            <Button variant="primary">Extraction App</Button>
          </Link>
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
