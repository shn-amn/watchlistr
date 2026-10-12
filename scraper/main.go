package main

import (
	"fmt"
	"os"
	"time"

	"github.com/shn-amn/watchlistr/scraper/internal"
)

func main() {
	apiKey := os.Getenv("TTVDB_API_KEY")
	ttvdb := internal.NewTTVDB(apiKey)
	scraper := internal.NewScraper(ttvdb)

	now := time.Now()
	fmt.Printf("starting at %s\n", now.UTC().Format(time.RFC3339))
	scraper.Run(8, 3)
	now = time.Now()
	fmt.Printf("finished at %s\n", now.UTC().Format(time.RFC3339))
}
