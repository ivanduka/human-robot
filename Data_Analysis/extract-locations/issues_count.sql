SELECT distinct i.tableId, i.rowIndex, i.vec_pri, i.status_bin, i.status_txt, i.issue_pri, i.issue_sec FROM issues i
LEFT JOIN tables t ON i.tableId = t.headTable
LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
WHERE tt.tagId = 5;

SELECT distinct tableId, rowIndex, vec_pri, vec_sec, status_bin, status, status_txt, issue_pri, issue_sec, landUse_nrcan_description FROM
(
SELECT i.tableId, i.rowIndex, i.vec_pri, i.vec_sec, i.status_bin, i.status, i.status_txt, i.issue_pri, i.issue_sec, lm.landUse_nrcan_description FROM issues i
LEFT JOIN locations l ON i.tableId = l.tableId and i.rowIndex = l.rowIndex
LEFT JOIN landuse lu ON l.tableId = lu.tableId and l.rowIndex = lu.rowIndex and l.locNo = lu.locNo
LEFT JOIN landuse_mapping lm ON lu.landuseId = lm.landuseId
LEFT JOIN tables t ON i.tableId = t.headTable
LEFT JOIN tables_tags tt ON t.tableId = tt.tableId
WHERE tt.tagId = 5 AND l.locFormat = 'DLS' AND i.issue_pri NOT IN ('-', '?', 'ESC') AND CONCAT(i.issue_pri,i.issue_sec) <> '----' AND CONCAT(i.issue_pri,i.issue_sec) <> '' AND status_bin NOT IN ('--', '-', '') AND status_bin IS NOT NULL AND landUse_nrcan_description IS NOT NULL AND landuse_sysops_description IS NOT NULL) T;

SELECT distinct i.tableId, i.rowIndex, i.vec_pri, i.vec_sec, i.status_bin, i.status, i.status_txt, i.issue_pri, i.issue_sec FROM issues i
LEFT JOIN locations l ON i.tableId = l.tableId and i.rowIndex = l.rowIndex
LEFT JOIN landuse lu ON l.tableId = lu.tableId and l.rowIndex = lu.rowIndex and l.locNo = lu.locNo
LEFT JOIN landuse_mapping lm ON lu.landuseId = lm.landuseId
LEFT JOIN tables t ON i.tableId = t.headTable
WHERE i.tableId NOT IN ('c046f97b-e73f-48ff-8a9c-d43b761ed7f2', 'ec74ee05-cc24-4424-92ff-d7b4e93ff09c') AND l.locFormat = 'DLS' AND i.issue_pri NOT IN ('-', '?', 'ESC') AND CONCAT(i.issue_pri,i.issue_sec) <> '----' AND CONCAT(i.issue_pri,i.issue_sec) <> '' AND status_bin NOT IN ('--', '-', '') AND status_bin IS NOT NULL;

SELECT distinct i.tableId, i.rowIndex, lm.landUse_nrcan_description FROM issues i
LEFT JOIN locations l ON i.tableId = l.tableId and i.rowIndex = l.rowIndex
LEFT JOIN landuse lu ON l.tableId = lu.tableId and l.rowIndex = lu.rowIndex and l.locNo = lu.locNo
LEFT JOIN landuse_mapping lm ON lu.landuseId = lm.landuseId
WHERE lm.landUse_nrcan_description IS NOT NULL;
