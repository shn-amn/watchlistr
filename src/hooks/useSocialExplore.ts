import { useState, useEffect, useRef } from 'react';
import type { Media, MediaList, NostrUser, AuthorProfileModalState } from '../types';
import type { NostrService, NostrSigner } from '../nostr';
import { cleanListTitle, decodeNpubToHex, resolveMediaItems } from '../utils';

export interface UseSocialExploreProps {
  nostrUser: NostrUser | null;
  nostrServiceRef: React.MutableRefObject<NostrService | null>;
  activeSignerRef: React.MutableRefObject<NostrSigner | null>;
  /**
   * List relay URLs currently connected. The followed-lists load retries only
   * for relays it has not queried yet, so late connectors are included without
   * re-fetching (and re-resolving posters) every time a relay reconnects.
   */
  connectedRelayUrls?: string[];
}

export function useSocialExplore({
  nostrUser,
  nostrServiceRef,
  activeSignerRef,
  connectedRelayUrls = []
}: UseSocialExploreProps) {
  const [activeHubTab, setActiveHubTab] = useState<'my-lists' | 'explore' | 'following'>('explore');

  // Guards the followed-lists load: a later request supersedes an earlier one,
  // and rapid relay connect/disconnect events are debounced into one load.
  const followedRequestIdRef = useRef<number>(0);
  const followedLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Relay URLs already covered by a successful followed-lists load. Used so a
  // relay that repeatedly reconnects does not keep re-triggering a fetch.
  const queriedRelayUrlsRef = useRef<Set<string>>(new Set());
  // Relay URLs already covered by a successful explore-feed load. Kept separate
  // from the followed set so a late connector (e.g. relay.damus.io) triggers a
  // single explore reload that includes it without re-fetching on every flap.
  const exploreQueriedRelayUrlsRef = useRef<Set<string>>(new Set());
  const exploreLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follows state
  const [followedPubkeys, setFollowedPubkeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlistr_followed_pubkeys');
    return saved ? JSON.parse(saved) : [];
  });
  const [followedProfiles, setFollowedProfiles] = useState<Record<string, { name?: string; picture?: string }>>({});
  const [followedListsMap, setFollowedListsMap] = useState<Record<string, MediaList[]>>({});
  const [expandedFollowingUsers, setExpandedFollowingUsers] = useState<Record<string, boolean>>({});

  // Blocked users state (kind:30007)
  const [blockedPubkeys, setBlockedPubkeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchlistr_blocked_pubkeys');
    return saved ? JSON.parse(saved) : [];
  });
  const blockedPubkeysRef = useRef<string[]>(blockedPubkeys);
  useEffect(() => {
    blockedPubkeysRef.current = blockedPubkeys;
  }, [blockedPubkeys]);

  // Clean social and blocked state whenever logged out
  useEffect(() => {
    if (!nostrUser) {
      blockedPubkeysRef.current = [];
      queriedRelayUrlsRef.current.clear();
      exploreQueriedRelayUrlsRef.current.clear();
      setBlockedPubkeys([]);
      setFollowedPubkeys([]);
      setFollowedProfiles({});
      setFollowedListsMap({});
      localStorage.removeItem('watchlistr_blocked_pubkeys');
      localStorage.removeItem('watchlistr_followed_pubkeys');
    }
  }, [nostrUser]);

  // Explore tab state
  const exploreRequestIdRef = useRef<number>(0);
  const [exploreLists, setExploreLists] = useState<MediaList[]>([]);
  const [exploreProfiles, setExploreProfiles] = useState<Record<string, { name?: string; picture?: string }>>({});
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [isExploreLoadingMore, setIsExploreLoadingMore] = useState(false);
  const [hasMoreExplore, setHasMoreExplore] = useState(true);
  const [exploreUntil, setExploreUntil] = useState<number | undefined>(undefined);
  const exploreObserverRef = useRef<HTMLDivElement | null>(null);

  // Prune own lists from explore state whenever logged-in user changes
  useEffect(() => {
    if (nostrUser?.pubkey) {
      const userPk = nostrUser.pubkey.toLowerCase().trim();
      setExploreLists(prev => prev.filter(l => (l.id.split(':')[1] || '').toLowerCase().trim() !== userPk));
    }
  }, [nostrUser?.pubkey]);

  // Prune blocked users' lists from explore state whenever blocks update
  useEffect(() => {
    if (nostrUser && blockedPubkeys.length > 0) {
      const blockedSet = new Set(blockedPubkeys.map(pk => pk.toLowerCase().trim()));
      setExploreLists(prev => prev.filter(l => !blockedSet.has((l.id.split(':')[1] || '').toLowerCase().trim())));
    }
  }, [nostrUser, blockedPubkeys]);

  // Modal states
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followInputKey, setFollowInputKey] = useState('');
  const [followError, setFollowError] = useState<string | null>(null);
  const [authorProfileModal, setAuthorProfileModal] = useState<AuthorProfileModalState>({ isOpen: false, pubkey: null });

  const toggleFollowedUserExpand = (pk: string) => {
    setExpandedFollowingUsers(prev => ({
      ...prev,
      [pk]: !prev[pk]
    }));
  };

  const resolveSocialListMetadata = async (listId: string, items: Media[]) => {
    const unresolved = items.filter(
      item => item.title === 'Loading from the TVDB...' || !item.poster || (item.type === 'movie' && !item.director) || (item.type === 'tv' && !item.creator)
    );
    if (unresolved.length === 0) return;

    const resolved = await resolveMediaItems(unresolved);

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

  // Load profile metadata and kind:30016 lists for followed pubkeys
  const loadFollowedData = async (pubkeys: string[], relayUrlsToMark?: string[]) => {
    if (!nostrServiceRef.current || pubkeys.length === 0) return;
    const reqId = ++followedRequestIdRef.current;

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

    // A newer load (e.g. after more relays connected) has superseded this one.
    if (followedRequestIdRef.current !== reqId) return;

    // No relay was reachable. Keep any previously loaded lists instead of
    // wiping them with an empty result; the relay-readiness effect will retry.
    if (remoteEvents === null) return;

    // Record which relays this successful load covered, so the retry effect
    // does not re-fetch when those same relays disconnect/reconnect.
    relayUrlsToMark?.forEach((url) => queriedRelayUrlsRef.current.add(url));

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
          resolveSocialListMetadata(list.id, list.items);
        }
      });
    });
  };

  // Helper to parse a kind:30016 event into a watched MediaList
  const parseWatchedListEvent = (event: any): MediaList | null => {
    const pk = event.pubkey || '';
    const dTag = event.tags?.find((t: string[]) => t[0] === 'd')?.[1] || 'watchlist:default';
    const titleTag = event.tags?.find((t: string[]) => t[0] === 'title')?.[1] || dTag;
    const descTag = event.tags?.find((t: string[]) => t[0] === 'description')?.[1] || '';
    const isWatchlist = dTag.startsWith('watchlist:') || dTag === 'watchlist';
    const type: 'watchlist' | 'watched' = isWatchlist ? 'watchlist' : 'watched';

    // Filter out to-watch / watchlist lists (keep ONLY watched lists)
    if (type !== 'watched') return null;

    const items: Media[] = (event.tags || [])
      .filter((t: string[]) => t[0] === 'i')
      .map((t: string[]) => {
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

    if (items.length === 0) return null;

    return {
      id: `social:${pk}:${dTag}`,
      title: cleanListTitle(titleTag),
      description: descTag,
      type,
      items,
      createdAt: event.created_at
    };
  };

  // Load global explore lists (kind:30016)
  const loadExploreData = async (
    isInitial: boolean = false,
    overrideUser?: NostrUser | null,
    overrideBlocks?: string[],
    relayUrlsToMark?: string[]
  ) => {
    if (!nostrServiceRef.current) return;
    const reqId = ++exploreRequestIdRef.current;
    if (isInitial) {
      setIsExploreLoading(true);
    } else {
      if (isExploreLoadingMore || !hasMoreExplore) return;
      setIsExploreLoadingMore(true);
    }

    try {
      const untilParam = isInitial ? undefined : exploreUntil;
      const remoteEvents = await nostrServiceRef.current.fetchExploreLists(20, untilParam);
      if (exploreRequestIdRef.current !== reqId) return;

      // Record the relays this successful load covered, so the readiness effect
      // does not re-fetch when those same relays disconnect/reconnect.
      relayUrlsToMark?.forEach((url) => exploreQueriedRelayUrlsRef.current.add(url));

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

      const effectiveUser = overrideUser !== undefined ? overrideUser : nostrUser;
      const effectiveBlocks = overrideBlocks !== undefined
        ? overrideBlocks
        : (effectiveUser ? blockedPubkeysRef.current : []);

      const newLists: MediaList[] = [];
      remoteEvents.forEach(event => {
        const pk = event.pubkey || '';
        const authorPk = pk.toLowerCase().trim();
        const userPk = effectiveUser?.pubkey ? effectiveUser.pubkey.toLowerCase().trim() : null;
        // Filter out logged in user's own lists and blocked users
        if ((userPk && authorPk === userPk) || effectiveBlocks.some(b => b.toLowerCase().trim() === authorPk)) return;
        const parsed = parseWatchedListEvent(event);
        if (parsed) {
          newLists.push(parsed);
        }
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
          resolveSocialListMetadata(list.id, list.items);
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

  const connectedRelayKey = connectedRelayUrls.join(',');

  // Debounced so a burst of relay connections produces a single load that
  // includes every relay open by then (late connectors like relay.damus.io
  // would otherwise be excluded by the fetch's socket snapshot). Only runs
  // while some connected relay has not been queried yet, so relays that keep
  // dropping and reconnecting do not trigger repeated fetches (which would
  // blank and re-resolve posters).
  useEffect(() => {
    if (followedPubkeys.length === 0 || !nostrServiceRef.current) return;
    const hasUnqueriedRelay = connectedRelayUrls.some((url) => !queriedRelayUrlsRef.current.has(url));
    if (!hasUnqueriedRelay) return;

    const urlsAtLoad = connectedRelayUrls.slice();
    if (followedLoadTimerRef.current) clearTimeout(followedLoadTimerRef.current);
    followedLoadTimerRef.current = setTimeout(() => {
      loadFollowedData(followedPubkeys, urlsAtLoad);
    }, 800);
    return () => {
      if (followedLoadTimerRef.current) clearTimeout(followedLoadTimerRef.current);
    };
  }, [followedPubkeys.length, connectedRelayKey]);

  // The explore feed has the same late-connector problem: its initial fetch
  // snapshots the sockets open at that moment, so a relay that connects later
  // (e.g. relay.damus.io) is excluded and never fetched until a manual refresh.
  // Reload once per connected relay that has not been queried yet. Re-checked
  // inside the timeout so a relay already covered by the completed initial load
  // does not cause a redundant fetch.
  useEffect(() => {
    if (activeHubTab !== 'explore' || !nostrServiceRef.current) return;
    const hasUnqueriedRelay = connectedRelayUrls.some((url) => !exploreQueriedRelayUrlsRef.current.has(url));
    if (!hasUnqueriedRelay) return;

    const urlsAtLoad = connectedRelayUrls.slice();
    if (exploreLoadTimerRef.current) clearTimeout(exploreLoadTimerRef.current);
    exploreLoadTimerRef.current = setTimeout(() => {
      const stillUnqueried = connectedRelayUrls.some((url) => !exploreQueriedRelayUrlsRef.current.has(url));
      if (!stillUnqueried) return;
      loadExploreData(true, undefined, undefined, urlsAtLoad);
    }, 800);
    return () => {
      if (exploreLoadTimerRef.current) clearTimeout(exploreLoadTimerRef.current);
    };
  }, [activeHubTab, connectedRelayKey]);

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

  const handleBlockUser = (rawKey: string) => {
    const hex = decodeNpubToHex(rawKey) || (rawKey ? rawKey.toLowerCase().trim() : '');
    if (!hex || blockedPubkeys.includes(hex)) return;

    const nextBlocks = [...blockedPubkeys, hex];
    blockedPubkeysRef.current = nextBlocks;
    setBlockedPubkeys(nextBlocks);
    localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(nextBlocks));

    setExploreLists(prev => prev.filter(l => l.id.split(':')[1] !== hex));
    publishBlockListToNostr(nextBlocks);
  };

  const handleUnblockUser = (rawKey: string) => {
    const hex = decodeNpubToHex(rawKey) || (rawKey ? rawKey.toLowerCase().trim() : '');
    if (!hex) return;
    const nextBlocks = blockedPubkeys.filter(k => k.toLowerCase().trim() !== hex);
    blockedPubkeysRef.current = nextBlocks;
    setBlockedPubkeys(nextBlocks);
    localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(nextBlocks));

    publishBlockListToNostr(nextBlocks);

    // Refresh explore feed so any unblocked posts appear in their natural chronological order
    loadExploreData(true);
  };

  const publishBlockListToNostr = async (keysToPublish: string[]) => {
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    try {
      const pTags = keysToPublish.map(pk => ["p", pk.toLowerCase().trim()]);
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

  const resetSocialState = () => {
    exploreRequestIdRef.current++;
    queriedRelayUrlsRef.current.clear();
    exploreQueriedRelayUrlsRef.current.clear();
    blockedPubkeysRef.current = [];
    setBlockedPubkeys([]);
    localStorage.removeItem('watchlistr_blocked_pubkeys');

    setFollowedPubkeys([]);
    setFollowedProfiles({});
    setFollowedListsMap({});
    localStorage.removeItem('watchlistr_followed_pubkeys');

    setExploreLists([]);
    setActiveHubTab('explore');
    setExploreUntil(undefined);
    setHasMoreExplore(true);

    loadExploreData(true, null, []);
  };

  return {
    activeHubTab,
    setActiveHubTab,
    exploreLists,
    exploreProfiles,
    isExploreLoading,
    isExploreLoadingMore,
    hasMoreExplore,
    exploreObserverRef,
    loadExploreData,
    followedPubkeys,
    setFollowedPubkeys,
    followedProfiles,
    setFollowedProfiles,
    followedListsMap,
    setFollowedListsMap,
    expandedFollowingUsers,
    toggleFollowedUserExpand,
    blockedPubkeys,
    setBlockedPubkeys,
    isFollowModalOpen,
    setIsFollowModalOpen,
    followInputKey,
    setFollowInputKey,
    followError,
    setFollowError,
    authorProfileModal,
    setAuthorProfileModal,
    handleFollowUser,
    handleUnfollowUser,
    handleBlockUser,
    handleUnblockUser,
    loadFollowedData,
    resetSocialState
  };
}
