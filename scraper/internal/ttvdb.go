package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const defaultBaseURL = "https://api4.thetvdb.com/v4"

type TTVDB struct {
	apiKey    string
	baseURL   string
	http      *http.Client
	token     string
	mu        sync.Mutex
}

func NewTTVDB(apiKey string) *TTVDB {
	ttvdb := &TTVDB{
		apiKey:  apiKey,
		baseURL: defaultBaseURL,
		http:    &http.Client{Timeout: 20 * time.Second},
		token:   "",
	}
	if err := ttvdb.login(context.Background(), ""); err != nil {
		panic(err.Error())
	}
	return ttvdb
}

func (c *TTVDB) Page(ctx context.Context, kind Kind, page int) (*Page, error) {
	var out Page
	if err := c.get(ctx, fmt.Sprintf("/%s?page=%d", kind, page), &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *TTVDB) login(ctx context.Context, staleToken string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.token != staleToken {
		return nil
	}

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

	c.token = out.Data.Token
	return nil
}

func (c *TTVDB) get(ctx context.Context, path string, out any) error {
	c.mu.Lock()
	token := c.token
	c.mu.Unlock()

	if token == "" {
		if err := c.login(ctx, ""); err != nil {
			return err
		}
		c.mu.Lock()
		token = c.token
		c.mu.Unlock()
	}

	res, err := c.doGet(ctx, path, token)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusUnauthorized {
		_, _ = io.Copy(io.Discard, res.Body)
		_ = res.Body.Close()
		if err := c.login(ctx, token); err != nil {
			return err
		}
		c.mu.Lock()
		token = c.token
		c.mu.Unlock()
		res, err = c.doGet(ctx, path, token)
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

func (c *TTVDB) doGet(ctx context.Context, path, token string) (*http.Response, error) {
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
