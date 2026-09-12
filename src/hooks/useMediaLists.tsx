import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import type {
  Media,
  MediaList,
  NostrUser,
  NewListModalState,
  EditListModalState,
  DeleteListModalState,
  LogModalState
} from '../types';
import type { NostrService, NostrSigner } from '../nostr';
import { cleanListTitle, resolveMediaItems } from '../utils';

export interface UseMediaListsProps {
  nostrUser: NostrUser | null;
  nostrServiceRef: React.MutableRefObject<NostrService | null>;
  activeSignerRef: React.MutableRefObject<NostrSigner | null>;
  setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  onSyncProfile?: (meta: { name?: string; picture?: string }) => void;
  onSyncFollows?: (follows: string[]) => void;
  onSyncBlocks?: (blocks: string[]) => void;
}

export function useMediaLists({
  nostrUser,
  nostrServiceRef,
  activeSignerRef,
  setIsSyncing,
  onSyncProfile,
  onSyncFollows,
  onSyncBlocks
}: UseMediaListsProps) {
  // Tombstone registry of deleted list IDs with deletion timestamp
  const [deletedListIds, setDeletedListIds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('watchlistr_deleted_lists');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Lists states with LocalStorage persistence
  const [lists, setLists] = useState<MediaList[]>(() => {
    const savedLists = localStorage.getItem('watchlistr_lists');
    const savedDeleted = localStorage.getItem('watchlistr_deleted_lists');
    let localDeleted: Record<string, number> = {};
    if (savedDeleted) {
      try {
        localDeleted = JSON.parse(savedDeleted);
      } catch (e) {}
    }

    if (savedLists) {
      try {
        const parsed: MediaList[] = JSON.parse(savedLists);
        return parsed
          .filter(l => !(localDeleted[l.id] && (l.createdAt || 0) <= localDeleted[l.id]))
          .map(l => ({
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

  // Modal states for list management
  const [newListModal, setNewListModal] = useState<NewListModalState>({
    isOpen: false,
    type: 'watched'
  });
  const [newListForm, setNewListForm] = useState({ title: '', description: '' });

  const [editListModal, setEditListModal] = useState<EditListModalState>({
    isOpen: false,
    list: null
  });
  const [editListForm, setEditListForm] = useState({ title: '', description: '' });

  const [deleteListModal, setDeleteListModal] = useState<DeleteListModalState>({
    isOpen: false,
    list: null
  });

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

  const activeWatched = lists.find(x => x.id === activeWatchedId) || { items: [] };
  const watchedList = activeWatched.items;

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

  // Sync state with browser URL hash & handle popstate
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

  // Resolve metadata for items in user lists
  const resolveUserListMetadata = async (listId: string, items: Media[]) => {
    const unresolved = items.filter(
      item => item.title === 'Loading from the TVDB...' || !item.poster || (item.type === 'movie' && !item.director) || (item.type === 'tv' && !item.creator)
    );
    if (unresolved.length === 0) return;

    const resolved = await resolveMediaItems(unresolved);

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
  };

  // Auto-resolve metadata on mount for any items in local storage missing details
  useEffect(() => {
    lists.forEach(list => {
      if (list.items.some(x => x.title === 'Loading from the TVDB...' || !x.poster || (x.type === 'movie' && !x.director) || (x.type === 'tv' && !x.creator))) {
        resolveUserListMetadata(list.id, list.items);
      }
    });
  }, []);

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
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, eventId: signedEvent.id } : l));
    } catch (err) {
      console.error(`Failed to publish list ${list.id} to Nostr:`, err);
    }
  };

  const syncFromNostr = async (pubkey: string) => {
    if (!nostrServiceRef.current) return;
    setIsSyncing(true);

    try {
      // 1. Fetch own lists (kind:30016 and kind:5 deletions)
      const events = await nostrServiceRef.current.fetchUserLists(pubkey);
      const remoteLists: MediaList[] = [];

      for (const event of events) {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        if (!dTag) continue;

        // Skip if marked deleted locally
        const deletedAt = deletedListIds[dTag];
        if (deletedAt && event.created_at <= deletedAt) {
          continue;
        }

        // Skip if marked as tombstone
        if (event.tags.some(t => t[0] === 'deleted' && t[1] === 'true')) {
          continue;
        }

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
          createdAt: event.created_at,
          eventId: event.id
        });
      }

      setLists(prev => {
        const merged = [...prev];
        remoteLists.forEach(remote => {
          // Double check against deletedListIds
          const deletedAt = deletedListIds[remote.id];
          if (deletedAt && remote.createdAt <= deletedAt) {
            return;
          }

          const index = merged.findIndex(x => x.id === remote.id);
          if (index >= 0) {
            if (remote.createdAt > (merged[index].createdAt || 0) || merged[index].items.length === 0 || merged[index].createdAt === 0) {
              merged[index] = { ...remote, eventId: remote.eventId || merged[index].eventId };
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
          resolveUserListMetadata(list.id, list.items);
        }
      });

      // 2. Fetch profile metadata (kind:0)
      if (onSyncProfile) {
        const profileEvent = await nostrServiceRef.current.fetchUserProfile(pubkey);
        if (profileEvent) {
          try {
            const meta = JSON.parse(profileEvent.content);
            onSyncProfile({
              name: meta.display_name || meta.name || meta.username,
              picture: meta.picture
            });
          } catch (e) { }
        }
      }

      // 3. Fetch followed pubkeys (kind:10016)
      if (onSyncFollows) {
        const remoteFollows = await nostrServiceRef.current.fetchUserFollows(pubkey);
        if (remoteFollows && remoteFollows.length > 0) {
          onSyncFollows(remoteFollows);
        }
      }

      // 4. Fetch blocked pubkeys (kind:30007)
      if (onSyncBlocks) {
        const remoteBlocks = await nostrServiceRef.current.fetchUserBlocks(pubkey);
        if (remoteBlocks && remoteBlocks.length > 0) {
          onSyncBlocks(remoteBlocks);
        }
      }
    } catch (err) {
      console.error("Failed to sync from Nostr:", err);
    } finally {
      setIsSyncing(false);
    }
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

  const deleteListFromNostr = async (list: MediaList) => {
    if (!nostrUser || nostrUser.readOnly || !nostrServiceRef.current || !activeSignerRef.current) return;
    try {
      const tags: string[][] = [
        ["a", `30016:${nostrUser.pubkey}:${list.id}`],
        ["d", list.id]
      ];
      if (list.eventId) {
        tags.push(["e", list.eventId]);
      }

      // 1. NIP-09 event deletion (kind:5)
      const unsignedKind5 = {
        created_at: Math.floor(Date.now() / 1000),
        kind: 5,
        tags,
        content: `Deleted list ${list.title || list.id}`
      };
      const signedKind5 = await activeSignerRef.current.signEvent(unsignedKind5);
      await nostrServiceRef.current.publishEvent(signedKind5);

      // 2. Also publish a tombstone parameterized replaceable event (kind:30016 with deleted: true)
      // This ensures relays that don't purge on kind:5 will overwrite the old event data
      try {
        const unsignedTombstone = {
          created_at: Math.floor(Date.now() / 1000) + 1,
          kind: 30016,
          tags: [
            ["d", list.id],
            ["title", list.title || list.id],
            ["deleted", "true"]
          ],
          content: ""
        };
        const signedTombstone = await activeSignerRef.current.signEvent(unsignedTombstone);
        await nostrServiceRef.current.publishEvent(signedTombstone);
      } catch (tombstoneErr) {
        console.warn("Could not publish tombstone kind:30016:", tombstoneErr);
      }
    } catch (err) {
      console.error(`Failed to publish list deletion for ${list.id}:`, err);
    }
  };

  const confirmDeleteList = (list: MediaList) => {
    setDeleteListModal({ isOpen: true, list });
  };

  const executeDeleteList = () => {
    if (!deleteListModal.list) return;

    const targetList = deleteListModal.list;
    const targetId = targetList.id;

    // 1. Remove from lists state immediately
    setLists(prev => prev.filter(l => l.id !== targetId));

    // 2. Record deletion in tombstone registry and persist
    const now = Math.floor(Date.now() / 1000);
    setDeletedListIds(prev => {
      const updated = { ...prev, [targetId]: now };
      try {
        localStorage.setItem('watchlistr_deleted_lists', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 3. Fallback active list pointers if deleted list was currently active
    if (activeWatchlistId === targetId) {
      setActiveWatchlistId('watchlist:default');
    }
    if (activeWatchedId === targetId) {
      setActiveWatchedId('watched:default');
    }

    // 4. Reset URL hash navigation
    if (window.location.hash.startsWith('#list-')) {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      }
    }
    setSelectedListId(null);

    // 5. Close modal
    setDeleteListModal({ isOpen: false, list: null });

    // 6. Broadcast deletion to Nostr relays
    deleteListFromNostr(targetList);
  };

  const defaultWatchlistId = 'watchlist:default';

  const isInDefaultWatchlist = (itemId: string): boolean => {
    const defaultList = lists.find(x => x.id === defaultWatchlistId) || lists.find(x => x.type === 'watchlist');
    return defaultList ? defaultList.items.some(x => x.id === itemId) : false;
  };

  const isInDefaultWatched = (itemId: string): boolean => {
    const defaultWatched = lists.find(x => x.id === 'watched:default') || lists.find(x => x.type === 'watched');
    return defaultWatched ? defaultWatched.items.some(x => x.id === itemId) : false;
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

  return {
    lists,
    setLists,
    activeWatchlistId,
    setActiveWatchlistId,
    activeWatchedId,
    setActiveWatchedId,
    selectedListId,
    setSelectedListId,
    openWatchlist,
    closeWatchlist,
    watchedList,
    newListModal,
    setNewListModal,
    newListForm,
    setNewListForm,
    editListModal,
    setEditListModal,
    editListForm,
    setEditListForm,
    deleteListModal,
    setDeleteListModal,
    logModal,
    setLogModal,
    openEditListModal,
    saveEditList,
    confirmDeleteList,
    executeDeleteList,
    createNewList,
    isInDefaultWatchlist,
    isInDefaultWatched,
    toggleDefaultWatchlist,
    renderWatchlistRibbon,
    addToWatchlist,
    removeFromWatchlist,
    removeFromWatched,
    openLogWatchedModal,
    saveWatchedDetails,
    setTodayDate,
    syncFromNostr,
    publishListToNostr,
    deleteListFromNostr
  };
}
