require("dotenv").config();
const mysql = require("mysql2/promise");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const log4js = require("log4js");
const fg = require("fast-glob");

const jpgPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\jpg_tables";
const pdfPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\pdf_files";
const manualCsvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\manual_csv";
const csvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\csv_tables";
[jpgPath, pdfPath, manualCsvPath, csvPath].forEach((p) =>
  fs.access(p, (err) => {
    if (err) throw new Error(`Path ${p} is not accessible`);
  }),
);

const app = express();
app.options("*", cors());
app.use(cors());
app.use("/pdf", express.static(pdfPath));
app.use("/jpg", express.static(jpgPath));
app.use("/csv", express.static(csvPath));

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

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 12,
  queueLimit: 0,
});

app.use((req, res, next) => {
  res.locals.pool = pool;
  next();
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
               COUNT(IF(t.relevancy = 0, 1, NULL))                           AS tablesIrrelevant,
               COUNT(IF(t.correct_csv IS NULL AND t.relevancy = 1, 1, NULL)) AS tablesNotValidated,
               COUNT(t.tableId)                                              AS tableCount
        FROM pdfs p
                 LEFT JOIN
             tables t ON p.pdfName = t.pdfName
        GROUP BY p.pdfId
        ORDER BY p.pdfId;
    `;
    const [result] = await res.locals.pool.execute(query);
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
        SELECT headTable,
               page,
               pageHeight,
               pageWidth,
               parentTable,
               tableId,
               tableTitle,
               x1,
               x2,
               y1,
               y2,
               level
        FROM tables
        WHERE pdfName = ?
        ORDER BY page DESC, level DESC;
    `;
    const statusQuery = `
        SELECT status
        FROM pdfs
        WHERE pdfName = ?;
    `;

    const tablesPromise = res.locals.pool.execute(tablesQuery, [pdfName]);
    const pdfStatusPromise = res.locals.pool.execute(statusQuery, [pdfName]);

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
    const [result] = await res.locals.pool.execute(query, [status, pdfName]);
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
      level,
    } = req.body;
    const creatorIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const query = `
        INSERT INTO tables (tableId, pdfName, page, pageWidth, pageHeight, x1, y1, x2, y2, tableTitle,
                            parentTable, creatorIp, headTable, level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
      level,
    ];
    const [result] = await res.locals.pool.execute(query, params);
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
    const [result] = await res.locals.pool.execute(query, [tableId]);
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
        ORDER BY page, level;
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
      const tablesPromise = res.locals.pool.execute(tablesQuery, [pdfName]);
      const tagsPromise = res.locals.pool.execute(tagsQuery, [pdfName]);

      const [[tables], [tags]] = await Promise.all([tablesPromise, tagsPromise]);
      res.json({ tables, tags });
      return;
    }

    const csvsPromise = res.locals.pool.execute(csvsQuery, [pdfName]);
    const tablesPromise = res.locals.pool.execute(tablesQuery, [pdfName]);
    const tagsPromise = res.locals.pool.execute(tagsQuery, [pdfName]);

    const [[csvs], [tables], [tags]] = await Promise.all([csvsPromise, tablesPromise, tagsPromise]);
    res.json({ csvs, tables, tags });
  } catch (error) {
    next(error);
  }
};

// Getting all tables in chain

const getAllTablesInChain = async (headTableId, res) => {
  const query1 = `
      SELECT tableId, parentTable, level
      FROM tables
      WHERE headTable = ?
      ORDER BY level;
  `;
  const [tablesResult] = await res.locals.pool.execute(query1, [headTableId]);
  return tablesResult.map((t) => t.tableId);
};

// Setting validation to tables

const setValidationForOne = async (tableId, csvId, res) => {
  const query = `
      UPDATE tables
      SET correct_csv = ?
      WHERE tableId = ?;
  `;
  return res.locals.pool.execute(query, [csvId, tableId]);
};

const setValidation = async (req, res, next) => {
  try {
    const { tableId, csvId, method, isHeadTable } = req.body;
    let pairsToProcess = [[tableId, csvId]];
    if (isHeadTable && csvId === null) {
      const tableIds = await getAllTablesInChain(tableId, res);
      pairsToProcess = tableIds.map((t) => [t, null]);
    } else if (isHeadTable) {
      const tableIds = await getAllTablesInChain(tableId, res);
      const query = `
                SELECT t.tableId, c.csvId
                FROM csvs c
                         INNER JOIN tables t USING (tableId)
                WHERE c.tableId IN (${Array(tableIds.length).fill("?")})
                  AND method = ?;
            `;
      const [result] = await res.locals.pool.execute(query, [...tableIds, method]);
      pairsToProcess = result.map((r) => [r.tableId, r.csvId]);
    }

    const promises = pairsToProcess.map(([tableId_, csvId_]) => setValidationForOne(tableId_, csvId_, res));
    await Promise.all(promises);
    res.json({ result: "Set Validation OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

// Setting relevancy to tables

const setRelevancyForOne = async (relevancy, tableId, res) => {
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
  const promise1 = res.locals.pool.execute(query1, [relevancy, tableId]);
  const promise2 = res.locals.pool.execute(query2, [tableId]);
  return Promise.all([promise1, promise2]);
};

const setRelevancy = async (req, res, next) => {
  try {
    const { tableId, relevancy, isHeadTable } = req.body;

    let tableIds = [tableId];
    if (isHeadTable) {
      tableIds = await getAllTablesInChain(tableId, res);
    }

    const promises = tableIds.map((id) => setRelevancyForOne(relevancy, id, res));
    await Promise.all(promises);

    res.json({ result: "Set Relevancy and Removed Tags OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

// Tagging of tables

const getTagsForTable = async (tableId, res) => {
  const query2 = `
      SELECT tagId
      FROM tables_tags
      WHERE tableId = ?;
  `;
  const [tagsResult] = await res.locals.pool.execute(query2, [tableId]);
  return tagsResult.map((t) => t.tagId);
};

const deleteAllTags = async (tableIds, res) => {
  const query3 = `
        DELETE
        FROM tables_tags
        WHERE tableId IN (${Array(tableIds.length).fill("?")});
    `;
  return res.locals.pool.execute(query3, [...tableIds]);
};

const assignTagsToTables = async (tableIds, tagIds, res) => {
  const query4 = `
      INSERT INTO tables_tags (tableId, tagId)
      VALUES (?, ?);;
  `;
  const promises = [];

  tableIds.forEach((table) => {
    tagIds.forEach((tag) => {
      promises.push(res.locals.pool.execute(query4, [table, tag]));
    });
  });

  return Promise.all(promises);
};

const insertRemoveTag = async (tableId, tagId, set, res) => {
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
  return res.locals.pool.execute(query, [tableId, tagId]);
};

const tagUntagTable = async (req, res, next) => {
  try {
    const { tableId, tagId, set, isHeadTable } = req.body;
    await insertRemoveTag(tableId, tagId, set, res);

    if (isHeadTable) {
      const [tables, tags] = await Promise.all([getAllTablesInChain(tableId, res), getTagsForTable(tableId, res)]);
      await deleteAllTags(tables, res);
      await assignTagsToTables(tables, tags, res);
    }
    res.json({ result: "Tagged OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

// Postprocessing API

const processingIndex = async (req, res, next) => {
  try {
    const query = `
        WITH manuals AS (SELECT t.headTable
                         FROM tables t
                                  LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
                         WHERE relevancy = 1
                         GROUP BY t.headTable
                         HAVING count(tt.tagId) > 0
                            AND count(t.tableId) = count(tt.tagId))
        SELECT t.pdfName,
               t.headTable,
               MIN(t.page)                 AS page,
               COUNT(c.accepted_text)      AS accepted,
               COUNT(c.processed_text)     AS processed,
               COUNT(c.csvId)              AS totalTables,
               IF(m.headTable, 'true', '') AS allManuals,
               CASE
                   WHEN COUNT(c.accepted_text) = COUNT(c.csvId) THEN '3. DONE'
                   WHEN COUNT(c.accepted_text) > 0 THEN '1. IN PROGRESS'
                   ELSE '2. NOT STARTED'
                   END                     AS status
        FROM tables t
                 INNER JOIN csvs c
                            ON t.correct_csv = c.csvId
                 LEFT JOIN manuals m ON t.headTable = m.headTable
        WHERE relevancy = 1
        GROUP BY t.headTable
        ORDER BY status, accepted DESC, allManuals, processed DESC, totalTables DESC;
    `;
    const [result] = await res.locals.pool.execute(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getSequence = async (req, res, next) => {
  try {
    const { headTable } = req.body;
    const tagsQuery = `
        SELECT tagId, tagName
        FROM tags;
    `;
    const headQuery = `
        SELECT tableTitle, pdfName, page
        FROM tables
        WHERE tableId = ?;
    `;
    const tablesQuery = `
        SELECT t.tableId,
               t.level,
               c.processed_text,
               c.accepted_text,
               c.csvId,
               t.level,
               c.csvText,
               if(
                       (json_arrayagg(tt.tagId) = cast('[
                    null
                  ]' AS json)),
                       CAST('[]' AS json),
                       json_arrayagg(tt.tagId)
                   ) AS tags
        FROM tables t
                 INNER JOIN csvs c ON t.correct_csv = c.csvId
                 LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
        WHERE headTable = ?
        GROUP BY t.tableId, t.level
        ORDER BY t.level;
    `;

    const p = res.locals.pool;
    const tagsPromise = p.execute(tagsQuery);
    const headPromise = p.execute(headQuery, [headTable]);
    const tablesPromise = p.execute(tablesQuery, [headTable]);

    const [[tagsList], [head], [tables]] = await Promise.all([tagsPromise, headPromise, tablesPromise]);
    res.json({ tagsList, head, tables });
  } catch (error) {
    next(error);
  }
};

const setAccepted = async (req, res, next) => {
  try {
    const { csvId, newAccepted } = req.body;
    const newAcceptedJSON = newAccepted === null ? null : JSON.stringify(newAccepted);
    const tagsQuery = `
        UPDATE csvs
        SET accepted_text = ?
        WHERE csvId = ?;
    `;

    const p = res.locals.pool;
    await p.execute(tagsQuery, [newAcceptedJSON, csvId]);

    res.json({ result: "Set accepted_text OK", ...req.body });
  } catch (error) {
    next(error);
  }
};

// Processing helper

const processingHelper = async (req, res, next) => {
  try {
    const query = `
        WITH wanted_tables AS (
            SELECT tableId
            FROM tables_tags
            WHERE tagId = 6
        ),
             heads_tags AS (
                 SELECT t.headTable, tt.tagId
                 FROM tables t
                          LEFT JOIN tables_tags tt
                                    ON t.tableId = tt.tableId
                 WHERE relevancy = 1
                 GROUP BY tt.tagId, t.headTable
             ),
             heads_tags_json AS (
                 SELECT headTable, JSON_ARRAYAGG(tagId) AS all_tags
                 FROM heads_tags
                 GROUP BY headTable
             )
        SELECT t.tableId,
               t.pdfName,
               t.correct_csv,
               c.csvText,
               c.processed_text,
               t.level,
               if((json_arrayagg(tt.tagId) = cast('[
         null
       ]' AS json)), CAST('[]' AS json), json_arrayagg(tt.tagId)
                   ) AS tags,
               htj.all_tags
        FROM wanted_tables wt
                 LEFT JOIN tables t ON t.tableId = wt.tableId
                 LEFT JOIN csvs c ON t.correct_csv = c.csvId
                 LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
                 LEFT JOIN heads_tags_json htj ON htj.headTable = t.headTable
        GROUP BY t.tableId;
    `;

    const p = res.locals.pool;
    const [data] = await p.execute(query);

    res.json({ data, query });
  } catch (error) {
    next(error);
  }
};

// Manual processing helper

const manualHelper = async (req, res, next) => {
  try {
    const query = `
      SELECT t.tableId, correct_csv, pdfName, page
      FROM tables_tags tt
              INNER JOIN tables t ON tt.tableId = t.tableId
      WHERE tagId = 13;
    `;
    const p = res.locals.pool;
    const [dbData] = await p.execute(query);

    const csvs = await fg("**/*.csv", { cwd: manualCsvPath });
    const existing = new Set(csvs.map((c) => c.split("/").slice(-1)[0].split(".")[0]));

    const data = dbData.map((csv) => ({ ...csv, status: existing.has(csv.correct_csv) ? "done" : "" }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

// Server setup

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

app.post("/processingIndex", (req, res, next) => processingIndex(req, res, next));
app.post("/getSequence", (req, res, next) => getSequence(req, res, next));
app.post("/setAccepted", (req, res, next) => setAccepted(req, res, next));

app.post("/processingHelper", (req, res, next) => processingHelper(req, res, next));
app.post("/manualHelper", (req, res, next) => manualHelper(req, res, next));

app.use("/", express.static(path.join(__dirname, "client", "build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

app.use((err, req, res, next) => errorHandler(err, req, res, next));

const port = process.env.PORT;
// eslint-disable-next-line no-console
app.listen(port, () => console.log(`Listening on port ${port}...`));
