package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/shn-amn/watchlistr/backend/internal/api"
	"github.com/shn-amn/watchlistr/backend/internal/tvdb"
)

func main() {
	loadDotEnv()

	cfg := tvdb.Config{
		APIKey:  os.Getenv("TTVDB_API_KEY"),
		Token:   os.Getenv("TTVDB_TOKEN"),
		BaseURL: os.Getenv("TVDB_BASE_URL"),
	}
	if cfg.APIKey == "" {
		log.Fatal("[watchlistr-api] TTVDB_API_KEY is required")
	}

	server := api.NewServer(tvdb.NewClient(cfg))
	host := getenv("HOST", "0.0.0.0")
	port := getenv("PORT", "3000")

	httpServer := &http.Server{
		Addr:              host + ":" + port,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("[watchlistr-api] listening on http://%s:%s", host, port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[watchlistr-api] server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// loadDotEnv loads KEY=VALUE pairs from the first .env found in the working
// directory or its parent. Real environment variables always win.
func loadDotEnv() {
	for _, path := range []string{".env", filepath.Join("..", ".env")} {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		for line := range strings.SplitSeq(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			idx := strings.Index(line, "=")
			if idx <= 0 {
				continue
			}
			key := strings.TrimSpace(line[:idx])
			value := strings.TrimSpace(line[idx+1:])
			if _, exists := os.LookupEnv(key); !exists {
				_ = os.Setenv(key, value)
			}
		}
		return
	}
}
