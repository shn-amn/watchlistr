import type { Media } from '../types';
import { DECAY_BONUS, HALF_LIFE_DAYS } from '../constants';

/**
 * Calculates the age in days for a watchedDate string, with intelligent midpoint estimation
 * for incomplete dates (e.g. YYYY or YYYY-MM) relative to the current date.
 * Returns null if no valid watch date is provided (so no bonus is applied).
 */
export const parseWatchedDateToDaysAge = (dateStr: string | undefined, now: Date = new Date()): number | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.trim().split('-').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return null;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const year = parts[0];
  const month = parts[1]; // undefined if only YYYY
  const day = parts[2];   // undefined if YYYY or YYYY-MM

  if (!month) {
    // Only Year provided (YYYY)
    if (year === currentYear) {
      // In current year: midpoint between Jan 1 and now
      const startOfYear = new Date(currentYear, 0, 1).getTime();
      const midTime = (startOfYear + now.getTime()) / 2;
      const ageMs = now.getTime() - midTime;
      return Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    } else if (year > currentYear) {
      return 0; // Future year, treat as today
    } else {
      // Past year: midpoint is mid-year (July 2, noon)
      const midYear = new Date(year, 6, 2, 12, 0, 0).getTime();
      const ageMs = now.getTime() - midYear;
      return Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    }
  }

  if (!day) {
    // Year and Month provided (YYYY-MM)
    if (year === currentYear && month === currentMonth) {
      // In current month: midpoint between start of month and now
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1).getTime();
      const midTime = (startOfMonth + now.getTime()) / 2;
      const ageMs = now.getTime() - midTime;
      return Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    } else if (year > currentYear || (year === currentYear && month > currentMonth)) {
      return 0; // Future month, treat as today
    } else {
      // Past month: midpoint of that month
      const daysInMonth = new Date(year, month, 0).getDate();
      const midMonth = new Date(year, month - 1, Math.round(daysInMonth / 2), 12, 0, 0).getTime();
      const ageMs = now.getTime() - midMonth;
      return Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    }
  }

  // Full YYYY-MM-DD
  const targetDate = new Date(year, month - 1, day, 12, 0, 0).getTime();
  if (isNaN(targetDate)) return null;
  const ageMs = now.getTime() - targetDate;
  return Math.max(0, ageMs / (1000 * 60 * 60 * 24));
};

/**
 * Calculates decay score: score = rating + bonus * 2 ^ -(age / 90)
 * Unrated items use rating = 0.
 * If no watch date is available, bonus is 0.
 */
export const calculateMediaScore = (item: Media, now: Date = new Date()): number => {
  const rating = item.userRating !== undefined ? item.userRating : 0;
  const ageInDays = parseWatchedDateToDaysAge(item.watchedDate, now);
  if (ageInDays === null) {
    return rating;
  }
  const bonus = DECAY_BONUS * Math.pow(2, -(ageInDays / HALF_LIFE_DAYS));
  return rating + bonus;
};

/**
 * Sorts watched list items by the decaying score formula, with consistent tie-breakers.
 */
export const sortWatchedItemsByDefaultScore = (items: Media[]): Media[] => {
  const now = new Date();
  return [...items].sort((a, b) => {
    const scoreA = calculateMediaScore(a, now);
    const scoreB = calculateMediaScore(b, now);
    if (Math.abs(scoreB - scoreA) > 0.0001) return scoreB - scoreA;

    // Tie-breaker 1: raw user rating
    const ratingA = a.userRating !== undefined ? a.userRating : 0;
    const ratingB = b.userRating !== undefined ? b.userRating : 0;
    if (ratingB !== ratingA) return ratingB - ratingA;

    // Tie-breaker 2: recency of watched date
    const dateA = a.watchedDate || '';
    const dateB = b.watchedDate || '';
    if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // Tie-breaker 3: title alphabetical
    return a.title.localeCompare(b.title);
  });
};
