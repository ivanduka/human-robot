require("dotenv").config();
const mysql = require("mysql2/promise");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
// const morgan = require("morgan");
const log4js = require("log4js");

const csvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\csv_tables";
const jpgPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\jpg_tables";
const pdfPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\pdf_files";
[csvPath, jpgPath, pdfPath].forEach((p) =>
  fs.access(p, (err) => {
    if (err) throw new Error(`Path ${p} is not accessible`);
  }),
);

const app = express();
app.options("*", cors());
app.use(cors());
app.use("/pdf", express.static(pdfPath));
app.use("/jpg", express.static(jpgPath));

// LOGGING
log4js.configure({
  appenders: {
    default: { type: "file", filename: "access.log" },
    console: { type: "console" },
  },
  categories: {
    default: { appenders: ["default", "console"], level: "debug" },
  },
});
const logger = log4js.getLogger();

// app.use(morgan("combined", {stream: {write: (str) => logger.debug(str)}}));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 12,
  queueLimit: 0,
});

// Index API

const tableIndex = async (req, res, next) => {
  try {
    const query = `
        SELECT p.pdfId,
               p.pdfName,
               p.pdfSize,
               p.filingId,
               p.date,
               p.totalPages,
               p.status,
               COUNT(t.correct_csv)                                          AS tablesValidated,
               COUNT(IF(t.relevancy = 0, 1, null))                           AS tablesIrrelevant,
               COUNT(IF(t.correct_csv IS NULL AND t.relevancy = 1, 1, NULL)) AS tablesNotValidated,
               COUNT(t.tableId)                                              AS tableCount
        FROM pdfs p
                 LEFT JOIN
             tables t ON p.pdfName = t.pdfName
        GROUP BY p.pdfId
        ORDER BY p.pdfId;
    `;
    const [result] = await pool.execute(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Table Extraction API

const getExtractionData = async (req, res, next) => {
  try {
    const { pdfName } = req.body;
    const tablesQuery = `
        SELECT headTable, page, pageHeight, pageWidth, parentTable, tableId, tableTitle, x1, x2, y1, y2
        FROM tables
        WHERE pdfName = ?
        ORDER BY page DESC, y1;
    `;
    const statusQuery = `
        SELECT status
        FROM pdfs
        WHERE pdfName = ?;
    `;

    const tablesPromise = pool.execute(tablesQuery, [pdfName]);
    const pdfStatusPromise = pool.execute(statusQuery, [pdfName]);

    const [[tables], [pdfStatus]] = await Promise.all([tablesPromise, pdfStatusPromise]);
    res.json({ tables, pdfStatus });
  } catch (error) {
    next(error);
  }
};

const setPdfStatus = async (req, res, next) => {
  try {
    const { status, pdfName } = req.body;
    const query = `
        UPDATE pdfs
        SET status = ?
        WHERE pdfName = ?;
    `;
    const [result] = await pool.execute(query, [status, pdfName]);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const insertTable = async (req, res, next) => {
  try {
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
      parentTable,
      headTable,
    } = req.body;
    const creatorIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const query = `
        INSERT INTO tables (tableId, pdfName, page, pageWidth, pageHeight, x1, y1, x2, y2, tableTitle,
                            parentTable, creatorIp, headTable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
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
      parentTable,
      creatorIp,
      headTable,
    ];
    const [result] = await pool.execute(query, params);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteTable = async (req, res, next) => {
  try {
    const { tableId } = req.body;
    const query = `
        DELETE
        FROM tables
        WHERE tableId = ?;
    `;
    const [result] = await pool.execute(query, [tableId]);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Validation API

const getValidationData = async (req, res, next) => {
  try {
    const { pdfName, notFirstLoading } = req.body;
    const csvsQuery = `
        SELECT csvId, tableId, csvText, method
        FROM csvs
        WHERE tableId IN (
            SELECT tableId
            FROM tables
            WHERE pdfName = ?
        );
    `;

    const tablesQuery = `
        SELECT parentTable, page, pdfName, relevancy, tableId, tableTitle, correct_csv
        FROM tables
        WHERE pdfName = ?
        ORDER BY page, y1 DESC;
    `;

    const tagsQuery = `
        SELECT tb.tableId,
               tg.tagId,
               tg.tagName,
               IF(tt.tagId IS NULL, 0, 1) AS count
        FROM tables tb
                 CROSS JOIN
             tags tg
                 LEFT JOIN
             tables_tags tt ON (tb.tableId = tt.tableId
                 AND tg.tagId = tt.tagId)
        WHERE tb.pdfName = ?
        ORDER BY tableId, tagId;
    `;

    if (notFirstLoading) {
      const tablesPromise = pool.execute(tablesQuery, [pdfName]);
      const tagsPromise = pool.execute(tagsQuery, [pdfName]);

      const [[tables], [tags]] = await Promise.all([tablesPromise, tagsPromise]);
      res.json({ tables, tags });
      return;
    }

    const csvsPromise = pool.execute(csvsQuery, [pdfName]);
    const tablesPromise = pool.execute(tablesQuery, [pdfName]);
    const tagsPromise = pool.execute(tagsQuery, [pdfName]);

    const [[csvs], [tables], [tags]] = await Promise.all([csvsPromise, tablesPromise, tagsPromise]);
    res.json({ csvs, tables, tags });
  } catch (error) {
    next(error);
  }
};

const getAllTablesInChain = async (headTableId) => {
  const query1 = `
      WITH RECURSIVE cte (tableId, parentTable) AS (
          SELECT tableId, parentTable
          FROM tables
          WHERE tableId = ?
          UNION ALL
          SELECT t.tableId, t.parentTable
          FROM tables t
                   INNER JOIN cte on t.parentTable = cte.tableId)
      SELECT *
      FROM cte;
  `;
  const [tablesResult] = await pool.execute(query1, [headTableId]);
  return tablesResult.map((t) => t.tableId);
};

const setValidationForOne = async (tableId, csvId) => {
  const query = `
      UPDATE tables
      SET correct_csv = ?
      WHERE tableId = ?;
  `;
  return pool.execute(query, [csvId, tableId]);
};

const setValidation = async (req, res, next) => {
  try {
    const { tableId, csvId, method, isHeadTable } = req.body;
    let pairsToProcess = [[tableId, csvId]];
    if (isHeadTable && csvId === null) {
      const tableIds = await getAllTablesInChain(tableId);
      pairsToProcess = tableIds.map((t) => [t, null]);
    } else if (isHeadTable) {
      const tableIds = await getAllTablesInChain(tableId);
      const query = `
                SELECT t.tableId, c.csvId
                FROM csvs c
                         INNER JOIN tables t USING (tableId)
                WHERE c.tableId IN (${Array(tableIds.length).fill("?")})
                  AND method = ?;
            `;
      const [result] = await pool.execute(query, [...tableIds, method]);
      pairsToProcess = result.map((r) => [r.tableId, r.csvId]);
    }

    const promises = pairsToProcess.map(([tableId_, csvId_]) => setValidationForOne(tableId_, csvId_));
    await Promise.all(promises);
    res.json({ result: "Set Validation OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

const setRelevancyForOne = async (relevancy, tableId) => {
  const query1 = `
      UPDATE tables
      SET relevancy = ?
      WHERE tableId = ?;
  `;
  const query2 = `
      DELETE
      FROM tables_tags
      WHERE tableId = ?;
  `;
  const promise1 = pool.execute(query1, [relevancy, tableId]);
  const promise2 = pool.execute(query2, [tableId]);
  return Promise.all([promise1, promise2]);
};

const setRelevancy = async (req, res, next) => {
  try {
    const { tableId, relevancy, isHeadTable } = req.body;

    let tableIds = [tableId];
    if (isHeadTable) {
      tableIds = await getAllTablesInChain(tableId);
    }

    const promises = tableIds.map((id) => setRelevancyForOne(relevancy, id));
    await Promise.all(promises);

    res.json({ result: "Set Relevancy and Removed Tags OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

const getTagsForTable = async (tableId) => {
  const query2 = `
      SELECT tagId
      FROM tables_tags
      WHERE tableId = ?;
  `;
  const [tagsResult] = await pool.execute(query2, [tableId]);
  return tagsResult.map((t) => t.tagId);
};

const deleteAllTags = async (tableIds) => {
  const query3 = `
        DELETE
        FROM tables_tags
        WHERE tableId IN (${Array(tableIds.length).fill("?")});
    `;
  return pool.execute(query3, [...tableIds]);
};

const assignTagsToTables = async (tableIds, tagIds) => {
  const query4 = `
      INSERT INTO tables_tags (tableId, tagId)
      VALUES (?, ?);;
  `;
  const promises = [];

  tableIds.forEach((table) => {
    tagIds.forEach((tag) => {
      promises.push(pool.execute(query4, [table, tag]));
    });
  });

  return Promise.all(promises);
};

const insertRemoveTag = async (tableId, tagId, set) => {
  let query = `
      INSERT INTO tables_tags (tableId, tagId)
      VALUES (?, ?);
  `;
  if (!set) {
    query = `
        DELETE
        FROM tables_tags
        WHERE tableId = ?
          AND tagId = ?;
    `;
  }
  return pool.execute(query, [tableId, tagId]);
};

const tagUntagTable = async (req, res, next) => {
  try {
    const { tableId, tagId, set, isHeadTable } = req.body;
    await insertRemoveTag(tableId, tagId, set);

    if (isHeadTable) {
      const [tables, tags] = await Promise.all([getAllTablesInChain(tableId), getTagsForTable(tableId)]);
      await deleteAllTags(tables);
      await assignTagsToTables(tables, tags);
    }
    res.json({ result: "Tagged OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

// Postprocessing API

// const getHeadTables = async () => {};
// const getProcTables = async () => {};
// const setTDDStatus = async () => {};

// Server setup

// noinspection JSUnusedLocalSymbols
function errorHandler(err, req, res, next) {
  logger.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.statusMessage = err.message.replace(/[^\t\x20-\x7e\x80-\xff]/, "_");
  res.status(500).send();
}

app.use(bodyParser.json());

app.post("/tableIndex", (req, res, next) => tableIndex(req, res, next));

app.post("/getExtractionData", (req, res, next) => getExtractionData(req, res, next));
app.post("/insertTable", (req, res, next) => insertTable(req, res, next));
app.post("/deleteTable", (req, res, next) => deleteTable(req, res, next));
app.post("/setPdfStatus", (req, res, next) => setPdfStatus(req, res, next));

app.post("/getValidationData", (req, res, next) => getValidationData(req, res, next));
app.post("/setValidation", (req, res, next) => setValidation(req, res, next));
app.post("/setRelevancy", (req, res, next) => setRelevancy(req, res, next));
app.post("/tagUntagTable", (req, res, next) => tagUntagTable(req, res, next));

app.use("/", express.static(path.join(__dirname, "client", "build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

app.use((err, req, res, next) => errorHandler(err, req, res, next));

const port = process.env.PORT;
// eslint-disable-next-line no-console
app.listen(port, () => console.log(`Listening on port ${port}...`));
