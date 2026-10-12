package internal

import (
	"fmt"
	"sync/atomic"
	"time"
)

type Stats struct {
	errors  atomic.Int32
	series  atomic.Int32
	movies  atomic.Int32
	written atomic.Int32
	stopper chan struct{}
}

func NewStats() *Stats {
	return &Stats{}
}

func (s *Stats) Run(ch chan Doc) error {
	s.stopper = make(chan struct{})
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()
		start := time.Now()
		show := func(now time.Time) {
			fmt.Printf(
				"\r[%3d] %6d series\t%6d movies\t%7d files written\t%7d errors\t%4d files in queue",
				int(now.Sub(start).Seconds()),
				s.series.Load(),
				s.movies.Load(),
				s.written.Load(),
				s.errors.Load(),
				len(ch),
			)
		}
		for {
			select {
			case now := <-ticker.C:
				show(now)
			case <-s.stopper:
				now := time.Now()
				show(now)
				fmt.Println()
				close(s.stopper)
				return
			}
		}
	}()
	return nil
}

func (s *Stats) Err(n int) {
	s.errors.Add(1)
}

func (s *Stats) Read(kind Kind) {
	switch kind {
	case SERIES:
		s.series.Add(1)
	case MOVIES:
		s.movies.Add(1)
	}
}

func (s *Stats) Written() {
	s.written.Add(1)
}

func (s *Stats) Stop() {
	if s.stopper != nil {
		s.stopper <- struct{}{}
		<-s.stopper
	}
}
