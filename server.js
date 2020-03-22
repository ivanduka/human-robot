require("dotenv").config();
const mysql = require("promise-mysql");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const csvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\csv_tables";
const jpgPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\jpg_tables";
const pdfPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\pdf";
for (let p of [csvPath, jpgPath, pdfPath]) {
  fs.access(p, err => {
    if (err) throw new Error(`Path ${p} is not accessible`);
  });
}

const app = express();

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
    console.log(error);
    return { error, results: null };
  }
};

const extraction_index = async (req, res) => {
  const result = await db({ query: "SELECT * FROM pdfs;" });
  res.json(result);
};

app.use(bodyParser.json());
app.use(cors());

app.use("/extraction_index", extraction_index);
app.use("/pdf", express.static(pdfPath));
app.use("/", express.static(path.join(__dirname, "client", "build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = 8080;
app.listen(port, () => console.log(`Listening on port ${port}...`));
