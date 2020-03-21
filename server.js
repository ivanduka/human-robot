require("dotenv").config();
const mysql = require("promise-mysql");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

// G:\Dev\PCMR\csv_tables
// G:\Dev\PCMR\jpg_tables

const csvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\csv_tables";
const jpgPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\jpg_tables";

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
    console.log();
    console.log(q.query);
    console.log(q.params);
    console.log(error);
    console.log();
    return { error, results: null };
  }
};

const test = async () => {
  const data = await db({ query: "SELECT * FROM pdfs" });
  console.log(data);
};
test();
