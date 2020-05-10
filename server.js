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

// app.use(morgan("combined", {stream: {write: (str) => logger.debug(str)}}));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

const db = async (q) => {
    try {
        const [results] = await pool.execute(q.query, q.params);
        return {results};
    } catch (error) {
        return {error};
    } finally {
    }
};

// Index API

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
        return res.status(400).json({error: result.error});
    }
    res.json(result);
};

// Table Extraction API

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
        return res.status(400).json({error: result.error});
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
        return res.status(400).json({error: result.error});
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
        return res.status(400).json({error: result.error});
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
        return res.status(400).json({error: result.error});
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
        return res.status(400).json({error: result.error});
    }
    res.json(result);
};

// Validation API

const getValidationCSVs = async (req, res, next) => {
    try {
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
        const [result] = await pool.execute(query, [pdfName]);
        res.json(result);
    } catch (error) {
        next(error)
    }
};

const getValidationTables = async (req, res) => {
    try {
        const {pdfName} = req.body;
        const query = `
            SELECT *
            FROM tables
            WHERE pdfName = ?
            ORDER BY page, y1 DESC;
        `;
        const [result] = await pool.execute(query, [pdfName]);
        res.json(result);
    } catch (error) {
        next(error)
    }
};

const getValidationTags = async (req, res) => {
    try {
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
        const [result] = await pool.execute(query, [pdfName]);
        res.json(result);
    } catch (error) {
        next(error)
    }
}

const setValidation = async (req, res, next) => {
    try {
        const {tableId, csvId} = req.body;
        const query = `
            UPDATE tables
            SET correct_csv = ?
            WHERE tableId = ?;
        `;
        await pool.execute(query, [csvId, tableId]);
        res.json({result: "Set Validation OK", ...req.body});
    } catch (error) {
        next(error)
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
}

const setRelevancy = async (req, res, next) => {
    try {
        const {tableId, relevancy, isHeadTable} = req.body;

        let tableIds = [tableId]
        if (isHeadTable) {
            [tableIds] = await getAllTablesInChain(tableId)
            tableIds = tableIds.map(t => t.tableId);
        }

        const promises = tableIds.map(id => setRelevancyForOne(relevancy, id))
        await Promise.all(promises)

        res.json({result: "Set Relevancy and Removed Tags OK", ...req.body});
    } catch (error) {
        next(error)
    }
}

const getAllTablesInChain = async (headTableId) => {
    const query1 = `
        WITH RECURSIVE cte (tableId, continuationOf) AS (
            SELECT tableId, continuationOf
            FROM tables
            WHERE tableId = ?
            UNION ALL
            SELECT t.tableId, t.continuationOf
            FROM tables t
                     INNER JOIN cte on t.continuationOf = cte.tableId)
        SELECT *
        FROM cte;
    `;
    return pool.execute(query1, [headTableId]);
}

const getTagsForTable = async (tableId) => {
    const query2 = `
        SELECT tagId
        FROM tables_tags
        WHERE tableId = ?;
    `;
    return pool.execute(query2, [tableId]);
}

const deleteAllTags = async (tableIds) => {
    const query3 = `
        DELETE
        FROM tables_tags
        WHERE tableId IN (${Array(tableIds.length).fill("?")});
    `
    return pool.execute(query3, [...tableIds]);
}

const assignTagsToTables = async (tableIds, tagIds) => {
    const query4 = `
        INSERT INTO tables_tags (tableId, tagId)
        VALUES (?, ?);;
    `
    const promises = []
    for (let table of tableIds) {
        for (let tag of tagIds) {
            promises.push(pool.execute(query4, [table, tag]));
        }
    }
    return Promise.all(promises)
}

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
}

const tagUntagTable = async (req, res, next) => {
    try {
        const {tableId, tagId, set, isHeadTable} = req.body;
        await insertRemoveTag(tableId, tagId, set);

        if (isHeadTable) {
            const promises = [getAllTablesInChain(tableId), getTagsForTable(tableId)]
            const [[tablesResult], [tagsResult]] = await Promise.all(promises)
            const tables = tablesResult.map(t => t.tableId)
            const tags = tagsResult.map(t => t.tagId);

            await deleteAllTags(tables);
            await assignTagsToTables(tables, tags);
        }
        res.json({result: "Tagged OK", ...req.body});
    } catch (error) {
        next(error)
    }
}

// noinspection JSUnusedLocalSymbols
function errorHandler(err, req, res, next) {
    logger.error(err);
    if (res.headersSent) {
        return next(err)
    }
    // res.statusMessage = JSON.stringify(err, Object.getOwnPropertyNames(err)).replace(/[^\t\x20-\x7e\x80-\xff]/, "_");
    res.statusMessage = err.message.replace(/[^\t\x20-\x7e\x80-\xff]/, "_");
    res.status(500).send()
}

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
app.use("/tagUntagTable", tagUntagTable)

app.use("/", express.static(path.join(__dirname, "client", "build")));
app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

app.use(errorHandler);

const port = 8080;
app.listen(port, () => console.log(`Listening on port ${port}...`));
