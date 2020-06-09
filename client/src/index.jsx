import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { pdfjs } from "react-pdf";
// import { unregister } from './serviceWorker';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

ReactDOM.render(<App />, document.getElementById("root"));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// unregister();
