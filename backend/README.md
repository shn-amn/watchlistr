# Watchlistr Backend

Media metadata service for Watchlistr. It exposes a normalized `/api/v1` API
(see [`openapi.yaml`](./openapi.yaml)) and currently sources data from
TheTVDB v4. The frontend talks to this contract, not to TVDB, so providers can
change without touching the UI.

## Requirements

- Go 1.26+

## Run

```bash
# from the repository root
npm start                # go -C backend run .

# or directly
cd backend && go run .
```

Environment variables (read from the process environment):

| Variable        | Default                    | Notes                       |
| --------------- | -------------------------- | --------------------------- |
| `TTVDB_API_KEY` | —                          | Required.                   |
| `TTVDB_TOKEN`   | —                          | Optional cached token.      |
| `PORT`          | `3000`                     |                             |
| `HOST`          | `0.0.0.0`                  |                             |
| `TVDB_BASE_URL` | `https://api4.thetvdb.com/v4` | Override for testing.    |

The service reads these from the process environment only; it does not read
`.env` files. Provide them via Docker (`env_file`), your orchestrator, or your
shell. `npm start` at the repo root sources the root `.env` for local
development.

## Endpoints

- `GET  /healthz`
- `GET  /api/v1/search?q=&limit=`
- `GET  /api/v1/media/{movie|tv}/{id}`
- `POST /api/v1/media/batch`

## Development

```bash
go test ./...   # unit tests (fake TVDB, no network)
go vet ./...
go build ./...
```
