require("dotenv").config();
const mysql = require("promise-mysql");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");

const csvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\csv_tables";
const jpgPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\jpg_tables";
const pdfPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\pdf_files";
for (let p of [csvPath, jpgPath, pdfPath]) {
  fs.access(p, err => {
    if (err) throw new Error(`Path ${p} is not accessible`);
  });
}

const app = express();

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" }
);
app.use(morgan("combined", { stream: accessLogStream }));
app.use(morgan("dev"));

const db = async q => {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE
  };

  try {
    const connection = await mysql.createConnection(config);
    const results = await connection.query(q.query, q.params);
    await connection.end();
    return { error: null, results };
  } catch (error) {
    return { error, results: null };
  }
};

const table_index = async (req, res) => {
  const result = await db({
    query: `
    SELECT 
    p.*,
    COUNT(t.pdfName) AS tableCount,
    COUNT(t.correct_csv) AS tablesValidated
FROM
    pdfs p
        LEFT JOIN
    tables t ON p.pdfName = t.pdfName
GROUP BY p.pdfName
ORDER BY p.pdfId; 
    `
  });
  if (result.error) {
    res.status(400);
  }
  res.json(result);
};

const getTables = async (req, res) => {
  const { pdfName } = req.body;
  const query = `SELECT * FROM tables WHERE pdfName = ? ORDER BY page DESC, y1 ASC;`;
  const result = await db({ query, params: [pdfName] });
  if (result.error) {
    res.status(400);
  }
  res.json(result);
};

const getValidationTables = async (req, res) => {
  const { pdfName } = req.body;
  const query = `SELECT * FROM tables WHERE pdfName = ? ORDER BY page ASC, y1 DESC;`;
  const result = await db({ query, params: [pdfName] });
  if (result.error) {
    res.status(400);
  }
  res.json(result);
};

const getValidationCSVs = async (req, res) => {
  const { tableId } = req.body;
  const query = `SELECT * FROM csvs WHERE tableId = ? ORDER BY method;`;
  const result = await db({ query, params: [tableId] });
  if (result.error) {
    res.status(400);
  }
  res.json(result);
};

const setPdfStatus = async (req, res) => {
  const { pdfName, status } = req.body;
  const query = `UPDATE pdfs SET status = ? WHERE pdfName = ?;`;
  const result = await db({ query, params: [status, pdfName] });
  if (result.error || result.results.affectedRows === 0) {
    res.status(400);
  }
  res.json(result);
};

const getPdfStatus = async (req, res) => {
  const { pdfName } = req.body;
  const query = `SELECT * FROM pdfs WHERE pdfName = ?;`;
  const result = await db({ query, params: [pdfName] });
  if (result.error) {
    res.status(400);
  }
  res.json(result);
};

const insertTable = async (req, res) => {
  const {
    tableId,
    pdfName,
    page,
    tableTitle,
    x1,
    x2,
    y1,
    y2,
    pageHeight,
    pageWidth,
    continuationOf
  } = req.body;

  const creatorIp =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  const query = {
    query:
      "INSERT INTO tables (tableId, pdfName, page, pageWidth, pageHeight, x1, y1, x2, " +
      "y2, tableTitle, continuationOf, creatorIp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);",
    params: [
      tableId,
      pdfName,
      page,
      pageWidth,
      pageHeight,
      x1,
      y1,
      x2,
      y2,
      tableTitle,
      continuationOf,
      creatorIp
    ]
  };
  const result = await db(query);
  if (result.error || result.results.affectedRows === 0) {
    res.status(400);
  }
  res.json(result);
};

const deleteTable = async (req, res) => {
  const { tableId } = req.body;
  const query = `DELETE FROM tables WHERE tableId = ?;`;
  const result = await db({ query, params: [tableId] });
  if (result.error || result.results.affectedRows === 0) {
    res.status(400);
  }
  res.json(result);
};

app.use(bodyParser.json());
app.use(cors());

app.use("/extractionIndex", table_index);
app.use("/getTables", getTables);
app.use("/insertTable", insertTable);
app.use("/deleteTable", deleteTable);
app.use("/getPdfStatus", getPdfStatus);
app.use("/setPdfStatus", setPdfStatus);
app.use("/getValidationTables", getValidationTables);
app.use("/getValidationCSVs", getValidationCSVs);

app.use("/pdf", express.static(pdfPath));
app.use("/", express.static(path.join(__dirname, "client", "build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = 8080;
app.listen(port, () => console.log(`Listening on port ${port}...`));
