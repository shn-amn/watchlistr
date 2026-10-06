package api

// Media is the normalized shape the frontend consumes. It intentionally hides
// the TVDB response structure so the provider can change without touching the UI.
type Media struct {
	ID       string   `json:"id"`   // "<type>-<tvdbId>", e.g. "movie-113"
	Type     string   `json:"type"` // "movie" | "tv"
	Title    string   `json:"title"`
	Year     string   `json:"year"`
	Poster   string   `json:"poster"`
	Genres   []string `json:"genres"`
	Slug     string   `json:"slug,omitempty"`
	Director string   `json:"director,omitempty"` // movies
	Creator  string   `json:"creator,omitempty"`  // tv: showrunner, else network
	Overview string   `json:"overview,omitempty"`
}

// MediaDetail extends Media with the fields the details modal renders.
// Future ratings (TVDB, Rotten Tomatoes, ...) belong here.
type MediaDetail struct {
	Media
	Showrunner string `json:"showrunner,omitempty"`
	Status     string `json:"status,omitempty"`
	FirstAired string `json:"firstAired,omitempty"`
	Runtime    int    `json:"runtime,omitempty"`
	Network    string `json:"network,omitempty"`
	Studio     string `json:"studio,omitempty"`
}
