package internal

import (
	"encoding/json"
	"fmt"
)

type HTTPError struct {
	StatusCode int
	Body       string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("tvdb request failed (%d): %s", e.StatusCode, e.Body)
}

type Page struct {
	Data []json.RawMessage `json:"data"`
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

type PageErr struct {
	Kind       Kind
	Page       int
	Underlying error
}

func (e PageErr) Error() string {
	return fmt.Sprintf("error fetching page %s#%d; %s", e.Kind, e.Page, e.Underlying.Error())
}

type DocErr struct {
	Kind       Kind
	ID         int
	Underlying error
}

func (e DocErr) Error() string {
	return fmt.Sprintf("error decoding doc %s:%d; %s", e.Kind, e.ID, e.Underlying.Error())
}

type WriteErr struct {
	Kind       Kind
	ID         int
	Underlying error
}

func (e WriteErr) Error() string {
	return fmt.Sprintf("error writing file %s/%d; %s", e.Kind, e.ID, e.Underlying.Error())
}
