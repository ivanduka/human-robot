import React, { Component } from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation
} from "react-router-dom";

import Spinner from "../spinner/Spinner";

export default class Index extends Component {
  state = {};

  componentDidMount() {}

  componentWillUnmount() {}

  render() {
    return (
      <div>
        <div>Index of Files:</div>
        <Link to="/extraction/2445104/33">2445104</Link>
      </div>
    );
  }
}
