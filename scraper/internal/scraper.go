package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

type Scraper struct {
	ttvdb *TTVDB
	stats *Stats
	stop  atomic.Bool
}

func NewScraper(c *TTVDB) *Scraper {
	return &Scraper{
		ttvdb: c,
		stats: NewStats(),
	}
}

func (s *Scraper) Run(fetchers int, sinks int) error {
	sererr := os.MkdirAll(filepath.Join("tmp", string(SERIES)), 0755)
	moverr := os.MkdirAll(filepath.Join("tmp", string(MOVIES)), 0755)
	if err := errors.Join(sererr, moverr); err != nil {
		return err
	}
	s.stop.Store(false)
	ch := make(chan Doc, 1024)
	ech := make(chan error, fetchers+sinks)
	go s.stats.Run(ch)
	var sinkWG sync.WaitGroup
	for range sinks {
		sinkWG.Go(func() { s.sink(ch, ech) })
	}
	sch := make(chan int, 1)
	mch := make(chan int, 1)
	var fetchWG sync.WaitGroup
	for range fetchers {
		fetchWG.Go(func() { s.fetch(sch, mch, ch, ech) })
	}
	sch <- 0
	mch <- 0
	fetchWG.Wait()
	close(sch)
	close(mch)
	close(ch)
	sinkWG.Wait()
	close(ech)
	s.stats.Stop()
	if n := len(ech); n > 0 {
		errs := make([]error, 0, n)
		for e := range ech {
			errs = append(errs, e)
		}
		return errors.Join(errs...)
	}
	return nil
}

func (s *Scraper) emergencyStop() {
	s.stop.Store(true)
}

func (s *Scraper) sink(ch chan Doc, ech chan error) {
	for doc := range ch {
		if s.stop.Load() {
			continue
		}
		var withID struct {
			ID int `json:"id"`
		}
		if err := json.Unmarshal(*doc.Raw, &withID); err != nil {
			s.emergencyStop()
			ech <- DocErr{doc.Kind, withID.ID, err}
			continue
		}
		err := os.WriteFile(fmt.Sprintf("tmp/%s/%d.json", doc.Kind, withID.ID), *doc.Raw, 0644)
		if err != nil {
			s.emergencyStop()
			ech <- WriteErr{doc.Kind, withID.ID, err}
			continue
		}
		s.stats.Written()
	}
}

func (s *Scraper) fetch(sch chan int, mch chan int, ch chan Doc, ech chan error) {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Hour)
	defer cancel()
	do := func(kind Kind, n int, xch *chan int) error {
		*xch <- n + 1
		page, err := s.ttvdb.Page(ctx, kind, n)
		if err != nil {
			page, err = s.ttvdb.Page(ctx, kind, n)
		}
		if err != nil {
			s.stats.Err(n)
			return PageErr{kind, n, err}
		}
		if len(page.Data) == 0 {
			*xch = nil
		}
		for _, doc := range page.Data {
			if s.stop.Load() {
				break
			}
			s.stats.Read(kind)
			ch <- Doc{kind, &doc}
		}
		return nil
	}
	for !s.stop.Load() && (sch != nil || mch != nil) {
		select {
		case n := <-sch:
			if err := do(SERIES, n, &sch); err != nil {
				ech <- err
				return
			}
		case n := <-mch:
			if err := do(MOVIES, n, &mch); err != nil {
				ech <- err
				return
			}
		}
	}
}
