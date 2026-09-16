import { useState, useEffect, useRef } from 'react';
import type { Media, MediaList, NostrUser, AuthorProfileModalState } from '../types';
import type { NostrService, NostrSigner } from '../nostr';
import { cleanListTitle, decodeNpubToHex, resolveMediaItems } from '../utils';

export interface UseSocialExploreProps {
  nostrUser: NostrUser | null;
  nostrServiceRef: React.MutableRefObject<NostrService | null>;
  activeSignerRef: React.MutableRefObject<NostrSigner | null>;
}

export function useSocialExplore({
  nostrUser,
  nostrServiceRef,
  activeSignerRef
}: UseSocialExploreProps) {
  const [activeHubTab, setActiveHubTab] = useState<'my-lists' | 'explore' | 'following'>('explore');

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

  // Explore tab state
  const [exploreLists, setExploreLists] = useState<MediaList[]>([]);
  const [exploreProfiles, setExploreProfiles] = useState<Record<string, { name?: string; picture?: string }>>({});
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [isExploreLoadingMore, setIsExploreLoadingMore] = useState(false);
  const [hasMoreExplore, setHasMoreExplore] = useState(true);
  const [exploreUntil, setExploreUntil] = useState<number | undefined>(undefined);
  const exploreObserverRef = useRef<HTMLDivElement | null>(null);

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
    overrideBlocks?: string[]
  ) => {
    if (!nostrServiceRef.current) return;
    if (isInitial) {
      setIsExploreLoading(true);
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

      const effectiveUser = overrideUser !== undefined ? overrideUser : nostrUser;
      const effectiveBlocks = overrideBlocks !== undefined ? overrideBlocks : blockedPubkeysRef.current;

      const newLists: MediaList[] = [];
      remoteEvents.forEach(event => {
        const pk = event.pubkey || '';
        // Filter out logged in user's own lists and blocked users
        if ((effectiveUser?.pubkey && pk === effectiveUser.pubkey) || effectiveBlocks.includes(pk.toLowerCase().trim())) return;
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
    blockedPubkeysRef.current = [];
    setBlockedPubkeys([]);
    localStorage.removeItem('watchlistr_blocked_pubkeys');

    setFollowedPubkeys([]);
    setFollowedProfiles({});
    setFollowedListsMap({});
    localStorage.removeItem('watchlistr_followed_pubkeys');

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
