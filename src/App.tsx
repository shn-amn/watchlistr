import React, { useState, useEffect, useRef } from 'react';
import { Bookmark } from 'lucide-react';
import {
  NostrService,
  Nip07Signer,
  ReadOnlySigner,
  BunkerNip46Signer,
  createBunkerSigner,
  startNostrConnectSession,
  uploadNostrImage
} from './nostr';
import type { NostrSigner } from './nostr';
import './App.css';

declare global {
  interface Window {
    nostr?: any;
  }
}

import type {
  Media,
  MediaList,
  NostrUser,
  LogModalState,
  DetailsModalState,
  NewListModalState,
  EditListModalState,
  DeleteListModalState,
  AuthorProfileModalState
} from './types';
import {
  DEFAULT_RELAYS
} from './constants';
import {
  getApiUrl,
  cleanListTitle,
  renderListTitle,
  renderDirectorCreator
} from './utils';
import {
  DeleteListModal,
  EditListModal,
  NewListModal,
  FollowModal,
  SettingsModal,
  DetailsModal,
  LogWatchedModal,
  AuthorProfileModal,
  ConnectionModal,
  OnboardingModal,
  SearchModal
} from './components/modals';
import {
  FloatingAddButton
} from './components/common';
import {
  HubView,
  WorkspaceView
} from './views';



function App() {
  // Lists states with LocalStorage persistence
  const [lists, setLists] = useState<MediaList[]>(() => {
    const savedLists = localStorage.getItem('watchlistr_lists');
    if (savedLists) {
      try {
        const parsed: MediaList[] = JSON.parse(savedLists);
        return parsed.map(l => ({
          ...l,
          title: cleanListTitle(l.title)
        }));
      } catch (e) { }
    }

    const savedWatchlist = localStorage.getItem('watchlistr_watchlist');
    const savedWatched = localStorage.getItem('watchlistr_watched');
    const initialWatchlistItems: Media[] = savedWatchlist ? JSON.parse(savedWatchlist) : [];
    const initialWatchedItems: Media[] = savedWatched ? JSON.parse(savedWatched) : [];

    return [
      {
        id: 'watchlist:default',
        title: 'To Watch',
        description: 'My default list of items to watch.',
        type: 'watchlist',
        items: initialWatchlistItems,
        createdAt: initialWatchlistItems.length > 0 ? Math.floor(Date.now() / 1000) : 0
      },
      {
        id: 'watched:default',
        title: 'Watched',
        description: 'My default list of watched items.',
        type: 'watched',
        items: initialWatchedItems,
        createdAt: initialWatchedItems.length > 0 ? Math.floor(Date.now() / 1000) : 0
      }
    ];
  });

  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('watchlist:default');
  const [activeWatchedId, setActiveWatchedId] = useState<string>('watched:default');

  // Page Navigation State: null = Page 1 (List Hub & Auth), string = Page 2 (Single List Workspace)
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Helper to open a list workspace with browser history pushState
  const openWatchlist = (listId: string) => {
    setSelectedListId(listId);
    if (window.location.hash !== `#list-${listId}`) {
      window.history.pushState({ type: 'list', listId }, '', `#list-${listId}`);
    }
  };

  // Helper to close a list workspace (navigate back)
  const closeWatchlist = () => {
    if (window.location.hash.startsWith('#list-')) {
      window.history.back();
    } else {
      setSelectedListId(null);
    }
  };

  // Sync state with browser URL hash & handle popstate (Back/Forward buttons & mobile swipes)
  useEffect(() => {
    const syncStateFromLocation = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#list-')) {
        const listIdFromHash = hash.replace('#list-', '');
        setSelectedListId(listIdFromHash);
      } else {
        setSelectedListId(null);
      }
    };

    // Check initial URL hash on mount
    syncStateFromLocation();

    const handlePopState = () => {
      syncStateFromLocation();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Save lists to LocalStorage whenever modified
  useEffect(() => {
    localStorage.setItem('watchlistr_lists', JSON.stringify(lists));
  }, [lists]);

  // Nostr User & Signer states
  const [nostrUser, setNostrUser] = useState<NostrUser | null>(() => {
    const savedUser = localStorage.getItem('watchlistr_nostr_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const activeSignerRef = useRef<NostrSigner | null>(null);
  const [hasNostrExtension, setHasNostrExtension] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [relayStatuses, setRelayStatuses] = useState<Record<string, boolean>>({});
  const nostrServiceRef = useRef<NostrService | null>(null);

  const activeWatched = lists.find(x => x.id === activeWatchedId) || { items: [] };
  const watchedList = activeWatched.items;

  // Social & Follows & Explore state
  const [activeHubTab, setActiveHubTab] = useState<'my-lists' | 'explore' | 'following'>('explore');
  const [followedPubkeys, setFollowedPubkeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlistr_followed_pubkeys');
    return saved ? JSON.parse(saved) : [];
  });
  const [followedProfiles, setFollowedProfiles] = useState<Record<string, { name?: string; picture?: string }>>({});
  const [followedListsMap, setFollowedListsMap] = useState<Record<string, MediaList[]>>({});

  // Blocked users state (kind:30007)
  const [blockedPubkeys, setBlockedPubkeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlistr_blocked_pubkeys');
    return saved ? JSON.parse(saved) : [];
  });

  // Explore tab state
  const [exploreLists, setExploreLists] = useState<MediaList[]>([]);
  const [exploreProfiles, setExploreProfiles] = useState<Record<string, { name?: string; picture?: string }>>({});
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [isExploreLoadingMore, setIsExploreLoadingMore] = useState(false);
  const [hasMoreExplore, setHasMoreExplore] = useState(true);
  const [exploreUntil, setExploreUntil] = useState<number | undefined>(undefined);
  const exploreObserverRef = useRef<HTMLDivElement | null>(null);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followInputKey, setFollowInputKey] = useState('');
  const [followError, setFollowError] = useState<string | null>(null);

  // Connection & Settings modal states
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Guided Onboarding & Direct Login Wizard state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<number | 'expert'>(0); // 0 = Entry choice, 1..4 = Guided Setup, 'expert' = Direct Login Tabs
  const onboardingStepRef = useRef(onboardingStep);
  useEffect(() => {
    onboardingStepRef.current = onboardingStep;
  }, [onboardingStep]);
  const [onboardingDesktopDevice, setOnboardingDesktopDevice] = useState<'android' | 'ios' | null>(null);
  const [directAuthTab, setDirectAuthTab] = useState<'bunker' | 'extension' | 'readonly'>('bunker');
  const [bunkerConnectMode, setBunkerConnectMode] = useState<'qr' | 'manual'>('qr');
  const [bunkerInputUrl, setBunkerInputUrl] = useState('');
  const [bunkerConnecting, setBunkerConnecting] = useState(false);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [authChallengeUrl, setAuthChallengeUrl] = useState<string | null>(null);
  const [readOnlyInputKey, setReadOnlyInputKey] = useState('');
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const [isNostrConnectListening, setIsNostrConnectListening] = useState<boolean>(false);

  // Profile Edit state & Deferred Upload with Interactive Crop & Zoom
  const [profileEditName, setProfileEditName] = useState('');
  const [profileEditPicture, setProfileEditPicture] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isPublishingProfile, setIsPublishingProfile] = useState(false);
  const [publishingStep, setPublishingStep] = useState<'uploading' | 'publishing' | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [authorProfileModal, setAuthorProfileModal] = useState<AuthorProfileModalState>({ isOpen: false, pubkey: null });

  // Following tab collapse/expand state
  const [expandedFollowingUsers, setExpandedFollowingUsers] = useState<Record<string, boolean>>({});

  const toggleFollowedUserExpand = (pk: string) => {
    setExpandedFollowingUsers(prev => ({
      ...prev,
      [pk]: !prev[pk]
    }));
  };

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // API search states
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state for logging watched details
  const [logModal, setLogModal] = useState<LogModalState>({
    isOpen: false,
    item: null,
    year: '',
    month: '',
    day: '',
    rating: '8',
    sourceList: 'search',
    targetListId: 'watched:default'
  });

  // Modal state for viewing TVDB details
  const [detailsModal, setDetailsModal] = useState<DetailsModalState>({
    isOpen: false,
    item: null,
    isLoading: false,
    error: null,
    extendedInfo: null
  });

  // Drawer state for search overlay on Page 2
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);

  // Modal state for creating new custom list
  const [newListModal, setNewListModal] = useState<NewListModalState>({
    isOpen: false,
    type: 'watched'
  });
  const [newListForm, setNewListForm] = useState({ title: '', description: '' });

  // Modal state for editing existing list
  const [editListModal, setEditListModal] = useState<EditListModalState>({
    isOpen: false,
    list: null
  });
  const [editListForm, setEditListForm] = useState({ title: '', description: '' });

  // Modal state for deleting list confirmation
  const [deleteListModal, setDeleteListModal] = useState<DeleteListModalState>({
    isOpen: false,
    list: null
  });

  // Initialize Nostr Extension check and WebSocket Service
  useEffect(() => {
    const service = new NostrService(DEFAULT_RELAYS);
    nostrServiceRef.current = service;

    service.connectRelays((statuses) => {
      setRelayStatuses({ ...statuses });
    });

    const checkExtension = () => {
      if (window.nostr) {
        setHasNostrExtension(true);
      }
    };
    checkExtension();
    const timer = setTimeout(checkExtension, 1000);

    return () => {
      clearTimeout(timer);
      service.close();
    };
  }, []);

  // Initialize activeSigner on load & handle auto-reconnect for NIP-46 Bunker
  useEffect(() => {
    if (!nostrUser) {
      activeSignerRef.current = null;
      return;
    }

    if (nostrUser.signerType === 'extension') {
      activeSignerRef.current = new Nip07Signer();
    } else if (nostrUser.signerType === 'readonly') {
      activeSignerRef.current = new ReadOnlySigner(nostrUser.pubkey);
    } else if (nostrUser.signerType === 'bunker' && nostrUser.bunkerUrl) {
      if (!activeSignerRef.current || (activeSignerRef.current as any).bunkerUrl !== nostrUser.bunkerUrl) {
        createBunkerSigner(nostrUser.bunkerUrl, nostrUser.bunkerClientSk)
          .then(signer => {
            activeSignerRef.current = signer;
          })
          .catch(err => {
            console.error("Auto-reconnect NIP-46 Bunker failed:", err);
          });
      }
    }

    if (nostrUser.pubkey) {
      syncFromNostr(nostrUser.pubkey);
    }
  }, [nostrUser?.pubkey, nostrUser?.signerType]);

  // Auto-resolve metadata on mount for any items in local storage missing details
  useEffect(() => {
    lists.forEach(list => {
      if (list.items.some(x => x.title === 'Loading from the TVDB...' || !x.poster || (x.type === 'movie' && !x.director) || (x.type === 'tv' && !x.creator))) {
        resolveListMetadata(list.id, list.items);
      }
    });
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(getApiUrl(`/api/tvdb/search?query=${encodeURIComponent(searchQuery)}`));
        if (!response.ok) {
          throw new Error(`Search request failed with status ${response.status}`);
        }
        const json = await response.json();
        if (json.data) {
          const mapped: Media[] = json.data.flatMap((item: any) => {
            let mediaType: 'movie' | 'tv';
            if (item.type === 'series') {
              mediaType = 'tv';
            } else if (item.type === 'movie') {
              mediaType = 'movie';
            } else {
              return [];
            }

            return [{
              id: `${mediaType}-${item.tvdb_id}`,
              title: item.name,
              year: item.year || 'N/A',
              type: mediaType,
              poster: item.image || item.image_url || item.thumbnail || '',
              genres: Array.isArray(item.genres)
                ? item.genres.map((g: any) => typeof g === 'string' ? g : (g?.name || '')).filter(Boolean)
                : [],
              slug: item.slug || undefined,
              director: item.director || undefined,
              creator: item.network || undefined,
              overview: item.overview || undefined
            }];
          });
          setSearchResults(mapped);
        } else {
          setSearchResults([]);
        }
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || 'An error occurred while communicating with TheTVDB.');
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleDirectExtensionLogin = async () => {
    if (!window.nostr) {
      alert("No NIP-07 extension detected. Please install Alby or nos2x, or use Remote Signer.");
      return;
    }

    try {
      const signer = new Nip07Signer();
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();
      if (pubkey) {
        const user: NostrUser = { pubkey, readOnly: false, signerType: 'extension' };
        setNostrUser(user);
        localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
        setIsOnboardingOpen(false);
      }
    } catch (err) {
      console.error("Failed to connect Nostr extension:", err);
      alert("Failed to get public key from extension.");
    }
  };

  const handleDirectBunkerManualLogin = async (url: string) => {
    if (!url.trim()) return;
    setBunkerConnecting(true);
    setBunkerError(null);
    setAuthChallengeUrl(null);

    try {
      const signer = await createBunkerSigner(url, undefined, (authUrl) => {
        setAuthChallengeUrl(authUrl);
      });
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();

      const user: NostrUser = {
        pubkey,
        readOnly: false,
        signerType: 'bunker',
        bunkerUrl: url.trim(),
        bunkerClientSk: signer.clientSecretKeyHex
      };

      setNostrUser(user);
      localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
      setBunkerInputUrl('');
      setIsOnboardingOpen(false);
    } catch (err: any) {
      console.error("Failed to connect NIP-46 Bunker:", err);
      setBunkerError(err.message || String(err));
    } finally {
      setBunkerConnecting(false);
    }
  };

  const handleDirectReadOnlyLogin = (rawKey: string) => {
    const hex = decodeNpubToHex(rawKey);
    if (!hex || hex.length !== 64) {
      alert("Invalid Nostr public key or npub format.");
      return;
    }
    const signer = new ReadOnlySigner(hex);
    activeSignerRef.current = signer;
    const user: NostrUser = { pubkey: hex, readOnly: true, signerType: 'readonly' };
    setNostrUser(user);
    localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
    setReadOnlyInputKey('');
    setIsOnboardingOpen(false);
  };

  const handleStartNostrConnect = async () => {
    setIsNostrConnectListening(true);
    setBunkerError(null);
    setAuthChallengeUrl(null);

    const session = startNostrConnectSession(DEFAULT_RELAYS, (authUrl) => {
      setAuthChallengeUrl(authUrl);
    });

    setNostrConnectUri(session.uri);

    try {
      const signer = await session.listen();
      activeSignerRef.current = signer;
      const pubkey = await signer.getPublicKey();

      const user: NostrUser = {
        pubkey,
        readOnly: false,
        signerType: 'bunker',
        bunkerUrl: signer.bunkerUrl,
        bunkerClientSk: signer.clientSecretKeyHex
      };

      setNostrUser(user);
      localStorage.setItem('watchlistr_nostr_user', JSON.stringify(user));
      setNostrConnectUri(null);
      if (onboardingStepRef.current === 0 || onboardingStepRef.current === 'expert') {
        setIsOnboardingOpen(false);
      } else {
        setOnboardingStep(4);
      }
    } catch (err: any) {
      console.error("Nostr Connect session failed:", err);
      setBunkerError(err.message || String(err));
    } finally {
      setIsNostrConnectListening(false);
    }
  };

  const logoutNostr = () => {
    if (activeSignerRef.current && 'close' in activeSignerRef.current) {
      try {
        (activeSignerRef.current as BunkerNip46Signer).close();
      } catch (e) { }
    }
    activeSignerRef.current = null;
    setNostrUser(null);
    setSelectedListId(null);
    localStorage.removeItem('watchlistr_nostr_user');

    setLists([
      {
        id: 'watchlist:default',
        title: 'To Watch',
        description: 'My default list of items to watch.',
        type: 'watchlist',
        items: [],
        createdAt: 0
      },
      {
        id: 'watched:default',
        title: 'Watched',
        description: 'My default list of watched items.',
        type: 'watched',
        items: [],
        createdAt: 0
      }
    ]);
    setFollowedPubkeys([]);
    setFollowedProfiles({});
    setFollowedListsMap({});
  };

  const publishListToNostr = async (list: MediaList) => {
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;

    const iTags = list.items.map(item => {
      const numericId = item.id.includes('-') ? item.id.split('-')[1] : item.id;
      const identifier = `ttvdb:${item.type === 'tv' ? 'series' : 'movie'}:${numericId}`;
      const urlHint = item.slug ? `https://thetvdb.com/${item.type === 'tv' ? 'series' : 'movies'}/${item.slug}` : "";
      const datestamp = item.watchedDate || "";
      const rating = item.userRating !== undefined ? item.userRating.toString() : "";
      return ["i", identifier, urlHint, datestamp, rating];
    });

    const unsignedEvent = {
      created_at: Math.floor(Date.now() / 1000),
      kind: 30016,
      tags: [
        ["d", list.id],
        ["title", cleanListTitle(list.title)],
        ["description", list.description],
        ...iTags
      ],
      content: ""
    };

    try {
      const signedEvent = await activeSignerRef.current.signEvent(unsignedEvent);
      await nostrServiceRef.current.publishEvent(signedEvent);
    } catch (err) {
      console.error(`Failed to publish list ${list.id} to Nostr:`, err);
    }
  };

  const syncFromNostr = async (pubkey: string) => {
    if (!nostrServiceRef.current) return;
    setIsSyncing(true);

    try {
      // 1. Fetch own lists (kind:30016)
      const events = await nostrServiceRef.current.fetchUserLists(pubkey);
      const remoteLists: MediaList[] = [];

      for (const event of events) {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        if (!dTag) continue;

        const rawTitle = event.tags.find(t => t[0] === 'title')?.[1] || dTag;
        const title = cleanListTitle(rawTitle);
        const description = event.tags.find(t => t[0] === 'description')?.[1] || '';
        const id = dTag;
        const type = (id.startsWith('watchlist:') || id === 'watchlist') ? 'watchlist' : 'watched';

        const items: Media[] = event.tags
          .filter(t => t[0] === 'i')
          .map(t => {
            const identifier = t[1] || '';
            const watchedDate = t[3] || '';
            const ratingStr = t[4] || '';

            let mediaType: 'movie' | 'tv' = 'movie';
            let mediaId = identifier;

            if (identifier.startsWith('ttvdb:')) {
              const parts = identifier.split(':');
              mediaType = parts[1] === 'series' ? 'tv' : 'movie';
              mediaId = `${mediaType}-${parts[2]}`;
            }

            const ratingNum = parseFloat(ratingStr);

            return {
              id: mediaId,
              title: 'Loading from the TVDB...',
              year: watchedDate ? watchedDate.split('-')[0] : '',
              type: mediaType,
              poster: '',
              genres: [],
              watchedDate,
              userRating: isNaN(ratingNum) ? undefined : ratingNum
            };
          });

        remoteLists.push({
          id,
          title,
          description,
          type,
          items,
          createdAt: event.created_at
        });
      }

      setLists(prev => {
        const merged = [...prev];
        remoteLists.forEach(remote => {
          const index = merged.findIndex(x => x.id === remote.id);
          if (index >= 0) {
            if (remote.createdAt > (merged[index].createdAt || 0) || merged[index].items.length === 0 || merged[index].createdAt === 0) {
              merged[index] = remote;
            }
          } else {
            merged.push(remote);
          }
        });
        return merged;
      });

      const watchlists = remoteLists.filter(x => x.type === 'watchlist');
      const watchedlists = remoteLists.filter(x => x.type === 'watched');

      if (watchlists.length > 0) {
        watchlists.sort((a, b) => b.createdAt - a.createdAt);
        setActiveWatchlistId(watchlists[0].id);
      }
      if (watchedlists.length > 0) {
        watchedlists.sort((a, b) => b.createdAt - a.createdAt);
        setActiveWatchedId(watchedlists[0].id);
      }

      remoteLists.forEach(list => {
        if (list.items.some(x => x.title === 'Loading from the TVDB...')) {
          resolveListMetadata(list.id, list.items);
        }
      });

      // 2. Fetch profile metadata (kind:0)
      const profileEvent = await nostrServiceRef.current.fetchUserProfile(pubkey);
      if (profileEvent) {
        try {
          const meta = JSON.parse(profileEvent.content);
          setNostrUser(prev => prev ? {
            ...prev,
            name: meta.display_name || meta.name || meta.username,
            picture: meta.picture
          } : null);
        } catch (e) { }
      }

      // 3. Fetch followed pubkeys (kind:10016)
      const remoteFollows = await nostrServiceRef.current.fetchUserFollows(pubkey);
      if (remoteFollows && remoteFollows.length > 0) {
        setFollowedPubkeys(remoteFollows);
        localStorage.setItem('watchlistr_followed_pubkeys', JSON.stringify(remoteFollows));
        loadFollowedData(remoteFollows);
      }

      // 4. Fetch blocked pubkeys (kind:30007)
      const remoteBlocks = await nostrServiceRef.current.fetchUserBlocks(pubkey);
      if (remoteBlocks && remoteBlocks.length > 0) {
        setBlockedPubkeys(remoteBlocks);
        localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(remoteBlocks));
      }
    } catch (err) {
      console.error("Failed to sync from Nostr:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to decode npub to hex
  const decodeNpubToHex = (input: string): string => {
    const trimmed = input.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (trimmed.startsWith('npub1')) {
      const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const pos = trimmed.lastIndexOf('1');
      const data: number[] = [];
      for (let i = pos + 1; i < trimmed.length; i++) {
        const d = ALPHABET.indexOf(trimmed[i].toLowerCase());
        if (d !== -1) data.push(d);
      }
      const bytes: number[] = [];
      let current = 0;
      let bits = 0;
      for (let i = 0; i < data.length - 6; i++) {
        current = (current << 5) | data[i];
        bits += 5;
        while (bits >= 8) {
          bits -= 8;
          bytes.push((current >> bits) & 0xff);
        }
      }
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return trimmed;
  };

  // Load profile metadata and kind:30016 lists for followed pubkeys
  const loadFollowedData = async (pubkeys: string[]) => {
    if (!nostrServiceRef.current || pubkeys.length === 0) return;

    pubkeys.forEach(async (pk) => {
      if (!followedProfiles[pk]) {
        const metaEvent = await nostrServiceRef.current?.fetchUserProfile(pk);
        if (metaEvent) {
          try {
            const meta = JSON.parse(metaEvent.content);
            setFollowedProfiles(prev => ({
              ...prev,
              [pk]: {
                name: meta.display_name || meta.name || meta.username || `${pk.substring(0, 8)}...`,
                picture: meta.picture
              }
            }));
          } catch (e) { }
        }
      }
    });

    const remoteEvents = await nostrServiceRef.current.fetchFollowedLists(pubkeys);
    const parsedMap: Record<string, MediaList[]> = {};

    remoteEvents.forEach(event => {
      const pk = event.pubkey || '';
      if (!pk) return;
      if (!parsedMap[pk]) parsedMap[pk] = [];
      const dTag = event.tags.find(t => t[0] === 'd')?.[1] || 'watchlist:default';
      const titleTag = event.tags.find(t => t[0] === 'title')?.[1] || dTag;
      const descTag = event.tags.find(t => t[0] === 'description')?.[1] || '';
      const isWatchlist = dTag.startsWith('watchlist:') || dTag === 'watchlist';
      const type: 'watchlist' | 'watched' = isWatchlist ? 'watchlist' : 'watched';

      const items: Media[] = event.tags
        .filter(t => t[0] === 'i')
        .map(t => {
          const identifier = t[1] || '';
          const datestamp = t[3] || '';
          const ratingStr = t[4] || '';

          let mediaType: 'movie' | 'tv' = 'movie';
          let mediaId = identifier;

          if (identifier.startsWith('ttvdb:')) {
            const parts = identifier.split(':');
            mediaType = parts[1] === 'series' ? 'tv' : 'movie';
            mediaId = `${mediaType}-${parts[2]}`;
          }

          const ratingNum = parseFloat(ratingStr);
          return {
            id: mediaId,
            title: 'Loading from the TVDB...',
            year: datestamp ? datestamp.split('-')[0] : '',
            type: mediaType,
            poster: '',
            genres: [],
            watchedDate: datestamp || undefined,
            userRating: isNaN(ratingNum) ? undefined : ratingNum
          };
        });

      parsedMap[pk].push({
        id: `social:${pk}:${dTag}`,
        title: cleanListTitle(titleTag),
        description: descTag,
        type,
        items,
        createdAt: event.created_at
      });
    });

    setFollowedListsMap(parsedMap);

    Object.values(parsedMap).forEach(userLists => {
      userLists.forEach(list => {
        if (list.items.some(x => x.title === 'Loading from the TVDB...' || !x.poster || (x.type === 'movie' && !x.director) || (x.type === 'tv' && !x.creator))) {
          resolveListMetadata(list.id, list.items);
        }
      });
    });
  };

  // Load global explore lists (kind:30016)
  const loadExploreData = async (isInitial: boolean = false) => {
    if (!nostrServiceRef.current) return;
    if (isInitial) {
      setIsExploreLoading(true);
      if (nostrUser?.pubkey) {
        try {
          const freshBlocks = await nostrServiceRef.current.fetchUserBlocks(nostrUser.pubkey);
          if (freshBlocks && freshBlocks.length > 0) {
            setBlockedPubkeys(freshBlocks);
            localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(freshBlocks));
          }
        } catch (e) {
          console.error("Failed to refresh mute list:", e);
        }
      }
    } else {
      if (isExploreLoadingMore || !hasMoreExplore) return;
      setIsExploreLoadingMore(true);
    }

    try {
      const untilParam = isInitial ? undefined : exploreUntil;
      const remoteEvents = await nostrServiceRef.current.fetchExploreLists(20, untilParam);

      if (remoteEvents.length === 0) {
        setHasMoreExplore(false);
        setIsExploreLoading(false);
        setIsExploreLoadingMore(false);
        return;
      }

      // Track oldest created_at for pagination
      const oldestTimestamp = Math.min(...remoteEvents.map(e => e.created_at));
      setExploreUntil(oldestTimestamp - 1);

      // Collect pubkeys and fetch profiles
      const allPubkeys = remoteEvents.map(e => e.pubkey).filter((pk): pk is string => Boolean(pk));
      const pubkeysToFetch = Array.from(new Set(allPubkeys)).filter(
        pk => !exploreProfiles[pk] && !followedProfiles[pk]
      );

      pubkeysToFetch.forEach(async (pk) => {
        const metaEvent = await nostrServiceRef.current?.fetchUserProfile(pk);
        if (metaEvent) {
          try {
            const meta = JSON.parse(metaEvent.content);
            setExploreProfiles(prev => ({
              ...prev,
              [pk]: {
                name: meta.display_name || meta.name || meta.username || `${pk.substring(0, 8)}...`,
                picture: meta.picture
              }
            }));
          } catch (e) { }
        }
      });

      const newLists: MediaList[] = [];
      remoteEvents.forEach(event => {
        const pk = event.pubkey || '';
        // Filter out logged in user's own lists and blocked users
        if ((nostrUser?.pubkey && pk === nostrUser.pubkey) || blockedPubkeys.includes(pk)) return;
        const dTag = event.tags.find(t => t[0] === 'd')?.[1] || 'watchlist:default';
        const titleTag = event.tags.find(t => t[0] === 'title')?.[1] || dTag;
        const descTag = event.tags.find(t => t[0] === 'description')?.[1] || '';
        const isWatchlist = dTag.startsWith('watchlist:') || dTag === 'watchlist';
        const type: 'watchlist' | 'watched' = isWatchlist ? 'watchlist' : 'watched';

        // Filter out to-watch / watchlist lists (keep ONLY watched lists)
        if (type !== 'watched') return;

        const listId = `social:${pk}:${dTag}`;

        const items: Media[] = event.tags
          .filter(t => t[0] === 'i')
          .map(t => {
            const identifier = t[1] || '';
            const datestamp = t[3] || '';
            const ratingStr = t[4] || '';

            let mediaType: 'movie' | 'tv' = 'movie';
            let mediaId = identifier;

            if (identifier.startsWith('ttvdb:')) {
              const parts = identifier.split(':');
              mediaType = parts[1] === 'series' ? 'tv' : 'movie';
              mediaId = `${mediaType}-${parts[2]}`;
            }

            const ratingNum = parseFloat(ratingStr);
            return {
              id: mediaId,
              title: 'Loading from the TVDB...',
              year: datestamp ? datestamp.split('-')[0] : '',
              type: mediaType,
              poster: '',
              genres: [],
              watchedDate: datestamp || undefined,
              userRating: isNaN(ratingNum) ? undefined : ratingNum
            };
          });

        // Filter out empty lists
        if (items.length === 0) return;

        newLists.push({
          id: listId,
          title: cleanListTitle(titleTag),
          description: descTag,
          type,
          items,
          createdAt: event.created_at
        });
      });

      setExploreLists(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const filteredNew = newLists.filter(l => !existingIds.has(l.id));
        const combined = isInitial ? newLists : [...prev, ...filteredNew];
        return combined.sort((a, b) => b.createdAt - a.createdAt);
      });

      // Trigger TVDB metadata resolution for new explore items
      newLists.forEach(list => {
        if (list.items.some(x => x.title === 'Loading from the TVDB...' || !x.poster || (x.type === 'movie' && !x.director) || (x.type === 'tv' && !x.creator))) {
          resolveListMetadata(list.id, list.items);
        }
      });

      if (remoteEvents.length < 20) {
        setHasMoreExplore(false);
      }
    } catch (err) {
      console.error("Error loading explore lists:", err);
    } finally {
      setIsExploreLoading(false);
      setIsExploreLoadingMore(false);
    }
  };

  // IntersectionObserver for infinite scrolling in Explore tab
  useEffect(() => {
    if (activeHubTab !== 'explore') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreExplore && !isExploreLoading && !isExploreLoadingMore) {
          loadExploreData(false);
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    const currentRef = exploreObserverRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
      observer.disconnect();
    };
  }, [activeHubTab, hasMoreExplore, isExploreLoading, isExploreLoadingMore, exploreUntil]);

  useEffect(() => {
    if (activeHubTab === 'explore' && exploreLists.length === 0 && !isExploreLoading) {
      loadExploreData(true);
    }
  }, [activeHubTab]);

  useEffect(() => {
    if (followedPubkeys.length > 0 && nostrServiceRef.current) {
      loadFollowedData(followedPubkeys);
    }
  }, [followedPubkeys.length]);

  const handleFollowUser = async (rawKey: string) => {
    setFollowError(null);
    const hex = decodeNpubToHex(rawKey);
    if (!hex || hex.length !== 64) {
      setFollowError('Invalid Nostr public key or npub format.');
      return;
    }
    if (followedPubkeys.includes(hex)) {
      setFollowError('You are already following this profile.');
      return;
    }

    const nextFollows = [...followedPubkeys, hex];
    setFollowedPubkeys(nextFollows);
    localStorage.setItem('watchlistr_followed_pubkeys', JSON.stringify(nextFollows));

    setFollowInputKey('');
    setIsFollowModalOpen(false);

    loadFollowedData(nextFollows);
    publishFollowListToNostr(nextFollows);
  };

  const handleUnfollowUser = (hex: string) => {
    const nextFollows = followedPubkeys.filter(k => k !== hex);
    setFollowedPubkeys(nextFollows);
    localStorage.setItem('watchlistr_followed_pubkeys', JSON.stringify(nextFollows));

    const nextMap = { ...followedListsMap };
    delete nextMap[hex];
    setFollowedListsMap(nextMap);

    publishFollowListToNostr(nextFollows);
  };

  const publishFollowListToNostr = async (keysToPublish: string[]) => {
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    try {
      const pTags = keysToPublish.map(pk => ["p", pk]);
      const unsignedEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 10016,
        tags: pTags,
        content: ""
      };
      const signedEvent = await activeSignerRef.current.signEvent(unsignedEvent);
      await nostrServiceRef.current.publishEvent(signedEvent);
    } catch (e) {
      console.error("Failed to publish kind:10016 follow list:", e);
    }
  };

  const handleBlockUser = (hex: string) => {
    if (blockedPubkeys.includes(hex)) return;

    const nextBlocks = [...blockedPubkeys, hex];
    setBlockedPubkeys(nextBlocks);
    localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(nextBlocks));

    setExploreLists(prev => prev.filter(l => l.id.split(':')[1] !== hex));
    publishBlockListToNostr(nextBlocks);
  };

  const handleUnblockUser = (hex: string) => {
    const nextBlocks = blockedPubkeys.filter(k => k !== hex);
    setBlockedPubkeys(nextBlocks);
    localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(nextBlocks));

    publishBlockListToNostr(nextBlocks);
  };

  const publishBlockListToNostr = async (keysToPublish: string[]) => {
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    try {
      const pTags = keysToPublish.map(pk => ["p", pk]);
      const unsignedEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 30007,
        tags: [
          ["d", "30016"],
          ...pTags
        ],
        content: ""
      };
      const signedEvent = await activeSignerRef.current.signEvent(unsignedEvent);
      await nostrServiceRef.current.publishEvent(signedEvent);
    } catch (e) {
      console.error("Failed to publish kind:30007 block list:", e);
    }
  };

  // Sync fetched profile metadata into profile edit state when modal is open
  // or when nostrUser.name / nostrUser.picture updates from relays asynchronously.
  useEffect(() => {
    const isEditingProfile = isConnectionModalOpen || (isOnboardingOpen && onboardingStep === 4);
    if (isEditingProfile && nostrUser) {
      if (nostrUser.name) {
        setProfileEditName(prev => prev || nostrUser.name || '');
      }
      if (nostrUser.picture && !selectedImageFile) {
        setProfileEditPicture(prev => prev || nostrUser.picture || '');
      }
    }
  }, [isConnectionModalOpen, isOnboardingOpen, onboardingStep, nostrUser, nostrUser?.name, nostrUser?.picture, selectedImageFile]);

  // Auto-advance onboarding to Step 4 (Profile Setup) when connected in Step 3
  useEffect(() => {
    if (isOnboardingOpen && onboardingStep === 3 && nostrUser) {
      setOnboardingStep(4);
    }
  }, [isOnboardingOpen, onboardingStep, nostrUser]);

  // Select local image file for deferred upload & cropping
  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setProfileStatus({ type: 'error', message: 'Please select a valid image file.' });
      return;
    }
    setSelectedImageFile(file);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    const localPreview = URL.createObjectURL(file);
    setProfileEditPicture(localPreview);
    setProfileStatus(null);
  };

  // HTML5 Canvas Cropper utility (exporting 600x600px Retina crisp JPEG)
  const generateCroppedAvatarFile = (
    file: File,
    zoom: number,
    offset: { x: number; y: number }
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to initialize canvas context."));
          return;
        }

        const viewportSize = 120; // UI circular preview container size
        const targetSize = 600;   // High-DPI Retina output resolution

        const baseScale = Math.max(viewportSize / img.naturalWidth, viewportSize / img.naturalHeight);
        const effectiveScale = baseScale * zoom;

        const cropWidth = viewportSize / effectiveScale;
        const cropHeight = viewportSize / effectiveScale;

        const centerX = (img.naturalWidth / 2) - (offset.x / effectiveScale);
        const centerY = (img.naturalHeight / 2) - (offset.y / effectiveScale);

        const srcX = centerX - (cropWidth / 2);
        const srcY = centerY - (cropHeight / 2);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, srcX, srcY, cropWidth, cropHeight, 0, 0, targetSize, targetSize);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Canvas blob export failed."));
            return;
          }
          const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          resolve(croppedFile);
        }, 'image/jpeg', 0.92);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  };

  // Deferred Profile Save (Crops & Uploads Photo to nostr.build if selected, then publishes kind:0 Profile event)
  const handlePublishProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    if (!profileEditName.trim()) {
      setProfileStatus({ type: 'error', message: 'Display name cannot be empty.' });
      return;
    }

    setIsPublishingProfile(true);
    setProfileStatus(null);

    try {
      let finalPictureUrl = profileEditPicture.trim();

      // Step 1: Crop and upload photo if a local file was chosen
      if (selectedImageFile) {
        setPublishingStep('uploading');
        const croppedFile = await generateCroppedAvatarFile(selectedImageFile, cropZoom, cropOffset);
        finalPictureUrl = await uploadNostrImage(croppedFile, activeSignerRef.current);
        setProfileEditPicture(finalPictureUrl);
        setSelectedImageFile(null);
      }

      // Step 2: Publish kind:0 Profile metadata event
      setPublishingStep('publishing');
      let existingMeta: Record<string, any> = {};
      const existingProfileEvent = await nostrServiceRef.current.fetchUserProfile(nostrUser.pubkey);
      if (existingProfileEvent?.content) {
        try {
          existingMeta = JSON.parse(existingProfileEvent.content);
        } catch (err) { }
      }

      const updatedMeta = {
        ...existingMeta,
        name: profileEditName.trim(),
        display_name: profileEditName.trim(),
        picture: finalPictureUrl
      };

      const unsignedEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: JSON.stringify(updatedMeta)
      };

      const signedEvent = await activeSignerRef.current.signEvent(unsignedEvent);
      await nostrServiceRef.current.publishEvent(signedEvent);

      setNostrUser(prev => prev ? {
        ...prev,
        name: profileEditName.trim(),
        picture: finalPictureUrl
      } : null);

      setProfileStatus({ type: 'success', message: 'Profile updated & published to Nostr relays!' });
    } catch (err: any) {
      console.error("Failed to publish profile:", err);
      setProfileStatus({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setIsPublishingProfile(false);
      setPublishingStep(null);
    }
  };

  const fetchTVShowrunner = async (seriesId: string): Promise<string | undefined> => {
    try {
      const epRes = await fetch(getApiUrl(`/api/tvdb/series/${seriesId}/episodes/default?page=0`));
      if (epRes.ok) {
        const epJson = await epRes.json();
        const ep1 = epJson.data?.episodes?.find((e: any) => e.seasonNumber === 1 && e.number === 1) || epJson.data?.episodes?.[0];
        if (ep1?.id) {
          const epExtRes = await fetch(getApiUrl(`/api/tvdb/episodes/${ep1.id}/extended`));
          if (epExtRes.ok) {
            const epExtJson = await epExtRes.json();
            const writers = epExtJson.data?.characters
              ?.filter((c: any) => c.peopleType === 'Writer')
              .map((c: any) => c.personName)
              .filter(Boolean);
            if (writers && writers.length > 0) {
              return Array.from(new Set<string>(writers)).join(', ');
            }
          }
        }
      }
    } catch (e) { }
    return undefined;
  };

  const resolveListMetadata = async (listId: string, items: Media[]) => {
    const unresolved = items.filter(item => item.title === 'Loading from the TVDB...' || !item.poster || (item.type === 'movie' && !item.director) || (item.type === 'tv' && !item.creator));
    if (unresolved.length === 0) return;

    const resolved = await Promise.all(unresolved.map(async (item) => {
      const numericId = item.id.includes('-') ? item.id.split('-')[1] : item.id;
      const endpoint = item.type === 'tv'
        ? getApiUrl(`/api/tvdb/series/${numericId}/extended`)
        : getApiUrl(`/api/tvdb/movies/${numericId}/extended`);

      try {
        let res = await fetch(endpoint);
        if (!res.ok && endpoint.endsWith('/extended')) {
          const stdEndpoint = item.type === 'tv'
            ? getApiUrl(`/api/tvdb/series/${numericId}`)
            : getApiUrl(`/api/tvdb/movies/${numericId}`);
          res = await fetch(stdEndpoint);
        }
        if (!res.ok) throw new Error();
        const json = await res.json();
        const data = json.data;
        if (data) {
          const directorName = item.type === 'movie'
            ? (data.director || data.characters?.find((c: any) => c.peopleType === 'Director')?.personName || undefined)
            : undefined;

          const networkName = item.type === 'tv'
            ? (data.network || data.originalNetwork?.name || (Array.isArray(data.companies?.network) ? data.companies.network[0]?.name : undefined) || undefined)
            : undefined;

          let showrunnerName: string | undefined = undefined;
          if (item.type === 'tv') {
            showrunnerName = await fetchTVShowrunner(numericId);
          }

          const posterUrl = data.image || data.image_url || data.thumbnail || '';

          return {
            ...item,
            title: item.title === 'Loading from the TVDB...' ? (data.name || data.translations?.eng || 'Unknown Title') : item.title,
            year: item.year && item.year !== 'N/A' ? item.year : (data.year || (data.first_air_time ? data.first_air_time.split('-')[0] : (data.firstAired ? data.firstAired.split('-')[0] : 'N/A'))),
            poster: posterUrl || item.poster || '',
            genres: data.genres ? (Array.isArray(data.genres) ? data.genres.map((g: any) => typeof g === 'string' ? g : (g?.name || '')).filter(Boolean) : []) : (item.genres || []),
            slug: data.slug || item.slug || undefined,
            overview: data.overview || item.overview || undefined,
            director: directorName || item.director,
            creator: showrunnerName || networkName || item.creator
          };
        }
      } catch (e) {
        console.error("Error resolving metadata for item", item.id, e);
      }
      return { ...item, title: item.title === 'Loading from the TVDB...' ? 'Unknown Title' : item.title };
    }));

    setLists(prev => prev.map(list => {
      if (list.id !== listId) return list;
      return {
        ...list,
        items: list.items.map(item => {
          const found = resolved.find(r => r.id === item.id);
          return found || item;
        })
      };
    }));

    setFollowedListsMap(prev => {
      const updated = { ...prev };
      let changed = false;
      Object.keys(updated).forEach(pk => {
        updated[pk] = updated[pk].map(list => {
          if (list.id !== listId) return list;
          changed = true;
          return {
            ...list,
            items: list.items.map(item => {
              const found = resolved.find(r => r.id === item.id);
              return found || item;
            })
          };
        });
      });
      return changed ? updated : prev;
    });

    setExploreLists(prev => prev.map(list => {
      if (list.id !== listId) return list;
      return {
        ...list,
        items: list.items.map(item => {
          const found = resolved.find(r => r.id === item.id);
          return found || item;
        })
      };
    }));
  };

  const createNewList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListForm.title.trim()) return;

    const type = newListModal.type;
    const cleanTitle = newListForm.title.trim();
    const id = `${type}:${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.floor(Math.random() * 10000)}`;

    const newList: MediaList = {
      id,
      title: cleanTitle,
      description: newListForm.description.trim(),
      type,
      items: [],
      createdAt: Math.floor(Date.now() / 1000)
    };

    setLists(prev => [...prev, newList]);
    if (type === 'watchlist') {
      setActiveWatchlistId(id);
    } else {
      setActiveWatchedId(id);
    }

    publishListToNostr(newList);

    setNewListForm({ title: '', description: '' });
    setNewListModal({ isOpen: false, type: 'watched' });
  };

  const openEditListModal = (list: MediaList) => {
    setEditListForm({
      title: list.title,
      description: list.description || ''
    });
    setEditListModal({ isOpen: true, list });
  };

  const saveEditList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editListModal.list || !editListForm.title.trim()) return;

    const updatedTitle = editListForm.title.trim();
    const updatedDesc = editListForm.description.trim();
    const targetId = editListModal.list.id;

    const updatedList: MediaList = {
      ...editListModal.list,
      title: updatedTitle,
      description: updatedDesc
    };

    setLists(prev => prev.map(l => l.id === targetId ? updatedList : l));
    publishListToNostr(updatedList);
    setEditListModal({ isOpen: false, list: null });
  };

  const deleteListFromNostr = async (listId: string) => {
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    try {
      const unsignedEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 5,
        tags: [
          ["a", `30016:${nostrUser.pubkey}:${listId}`],
          ["d", listId]
        ],
        content: `Deleted list ${listId}`
      };
      const signedEvent = await activeSignerRef.current.signEvent(unsignedEvent);
      await nostrServiceRef.current.publishEvent(signedEvent);
    } catch (err) {
      console.error(`Failed to publish list deletion for ${listId}:`, err);
    }
  };

  const confirmDeleteList = (list: MediaList) => {
    setDeleteListModal({ isOpen: true, list });
  };

  const executeDeleteList = () => {
    if (!deleteListModal.list) return;

    const targetId = deleteListModal.list.id;
    setLists(prev => prev.filter(l => l.id !== targetId));
    deleteListFromNostr(targetId);

    setDeleteListModal({ isOpen: false, list: null });
    setSelectedListId(null);
  };

  // Actions
  const defaultWatchlistId = 'watchlist:default';

  const isInDefaultWatchlist = (itemId: string): boolean => {
    const defaultList = lists.find(x => x.id === defaultWatchlistId) || lists.find(x => x.type === 'watchlist');
    return defaultList ? defaultList.items.some(x => x.id === itemId) : false;
  };

  const isInDefaultWatched = (itemId: string): boolean => {
    const defaultWatched = lists.find(x => x.id === 'watched:default') || lists.find(x => x.type === 'watched');
    return defaultWatched ? defaultWatched.items.some(x => x.id === itemId) : false;
  };

  const toggleDefaultWatchlist = (item: Media) => {
    const defaultList = lists.find(x => x.id === defaultWatchlistId) || lists.find(x => x.type === 'watchlist');
    const targetId = defaultList ? defaultList.id : defaultWatchlistId;
    if (isInDefaultWatchlist(item.id)) {
      removeFromWatchlist(item.id, targetId);
    } else {
      addToWatchlist(item, targetId);
    }
  };

  const renderWatchlistRibbon = (item: Media) => {
    const inDefault = isInDefaultWatchlist(item.id);
    const darkGreen = '#15803d';
    return (
      <button
        className={`btn btn-action-icon ${inDefault ? 'ribbon-active' : 'ribbon-inactive'}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleDefaultWatchlist(item);
        }}
        title={inDefault ? "In To-Watch list (Click to remove)" : "Add to default To-Watch list"}
        style={{
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          color: inDefault ? darkGreen : 'var(--text-tertiary)',
          backgroundColor: inDefault ? 'rgba(21, 128, 61, 0.14)' : 'transparent',
          border: inDefault ? '1px solid rgba(21, 128, 61, 0.35)' : '1px solid var(--border-color)',
          transition: 'all var(--transition-fast)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Bookmark size={16} fill={inDefault ? darkGreen : 'none'} />
      </button>
    );
  };

  const addToWatchlist = (item: Media, targetListId: string = activeWatchlistId) => {
    let updatedList: MediaList | null = null;
    setLists(prev => {
      const next = prev.map(list => {
        if (list.id === targetListId) {
          if (list.items.some(x => x.id === item.id)) return list;
          updatedList = { ...list, items: [item, ...list.items], createdAt: Math.floor(Date.now() / 1000) };
          return updatedList;
        }
        return list;
      });
      if (updatedList) {
        publishListToNostr(updatedList);
      }
      return next;
    });
  };

  const openLogWatchedModal = (item: Media, sourceList: 'search' | 'watchlist' | 'edit', targetListId?: string) => {
    const dateStr = item.watchedDate || new Date().toISOString().split('T')[0];
    const parts = dateStr.split('-');

    let validWatchedId: string = targetListId || '';
    const targetList = lists.find(x => x.id === targetListId);
    if (!targetList || targetList.type !== 'watched') {
      const defaultWatched = lists.find(x => x.id === 'watched:default') || lists.find(x => x.type === 'watched');
      validWatchedId = defaultWatched ? defaultWatched.id : 'watched:default';
    }

    setLogModal({
      isOpen: true,
      item,
      year: parts[0] || '',
      month: parts[1] || '',
      day: parts[2] || '',
      rating: item.userRating !== undefined ? item.userRating.toString() : '8',
      sourceList,
      targetListId: validWatchedId
    });
  };

  const saveWatchedDetails = () => {
    if (!logModal.item) return;

    let dateStr = '';
    if (logModal.year) {
      dateStr = logModal.year;
      if (logModal.month) {
        dateStr += `-${logModal.month}`;
        if (logModal.day) {
          dateStr += `-${logModal.day}`;
        }
      }
    }

    const ratingNum = parseFloat(logModal.rating);
    const updatedItem: Media = {
      ...logModal.item,
      watchedDate: dateStr || undefined,
      userRating: isNaN(ratingNum) ? undefined : ratingNum
    };

    const targetListId = logModal.targetListId || activeWatchedId;
    let updatedWatchlist: MediaList | null = null;
    let updatedWatchedlist: MediaList | null = null;

    setLists(prev => {
      const next = prev.map(list => {
        if (list.type === 'watchlist') {
          if (list.items.some(x => x.id === updatedItem.id)) {
            updatedWatchlist = { ...list, items: list.items.filter(x => x.id !== updatedItem.id), createdAt: Math.floor(Date.now() / 1000) };
            return updatedWatchlist;
          }
        }
        if (list.id === targetListId) {
          const exists = list.items.some(x => x.id === updatedItem.id);
          const filtered = list.items.filter(x => x.id !== updatedItem.id);
          updatedWatchedlist = {
            ...list,
            items: exists && logModal.sourceList === 'edit'
              ? list.items.map(x => x.id === updatedItem.id ? updatedItem : x)
              : [updatedItem, ...filtered],
            createdAt: Math.floor(Date.now() / 1000)
          };
          return updatedWatchedlist;
        }
        return list;
      });

      if (updatedWatchlist) publishListToNostr(updatedWatchlist);
      if (updatedWatchedlist) publishListToNostr(updatedWatchedlist);

      return next;
    });

    setLogModal(prev => ({ ...prev, isOpen: false, item: null }));
  };

  const setTodayDate = () => {
    const today = new Date();
    setLogModal(prev => ({
      ...prev,
      year: today.getFullYear().toString(),
      month: (today.getMonth() + 1).toString().padStart(2, '0'),
      day: today.getDate().toString().padStart(2, '0')
    }));
  };

  const removeFromWatchlist = (id: string, listId: string = activeWatchlistId) => {
    let updatedList: MediaList | null = null;
    setLists(prev => {
      const next = prev.map(list => {
        if (list.id === listId) {
          updatedList = { ...list, items: list.items.filter(x => x.id !== id), createdAt: Math.floor(Date.now() / 1000) };
          return updatedList;
        }
        return list;
      });
      if (updatedList) {
        publishListToNostr(updatedList);
      }
      return next;
    });
  };

  const removeFromWatched = (id: string, listId: string = activeWatchedId) => {
    let updatedList: MediaList | null = null;
    setLists(prev => {
      const next = prev.map(list => {
        if (list.id === listId) {
          updatedList = { ...list, items: list.items.filter(x => x.id !== id), createdAt: Math.floor(Date.now() / 1000) };
          return updatedList;
        }
        return list;
      });
      if (updatedList) {
        publishListToNostr(updatedList);
      }
      return next;
    });
  };

  const openDetailsModal = async (item: Media) => {
    setDetailsModal({
      isOpen: true,
      item,
      isLoading: true,
      error: null,
      extendedInfo: null
    });

    const numericId = item.id.includes('-') ? item.id.split('-')[1] : item.id;
    const endpoint = item.type === 'tv'
      ? getApiUrl(`/api/tvdb/series/${numericId}/extended`)
      : getApiUrl(`/api/tvdb/movies/${numericId}/extended`);

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch details: ${response.status}`);
      }
      const json = await response.json();
      let extendedData = json.data || null;

      if (item.type === 'tv' && extendedData) {
        const showrunner = await fetchTVShowrunner(numericId);
        if (showrunner) {
          extendedData = {
            ...extendedData,
            showrunner
          };
        }
      }

      setDetailsModal(prev => ({
        ...prev,
        isLoading: false,
        extendedInfo: extendedData
      }));
    } catch (err: any) {
      console.error('Error fetching extended info:', err);
      setDetailsModal(prev => ({
        ...prev,
        isLoading: false,
        error: 'Could not load details from TheTVDB.'
      }));
    }
  };

  const closeDetailsModal = () => {
    setDetailsModal(prev => ({ ...prev, isOpen: false, item: null, extendedInfo: null }));
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const isSocialList = selectedListId ? selectedListId.startsWith('social:') : false;
  let currentList: MediaList | undefined;
  let socialProfile: { name?: string; picture?: string; pubkey?: string } | undefined;

  if (isSocialList && selectedListId) {
    const parts = selectedListId.split(':');
    const pubkey = parts[1];
    const userLists = followedListsMap[pubkey] || exploreLists.filter(l => l.id.startsWith(`social:${pubkey}:`));
    currentList = userLists.find(x => x.id === selectedListId) || exploreLists.find(x => x.id === selectedListId);
    const profile = followedProfiles[pubkey] || exploreProfiles[pubkey];
    socialProfile = {
      pubkey,
      name: profile?.name || `${pubkey.substring(0, 8)}...`,
      picture: profile?.picture
    };
  } else {
    currentList = lists.find(x => x.id === selectedListId);
  }

  return (
    <div className="app-container">
      {!selectedListId ? (
        <HubView
          nostrUser={nostrUser}
          isSyncing={isSyncing}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenConnection={() => setIsConnectionModalOpen(true)}
          onOpenLogin={() => {
            setOnboardingStep(0);
            setIsOnboardingOpen(true);
          }}
          activeHubTab={activeHubTab}
          setActiveHubTab={setActiveHubTab}
          lists={lists}
          onOpenNewListModal={() => setNewListModal({ isOpen: true, type: 'watched' })}
          onSyncFromNostr={syncFromNostr}
          exploreLists={exploreLists}
          exploreProfiles={exploreProfiles}
          isExploreLoading={isExploreLoading}
          isExploreLoadingMore={isExploreLoadingMore}
          hasMoreExplore={hasMoreExplore}
          exploreObserverRef={exploreObserverRef}
          onRefreshExplore={loadExploreData}
          blockedPubkeys={blockedPubkeys}
          followedPubkeys={followedPubkeys}
          followedProfiles={followedProfiles}
          followedListsMap={followedListsMap}
          expandedFollowingUsers={expandedFollowingUsers}
          onToggleFollowedUserExpand={toggleFollowedUserExpand}
          onOpenFollowModal={() => setIsFollowModalOpen(true)}
          onUnfollowUser={handleUnfollowUser}
          onOpenWatchlist={openWatchlist}
          onOpenAuthorProfile={(pubkey) => setAuthorProfileModal({ isOpen: true, pubkey })}
          relayStatuses={relayStatuses}
        />
      ) : (
        <WorkspaceView
          nostrUser={nostrUser}
          isSyncing={isSyncing}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenConnection={() => setIsConnectionModalOpen(true)}
          onOpenLogin={() => {
            setOnboardingStep(0);
            setIsOnboardingOpen(true);
          }}
          currentList={currentList}
          isSocialList={isSocialList}
          socialProfile={socialProfile}
          onCloseWatchlist={closeWatchlist}
          onOpenEditListModal={openEditListModal}
          onConfirmDeleteList={confirmDeleteList}
          onOpenSearchDrawer={() => setIsSearchDrawerOpen(true)}
          onOpenAuthorProfile={(pubkey) => setAuthorProfileModal({ isOpen: true, pubkey })}
          onOpenDetailsModal={openDetailsModal}
          onOpenLogWatchedModal={openLogWatchedModal}
          onRemoveFromWatchlist={removeFromWatchlist}
          onRemoveFromWatched={removeFromWatched}
          renderWatchlistRibbon={renderWatchlistRibbon}
        />
      )}

      {/* Global Search Modal Popup (Find & Add) */}
      <SearchModal
        isOpen={isSearchDrawerOpen}
        onClose={() => setIsSearchDrawerOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        clearSearch={clearSearch}
        isLoading={isLoading}
        error={error}
        searchResults={searchResults}
        currentList={currentList}
        isInDefaultWatched={isInDefaultWatched}
        openDetailsModal={openDetailsModal}
        renderDirectorCreator={renderDirectorCreator}
        renderWatchlistRibbon={renderWatchlistRibbon}
        renderListTitle={renderListTitle}
        addToWatchlist={addToWatchlist}
        openLogWatchedModal={openLogWatchedModal}
      />

      {/* Floating Red Action Button for Find & Add */}
      <FloatingAddButton
        isVisible={!isSearchDrawerOpen}
        onClick={() => setIsSearchDrawerOpen(true)}
      />

      {/* Log Watched Modal */}
      <LogWatchedModal
        modal={logModal}
        setModal={setLogModal}
        onClose={() => setLogModal(prev => ({ ...prev, isOpen: false, item: null }))}
        onSave={saveWatchedDetails}
        onSetToday={setTodayDate}
      />

      {/* TVDB Item Details Modal */}
      <DetailsModal
        modal={detailsModal}
        watchedList={watchedList}
        onClose={closeDetailsModal}
        onRetry={(item) => openDetailsModal(item)}
        onMarkWatched={(item) => openLogWatchedModal(item, 'search')}
        renderWatchlistRibbon={renderWatchlistRibbon}
      />

      {/* Create New List Modal */}
      <NewListModal
        isOpen={newListModal.isOpen}
        type={newListModal.type}
        setType={(type) => setNewListModal(prev => ({ ...prev, type }))}
        formData={newListForm}
        setFormData={setNewListForm}
        onClose={() => setNewListModal({ isOpen: false, type: 'watched' })}
        onCreate={createNewList}
      />

      {/* Edit List Modal */}
      <EditListModal
        isOpen={editListModal.isOpen}
        list={editListModal.list}
        formData={editListForm}
        setFormData={setEditListForm}
        onClose={() => setEditListModal({ isOpen: false, list: null })}
        onSave={saveEditList}
      />

      {/* Delete List Modal */}
      <DeleteListModal
        isOpen={deleteListModal.isOpen}
        list={deleteListModal.list}
        onClose={() => setDeleteListModal({ isOpen: false, list: null })}
        onConfirm={executeDeleteList}
      />

      {/* Follow Contact Modal */}
      <FollowModal
        isOpen={isFollowModalOpen}
        inputKey={followInputKey}
        setInputKey={setFollowInputKey}
        error={followError}
        onClose={() => setIsFollowModalOpen(false)}
        onFollow={handleFollowUser}
      />

      {/* Author Profile Modal */}
      <AuthorProfileModal
        isOpen={authorProfileModal.isOpen}
        pubkey={authorProfileModal.pubkey}
        onClose={() => setAuthorProfileModal({ isOpen: false, pubkey: null })}
        followedProfiles={followedProfiles}
        exploreProfiles={exploreProfiles}
        followedPubkeys={followedPubkeys}
        nostrUser={nostrUser}
        followedListsMap={followedListsMap}
        exploreLists={exploreLists}
        blockedPubkeys={blockedPubkeys}
        onFollowUser={handleFollowUser}
        onUnfollowUser={handleUnfollowUser}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
        onOpenWatchlist={openWatchlist}
      />
      {/* Account & Profile Connection Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        nostrUser={nostrUser}
        profileEditName={profileEditName}
        setProfileEditName={setProfileEditName}
        profileEditPicture={profileEditPicture}
        setProfileEditPicture={setProfileEditPicture}
        selectedImageFile={selectedImageFile}
        setSelectedImageFile={setSelectedImageFile}
        cropZoom={cropZoom}
        setCropZoom={setCropZoom}
        cropOffset={cropOffset}
        setCropOffset={setCropOffset}
        isDraggingPhoto={isDraggingPhoto}
        setIsDraggingPhoto={setIsDraggingPhoto}
        dragStartRef={dragStartRef}
        isDraggingAvatar={isDraggingAvatar}
        setIsDraggingAvatar={setIsDraggingAvatar}
        isPublishingProfile={isPublishingProfile}
        publishingStep={publishingStep}
        profileStatus={profileStatus}
        setProfileStatus={setProfileStatus}
        handleFileSelection={handleFileSelection}
        handlePublishProfile={handlePublishProfile}
        logoutNostr={logoutNostr}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        relays={DEFAULT_RELAYS}
        relayStatuses={relayStatuses}
        blockedPubkeys={blockedPubkeys}
        profiles={{ ...followedProfiles, ...exploreProfiles }}
        onUnblockUser={handleUnblockUser}
      />
      {/* Guided Onboarding & Direct Login Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onboardingStep={onboardingStep}
        setOnboardingStep={setOnboardingStep}
        onboardingDesktopDevice={onboardingDesktopDevice}
        setOnboardingDesktopDevice={setOnboardingDesktopDevice}
        directAuthTab={directAuthTab}
        setDirectAuthTab={setDirectAuthTab}
        bunkerConnectMode={bunkerConnectMode}
        setBunkerConnectMode={setBunkerConnectMode}
        bunkerInputUrl={bunkerInputUrl}
        setBunkerInputUrl={setBunkerInputUrl}
        bunkerConnecting={bunkerConnecting}
        bunkerError={bunkerError}
        setBunkerError={setBunkerError}
        authChallengeUrl={authChallengeUrl}
        readOnlyInputKey={readOnlyInputKey}
        setReadOnlyInputKey={setReadOnlyInputKey}
        nostrConnectUri={nostrConnectUri}
        isNostrConnectListening={isNostrConnectListening}
        hasNostrExtension={hasNostrExtension}
        nostrUser={nostrUser}
        handleStartNostrConnect={handleStartNostrConnect}
        handleDirectBunkerManualLogin={handleDirectBunkerManualLogin}
        handleDirectExtensionLogin={handleDirectExtensionLogin}
        handleDirectReadOnlyLogin={handleDirectReadOnlyLogin}
        profileEditName={profileEditName}
        setProfileEditName={setProfileEditName}
        profileEditPicture={profileEditPicture}
        setProfileEditPicture={setProfileEditPicture}
        selectedImageFile={selectedImageFile}
        cropZoom={cropZoom}
        setCropZoom={setCropZoom}
        cropOffset={cropOffset}
        setCropOffset={setCropOffset}
        isDraggingPhoto={isDraggingPhoto}
        setIsDraggingPhoto={setIsDraggingPhoto}
        dragStartRef={dragStartRef}
        isDraggingAvatar={isDraggingAvatar}
        setIsDraggingAvatar={setIsDraggingAvatar}
        handleFileSelection={handleFileSelection}
        handlePublishProfile={handlePublishProfile}
        profileStatus={profileStatus}
        isPublishingProfile={isPublishingProfile}
        publishingStep={publishingStep}
      />
    </div>
  );
}

export default App;
