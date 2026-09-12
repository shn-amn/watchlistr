// Core media models
export interface Media {
  id: string;
  title: string;
  year: string;
  type: 'movie' | 'tv';
  poster: string;
  genres: string[];
  watchedDate?: string;
  userRating?: number;
  slug?: string;
  director?: string;
  creator?: string;
  overview?: string;
}

export interface MediaList {
  id: string;
  title: string;
  description: string;
  type: 'watchlist' | 'watched';
  items: Media[];
  createdAt: number;
  eventId?: string;
}

// Nostr identity model
export interface NostrUser {
  pubkey: string;
  npub?: string;
  name?: string;
  picture?: string;
  readOnly?: boolean;
  signerType: 'extension' | 'bunker' | 'readonly';
  bunkerUrl?: string;
  bunkerClientSk?: string;
}

// UI and filter types
export type MediaTypeFilter = 'movie' | 'tv' | null;
export type MediaSortOrder = 'recent' | 'oldest' | 'rating' | 'lowest' | null;
export type DeviceType = 'android' | 'ios' | 'desktop';

export interface RatingEmojiInfo {
  emoji: string;
  label: string;
}

// Modal state interfaces
export interface LogModalState {
  isOpen: boolean;
  item: Media | null;
  year: string;
  month: string;
  day: string;
  rating: string;
  sourceList: 'search' | 'watchlist' | 'edit';
  targetListId: string;
}

export interface DetailsModalState {
  isOpen: boolean;
  item: Media | null;
  isLoading: boolean;
  error: string | null;
  extendedInfo: any | null;
}

export interface NewListModalState {
  isOpen: boolean;
  type: 'watchlist' | 'watched';
}

export interface EditListModalState {
  isOpen: boolean;
  list: MediaList | null;
}

export interface DeleteListModalState {
  isOpen: boolean;
  list: MediaList | null;
}

export interface AuthorProfileModalState {
  isOpen: boolean;
  pubkey: string | null;
}
