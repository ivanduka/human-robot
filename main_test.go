package main
//
//import (
//	"github.com/dukaivan/human-robot/models"
//	"net/http"
//	"net/http/httptest"
//	"testing"
//)
//
//type mockDB struct{}
//
//func (mdb *mockDB) AllBooks() ([]*models.PdfIndexRow, error) {
//	bks := make([]*models.PdfIndexRow, 0)
//	bks = append(bks, &models.Book{Isbn: "978-1503261969", Title: "Emma", Author: "Jayne Austen", Price: 9.44})
//	bks = append(bks, &models.Book{Isbn: "978-1505255607", Title: "The Time Machine", Author: "H. G. Wells", Price: 5.99})
//	return bks, nil
//}
//
//func TestBooksIndex(t *testing.T) {
//	rec := httptest.NewRecorder()
//	req, _ := http.NewRequest("GET", "/books", nil)
//
//	env := Env{new(mockDB)}
//	http.HandlerFunc(env.booksIndex).ServeHTTP(rec, req)
//
//	expected := "978-1503261969, Emma, Jayne Austen, £9.44\n978-1505255607, The Time Machine, H. G. Wells, £5.99\n"
//	if expected != rec.Body.String() {
//		t.Errorf("\n...expected = %v\n...obtained = %v", expected, rec.Body.String())
//	}
//}
