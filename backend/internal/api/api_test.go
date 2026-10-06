package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shn-amn/watchlistr/backend/internal/api"
	"github.com/shn-amn/watchlistr/backend/internal/tvdb"
)

// fakeTVDB emulates the subset of the TVDB v4 API the backend consumes.
func fakeTVDB(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("POST /login", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"data": map[string]string{"token": "test-token"}})
	})
	mux.HandleFunc("GET /search", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"data": []map[string]any{{
			"tvdb_id":   "1",
			"type":      "series",
			"name":      "Test Show",
			"year":      "2020",
			"image_url": "https://img/test.jpg",
			"genres":    []string{"Drama"},
			"slug":      "test-show",
			"network":   "HBO",
			"overview":  "A test show.",
		}, {
			"tvdb_id": "999",
			"type":    "person",
			"name":    "Ignored",
		}}})
	})
	mux.HandleFunc("GET /series/1/extended", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"data": map[string]any{
			"name":            "Test Show",
			"image":           "https://img/test.jpg",
			"year":            "2020",
			"firstAired":      "2020-01-01",
			"averageRuntime":  42,
			"overview":        "A test show.",
			"slug":            "test-show",
			"status":          map[string]any{"name": "Continuing"},
			"genres":          []map[string]string{{"name": "Drama"}},
			"originalNetwork": map[string]string{"name": "HBO"},
			"characters":      []map[string]string{},
		}})
	})
	mux.HandleFunc("GET /series/1/episodes/default", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"data": map[string]any{
			"episodes": []map[string]any{{"id": 10, "seasonNumber": 1, "number": 1, "name": "Pilot"}},
		}})
	})
	mux.HandleFunc("GET /episodes/10/extended", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"data": map[string]any{
			"characters": []map[string]string{
				{"peopleType": "Writer", "personName": "Jane Doe"},
				{"peopleType": "Actor", "personName": "Someone"},
				{"peopleType": "Writer", "personName": "Jane Doe"},
			},
		}})
	})
	mux.HandleFunc("GET /movies/2/extended", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"data": map[string]any{
			"name":     "Test Movie",
			"image":    "https://img/movie.jpg",
			"year":     "1999",
			"runtime":  120,
			"overview": "A test movie.",
			"slug":     "test-movie",
			"status":   map[string]any{"name": "Released"},
			"genres":   []map[string]string{{"name": "Action"}},
			"studios":  []map[string]string{{"name": "Studio X"}},
			"characters": []map[string]string{
				{"peopleType": "Director", "personName": "John Roe"},
			},
		}})
	})

	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func newAPIServer(t *testing.T) *httptest.Server {
	t.Helper()
	client := tvdb.NewClient(tvdb.Config{APIKey: "key", BaseURL: fakeTVDB(t).URL})
	server := httptest.NewServer(api.NewServer(client).Handler())
	t.Cleanup(server.Close)
	return server
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}

func getJSON(t *testing.T, url string, out any) {
	t.Helper()
	res, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		t.Fatalf("GET %s: status %d: %s", url, res.StatusCode, body)
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		t.Fatalf("GET %s: decode: %v", url, err)
	}
}

func TestSearchNormalization(t *testing.T) {
	server := newAPIServer(t)

	var payload struct {
		Results []api.Media `json:"results"`
	}
	getJSON(t, server.URL+"/api/v1/search?q=test", &payload)

	if len(payload.Results) != 1 {
		t.Fatalf("expected 1 result (person filtered), got %d", len(payload.Results))
	}
	got := payload.Results[0]
	if got.ID != "tv-1" || got.Type != "tv" || got.Title != "Test Show" {
		t.Errorf("unexpected media: %+v", got)
	}
	if got.Creator != "HBO" || len(got.Genres) != 1 || got.Genres[0] != "Drama" {
		t.Errorf("unexpected creator/genres: %+v", got)
	}
}

func TestTVDetailIncludesShowrunner(t *testing.T) {
	server := newAPIServer(t)

	var detail api.MediaDetail
	getJSON(t, server.URL+"/api/v1/media/tv/1", &detail)

	if detail.ID != "tv-1" || detail.Type != "tv" {
		t.Fatalf("unexpected id/type: %+v", detail)
	}
	if detail.Showrunner != "Jane Doe" {
		t.Errorf("showrunner = %q, want %q", detail.Showrunner, "Jane Doe")
	}
	if detail.Creator != "Jane Doe" {
		t.Errorf("creator = %q, want showrunner fallback", detail.Creator)
	}
	if detail.Network != "HBO" || detail.Status != "Continuing" || detail.Runtime != 42 {
		t.Errorf("unexpected detail fields: %+v", detail)
	}
}

func TestMovieDetailNormalization(t *testing.T) {
	server := newAPIServer(t)

	var detail api.MediaDetail
	getJSON(t, server.URL+"/api/v1/media/movie/2", &detail)

	if detail.ID != "movie-2" || detail.Type != "movie" {
		t.Fatalf("unexpected id/type: %+v", detail)
	}
	if detail.Director != "John Roe" || detail.Studio != "Studio X" {
		t.Errorf("unexpected director/studio: %+v", detail)
	}
	if detail.Runtime != 120 || detail.Status != "Released" {
		t.Errorf("unexpected runtime/status: %+v", detail)
	}
}

func TestBatchPreservesOrderAndType(t *testing.T) {
	server := newAPIServer(t)

	body, _ := json.Marshal(map[string]any{"items": []map[string]string{
		{"id": "movie-2", "type": "movie"},
		{"id": "tv-1", "type": "tv"},
	}})
	res, err := http.Post(server.URL+"/api/v1/media/batch", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("POST batch: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("batch status %d", res.StatusCode)
	}

	var payload struct {
		Results []api.Media `json:"results"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(payload.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(payload.Results))
	}
	if payload.Results[0].ID != "movie-2" || payload.Results[1].ID != "tv-1" {
		t.Errorf("order not preserved: %+v", payload.Results)
	}
	if payload.Results[0].Director != "John Roe" || payload.Results[1].Creator != "Jane Doe" {
		t.Errorf("unexpected batch values: %+v", payload.Results)
	}
}
