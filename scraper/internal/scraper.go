package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Scraper struct {
	ttvdb *TTVDB
	stats *Stats
}

func NewScraper(c *TTVDB) *Scraper {
	return &Scraper{c, NewStats()}
}

func (s *Scraper) Run(fetchers int, sinks int) {
	ch := make(chan (Doc), 1024)
	go s.stats.Run(ch)
	var sinkWG sync.WaitGroup
	for range sinks {
		sinkWG.Go(func() { s.sink(ch) })
	}
	sch := make(chan (int), 1)
	mch := make(chan (int), 1)
	var fetchWG sync.WaitGroup
	for range fetchers {
		fetchWG.Go(func() { s.fetch(sch, mch, ch) })
	}
	sch <- 0
	mch <- 0
	fetchWG.Wait()
	close(sch)
	close(mch)
	close(ch)
	sinkWG.Wait()
	s.stats.Stop()
	fmt.Println()
}

func (s *Scraper) sink(ch chan (Doc)) {
	n := 0
	os.MkdirAll(filepath.Join("tmp", string(SERIES)), 0755)
	os.MkdirAll(filepath.Join("tmp", string(MOVIES)), 0755)
	for doc := range ch {
		var withID struct {
			ID int `json:"id"`
		}
		if err := json.Unmarshal(*doc.Raw, &withID); err != nil {
			panic(err)
		}
		err := os.WriteFile(fmt.Sprintf("tmp/%s/%d.json", doc.Kind, withID.ID), *doc.Raw, 0644)
		if err != nil {
			panic(err)
		} else {
			n++
			s.stats.Written()
		}
	}
}

func (s *Scraper) fetch(sch chan (int), mch chan (int), ch chan (Doc)) {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Hour)
	defer cancel()
	do := func(kind Kind, n int, xch *chan (int)) {
		*xch <- n + 1
		page, err := s.ttvdb.Page(ctx, kind, n)
		if err != nil {
			page, err = s.ttvdb.Page(ctx, kind, n)
		}
		if err != nil {
			s.stats.Err(n)
			return
		}
		if len(page.Data) == 0 {
			*xch = nil
			return
		}
		for _, doc := range page.Data {
			s.stats.Read(kind)
			ch <- Doc{kind, &doc}
		}
	}
	for sch != nil || mch != nil {
		select {
		case n := <-sch:
			do(SERIES, n, &sch)
		case n := <-mch:
			do(MOVIES, n, &mch)
		}
	}
}
