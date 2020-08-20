-- #######################
-- Tables to get rid of
-- #######################

-- tables where all marked as requiring manual processing (recommended for deletion) by tableHead
SELECT pr.application_title_short,
       t.pdfName,
       t.page,
       t.headTable,
       count(t.tableId) AS tables,
       count(tt.tagId)  AS manuals
FROM tables t
         INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
         INNER JOIN projects pr ON pd.application_id = pr.application_id
         LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
GROUP BY t.headTable
HAVING manuals > 0
   AND tables = manuals
ORDER BY tables DESC;

-- tables where all marked as requiring manual processing (recommended for deletion) by PDF
WITH t AS (
    SELECT pr.application_title_short,
           t.pdfName,
           t.page,
           t.headTable,
           count(t.tableId) AS tables,
           count(tt.tagId)  AS manuals
    FROM tables t
             INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
             INNER JOIN projects pr ON pd.application_id = pr.application_id
             LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
    GROUP BY t.headTable
    HAVING manuals > 0
       AND tables = manuals
    ORDER BY tables DESC
)
SELECT t.application_title_short, t.pdfName, SUM(tables) AS tables
FROM t
GROUP BY pdfName;

-- tables where all marked as requiring manual processing (recommended for deletion) by Project
WITH deletion AS (
    SELECT pr.application_title_short,
           t.pdfName,
           t.page,
           t.headTable,
           count(t.tableId) AS tables,
           count(tt.tagId)  AS manuals
    FROM tables t
             INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
             INNER JOIN projects pr ON pd.application_id = pr.application_id
             LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
    GROUP BY t.headTable
    HAVING manuals > 0
       AND tables = manuals
    ORDER BY tables DESC
)
SELECT application_title_short, SUM(tables) AS manual_processing
FROM deletion
GROUP BY application_title_short;

-- number of all tables per project
SELECT pr.application_title_short, COUNT(t.tableId) AS tables
FROM tables t
         INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
         INNER JOIN projects pr ON pd.application_id = pr.application_id
GROUP BY pr.application_title_short
ORDER BY tables DESC;


-- comparison: total number of tables vs manual:
WITH del_tables AS (
    SELECT pr.application_title_short,
           t.pdfName,
           t.page,
           t.headTable,
           count(t.tableId) AS tables,
           count(tt.tagId)  AS manuals
    FROM tables t
             INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
             INNER JOIN projects pr ON pd.application_id = pr.application_id
             LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
    WHERE t.relevancy = 1
    GROUP BY t.headTable
    HAVING manuals > 0
       AND tables = manuals
),
     del_by_proj AS (SELECT application_title_short, SUM(tables) AS manual_processing
                     FROM del_tables
                     GROUP BY application_title_short),
     totals AS (
         SELECT pr.application_title_short, COUNT(t.tableId) AS total_tables
         FROM tables t
                  INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
                  INNER JOIN projects pr ON pd.application_id = pr.application_id
         WHERE t.relevancy = 1
         GROUP BY pr.application_title_short
     )
SELECT t.application_title_short,
       COALESCE(d.manual_processing, 0)                                AS manual_tables,
       t.total_tables,
       round((COALESCE(manual_processing, 0) / total_tables * 100), 0) AS percentage_of_manual
FROM totals t
         LEFT JOIN del_by_proj d USING (application_title_short)
ORDER BY manual_tables DESC;


-- #######################
-- DO MANUAL PROCESSING:
-- #######################

-- List of tables for manual processing where not all tables require manual processing
SELECT t.pdfName, t.page, t.headTable, count(t.tableId) AS tables, count(tt.tagId) AS manuals
FROM tables t
         LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
GROUP BY t.headTable
HAVING manuals > 0
   AND tables != manuals
ORDER BY manuals DESC;

-- Number of tables for manual processing where not all tables require manual processing
WITH manuals AS (SELECT count(tt.tagId) AS manuals
                 FROM tables t
                          LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
                 GROUP BY t.headTable
                 HAVING manuals > 0
                    AND count(t.tableId) != manuals)
SELECT SUM(manuals) AS do_manuals
FROM manuals;

-- CSVs to be processed manually
SELECT t.pdfName, t.page, t.tableId, c.csvId
FROM tables t
         INNER JOIN csvs c ON t.correct_csv = c.csvId
         INNER JOIN tables_tags tt ON (t.tableId = tt.tableId AND tt.tagId = 13)
WHERE t.headTable IN (SELECT t.headTable
                      FROM tables t
                               LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
                      GROUP BY t.headTable
                      HAVING count(tt.tagId) > 0
                         AND count(t.tableId) != count(tt.tagId));

-- #######################
-- Tables with Stream but not manual
SELECT t.tableId,
       t.pdfName,
       t.page,
       t.correct_csv,
       c.method,
       tt.tagId
FROM tables t
         INNER JOIN csvs c ON t.correct_csv = csvId
         LEFT JOIN tables_tags tt ON (t.tableId = tt.tableId AND tt.tagId = 13)
WHERE c.method = 'stream'
  AND tt.tagId IS NULL;


-- tags for sequence
SELECT t.tableId, t.headTable, t.correct_csv, c.csvText
FROM tables t
         INNER JOIN csvs c ON t.correct_csv = c.csvId
WHERE relevancy = 1;

SELECT *
FROM tables_tags
WHERE tagId IS NULL;

SELECT DISTINCT headTable
FROM tables
WHERE relevancy = 1;

WITH heads_tags AS (
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
SELECT t.tableId, t.headTable, t.correct_csv, c.csvText, htj.all_tags, JSON_ARRAYAGG(tt.tagId) AS tags
FROM tables t
         LEFT JOIN heads_tags_json htj ON htj.headTable = t.headTable
         LEFT JOIN csvs c ON t.correct_csv = c.csvId
         LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
WHERE t.relevancy = 1
  AND c.accepted_text IS NULL
GROUP BY t.tableId;

SELECT *
FROM tables_tags
ORDER BY tagId;



WITH heads_tags AS (
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
     ),
     all_manuals AS (
         SELECT t.headTable
         FROM tables t
                  LEFT JOIN tables_tags tt ON t.tableId = tt.tableId AND tt.tagId = 13
         WHERE relevancy = 1
         GROUP BY t.headTable
         HAVING count(tt.tagId) > 0
            AND count(t.tableId) = count(tt.tagId)
     )
SELECT t.tableId,
       t.headTable,
       t.correct_csv,
       c.csvText,
       htj.all_tags,
       JSON_ARRAYAGG(tt.tagId)                   AS tags,
       IF(am.headTable IS NULL, 'false', 'true') AS all_manual
FROM tables t
         LEFT JOIN heads_tags_json htj ON htj.headTable = t.headTable
         LEFT JOIN csvs c ON t.correct_csv = c.csvId
         LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
         LEFT JOIN all_manuals am ON t.headTable = am.headTable
WHERE t.relevancy = 1
  AND c.accepted_text IS NULL
GROUP BY t.tableId;

SELECT count(*)
FROM csvs
WHERE processed_text IS NOT NULL;

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

-- Flat file with all heads + concatenated & combined content + tags
SELECT pr.application_title_short        AS application_title_short,
       pr.application_title              AS application_title,
       pd.pdfId                          AS pdfId,
       pd.filingId                       AS filingId,
       pd.date                           AS date,
       pd.application_id                 AS application_id,
       pd.submitter                      AS submitter,
       pd.company                        AS company,
       t.tableId                         AS tableId,
       t.pdfName                         AS pdfName,
       t.page                            AS page,
       t.tableTitle                      AS tableTitle,
       t.combinedConText                 AS table_content,
       if(tt1.tagId IS NULL, '', 'true') AS eil_one,
       if(tt2.tagId IS NULL, '', 'true') AS eil_several,
       if(tt3.tagId IS NULL, '', 'true') AS rating_coding
FROM tables t
         JOIN csvs c ON t.correct_csv = c.csvId
         JOIN pdfs pd ON t.pdfName = pd.pdfName
         JOIN projects pr ON pd.application_id = pr.application_id
         LEFT JOIN tables_tags tt1 ON t.tableId = tt1.tableId AND tt1.tagId = 2
         LEFT JOIN tables_tags tt2 ON t.tableId = tt2.tableId AND tt2.tagId = 3
         LEFT JOIN tables_tags tt3 ON t.tableId = tt3.tableId AND tt3.tagId = 4
WHERE combinedConText IS NOT NULL;

# Calculate issues stats
WITH counts AS (
    SELECT tableId, count(1) AS issues
    FROM issues
    GROUP BY tableId
    ORDER BY count(1)
)
SELECT round(avg(issues))        AS avg,
       sum(issues)               AS sum,
       min(issues)               AS min,
       max(issues)               AS max,
       count(1)                  AS count,
       (SELECT max(issues)
        FROM (SELECT issues
              FROM counts
              LIMIT 53) AS med) AS median # change LIMIT to half of count
FROM counts;

