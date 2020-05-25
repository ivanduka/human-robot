-- tables for main processing window
select t.tableId,
       t.pdfName,
       t.page,
       t.tableTitle,
       t.parentTable,
       t.headTable,
       t.correct_csv,
       c.tdd_status
FROM tables t
         INNER JOIN csvs c ON t.correct_csv = c.csvId
WHERE relevancy = 1;

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
       COALESCE(d.manual_processing, 0)                                             as manual_tables,
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