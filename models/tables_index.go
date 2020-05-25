package models

import (
	"time"
)

type PdfIndexRow struct {
	PdfId              int       `json:"pdfId"`
	PdfName            string    `json:"pdfName"`
	PdfSize            float64   `json:"pdfSize"`
	FilingId           string    `json:"filingId"`
	Date               time.Time `json:"date"`
	TotalPages         int       `json:"totalPages"`
	Status             string    `json:"status"`
	TablesValidated    int       `json:"tablesValidated"`
	TablesIrrelevant   int       `json:"tablesIrrelevant"`
	TablesNotValidated int       `json:"tablesNotValidated"`
	TableCount         int       `json:"tableCount"`
}

func (db *DB) PdfsIndex() ([]*PdfIndexRow, error) {
	query := `
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
        ORDER BY p.pdfId;`
	rows, err := db.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pdfs := make([]*PdfIndexRow, 0)
	for rows.Next() {
		pdf := new(PdfIndexRow)
		err := rows.Scan(&pdf.PdfId, &pdf.PdfName, &pdf.PdfSize, &pdf.FilingId, &pdf.Date, &pdf.TotalPages,
			&pdf.Status, &pdf.TablesValidated, &pdf.TablesIrrelevant, &pdf.TablesNotValidated, &pdf.TableCount)
		if err != nil {
			return nil, err
		}
		pdfs = append(pdfs, pdf)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return pdfs, nil
}
