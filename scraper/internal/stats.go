package internal

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type Stats struct {
	running  bool
	errors   int
	series   int
	movies   int
	written  int
	errchan  chan (int)
	serchan  chan (struct{})
	movchan  chan (struct{})
	filchan  chan (struct{})
	stopchan chan (struct{})
}

func NewStats() *Stats {
	return &Stats{
		errchan:  make(chan (int)),
		serchan:  make(chan (struct{})),
		movchan:  make(chan (struct{})),
		filchan:  make(chan (struct{})),
		stopchan: make(chan (struct{})),
	}
}

func (s *Stats) Run(ch chan (Doc)) error {
	if s.running {
		return errors.New("stats already running")
	}
	s.running = true
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()
		start := time.Now()
		for {
			select {
			case now := <-ticker.C:
				fmt.Printf(
					"\r[%3d] %6d series\t%6d movies\t%7d files written\t%7d errors\t%4d files in queue",
					int(now.Sub(start).Seconds()),
					s.series,
					s.movies,
					s.written,
					s.errors,
					len(ch),
				)
			case <-ctx.Done():
				return
			}
		}
	}()
	for {
		select {
		case <-s.serchan:
			s.series++
		case <-s.movchan:
			s.movies++
		case <-s.filchan:
			s.written++
		case <-s.errchan:
			s.errors++
		case <-s.stopchan:
			close(s.serchan)
			close(s.movchan)
			close(s.filchan)
			close(s.errchan)
			return nil
		}
	}
}

func (s *Stats) Err(n int) error {
	if !s.running {
		return errors.New("stats not running")
	}
	s.errchan <- n
	return nil
}

func (s *Stats) Read(kind Kind) error {
	if !s.running {
		return errors.New("stats not running")
	}
	switch kind {
	case SERIES:
		s.serchan <- struct{}{}
	case MOVIES:
		s.movchan <- struct{}{}
	}
	return nil
}

func (s *Stats) Written() error {
	if !s.running {
		return errors.New("stats not running")
	}
	s.filchan <- struct{}{}
	return nil
}

func (s *Stats) Stop() error {
	if !s.running {
		return errors.New("stats not running")
	}
	close(s.stopchan)
	return nil
}
