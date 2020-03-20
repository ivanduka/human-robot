import React, { Component } from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation,
  Redirect
} from "react-router-dom";
import "./App.css";
import Extraction from "./extraction/extraction_app/Extraction";
import ExtractionIndex from "./extraction/ExtractionIndex";

const app = () => (
  <Router>
    <Switch>
      <Route exact path="/extraction" component={ExtractionIndex} />
      <Route path="/extraction/:file/:page" component={Extraction} />
      <Redirect from="/extraction/:file" to="/extraction/:file/1" />
      <Route exact path="/" component={Home} />
      <Route path="*" component={NoMatch} />
    </Switch>
  </Router>
);

const Home = () => {
  return <Link to="/extraction">Extraction</Link>;
};

function NoMatch() {
  let location = useLocation();
  return (
    <h3>
      No match for <code>{location.pathname}</code>
    </h3>
  );
}

export default app;
