import type { WatchedDateFilter, WatchedFiltersState } from '../types';
import { getDaysInMonth } from './dates';

export const DEFAULT_WATCHED_FILTERS: WatchedFiltersState = {
  showMovies: false,
  showTv: false,
  from: { year: '', month: '', day: '' },
  to: { year: '', month: '', day: '' },
  minRating: 1,
  maxRating: 10
};

/**
 * Resolves year, month, day filter into a normalized ISO YYYY-MM-DD boundary.
 */
export function resolveDateBounds(year: string, month: string, day: string, isEndBound: boolean): string {
  if (!year) return '';
  const y = year.padStart(4, '0');

  if (!month) {
    return isEndBound ? `${y}-12-31` : `${y}-01-01`;
  }
  const m = month.padStart(2, '0');

  if (!day) {
    if (isEndBound) {
      const days = getDaysInMonth(y, m);
      return `${y}-${m}-${String(days).padStart(2, '0')}`;
    }
    return `${y}-${m}-01`;
  }

  const d = day.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(): string {
  const d = new Date();
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Resolves an item's watchedDate string (YYYY, YYYY-MM, or YYYY-MM-DD) into its [startBound, endBound] interval.
 * Watched items cannot have occurred in the future, so the end bound is capped at today.
 */
export function resolveItemDateBounds(watchedDate?: string): [string, string] | null {
  if (!watchedDate || !watchedDate.trim()) return null;
  const parts = watchedDate.trim().split('-');
  const y = parts[0];
  if (!y || y.length !== 4) return null;

  const m = parts[1] || '';
  const d = parts[2] || '';

  const start = resolveDateBounds(y, m, d, false);
  const rawEnd = resolveDateBounds(y, m, d, true);
  const todayISO = getTodayISO();
  const end = rawEnd > todayISO ? todayISO : rawEnd;
  return [start, end];
}

/**
 * Checks whether an item's watchedDate is strictly contained within the filter interval.
 * Strict/conservative inclusion: only items whose entire date precision interval is
 * guaranteed to be within the filter boundaries are included.
 * If date filter is active and item lacks a valid watchedDate, returns false.
 * If the To (max) boundary is not chosen, it defaults to today.
 */
export function matchesDateRange(
  itemWatchedDate: string | undefined,
  fromFilter: WatchedDateFilter,
  toFilter: WatchedDateFilter
): boolean {
  const isFromSet = Boolean(fromFilter.year);
  const isToSet = Boolean(toFilter.year);

  // If no date boundaries set, all items pass
  if (!isFromSet && !isToSet) return true;

  // Date filter is active: items without date are excluded
  if (!itemWatchedDate) return false;

  const bounds = resolveItemDateBounds(itemWatchedDate);
  if (!bounds) return false;
  const [itemStart, itemEnd] = bounds;

  const todayISO = getTodayISO();

  if (isFromSet) {
    const fromBound = resolveDateBounds(fromFilter.year, fromFilter.month, fromFilter.day, false);
    if (fromBound && itemStart < fromBound) {
      return false;
    }
  }

  // If To is set, use resolved bound (capped at today); otherwise default max date is today
  const rawToBound = isToSet
    ? resolveDateBounds(toFilter.year, toFilter.month, toFilter.day, true)
    : todayISO;
  const toBound = rawToBound > todayISO ? todayISO : rawToBound;

  if (toBound && itemEnd > toBound) {
    return false;
  }

  return true;
}

export function isDateFilterActive(from: WatchedDateFilter, to: WatchedDateFilter): boolean {
  return Boolean(from.year || to.year);
}

export function isRatingFilterActive(minRating: number, maxRating: number): boolean {
  return minRating > 1 || maxRating < 10;
}

export function matchesRatingRange(
  itemRating: number | undefined,
  minRating: number,
  maxRating: number
): boolean {
  if (!isRatingFilterActive(minRating, maxRating)) return true;
  if (itemRating === undefined || isNaN(itemRating)) return false;
  return itemRating >= minRating && itemRating <= maxRating;
}

export function isTypeFilterActive(showMovies: boolean, showTv: boolean): boolean {
  return (showMovies && !showTv) || (!showMovies && showTv);
}

export function matchesType(itemType: 'movie' | 'tv', showMovies: boolean, showTv: boolean): boolean {
  if (showMovies && !showTv) return itemType === 'movie';
  if (!showMovies && showTv) return itemType === 'tv';
  return true; // both unselected or both selected acts as "all types"
}

export function isWatchedFilterActive(filters: WatchedFiltersState): boolean {
  return (
    isTypeFilterActive(filters.showMovies, filters.showTv) ||
    isDateFilterActive(filters.from, filters.to) ||
    isRatingFilterActive(filters.minRating, filters.maxRating)
  );
}

export function getActiveFilterCount(filters: WatchedFiltersState): number {
  let count = 0;
  if (isTypeFilterActive(filters.showMovies, filters.showTv)) count++;
  if (isDateFilterActive(filters.from, filters.to)) count++;
  if (isRatingFilterActive(filters.minRating, filters.maxRating)) count++;
  return count;
}
