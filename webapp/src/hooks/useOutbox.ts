import { useState, useEffect, useCallback, useMemo } from 'react';
import type { OutboxAction } from '../types';

const OUTBOX_STORAGE_KEY = 'watchlistr_outbox';

export function useOutbox() {
  const [outbox, setOutbox] = useState<OutboxAction[]>(() => {
    try {
      const stored = localStorage.getItem(OUTBOX_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load outbox from localStorage:", e);
      return [];
    }
  });

  // Sync to localStorage whenever outbox updates
  useEffect(() => {
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(outbox));
    } catch (e) {
      console.error("Failed to persist outbox to localStorage:", e);
    }
  }, [outbox]);

  const enqueueAction = useCallback((actionData: Omit<OutboxAction, 'id' | 'timestamp'>): OutboxAction => {
    const id = `outbox-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const newAction: OutboxAction = { ...actionData, id, timestamp };

    setOutbox(prev => {
      // Coalescing logic:
      if (newAction.action === 'update') {
        const existingIdx = prev.findIndex(a => a.entityId === newAction.entityId);
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const updated: OutboxAction = {
            ...existing,
            payload: newAction.payload,
            timestamp: newAction.timestamp
            // preserve original previousSnapshot
          };
          const next = [...prev];
          next[existingIdx] = updated;
          return next;
        }
      } else if (newAction.action === 'delete') {
        const existingIdx = prev.findIndex(a => a.entityId === newAction.entityId);
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          // If the list was created offline and deleted before ever syncing to Nostr,
          // simply drop both actions!
          if (existing.action === 'create') {
            return prev.filter((_, idx) => idx !== existingIdx);
          }
          // Otherwise replace with the delete action
          const next = [...prev];
          next[existingIdx] = newAction;
          return next;
        }
      }

      return [...prev, newAction];
    });

    return newAction;
  }, []);

  const removeAction = useCallback((actionId: string) => {
    setOutbox(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const clearOutbox = useCallback(() => {
    setOutbox([]);
  }, []);

  const pendingEntityIds = useMemo(() => {
    return new Set(outbox.map(a => a.entityId));
  }, [outbox]);

  const isEntityPending = useCallback((entityId: string) => {
    return pendingEntityIds.has(entityId);
  }, [pendingEntityIds]);

  return {
    outbox,
    setOutbox,
    enqueueAction,
    removeAction,
    clearOutbox,
    pendingEntityIds,
    isEntityPending
  };
}
