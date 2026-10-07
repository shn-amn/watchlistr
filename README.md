# Watchlistr

A modern, decentralized movie & TV show tracking application built on **Nostr** (`kind:30016`). Create custom watchlists, log watched titles with ratings and dates, and explore your followed contacts' public lists.

---

## Features

- **Decentralized Storage**: Save and sync lists via Nostr relays using `kind:30016` parameterized replaceable events.
- **Unified Authentication**:
  - **NIP-07** browser extension support (Alby, nos2x, etc.)
  - **NIP-46** Nostr Connect / Bunker support (NsecBunker)
  - **Read-Only** pubkey browsing mode
- **Rich Media Metadata**: Integrated with **TheTVDB API v4** for posters, release years, directors, creators, and episode details.
- **Dual List Types**:
  - **To Watch**: Keep track of movies and series you plan to watch.
  - **Watched Logs**: Log watched dates, personal ratings, and notes.
- **Social Discovery**: Follow contacts and inspect their public watchlists.
- **Decoupled Architecture**: Static React frontend backed by a standalone Go metadata service (`backend/`) exposing a normalized `/api/v1` contract.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Lucide React
- **Nostr**: `nostr-tools`, NIP-07, NIP-46
- **Backend API**: Go 1.26 (`net/http`, zero external dependencies)
- **Deployment**: Docker, Caddy

---

## Local Development

### 1. Prerequisites
- **[mise](https://mise.jdx.dev)**: installs and pins the toolchain (Go, Node, gopls)
- **TheTVDB API Key**: Free key from [TheTVDB API](https://thetvdb.com/api-information)

### 2. Install the Toolchain and Dependencies
`mise.toml` pins Go, Node and gopls, so a clean checkout needs only:

```bash
mise trust          # once per clone — mise does not trust config files on sight
mise run setup
```

`mise run setup` installs the pinned toolchain, runs `npm ci` in `webapp/`, and
creates `.env` from `.env.example` if it does not exist.

### 3. Environment Setup
Add your TVDB API key to `.env` at the repo root:

```env
TTVDB_API_KEY=your_tvdb_api_key_here
# PORT=3000 (Optional, defaults to 3000)
```

The backend reads plain environment variables only — it never parses `.env`
itself. The `dev-backend` task sources the file for you, so this works for local
development with no extra steps. When running the binary directly, export the
variables yourself:

```bash
TTVDB_API_KEY=your_tvdb_api_key_here go -C backend run .
```

### 4. Run Development Servers
Start both the TVDB API backend server and Vite frontend:

```bash
mise run dev
```

- **Frontend**: `https://localhost:5173`
- **Backend API**: `http://localhost:3000`

---

## Production Deployment

Watchlistr uses a high-performance decoupled deployment architecture:

### 1. Build Static Frontend
Compile the React frontend into static production files:

```bash
mise run build
```
This generates optimized static files in the `webapp/dist/` directory.

### 2. Run Backend Container
Run the backend API proxy server container using Docker Compose:

```bash
docker compose -f backend/docker-compose.yml up -d
```

### 3. Serve via Caddy
Mount `webapp/dist/` into your Caddy server and use the following reverse proxy block:

```caddy
watchlistr.example.com {
    encode zstd gzip
    root * /srv/watchlistr

    handle /api/* {
        reverse_proxy ttvdb-proxy:3000
    }

    handle {
        try_files {path} /index.html
        file_server
    }
}
```
