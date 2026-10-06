package api

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/shn-amn/watchlistr/backend/internal/tvdb"
)

const (
	defaultSearchLimit = 10
	maxSearchLimit     = 50
	batchConcurrency   = 8
)

var errNotFound = errors.New("media not found")

// Server wires HTTP routes to the TVDB client.
type Server struct {
	tvdb *tvdb.Client
}

func NewServer(client *tvdb.Client) *Server {
	return &Server{tvdb: client}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /api/v1/search", s.handleSearch)
	mux.HandleFunc("GET /api/v1/media/{type}/{id}", s.handleMedia)
	mux.HandleFunc("POST /api/v1/media/batch", s.handleBatch)
	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		writeJSON(w, http.StatusOK, map[string]any{"results": []Media{}})
		return
	}

	limit := defaultSearchLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= maxSearchLimit {
			limit = n
		}
	}

	results, err := s.tvdb.Search(r.Context(), query, limit)
	if err != nil {
		log.Printf("[watchlistr-api] search %q failed: %v", query, err)
		writeError(w, http.StatusBadGateway, "search failed")
		return
	}

	media := make([]Media, 0, len(results))
	for _, item := range results {
		if m, ok := searchResultToMedia(item); ok {
			media = append(media, m)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": media})
}

func (s *Server) handleMedia(w http.ResponseWriter, r *http.Request) {
	mediaType := r.PathValue("type")
	id := r.PathValue("id")
	if mediaType != "movie" && mediaType != "tv" {
		writeError(w, http.StatusNotFound, "unknown media type")
		return
	}
	if !isNumeric(id) {
		writeError(w, http.StatusBadRequest, "invalid media id")
		return
	}

	detail, err := s.resolveDetail(r.Context(), mediaType, id)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeError(w, http.StatusNotFound, "media not found")
			return
		}
		log.Printf("[watchlistr-api] media %s/%s failed: %v", mediaType, id, err)
		writeError(w, http.StatusBadGateway, "failed to fetch media details")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

type batchItem struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type batchRequest struct {
	Items []batchItem `json:"items"`
}

func (s *Server) handleBatch(w http.ResponseWriter, r *http.Request) {
	var req batchRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	results := make([]Media, len(req.Items))
	sem := make(chan struct{}, batchConcurrency)
	var wg sync.WaitGroup

	for i, item := range req.Items {
		mediaType, id, ok := splitMediaID(item.ID, item.Type)
		if !ok {
			continue
		}
		wg.Add(1)
		go func(i int, mediaType, id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			detail, err := s.resolveDetail(r.Context(), mediaType, id)
			if err != nil {
				return
			}
			media := detail.Media
			// Echo back the registered id prefix (tv/movie) rather than the tvdb one.
			media.ID = mediaType + "-" + id
			results[i] = media
		}(i, mediaType, id)
	}
	wg.Wait()

	out := make([]Media, 0, len(results))
	for _, m := range results {
		if m.ID != "" {
			out = append(out, m)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": out})
}

// resolveDetail normalizes a single title into the MediaDetail shape, falling
// back from the /extended endpoint to the basic one.
func (s *Server) resolveDetail(ctx context.Context, mediaType, id string) (MediaDetail, error) {
	switch mediaType {
	case "tv":
		if ext, err := s.tvdb.SeriesExtended(ctx, id); err == nil {
			return s.seriesToDetail(ctx, id, ext), nil
		} else if basic, berr := s.tvdb.Series(ctx, id); berr == nil {
			return seriesBasicToDetail(id, basic), nil
		} else {
			return MediaDetail{}, err
		}
	case "movie":
		if ext, err := s.tvdb.MovieExtended(ctx, id); err == nil {
			return movieToDetail(id, ext), nil
		} else if basic, berr := s.tvdb.Movie(ctx, id); berr == nil {
			return movieBasicToDetail(id, basic), nil
		} else {
			return MediaDetail{}, err
		}
	default:
		return MediaDetail{}, errNotFound
	}
}

func (s *Server) seriesToDetail(ctx context.Context, id string, ext *tvdb.SeriesExtended) MediaDetail {
	network := companyName(ext.OriginalNetwork)
	if network == "" {
		network = firstCompanyName(ext.Companies)
	}
	showrunner := s.showrunner(ctx, id)

	runtime := ext.AverageRuntime
	if runtime == 0 && ext.Runtime != nil {
		runtime = *ext.Runtime
	}

	return MediaDetail{
		Media: Media{
			ID:       "tv-" + id,
			Type:     "tv",
			Title:    ext.Name,
			Year:     firstNonEmpty(ext.Year, "N/A"),
			Poster:   ext.Image,
			Genres:   genreNames(ext.Genres),
			Slug:     ext.Slug,
			Overview: ext.Overview,
			Creator:  firstNonEmpty(showrunner, network),
		},
		Showrunner: showrunner,
		Status:     statusName(ext.Status),
		FirstAired: ext.FirstAired,
		Runtime:    runtime,
		Network:    network,
	}
}

// showrunner resolves the lead writers of a series from its first episode,
// mirroring the previous client-side behaviour (season 1, episode 1, else first).
func (s *Server) showrunner(ctx context.Context, seriesID string) string {
	episodes, err := s.tvdb.Episodes(ctx, seriesID, 0)
	if err != nil || len(episodes) == 0 {
		return ""
	}
	pick := episodes[0]
	for _, ep := range episodes {
		if ep.SeasonNumber == 1 && ep.Number == 1 {
			pick = ep
			break
		}
	}

	ext, err := s.tvdb.EpisodeExtended(ctx, strconv.Itoa(pick.ID))
	if err != nil {
		return ""
	}

	seen := make(map[string]bool)
	var writers []string
	for _, c := range ext.Characters {
		if c.PeopleType != "Writer" {
			continue
		}
		name := strings.TrimSpace(c.PersonName)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		writers = append(writers, name)
	}
	return strings.Join(writers, ", ")
}

func movieToDetail(id string, ext *tvdb.MovieExtended) MediaDetail {
	director := strings.TrimSpace(ext.Director)
	if director == "" {
		director = characterByType(ext.Characters, "Director")
	}
	studio := firstStudioName(ext.Studios)
	if studio == "" {
		studio = firstCompanyName(ext.Companies.Studio)
	}

	firstAired := ext.Year
	if ext.FirstRelease != nil && ext.FirstRelease.Date != "" {
		firstAired = ext.FirstRelease.Date
	}

	return MediaDetail{
		Media: Media{
			ID:       "movie-" + id,
			Type:     "movie",
			Title:    ext.Name,
			Year:     firstNonEmpty(ext.Year, "N/A"),
			Poster:   ext.Image,
			Genres:   genreNames(ext.Genres),
			Slug:     ext.Slug,
			Overview: ext.Overview,
			Director: director,
		},
		Status:     statusName(ext.Status),
		FirstAired: firstAired,
		Runtime:    intOrZero(ext.Runtime),
		Studio:     studio,
	}
}

func seriesBasicToDetail(id string, b *tvdb.SeriesBasic) MediaDetail {
	return MediaDetail{
		Media: Media{
			ID:       "tv-" + id,
			Type:     "tv",
			Title:    b.Name,
			Year:     firstNonEmpty(b.Year, "N/A"),
			Poster:   b.Image,
			Genres:   []string{},
			Slug:     b.Slug,
			Overview: b.Overview,
		},
		Status:     statusName(b.Status),
		FirstAired: b.FirstAired,
		Runtime:    b.AverageRuntime,
	}
}

func movieBasicToDetail(id string, b *tvdb.MovieBasic) MediaDetail {
	return MediaDetail{
		Media: Media{
			ID:       "movie-" + id,
			Type:     "movie",
			Title:    b.Name,
			Year:     firstNonEmpty(b.Year, "N/A"),
			Poster:   b.Image,
			Genres:   []string{},
			Slug:     b.Slug,
			Overview: b.Overview,
		},
		Status:  statusName(b.Status),
		Runtime: intOrZero(b.Runtime),
	}
}

func searchResultToMedia(it tvdb.SearchResult) (Media, bool) {
	var mediaType string
	switch it.Type {
	case "series":
		mediaType = "tv"
	case "movie":
		mediaType = "movie"
	default:
		return Media{}, false
	}
	if it.TVDBID == "" {
		return Media{}, false
	}

	return Media{
		ID:       mediaType + "-" + it.TVDBID,
		Type:     mediaType,
		Title:    it.Name,
		Year:     firstNonEmpty(it.Year, "N/A"),
		Poster:   firstNonEmpty(it.Image, it.Thumbnail),
		Genres:   ensureStrings(it.Genres),
		Slug:     it.Slug,
		Director: it.Director,
		Creator:  it.Network,
		Overview: it.Overview,
	}, true
}

// ---- Helpers ----

// splitMediaID accepts "<movie|tv|series>-<id>" or a bare numeric id with a
// separate type hint, returning a normalized ("movie"|"tv", numericID).
func splitMediaID(rawID, typeHint string) (string, string, bool) {
	rawID = strings.TrimSpace(rawID)
	mediaType := strings.TrimSpace(typeHint)

	if i := strings.Index(rawID, "-"); i > 0 {
		prefix := rawID[:i]
		rest := rawID[i+1:]
		if prefix == "movie" || prefix == "tv" || prefix == "series" {
			mediaType = prefix
			rawID = rest
		}
	}
	if mediaType == "series" {
		mediaType = "tv"
	}
	if mediaType != "movie" && mediaType != "tv" {
		return "", "", false
	}
	if !isNumeric(rawID) {
		return "", "", false
	}
	return mediaType, rawID, true
}

func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func ensureStrings(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	return values
}

func genreNames(genres []tvdb.Genre) []string {
	names := make([]string, 0, len(genres))
	for _, g := range genres {
		if strings.TrimSpace(g.Name) != "" {
			names = append(names, g.Name)
		}
	}
	return names
}

func characterByType(characters []tvdb.Character, peopleType string) string {
	for _, c := range characters {
		if c.PeopleType == peopleType && strings.TrimSpace(c.PersonName) != "" {
			return c.PersonName
		}
	}
	return ""
}

func companyName(c *tvdb.Company) string {
	if c == nil {
		return ""
	}
	return c.Name
}

func firstCompanyName(companies []tvdb.Company) string {
	for _, c := range companies {
		if strings.TrimSpace(c.Name) != "" {
			return c.Name
		}
	}
	return ""
}

func firstStudioName(studios []tvdb.Studio) string {
	for _, s := range studios {
		if strings.TrimSpace(s.Name) != "" {
			return s.Name
		}
	}
	return ""
}

func statusName(s *tvdb.Status) string {
	if s == nil {
		return ""
	}
	return s.Name
}

func intOrZero(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("[watchlistr-api] failed to encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
