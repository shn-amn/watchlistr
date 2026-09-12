import type { RatingEmojiInfo } from '../types';

export const DEFAULT_RELAYS: string[] = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social'
];

export const DECAY_BONUS = 2.1;
export const HALF_LIFE_DAYS = 90;

// 1-10 Rating Scale Emojis & Labels
export const RATING_EMOJIS: Record<number, RatingEmojiInfo> = {
  1: { emoji: '🤮', label: 'Vomiting' },
  2: { emoji: '🤢', label: 'Nauseous' },
  3: { emoji: '🥱', label: 'Boring' },
  4: { emoji: '🙄', label: 'Meh' },
  5: { emoji: '🙂', label: 'Slight Smile' },
  6: { emoji: '😊', label: 'Warm Smile' },
  7: { emoji: '😃', label: 'Good' },
  8: { emoji: '😍', label: 'Heart Eyes' },
  9: { emoji: '🤩', label: 'Star-struck' },
  10: { emoji: '🤯', label: 'Mind Blown' },
};
