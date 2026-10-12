package main

import (
	"fmt"
	"os"

	"github.com/shn-amn/watchlistr/scraper/internal"
)

func main() {
	apiKey := os.Getenv("TTVDB_API_KEY")
	ttvdb := internal.NewTTVDB(apiKey)
	scraper := internal.NewScraper(ttvdb)

	if err := scraper.Run(8, 3); err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	os.Exit(0)
}
