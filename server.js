require("dotenv").config();
const mysql = require("mysql2/promise");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const log4js = require("log4js");

const csvPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\csv_tables";
const jpgPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\jpg_tables";
const pdfPath = "\\\\luxor\\data\\board\\Dev\\PCMR\\pdf_files";
for (let p of [csvPath, jpgPath, pdfPath]) {
    fs.access(p, (err) => {
        if (err) throw new Error(`Path ${p} is not accessible`);
    });
}

const app = express();
app.options("*", cors());
app.use(cors());
app.use("/pdf", express.static(pdfPath));
app.use("/jpg", express.static(jpgPath));

// LOGGING
log4js.configure({
    appenders: {
        default: {type: "file", filename: "access.log"},
        console: {type: "console"},
    },
    categories: {
        default: {appenders: ["default", "console"], level: "debug"},
    },
});
const logger = log4js.getLogger();

app.use(morgan("combined", {stream: {write: (str) => logger.debug(str)}}));

const db = async (q) => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_DATABASE,
            connectionLimit: 50,
        })
        logger.debug(q);
        const [results] = await conn.execute(q.query, q.params);
        conn.close();
        return {results};
    } catch (error) {
        return {error};
    } finally {
        if (conn) {
            conn.close()
        }
    }
};

const table_index = async (req, res) => {
    const result = await db({
        query: `
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
                   COUNT(t.pdfName)                                              AS tableCount
            FROM pdfs p
                     LEFT JOIN
                 tables t ON p.pdfName = t.pdfName
            GROUP BY p.pdfId
            ORDER BY p.pdfId;
        `,
    });
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const getTables = async (req, res) => {
    const {pdfName} = req.body;
    const query = `
        SELECT *
        FROM tables
        WHERE pdfName = ?
        ORDER BY page DESC, y1;
    `;
    const result = await db({query, params: [pdfName]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const getValidationTables = async (req, res) => {
    const {pdfName} = req.body;
    const query = `
        SELECT *
        FROM tables
        WHERE pdfName = ?
        ORDER BY page, y1 DESC;
    `;
    const result = await db({query, params: [pdfName]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const getValidationTags = async (req, res) => {
    const {pdfName} = req.body;
    const query = `
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
    const result = await db({query, params: [pdfName]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
}

const tagTable = async (req, res) => {
    const {tableId, tagId} = req.body;
    const query = `
        INSERT INTO tables_tags (tableId, tagId)
        VALUES (?, ?);
    `;
    const result = await db({query, params: [tableId, tagId]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
}

const unTagTable = async (req, res) => {
    const {tableId, tagId} = req.body;
    const query = `
        DELETE
        FROM tables_tags
        WHERE tableId = ?
          AND tagId = ?;
    `;
    const result = await db({query, params: [tableId, tagId]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
}

const removeAllTags = async (req, res) => {
    const {tableId} = req.body;
    const query = `
        DELETE
        FROM tables_tags
        WHERE tableId = ?;
    `;
    const result = await db({query, params: [tableId]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
}

const getValidationCSVs = async (req, res) => {
    const {pdfName} = req.body;
    const query = `
        SELECT *
        FROM csvs
        WHERE tableId IN (
            SELECT tableId
            FROM tables
            WHERE pdfName = ?
        );
    `;
    const result = await db({query, params: [pdfName]});
    if (result.error) {
        logger.error(error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const setValidation = async (req, res) => {
    const {tableId, csvId} = req.body;
    const query = `
        UPDATE tables
        SET correct_csv = ?
        WHERE tableId = ?;
    `;
    const result = await db({query, params: [csvId, tableId]});
    if (result.error || result.results.affectedRows === 0) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const setPdfStatus = async (req, res) => {
    const {pdfName, status} = req.body;
    const query = `
        UPDATE pdfs
        SET status = ?
        WHERE pdfName = ?;
    `;
    const result = await db({query, params: [status, pdfName]});
    if (result.error || result.results.affectedRows === 0) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const getPdfStatus = async (req, res) => {
    const {pdfName} = req.body;
    const query = `
        SELECT *
        FROM pdfs
        WHERE pdfName = ?;
    `;
    const result = await db({query, params: [pdfName]});
    if (result.error) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
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
        continuationOf,
    } = req.body;

    const creatorIp =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    const query = {
        query: `
            INSERT INTO tables (tableId, pdfName, page, pageWidth, pageHeight, x1, y1, x2, y2, tableTitle,
                                continuationOf, creatorIp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
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
            creatorIp,
        ],
    };
    const result = await db(query);
    if (result.error || result.results.affectedRows === 0) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const deleteTable = async (req, res) => {
    const {tableId} = req.body;
    const query = `
        DELETE
        FROM tables
        WHERE tableId = ?;
    `;
    const result = await db({query, params: [tableId]});
    if (result.error || result.results.affectedRows === 0) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
};

const setRelevancy = async (req, res) => {
    const {tableId, relevancy} = req.body;
    const query = `
        UPDATE tables
        SET relevancy = ?
        WHERE tableId = ?;
    `;
    const result = await db({query, params: [relevancy, tableId]});
    if (result.error || result.results.affectedRows === 0) {
        logger.error(result.error);
        return res.status(400).json({error: result.error.toString()});
    }
    res.json(result);
}

// noinspection JSUnusedLocalSymbols
const errorHandler = (err, req, res, next) => {
    res.status(500);
    logger.error(error);
    res.send(JSON.stringify(err));
};

app.use(errorHandler);
app.use(bodyParser.json());

app.use("/table_index", table_index);

app.use("/getTables", getTables);
app.use("/insertTable", insertTable);
app.use("/deleteTable", deleteTable);
app.use("/getPdfStatus", getPdfStatus);
app.use("/setPdfStatus", setPdfStatus);

app.use("/getValidationCSVs", getValidationCSVs);
app.use("/getValidationTables", getValidationTables);
app.use("/setValidation", setValidation);
app.use("/setRelevancy", setRelevancy);
app.use("/getValidationTags", getValidationTags)
app.use("/tagTable", tagTable)
app.use("/untagTable", unTagTable)
app.use("/removeAllTags", removeAllTags)

app.use("/", express.static(path.join(__dirname, "client", "build")));
app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = 8080;
app.listen(port, () => console.log(`Listening on port ${port}...`));
