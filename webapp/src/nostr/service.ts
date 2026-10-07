import type { NostrEvent } from './types';

export class NostrService {
  private relays: Map<string, WebSocket> = new Map();
  private profileRelays: Map<string, WebSocket> = new Map();
  private relayStatuses: Record<string, boolean> = {};
  private onStatusChangeCallback?: (status: Record<string, boolean>) => void;

  constructor(
    defaultRelays: string[],
    profileRelays: string[],
    onStatusChange?: (status: Record<string, boolean>) => void
  ) {
    this.onStatusChangeCallback = onStatusChange;
    defaultRelays.forEach(url => this.connectRelay(url));
    profileRelays
      .filter((url) => !defaultRelays.includes(url))
      .forEach(url => this.connectRelay(url, true));
  }

  // Update status callback
  public setStatusCallback(callback: (status: Record<string, boolean>) => void) {
    this.onStatusChangeCallback = callback;
    callback({ ...this.relayStatuses });
  }

  public connectRelays(callback?: (statuses: Record<string, boolean>) => void) {
    if (callback) {
      this.setStatusCallback(callback);
    }
  }

  public close() {
    Array.from(this.profileRelays.keys()).forEach(url => this.disconnectRelay(url));
    Array.from(this.relays.keys()).forEach(url => this.disconnectRelay(url));
  }

  // Connect to a single Nostr relay
  public connectRelay(url: string, profileOnly: boolean = false) {
    if (this.relays.has(url)) return;
    if (profileOnly && this.profileRelays.has(url)) return;

    try {
      const ws = new WebSocket(url);
      if (profileOnly) this.profileRelays.set(url, ws);
      else this.relays.set(url, ws);
      this.relayStatuses[url] = false;
      this.triggerStatusChange();

      ws.onopen = () => {
        this.relayStatuses[url] = true;
        this.triggerStatusChange();
        console.log(`Connected to Nostr relay: ${url}`);
      };

      ws.onclose = () => {
        this.relayStatuses[url] = false;
        this.triggerStatusChange();
        console.log(`Disconnected from Nostr relay: ${url}`);
        // Attempt reconnect after 5 seconds
        setTimeout(() => {
          if (profileOnly) this.profileRelays.delete(url);
          else this.relays.delete(url);
          this.connectRelay(url, profileOnly);
        }, 5000);
      };

      ws.onerror = (err) => {
        console.error(`Relay connection error on ${url}:`, err);
        this.relayStatuses[url] = false;
        this.triggerStatusChange();
      };
    } catch (e) {
      console.error(`Failed to initialize WebSocket for ${url}:`, e);
    }
  }

  // Disconnect from a relay and clean up
  public disconnectRelay(url: string) {
    const ws = this.relays.get(url) ?? this.profileRelays.get(url);
    if (ws) {
      ws.close();
      this.relays.delete(url);
      delete this.relayStatuses[url];
      this.triggerStatusChange();
    }
  }

  public getConnectedRelays(): string[] {
    return [...new Set([...this.relays.keys(), ...this.profileRelays.keys()])]
  }

  public getRelayStatuses(): Record<string, boolean> {
    return { ...this.relayStatuses };
  }

  private triggerStatusChange() {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback({ ...this.relayStatuses });
    }
  }

  /**
   * Shared relay query engine.
   *
   * Waits briefly for sockets to open, subscribes to every connected relay with
   * the given filter, and resolves once each relay has sent EOSE or the timeout
   * elapses. Returns the raw events gathered from all relays, or `null` when no
   * relay was reachable so callers can distinguish "offline" from "no results".
   */
  private async queryRelays(
    filter: Record<string, any>,
    opts: { timeoutMs?: number; includeProfileRelays?: boolean; subPrefix?: string } = {}
  ): Promise<NostrEvent[] | null> {
    const { timeoutMs = 3000, includeProfileRelays = false, subPrefix = 'sub' } = opts;

    const getOpenSockets = (): Array<[string, WebSocket]> => {
      const pool = includeProfileRelays
        ? new Map([...this.relays, ...this.profileRelays])
        : new Map(this.relays);
      return Array.from(pool.entries()).filter(([, ws]) => ws.readyState === WebSocket.OPEN);
    };

    // Wait up to 3 seconds for sockets to connect if none are open yet
    let activeWebSockets = getOpenSockets();
    if (activeWebSockets.length === 0) {
      await new Promise<void>((resolve) => {
        let checkCount = 0;
        const interval = setInterval(() => {
          checkCount++;
          if (getOpenSockets().length > 0 || checkCount >= 15) {
            clearInterval(interval);
            resolve();
          }
        }, 200);
      });
      activeWebSockets = getOpenSockets();
    }

    if (activeWebSockets.length === 0) {
      return null;
    }

    const subId = `${subPrefix}_${Math.random().toString(36).substring(2, 9)}`;
    const collected: NostrEvent[] = [];
    const promises: Promise<void>[] = [];

    activeWebSockets.forEach(([url, ws]) => {
      const promise = new Promise<void>((resolve) => {
        const handleMessage = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data[0] === 'EVENT' && data[1] === subId) {
              collected.push(data[2] as NostrEvent);
            } else if (data[0] === 'EOSE' && data[1] === subId) {
              cleanup();
              resolve();
            }
          } catch (err) {
            console.error(`Error parsing message from relay ${url}:`, err);
          }
        };

        const cleanup = () => {
          ws.removeEventListener('message', handleMessage);
        };

        ws.addEventListener('message', handleMessage);
        ws.send(JSON.stringify(['REQ', subId, filter]));

        setTimeout(() => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(['CLOSE', subId]));
            }
          } catch (e) { }
          cleanup();
          resolve();
        }, timeoutMs);
      });

      promises.push(promise);
    });

    await Promise.all(promises);
    return collected;
  }

  // Fetch all kind:30016 events for a pubkey
  public async fetchUserLists(pubkey: string, timeoutMs: number = 4000): Promise<NostrEvent[]> {
    const events = await this.queryRelays(
      { authors: [pubkey], kinds: [30016, 5] },
      { timeoutMs, subPrefix: 'sub_lists' }
    );
    if (!events) return [];

    const eventsMap: Map<string, NostrEvent> = new Map(); // d-tag -> Event
    const deletedDTags: Map<string, number> = new Map();
    const deletedEventIds: Set<string> = new Set();

    events.forEach(event => {
      if (event.kind === 5) {
        // NIP-09 deletion event
        event.tags.forEach(t => {
          if (t[0] === 'a') {
            const parts = t[1]?.split(':');
            if (parts && parts[0] === '30016' && parts[2]) {
              const d = parts[2];
              deletedDTags.set(d, Math.max(deletedDTags.get(d) || 0, event.created_at));
              const existing = eventsMap.get(d);
              if (existing && existing.created_at <= event.created_at) {
                eventsMap.delete(d);
              }
            }
          } else if (t[0] === 'e' && t[1]) {
            deletedEventIds.add(t[1]);
            for (const [d, existing] of eventsMap.entries()) {
              if (existing.id === t[1]) {
                eventsMap.delete(d);
              }
            }
          } else if (t[0] === 'd' && t[1]) {
            deletedDTags.set(t[1], Math.max(deletedDTags.get(t[1]) || 0, event.created_at));
            const existing = eventsMap.get(t[1]);
            if (existing && existing.created_at <= event.created_at) {
              eventsMap.delete(t[1]);
            }
          }
        });
      } else if (event.kind === 30016) {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        const isTombstone = event.tags.some(t => t[0] === 'deleted' && t[1] === 'true');
        if (dTag && !isTombstone) {
          const isDeletedById = Boolean(event.id && deletedEventIds.has(event.id));
          const isDeletedByDTag = (deletedDTags.get(dTag) || 0) >= event.created_at;
          if (!isDeletedById && !isDeletedByDTag) {
            const existing = eventsMap.get(dTag);
            // Keep the newer event (replaceable event rule)
            if (!existing || event.created_at > existing.created_at) {
              eventsMap.set(dTag, event);
            }
          }
        }
      }
    });

    // Final filter to ensure no deleted or tombstoned events slip through
    return Array.from(eventsMap.values()).filter(ev => {
      if (ev.id && deletedEventIds.has(ev.id)) return false;
      const d = ev.tags.find(t => t[0] === 'd')?.[1];
      if (d && (deletedDTags.get(d) || 0) >= ev.created_at) return false;
      if (ev.tags.some(t => t[0] === 'deleted' && t[1] === 'true')) return false;
      return true;
    });
  }

  // Fetch kind:0 metadata profile for a pubkey
  public async fetchUserProfile(pubkey: string, timeoutMs: number = 3000): Promise<NostrEvent | null> {
    const events = await this.queryRelays(
      { authors: [pubkey], kinds: [0], limit: 1 },
      { timeoutMs, includeProfileRelays: true, subPrefix: 'sub_profile' }
    );
    if (!events) return null;

    let newestEvent: NostrEvent | null = null;
    events.forEach(event => {
      if (!newestEvent || event.created_at > newestEvent.created_at) {
        newestEvent = event;
      }
    });
    return newestEvent;
  }

  // Fetch kind:10016 follow list for a pubkey
  public async fetchUserFollows(pubkey: string, timeoutMs: number = 3000): Promise<string[]> {
    const events = await this.queryRelays(
      { authors: [pubkey], kinds: [10016], limit: 1 },
      { timeoutMs, subPrefix: 'sub_follows' }
    );
    if (!events) return [];

    let newestEvent: NostrEvent | null = null;
    events.forEach(event => {
      if (!newestEvent || event.created_at > newestEvent.created_at) {
        newestEvent = event;
      }
    });

    if (!newestEvent) return [];
    return (newestEvent as NostrEvent).tags
      .filter(t => t[0] === 'p' && t[1])
      .map(t => t[1]);
  }

  // Fetch kind:30007 block/mute list for a pubkey
  public async fetchUserBlocks(pubkey: string, timeoutMs: number = 3000): Promise<string[]> {
    const events = await this.queryRelays(
      { authors: [pubkey], kinds: [30007], "#d": ["30016", "mute"] },
      { timeoutMs, subPrefix: 'sub_blocks' }
    );
    if (!events || events.length === 0) return [];

    // Group kind:30007 events by d-tag, keeping the newest event (max created_at) per NIP-33/NIP-51
    const newestByDTag = new Map<string, NostrEvent>();
    events.forEach(event => {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';
      const existing = newestByDTag.get(dTag);
      if (!existing || event.created_at > existing.created_at) {
        newestByDTag.set(dTag, event);
      }
    });

    // If Watchlistr block list (d: "30016") exists, it is the authoritative blocklist
    let targetEvent = newestByDTag.get('30016');
    if (!targetEvent) {
      // Fallback to standard NIP-51 mute list if 30016 has not been created yet
      targetEvent = newestByDTag.get('mute');
    }

    if (!targetEvent) return [];

    const pSet = new Set<string>();
    targetEvent.tags.forEach(t => {
      if (t[0] === 'p' && t[1]) {
        pSet.add(t[1].toLowerCase().trim());
      }
    });
    return Array.from(pSet);
  }

  // Fetch kind:30016 lists for multiple followed pubkeys.
  // Returns null when no relay was reachable, so callers can distinguish
  // "no relay connection" from "these authors have no lists".
  public async fetchFollowedLists(pubkeys: string[], timeoutMs: number = 4000): Promise<NostrEvent[] | null> {
    if (pubkeys.length === 0) return [];

    const events = await this.queryRelays(
      { authors: pubkeys, kinds: [30016] },
      { timeoutMs, subPrefix: 'sub_ffollowed' }
    );
    if (!events) return null;

    const eventsMap: Map<string, NostrEvent> = new Map(); // pubkey:d-tag -> Event
    events.forEach(event => {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';
      const isTombstone = event.tags.some(t => t[0] === 'deleted' && t[1] === 'true');
      if (dTag && !isTombstone) {
        const key = `${event.pubkey}:${dTag}`;
        const existing = eventsMap.get(key);
        if (!existing || event.created_at > existing.created_at) {
          eventsMap.set(key, event);
        }
      }
    });

    return Array.from(eventsMap.values());
  }

  // Fetch global kind:30016 lists with pagination limit and optional until timestamp
  public async fetchExploreLists(limit: number = 20, until?: number, timeoutMs: number = 4000): Promise<NostrEvent[]> {
    const filter: Record<string, any> = { kinds: [30016], limit };
    if (until) {
      filter.until = until;
    }

    const events = await this.queryRelays(filter, { timeoutMs, subPrefix: 'sub_explore' });
    if (!events) return [];

    const eventsMap: Map<string, NostrEvent> = new Map();
    events.forEach(event => {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';
      const isTombstone = event.tags.some(t => t[0] === 'deleted' && t[1] === 'true');
      if (dTag && !isTombstone) {
        const key = `${event.pubkey}:${dTag}`;
        const existing = eventsMap.get(key);
        if (!existing || event.created_at > existing.created_at) {
          eventsMap.set(key, event);
        }
      }
    });

    return Array.from(eventsMap.values()).sort((a, b) => b.created_at - a.created_at);
  }

  // Publish a signed event to all active relays
  public async publishEvent(event: NostrEvent): Promise<boolean> {
    const activeWebSockets = Array.from(this.relays.values()).filter(
      ws => ws.readyState === WebSocket.OPEN
    );

    if (activeWebSockets.length === 0) {
      console.error("Cannot publish: no active relay connections.");
      return false;
    }

    const payload = JSON.stringify(['EVENT', event]);
    let successCount = 0;

    activeWebSockets.forEach(ws => {
      try {
        ws.send(payload);
        successCount++;
      } catch (err) {
        console.error("Failed to send event to relay WebSocket:", err);
      }
    });

    return successCount > 0;
  }
}
