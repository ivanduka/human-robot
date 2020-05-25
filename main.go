package main

import (
	"encoding/json"
	"fmt"
	"github.com/dukaivan/human-robot/models"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

type Env struct {
	models.Datastore
}

type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// prepend the path with the path to the static directory
	path := filepath.Join(h.staticPath, r.URL.Path)

	// check whether a file exists at the given path
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		// file does not exist, serve index.html
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		// if we got an error (that wasn't that the file doesn't exist) stating the
		// file, return a 500 internal server error and stop
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// otherwise, use http.FileServer to serve the static dir
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASS")
	host := os.Getenv("DB_HOST")
	database := os.Getenv("DB_DATABASE")
	port := os.Getenv("PORT")
	connString := fmt.Sprintf("%s:%s@tcp(%s)/%s?parseTime=true", user, password, host, database)
	db, err := models.NewDB(connString)
	if err != nil {
		log.Fatal("error connecting to DB: ", err)
	}
	env := &Env{db}

	r := mux.NewRouter()
	r.HandleFunc("/tableIndex", env.PostPdfsIndex)
	pdfs := http.FileServer(http.Dir(os.Getenv("PDFS_PATH")))
	r.PathPrefix("/pdf/").Handler(http.StripPrefix("/pdf/", pdfs))
	jpgs := http.FileServer(http.Dir(os.Getenv("JPGS_PATH")))
	r.PathPrefix("/jpg/").Handler(http.StripPrefix("/jpg/", jpgs))
	r.PathPrefix("/").Handler(spaHandler{staticPath: "./client/build", indexPath: "index.html"})

	fmt.Printf("Listening on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func (env *Env) PostPdfsIndex(w http.ResponseWriter, _ *http.Request) {
	pdfs, err := env.PdfsIndex()
	if err != nil {
		fmt.Println(err)
		http.Error(w, err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	err = json.NewEncoder(w).Encode(pdfs)
	if err != nil {
		fmt.Println(err)
		http.Error(w, err.Error(), 500)
	}
}
