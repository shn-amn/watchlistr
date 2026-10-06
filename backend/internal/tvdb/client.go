package tvdb

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const defaultBaseURL = "https://api4.thetvdb.com/v4"

// Config holds the credentials and endpoint for the TVDB v4 API.
type Config struct {
	APIKey  string
	Token   string
	BaseURL string
}

// HTTPError is returned when TVDB responds with a non-200 status.
type HTTPError struct {
	StatusCode int
	Body       string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("tvdb request failed (%d): %s", e.StatusCode, e.Body)
}

// Client is a minimal TVDB v4 client with coalesced token refresh.
type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client

	mu    sync.Mutex
	token string

	refreshMu sync.Mutex
}

func NewClient(cfg Config) *Client {
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = defaultBaseURL
	}
	return &Client{
		apiKey:  cfg.APIKey,
		baseURL: base,
		http:    &http.Client{Timeout: 20 * time.Second},
		token:   cfg.Token,
	}
}

// ---- Wire types (only the fields we consume) ----

type Status struct {
	Name string `json:"name"`
}

type Genre struct {
	Name string `json:"name"`
}

type Company struct {
	Name string `json:"name"`
}

type Studio struct {
	Name string `json:"name"`
}

type Release struct {
	Date string `json:"date"`
}

type Character struct {
	PeopleType string `json:"peopleType"`
	PersonName string `json:"personName"`
}

type SearchResult struct {
	TVDBID       string   `json:"tvdb_id"`
	Type         string   `json:"type"`
	Name         string   `json:"name"`
	Year         string   `json:"year"`
	Image        string   `json:"image_url"`
	Thumbnail    string   `json:"thumbnail"`
	Genres       []string `json:"genres"`
	Slug         string   `json:"slug"`
	Director     string   `json:"director"`
	Network      string   `json:"network"`
	Overview     string   `json:"overview"`
	Status       string   `json:"status"`
	FirstAirTime string   `json:"first_air_time"`
}

type SeriesExtended struct {
	Name            string      `json:"name"`
	Image           string      `json:"image"`
	Year            string      `json:"year"`
	FirstAired      string      `json:"firstAired"`
	AverageRuntime  int         `json:"averageRuntime"`
	Runtime         *int        `json:"runtime"`
	Status          *Status     `json:"status"`
	Overview        string      `json:"overview"`
	Slug            string      `json:"slug"`
	Genres          []Genre     `json:"genres"`
	OriginalNetwork *Company    `json:"originalNetwork"`
	Companies       []Company   `json:"companies"`
	Characters      []Character `json:"characters"`
}

type MovieExtended struct {
	Name         string         `json:"name"`
	Image        string         `json:"image"`
	Year         string         `json:"year"`
	FirstRelease *Release       `json:"first_release"`
	Runtime      *int           `json:"runtime"`
	Status       *Status        `json:"status"`
	Overview     string         `json:"overview"`
	Slug         string         `json:"slug"`
	Genres       []Genre        `json:"genres"`
	Director     string         `json:"director"`
	Studios      []Studio       `json:"studios"`
	Companies    MovieCompanies `json:"companies"`
	Characters   []Character    `json:"characters"`
}

type MovieCompanies struct {
	Studio []Company `json:"studio"`
}

type SeriesBasic struct {
	Name           string  `json:"name"`
	Image          string  `json:"image"`
	Year           string  `json:"year"`
	FirstAired     string  `json:"firstAired"`
	AverageRuntime int     `json:"averageRuntime"`
	Status         *Status `json:"status"`
	Overview       string  `json:"overview"`
	Slug           string  `json:"slug"`
}

type MovieBasic struct {
	Name     string  `json:"name"`
	Image    string  `json:"image"`
	Year     string  `json:"year"`
	Runtime  *int    `json:"runtime"`
	Status   *Status `json:"status"`
	Overview string  `json:"overview"`
	Slug     string  `json:"slug"`
}

type Episode struct {
	ID           int    `json:"id"`
	SeasonNumber int    `json:"seasonNumber"`
	Number       int    `json:"number"`
	Name         string `json:"name"`
}

type EpisodeExtended struct {
	Characters []Character `json:"characters"`
}

// ---- Public API ----

func (c *Client) Search(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	q := url.Values{}
	q.Set("query", query)
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	var out []SearchResult
	if err := c.getData(ctx, "/search?"+q.Encode(), &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) SeriesExtended(ctx context.Context, id string) (*SeriesExtended, error) {
	var out SeriesExtended
	if err := c.getData(ctx, "/series/"+url.PathEscape(id)+"/extended", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Series(ctx context.Context, id string) (*SeriesBasic, error) {
	var out SeriesBasic
	if err := c.getData(ctx, "/series/"+url.PathEscape(id), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) MovieExtended(ctx context.Context, id string) (*MovieExtended, error) {
	var out MovieExtended
	if err := c.getData(ctx, "/movies/"+url.PathEscape(id)+"/extended", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Movie(ctx context.Context, id string) (*MovieBasic, error) {
	var out MovieBasic
	if err := c.getData(ctx, "/movies/"+url.PathEscape(id), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Episodes(ctx context.Context, seriesID string, page int) ([]Episode, error) {
	var out struct {
		Episodes []Episode `json:"episodes"`
	}
	path := fmt.Sprintf("/series/%s/episodes/default?page=%d", url.PathEscape(seriesID), page)
	if err := c.getData(ctx, path, &out); err != nil {
		return nil, err
	}
	return out.Episodes, nil
}

func (c *Client) EpisodeExtended(ctx context.Context, id string) (*EpisodeExtended, error) {
	var out EpisodeExtended
	if err := c.getData(ctx, "/episodes/"+url.PathEscape(id)+"/extended", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ---- Internals ----

func (c *Client) getData(ctx context.Context, path string, out any) error {
	env := struct {
		Data json.RawMessage `json:"data"`
	}{}
	if err := c.get(ctx, path, &env); err != nil {
		return err
	}
	if out == nil || len(env.Data) == 0 {
		return nil
	}
	return json.Unmarshal(env.Data, out)
}

func (c *Client) getToken() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.token
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	if c.getToken() == "" {
		if err := c.forceLogin(ctx, ""); err != nil {
			return err
		}
	}

	token := c.getToken()
	res, err := c.doGet(ctx, path, token)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusUnauthorized {
		_, _ = io.Copy(io.Discard, res.Body)
		_ = res.Body.Close()
		if err := c.forceLogin(ctx, token); err != nil {
			return err
		}
		res, err = c.doGet(ctx, path, c.getToken())
		if err != nil {
			return err
		}
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return &HTTPError{StatusCode: res.StatusCode, Body: strings.TrimSpace(string(body))}
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func (c *Client) doGet(ctx context.Context, path, token string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return c.http.Do(req)
}

// forceLogin re-authenticates, coalescing concurrent refreshes: if another
// goroutine already replaced staleToken, the call is a no-op.
func (c *Client) forceLogin(ctx context.Context, staleToken string) error {
	c.refreshMu.Lock()
	defer c.refreshMu.Unlock()
	if staleToken != "" && c.getToken() != staleToken {
		return nil
	}
	return c.login(ctx)
}

func (c *Client) login(ctx context.Context) error {
	body, _ := json.Marshal(map[string]string{"apikey": c.apiKey})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/login", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return &HTTPError{StatusCode: res.StatusCode, Body: strings.TrimSpace(string(raw))}
	}

	var out struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return err
	}
	if out.Data.Token == "" {
		return fmt.Errorf("tvdb login returned an empty token")
	}

	c.mu.Lock()
	c.token = out.Data.Token
	c.mu.Unlock()
	return nil
}
