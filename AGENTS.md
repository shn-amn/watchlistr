# Watchlistr - AI Agent Documentation

## Project Overview

Watchlistr is a decentralized media tracking application built on the Nostr protocol using `kind:30016` parameterized replaceable events. It allows users to create watchlists, log watched content, and discover media from followed users.

## Quick Start for AI Agents

### Core Functionality
- **Media Tracking**: Movies and TV shows with ratings and dates
- **Nostr Integration**: Data storage on decentralized relays
- **TVDB API**: Rich media metadata integration
- **Social Features**: Follow users and discover their lists

### Repository Layout
- `webapp/` - React frontend (npm workspace, Vite)
- `backend/` - Go metadata API (independent module)

### Key Files to Understand
- `webapp/src/App.tsx` - Main application component
- `webapp/src/nostr/index.ts` - Nostr protocol implementation
- `webapp/src/hooks/useMediaLists.tsx` - Core list management
- `webapp/src/hooks/useNostrAuth.ts` - Authentication system
- `backend/main.go` - Go metadata API entrypoint
- `backend/internal/api/handlers.go` - `/api/v1` routes and normalization
- `backend/internal/tvdb/client.go` - TVDB v4 client with token refresh
- `backend/openapi.yaml` - `/api/v1` contract (source of truth)
- `webapp/src/types/index.ts` - TypeScript interfaces

### Data Structures (Key Interfaces)
```typescript
// Media item
interface Media {
  id: string;           // "movie-12345" or "tv-67890"
  title: string;        
  year: string;         // Release year
  type: 'movie' | 'tv';
  poster: string;       // Image URL
  watchedDate?: string; // ISO date
  userRating?: number;  // 0-10 rating
}

// Media list
interface MediaList {
  id: string;                    // "watchlist:custom-name"
  title: string;                 
  type: 'watchlist' | 'watched';
  items: Media[];               
  createdAt: number;            // Unix timestamp
}
```

### Nostr Event Types
- `kind:30016` - Media lists with `d` tags for unique identifiers
- `kind:5` - List deletions
- `kind:0` - User profiles
- `kind:10016` - Follow lists
- `kind:30007` - Block/mute lists

### Authentication Methods
1. **NIP-07**: Browser extensions (Alby, nos2x)
2. **NIP-46**: Remote signers (NsecBunker)
3. **Read-Only**: Public key only, no signing

### API Endpoints
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend: `http://localhost:3000/api/v1/*` (normalized media API, Go)
- TVDB API: `https://api4.thetvdb.com/v4/*` (upstream, server-side only)

The frontend must target `/api/v1`, never TVDB directly. Update
`backend/openapi.yaml` whenever the contract changes.

### Development Commands
```bash
npm install          # Install dependencies
npm run dev:all      # Start both frontend and backend
npm run build        # Build for production
npm start            # Start backend only
```

### Environment Setup
The backend reads environment variables only (no `.env` parsing). For local
development, put them in a `.env` at the repo root — `npm start` sources it:
```env
TTVDB_API_KEY=your_tvdb_api_key_here
# PORT=3000 (optional)
```

### Common Patterns
- **Outbox Pattern**: Offline operation support with retry logic
- **Parameterized Events**: NIP-33 replaceable events for lists
- **Automatic Metadata Resolution**: TVDB data enrichment
- **Connection State Management**: Handling online/offline states

### Error Handling
- **Signer Timeouts**: 15s timeout for remote signers
- **TVDB Token Refresh**: Automatic on 401 errors
- **Connection Recovery**: Automatic relay reconnection
- **User Notifications**: Toast system with retry actions

### Storage Locations
- **Local Storage**: User data and outbox actions
- **Nostr Relays**: Public list data
- **TVDB API**: Media metadata

### Social Features Implementation
- Follow lists via `kind:10016`
- Public list discovery through global queries
- Profile metadata via `kind:0`
- Blocking via `kind:30007`

## For AI Agents Working on This Project

### When modifying code:
- Maintain TypeScript strict mode
- Follow existing React hooks patterns
- Preserve offline support functionality
- Handle Nostr connection states properly
- Use the outbox system for async actions

### When adding features:
- Consider Nostr compatibility first
- Implement proper error handling
- Support both online and offline modes
- Follow the existing UI/UX patterns

### Testing considerations:
- Test with different connection states
- Verify offline operation support
- Check Nostr event formatting
- Validate TVDB API responses

This file is optimized for AI agent comprehension and should be the first reference point when working on the Watchlistr codebase.