package internal

import (
	"fmt"
	"encoding/json"
)

type HTTPError struct {
	StatusCode int
	Body       string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("tvdb request failed (%d): %s", e.StatusCode, e.Body)
}

type Page struct {
	Data   []json.RawMessage `json:"data"`
}

type Kind string

const (
	SERIES Kind = "series"
	MOVIES Kind = "movies"
)

type Doc struct {
	Kind Kind
	Raw  *json.RawMessage
}
