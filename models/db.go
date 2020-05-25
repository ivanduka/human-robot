package models

import (
	"database/sql"
	_ "github.com/go-sql-driver/mysql"
)

func NewDB(dataSourceName string) (*DB, error) {
	db, err := sql.Open("mysql", dataSourceName)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}
	return &DB{db: db}, nil
}

type Datastore interface {
	PdfsIndex() ([]*PdfIndexRow, error)
}

type DB struct {
	db *sql.DB
}
