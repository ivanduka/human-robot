-- tables for main processing window
select t.pdfName,
       t.tableTitle,
       t.headTable,
       COUNT(IF(c.tdd_status = 0, 1, NULL)) as noResults,
       COUNT(IF(c.tdd_status = 1, 1, NULL)) as oks,
       COUNT(IF(c.tdd_status = 2, 1, NULL)) as errors,
       COUNT(*)                             as totalTables,
       MIN(t.page)                          as page,
       CASE
           WHEN COUNT(IF(c.tdd_status = 2, 1, NULL)) > 0 THEN 'errors'
           WHEN COUNT(IF(c.tdd_status = 0, 1, NULL)) = COUNT(*) THEN 'not_started'
           WHEN COUNT(IF(c.tdd_status = 1, 1, NULL)) = COUNT(*) THEN 'OK'
           ELSE 'in_progress'
           END                              as status
FROM tables t
         INNER JOIN csvs c
                    ON t.correct_csv = c.csvId
WHERE relevancy = 1
GROUP BY t.headTable
ORDER BY errors DESC, noResults DESC, oks DESC;

select t.headTable, COUNT(*) as tables
FROM tables t
         INNER JOIN csvs c ON t.correct_csv = c.csvId
WHERE relevancy = 1
GROUP BY t.headTable;

select *
from tables
where tableId = '03bc1560-7126-4e6c-b918-543b83819760';

select t.tableId, t.headTable
from tables t;

-- #######################
-- Tables to get rid of
-- #######################

-- tables where all marked as requiring manual processing (recommended for deletion) by tableHead
SELECT pr.application_title_short,
       t.pdfName,
       t.page,
       t.headTable,
       count(t.tableId) as tables,
       count(tt.tagId)  as manuals
FROM tables t
         INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
         INNER JOIN projects pr ON pd.application_id = pr.application_id
         LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
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
           count(t.tableId) as tables,
           count(tt.tagId)  as manuals
    FROM tables t
             INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
             INNER JOIN projects pr ON pd.application_id = pr.application_id
             LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
    GROUP BY t.headTable
    HAVING manuals > 0
       AND tables = manuals
    ORDER BY tables DESC
)
SELECT t.application_title_short, t.pdfName, SUM(tables) as tables
FROM t
GROUP BY pdfName;

-- tables where all marked as requiring manual processing (recommended for deletion) by Project
WITH deletion AS (
    SELECT pr.application_title_short,
           t.pdfName,
           t.page,
           t.headTable,
           count(t.tableId) as tables,
           count(tt.tagId)  as manuals
    FROM tables t
             INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
             INNER JOIN projects pr ON pd.application_id = pr.application_id
             LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
    GROUP BY t.headTable
    HAVING manuals > 0
       AND tables = manuals
    ORDER BY tables DESC
)
SELECT application_title_short, SUM(tables) as manual_processing
FROM deletion
GROUP BY application_title_short;

-- number of all tables per project
SELECT pr.application_title_short, COUNT(t.tableId) as tables
FROM tables t
         INNER JOIN pdfs pd on t.pdfName = pd.pdfName
         INNER JOIN projects pr on pd.application_id = pr.application_id
GROUP BY pr.application_title_short
ORDER BY tables DESC;


-- comparison: total number of tables vs manual:
WITH del_tables AS (
    SELECT pr.application_title_short,
           t.pdfName,
           t.page,
           t.headTable,
           count(t.tableId) as tables,
           count(tt.tagId)  as manuals
    FROM tables t
             INNER JOIN pdfs pd ON t.pdfName = pd.pdfName
             INNER JOIN projects pr ON pd.application_id = pr.application_id
             LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
    WHERE t.relevancy = 1
    GROUP BY t.headTable
    HAVING manuals > 0
       AND tables = manuals
),
     del_by_proj AS (SELECT application_title_short, SUM(tables) as manual_processing
                     FROM del_tables
                     GROUP BY application_title_short),
     totals as (
         SELECT pr.application_title_short, COUNT(t.tableId) as total_tables
         FROM tables t
                  INNER JOIN pdfs pd on t.pdfName = pd.pdfName
                  INNER JOIN projects pr on pd.application_id = pr.application_id
         WHERE t.relevancy = 1
         GROUP BY pr.application_title_short
     )
SELECT t.application_title_short,
       COALESCE(d.manual_processing, 0) as                                manual_tables,
       t.total_tables,
       round((COALESCE(manual_processing, 0) / total_tables * 100), 0) AS percentage_of_manual
FROM totals t
         LEFT JOIN del_by_proj d USING (application_title_short)
ORDER BY manual_tables DESC;


-- #######################
-- DO MANUAL PROCESSING:
-- #######################

-- List of tables for manual processing where not all tables require manual processing
select t.pdfName, t.page, t.headTable, count(t.tableId) as tables, count(tt.tagId) as manuals
from tables t
         LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
group BY t.headTable
HAVING manuals > 0
   AND tables != manuals
ORDER BY manuals DESC;

-- Number of tables for manual processing where not all tables require manual processing
with manuals AS (select count(tt.tagId) as manuals
                 from tables t
                          LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
                 GROUP BY t.headTable
                 HAVING manuals > 0
                    AND count(t.tableId) != manuals)
SELECT SUM(manuals) as do_manuals
FROM manuals;

-- CSVs to be processed manually
SELECT t.pdfName, t.page, t.tableId, c.csvId
FROM tables t
         INNER JOIN csvs c on t.correct_csv = c.csvId
         INNER JOIN tables_tags tt on (t.tableId = tt.tableId AND tt.tagId = 13)
WHERE t.headTable IN (SELECT t.headTable
                      FROM tables t
                               LEFT JOIN tables_tags tt on t.tableId = tt.tableId AND tt.tagId = 13
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
SELECT t.tableId, t.parentTable, tj.tags
FROM tables t
         LEFT JOIN tags_json tj on t.tableId = tj.tableId
WHERE headTable = '57fffa5e-ad29-4140-ba73-58290505443d'
ORDER BY tags, t.parentTable;

UPDATE csvs c INNER JOIN tables t on c.csvId = t.correct_csv
SET processed_text = CAST('[
  [
    1,
    2,
    3
  ],
  [
    4,
    5,
    6
  ],
  [
    7,
    8,
    1111
  ]
]' as json)
WHERE headTable = '768b2aaf-8d86-4a30-bec5-7f4a4e646311'

UPDATE csvs SET accepted_text = NULL, processed_text = NULL;