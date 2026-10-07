# Watchlistr - Decentralized Media Tracking Application

## Overview

Watchlistr is a modern, decentralized movie and TV show tracking application built on the **Nostr protocol** using `kind:30016` parameterized replaceable events. It allows users to create custom watchlists, log watched titles with ratings and dates, and explore public lists from followed contacts.

## Core Features

### 🎯 Decentralized Storage
- **Nostr Protocol**: Uses `kind:30016` events for storing media lists
- **Relay-based**: Syncs data across multiple Nostr relays
- **Parameterized Events**: Each list has a unique `d` tag identifier
- **Replaceable Events**: Supports updates and deletions via NIP-33

### 🔐 Unified Authentication
- **NIP-07**: Browser extension support (Alby, nos2x, etc.)
- **NIP-46**: Nostr Connect / Bunker support (NsecBunker)
- **Read-Only Mode**: Browse public lists without authentication
- **Multiple Signer Types**: Extension, Bunker, and Read-Only modes

### 📺 Rich Media Metadata
- **TheTVDB API v4 Integration**: Comprehensive media database
- **Automatic Metadata Resolution**: Posters, release years, directors, creators
- **Episode Details**: Full series information and episode guides
- **Image Support**: Poster images and media artwork

### 📋 Dual List Types
- **To Watch Lists**: Track movies and series you plan to watch
- **Watched Logs**: Record watched dates, personal ratings, and notes
- **Custom Lists**: Create multiple lists for different purposes
- **Default Lists**: Built-in "To Watch" and "Watched" default lists

### 👥 Social Discovery
- **Follow Contacts**: Discover and follow other users
- **Public List Browsing**: Explore lists from followed users
- **Profile Integration**: View user profiles and metadata
- **Block/Mute Support**: Manage unwanted content

## Technical Architecture

### Frontend Stack
- **React 19**: Modern React with hooks and functional components
- **TypeScript**: Full type safety throughout the application
- **Vite**: Fast development server and build tool
- **Lucide React**: Modern icon library

### Nostr Integration
- **nostr-tools**: Core Nostr protocol implementation
- **NIP-07**: Browser extension authentication
- **NIP-46**: Remote signer (Bunker) support
- **NIP-51**: List management (follows, mutes, curated lists)
- **NIP-98**: Media upload authentication

### Backend API
- **Go 1.26**: `net/http` with zero external dependencies
- **Normalized `/api/v1`**: Provider-agnostic media contract for the frontend
- **TVDB Upstream**: TheTVDB v4 client with automatic token refresh
- **Environment-based**: Configurable via environment variables

### Deployment Architecture
- **Static Frontend**: Pre-built React application
- **Decoupled Backend**: Standalone metadata API service (`backend/`)
- **Docker Containerization**: Easy deployment via Docker Compose
- **Caddy Server**: Reverse proxy and static file serving

## Data Structures

### Media Interface
```typescript
interface Media {
  id: string;           // Unique identifier (e.g., "movie-12345")
  title: string;        // Media title
  year: string;         // Release year
  type: 'movie' | 'tv'; // Media type
  poster: string;       // Poster image URL
  genres: string[];     // Genre tags
  watchedDate?: string; // ISO date string when watched
  userRating?: number;  // User rating (0-10)
  slug?: string;        // TVDB slug for URLs
  director?: string;    // Movie director
  creator?: string;    // TV series creator
  overview?: string;   // Plot summary
}
```

### Media List Interface
```typescript
interface MediaList {
  id: string;                    // Unique list identifier
  title: string;                 // List title
  description: string;           // List description
  type: 'watchlist' | 'watched'; // List type
  items: Media[];               // Media items in the list
  createdAt: number;            // Unix timestamp
  eventId?: string;             // Nostr event ID (if published)
}
```

### Nostr User Interface
```typescript
interface NostrUser {
  pubkey: string;                       // Public key
  npub?: string;                       // Bech32 encoded public key
  name?: string;                       // Display name
  picture?: string;                    // Profile picture URL
  readOnly?: boolean;                 // Read-only mode flag
  signerType: 'extension' | 'bunker' | 'readonly'; // Authentication type
  bunkerUrl?: string;                 // Bunker server URL
  bunkerClientSk?: string;            // Client secret key (Bunker)
}
```

## Nostr Event Structure

### Kind 30016 - Media Lists
```json
{
  "kind": 30016,
  "tags": [
    ["d", "list-unique-id"],
    ["title", "List Title"],
    ["description", "List description"],
    ["i", "ttvdb:movie:12345", "https://thetvdb.com/movies/slug", "2024-12-25", "8"],
    ["i", "ttvdb:series:67890", "https://thetvdb.com/series/slug", "", ""]
  ],
  "content": ""
}
```

### Kind 5 - List Deletion
```json
{
  "kind": 5,
  "tags": [
    ["a", "30016:pubkey:list-id"],
    ["d", "list-id"],
    ["e", "event-id-to-delete"]
  ],
  "content": "Deleted list description"
}
```

## Authentication Flow

### NIP-07 Extension Flow
1. User clicks "Login with Extension"
2. Browser checks for `window.nostr` availability
3. Extension prompts user for permission
4. Public key retrieved and session established
5. Required permissions requested

### NIP-46 Bunker Flow
1. User enters bunker URL or Nostr Connect URI
2. Client secret key generated
3. Connection request sent to remote signer
4. Auth challenge handled (QR code or deep link)
5. Session established with permissions

### Read-Only Mode
1. User enters public key directly
2. No signing capability
3. Read-only access to public data
4. Local list management only

## API Integration

### TheTVDB API Proxy
- **Endpoint**: `/api/v1/*`
- **Authentication**: Bearer token management
- **CORS Support**: Cross-origin requests enabled
- **Error Handling**: Automatic token refresh on 401
- **Proxy Headers**: Proper header forwarding and filtering

### Search Endpoints
- **Search**: `/search?q=query&type=movie|tv`
- **Details**: `/movies/{id}`, `/series/{id}`
- **Images**: Poster and artwork retrieval
- **Metadata**: Directors, creators, episode information

## State Management

### Local Storage
- **watchlistr_lists**: User's media lists
- **watchlistr_deleted_lists**: Tombstone registry
- **watchlistr_followed_pubkeys**: Followed users
- **watchlistr_blocked_pubkeys**: Blocked users

### React Hooks
- **useMediaLists**: Core list management
- **useNostrAuth**: Authentication state
- **useMediaSearch**: TVDB search functionality
- **useSocialExplore**: Social features
- **useOutbox**: Offline operation support
- **useToast**: Notification system

## Offline Support

### Outbox Pattern
- **Action Queue**: Pending operations stored locally
- **Retry Logic**: Automatic retry on reconnection
- **Rollback Support**: User-initiated operation reversal
- **Conflict Resolution**: Timestamp-based resolution

### Connection States
- **Connected**: Full functionality
- **Connecting**: Establishing connection
- **Broken**: Signer timeout or failure
- **Disconnected**: No active connection

## Social Features

### Following System
- **Kind 10016**: Standard follow lists
- **Pubkey Discovery**: Find users to follow
- **Profile Sync**: Fetch user metadata
- **List Discovery**: Browse followed users' lists

### Blocking System
- **Kind 30007**: Mute/block lists
- **Content Filtering**: Hide blocked users' content
- **Privacy Control**: User-controlled blocking

### Explore Functionality
- **Global Discovery**: Browse public lists
- **Pagination**: Load more results
- **Sorting**: Recent activity sorting
- **Profile Integration**: View author information

## Deployment

### Development Setup
```bash
# 1. Trust the mise config (once per clone)
mise trust

# 2. Install toolchain + webapp dependencies (creates .env from the example)
mise run setup
# Then edit .env and set TTVDB_API_KEY

# 3. Run development servers
mise run dev
```

### Production Deployment
```bash
# 1. Build static frontend (output in webapp/dist/)
mise run build

# 2. Run backend container
docker compose -f backend/docker-compose.yml up -d

# 3. Configure Caddy server
# See README for Caddy configuration
```

### Environment Variables
```env
TTVDB_API_KEY=your_tvdb_api_key_here
TTVDB_TOKEN=auto_refreshed_token
PORT=3000
HOST=0.0.0.0
```

## Security Considerations

### Data Privacy
- **Public by Default**: Lists are public on Nostr relays
- **User Control**: Users control what they publish
- **Local Storage**: Sensitive data stored locally only
- **No Central Server**: No user data collection

### Authentication Security
- **Permission Scoping**: Minimal required permissions
- **Token Management**: Secure token handling
- **Connection Timeouts**: 15s timeout for remote signers
- **Error Handling**: Secure error reporting

### Network Security
- **HTTPS Only**: Production requires HTTPS
- **CORS Configuration**: Proper cross-origin policies
- **Header Sanitization**: Hop-by-hop header filtering
- **Input Validation**: Strict input validation

## Performance Optimizations

### Frontend Performance
- **React 19 Features**: Latest performance improvements
- **Vite Build**: Optimized production bundles
- **Lazy Loading**: Component-level code splitting
- **Efficient Rerenders**: Optimized state updates

### Nostr Performance
- **Relay Connection Pooling**: Managed WebSocket connections
- **Request Batching**: Efficient Nostr subscription management
- **Timeout Handling**: Proper request timeouts
- **Connection Recovery**: Automatic reconnection logic

### API Performance
- **TVDB Caching**: Local metadata caching
- **Batch Requests**: Efficient media resolution
- **Error Resilience**: Graceful degradation
- **Memory Management**: Proper resource cleanup

## Browser Support

### Supported Browsers
- **Chrome/Chromium**: 88+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

### Required Features
- **WebSocket Support**: Relay connections
- **Local Storage**: Data persistence
- **ES2020 Features**: Modern JavaScript
- **CSS Grid/Flexbox**: Modern layout

## Contributing

### Development Guidelines
- **TypeScript Strict**: Full type safety
- **ESLint/Oxlint**: Code quality enforcement
- **Component Architecture**: React hooks pattern
- **Testing**: Comprehensive test coverage

### Code Organization
- **Components**: Reusable UI components
- **Hooks**: State management logic
- **Types**: TypeScript interfaces
- **Utils**: Helper functions
- **Views**: Page-level components

## Future Enhancements

### Planned Features
- **Episode Tracking**: Individual episode logging
- **Season Progress**: Season completion tracking
- **Import/Export**: Data portability
- **Advanced Filters**: Enhanced filtering options
- **Mobile Apps**: Native mobile applications
- **Themes**: Custom UI themes
- **Plugins**: Extensible functionality

### Technical Roadmap
- **NIP-XX Support**: Additional Nostr improvements
- **Performance**: Further optimizations
- **Accessibility**: WCAG compliance
- **Internationalization**: Multi-language support

## License & Attribution

Watchlistr is built on open source technologies:
- **Nostr Protocol**: Decentralized social networking
- **TheTVDB**: Comprehensive media database
- **React**: UI framework
- **Vite**: Build toolchain

See individual package licenses for details.

---

*This documentation covers the core architecture and functionality of Watchlistr. For specific implementation details, refer to the source code and inline documentation.*