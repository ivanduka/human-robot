import React, { Component } from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import "./App.css";
import Extraction from "./extraction_app/Extraction";

const app = () => (
  <Router>
    <Switch>
      <Route path="/extraction">
        <Extraction />
      </Route>
      <Route path="/">
        <Home />
      </Route>
    </Switch>
  </Router>
);

const Home = () => {
  return <Link to="/extraction">Extraction</Link>;
};

export default app;
