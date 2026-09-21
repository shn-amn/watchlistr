export const getMonthName = (m: string): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m, 10) - 1;
  return months[idx] || m;
};

export const getDaysInMonth = (yearStr: string, monthStr: string): number => {
  if (!yearStr || !monthStr) return 31;
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  if (isNaN(y) || isNaN(m)) return 31;
  return new Date(y, m, 0).getDate();
};

export const getDayOptions = (yearStr: string, monthStr: string): { value: string; label: string }[] => {
  const daysCount = getDaysInMonth(yearStr, monthStr);
  const options: { value: string; label: string }[] = [];
  for (let i = 1; i <= daysCount; i++) {
    const val = i.toString().padStart(2, '0');
    options.push({ value: val, label: i.toString() });
  }
  return options;
};

export const getYearOptions = (selectedYear?: string): string[] => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear; y >= 1900; y--) {
    years.push(y.toString());
  }
  if (selectedYear && !years.includes(selectedYear) && !isNaN(parseInt(selectedYear, 10))) {
    years.unshift(selectedYear);
  }
  return years;
};

export const MONTH_OPTIONS: { value: string; label: string; fullLabel: string }[] = [
  { value: '01', label: 'Jan', fullLabel: 'Jan (01)' },
  { value: '02', label: 'Feb', fullLabel: 'Feb (02)' },
  { value: '03', label: 'Mar', fullLabel: 'Mar (03)' },
  { value: '04', label: 'Apr', fullLabel: 'Apr (04)' },
  { value: '05', label: 'May', fullLabel: 'May (05)' },
  { value: '06', label: 'Jun', fullLabel: 'Jun (06)' },
  { value: '07', label: 'Jul', fullLabel: 'Jul (07)' },
  { value: '08', label: 'Aug', fullLabel: 'Aug (08)' },
  { value: '09', label: 'Sep', fullLabel: 'Sep (09)' },
  { value: '10', label: 'Oct', fullLabel: 'Oct (10)' },
  { value: '11', label: 'Nov', fullLabel: 'Nov (11)' },
  { value: '12', label: 'Dec', fullLabel: 'Dec (12)' },
];

export const formatSingleDateFilter = (filter: { year?: string; month?: string; day?: string }): string => {
  if (!filter.year) return '';
  if (filter.month && filter.day) {
    return `${getMonthName(filter.month)} ${parseInt(filter.day, 10)}, ${filter.year}`;
  }
  if (filter.month) {
    return `${getMonthName(filter.month)} ${filter.year}`;
  }
  return filter.year;
};

export const formatDateRangeSummary = (
  from: { year?: string; month?: string; day?: string },
  to: { year?: string; month?: string; day?: string }
): string => {
  const fromStr = formatSingleDateFilter(from);
  const toStr = formatSingleDateFilter(to);

  if (!fromStr && !toStr) return 'All Time';
  if (fromStr && toStr && fromStr === toStr) return fromStr;
  if (fromStr && toStr) return `${fromStr} → ${toStr}`;
  if (fromStr) return `${fromStr} → Today`;
  if (toStr) return `Until ${toStr}`;
  return 'All Time';
};

export const formatCompactDateRangeSummary = (
  from: { year?: string; month?: string; day?: string },
  to: { year?: string; month?: string; day?: string }
): string => {
  const hasFromYear = Boolean(from.year);
  const hasToYear = Boolean(to.year);

  if (!hasFromYear && !hasToYear) return 'All Time';

  const shortYr = (yr?: string) => (yr && yr.length === 4 ? yr.slice(2) : yr || '');
  const padM = (m?: string) => (m ? m.padStart(2, '0') : '');

  // Case 1: Only "From" is specified (to is implicitly Today)
  if (hasFromYear && !hasToYear) {
    if (from.month) {
      return `≥ ${padM(from.month)}/${shortYr(from.year)}`;
    }
    return `≥ ${from.year}`;
  }

  // Case 2: Only "To" is specified
  if (!hasFromYear && hasToYear) {
    if (to.month) {
      return `≤ ${padM(to.month)}/${shortYr(to.year)}`;
    }
    return `≤ ${to.year}`;
  }

  // Case 3: Both "From" and "To" are specified
  const fromY = from.year!;
  const toY = to.year!;

  // 3a. Same Year
  if (fromY === toY) {
    // Both full year without month
    if (!from.month && !to.month) {
      return fromY;
    }
    // Full year Jan to Dec
    if (from.month === '01' && to.month === '12') {
      return fromY;
    }
    // Same Month (e.g. 03/26)
    if (from.month && to.month && from.month === to.month) {
      return `${padM(from.month)}/${shortYr(fromY)}`;
    }
    // Different Months in same year (e.g. 01-03/26)
    if (from.month && to.month) {
      return `${padM(from.month)}-${padM(to.month)}/${shortYr(fromY)}`;
    }
    if (from.month) {
      return `${padM(from.month)}-12/${shortYr(fromY)}`;
    }
    if (to.month) {
      return `01-${padM(to.month)}/${shortYr(fromY)}`;
    }
    return fromY;
  }

  // 3b. Different Years (e.g. 09/24-03/26 or 2024-2026)
  if (from.month && to.month) {
    return `${padM(from.month)}/${shortYr(fromY)}-${padM(to.month)}/${shortYr(toY)}`;
  }
  if (from.month && !to.month) {
    return `${padM(from.month)}/${shortYr(fromY)}-${shortYr(toY)}`;
  }
  if (!from.month && to.month) {
    return `${shortYr(fromY)}-${padM(to.month)}/${shortYr(toY)}`;
  }

  return `${fromY}-${toY}`;
};

export const formatCompactRatingRange = (minRating: number, maxRating: number): string => {
  if (minRating <= 1 && maxRating >= 10) return '';
  if (minRating > 1 && maxRating >= 10) return `≥ ${minRating}★`;
  if (minRating <= 1 && maxRating < 10) return `≤ ${maxRating}★`;
  if (minRating === maxRating) return `${minRating}★`;
  return `${minRating}–${maxRating}★`;
};

export interface PrecisionDateObject {
  year?: string;
  month?: string;
  day?: string;
}

export const isDateAfterMax = (
  date: PrecisionDateObject,
  maxDate?: PrecisionDateObject
): boolean => {
  if (!maxDate || !maxDate.year) return false;
  const y = date.year ? date.year.padStart(4, '0') : '';
  const m = date.month ? date.month.padStart(2, '0') : '';
  const d = date.day ? date.day.padStart(2, '0') : '';

  const maxY = maxDate.year.padStart(4, '0');
  const maxM = maxDate.month ? maxDate.month.padStart(2, '0') : '';
  const maxD = maxDate.day ? maxDate.day.padStart(2, '0') : '';

  if (!y) return false;
  if (y > maxY) return true;
  if (y < maxY) return false;

  if (m && maxM) {
    if (m > maxM) return true;
    if (m < maxM) return false;

    if (d && maxD) {
      return d > maxD;
    }
  }

  return false;
};

export const isDateBeforeMin = (
  date: PrecisionDateObject,
  minDate?: PrecisionDateObject
): boolean => {
  if (!minDate || !minDate.year) return false;
  const y = date.year ? date.year.padStart(4, '0') : '';
  const m = date.month ? date.month.padStart(2, '0') : '';
  const d = date.day ? date.day.padStart(2, '0') : '';

  const minY = minDate.year.padStart(4, '0');
  const minM = minDate.month ? minDate.month.padStart(2, '0') : '';
  const minD = minDate.day ? minDate.day.padStart(2, '0') : '';

  if (!y) return false;
  if (y < minY) return true;
  if (y > minY) return false;

  if (m && minM) {
    if (m < minM) return true;
    if (m > minM) return false;

    if (d && minD) {
      return d < minD;
    }
  }

  return false;
};


