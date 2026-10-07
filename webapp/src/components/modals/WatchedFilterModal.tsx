import React, { useState } from 'react';
import { Film, Tv, Filter, X, RotateCcw, Calendar } from 'lucide-react';
import type { Media, WatchedFiltersState } from '../../types';
import {
  formatDateRangeSummary,
  formatSingleDateFilter,
  getRatingEmoji
} from '../../utils';
import {
  DEFAULT_WATCHED_FILTERS,
  isWatchedFilterActive,
  getActiveFilterCount,
  isDateFilterActive
} from '../../utils/filter';
import { FlexibleCalendar, type DatePrecisionValue } from '../common/FlexibleCalendar';

export interface WatchedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: WatchedFiltersState;
  onChangeFilters: (next: WatchedFiltersState) => void;
  movieCount: number;
  tvCount: number;
  totalCount: number;
  matchedCount: number;
  items?: Media[];
}

export const WatchedFilterModal: React.FC<WatchedFilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  movieCount,
  tvCount,
  totalCount,
  matchedCount,
  items
}) => {
  const [activeBoundary, setActiveBoundary] = useState<'from' | 'to' | null>(null);

  // Reset calendar expansion when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setActiveBoundary(null);
    }
  }, [isOpen]);

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const lastYear = String(now.getFullYear() - 1);
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  // Compute earliest registered watchedDate in current list items
  const minDateFromList = React.useMemo<DatePrecisionValue | undefined>(() => {
    if (!items || items.length === 0) return undefined;
    const dates = items
      .map((item) => item.watchedDate)
      .filter((d): d is string => Boolean(d && /^\d{4}/.test(d.trim())))
      .sort();
    if (dates.length === 0) return undefined;
    const earliest = dates[0].trim();
    const parts = earliest.split('-');
    return {
      year: parts[0] || '',
      month: parts[1] || '',
      day: parts[2] || ''
    };
  }, [items]);

  // Max date is today
  const todayMaxDate = React.useMemo<DatePrecisionValue>(() => {
    const d = new Date();
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0')
    };
  }, []);

  // Compute effective boundaries for active calendar tab
  const effectiveMinDate = activeBoundary === 'from'
    ? minDateFromList
    : (filters.from.year ? filters.from : minDateFromList);

  const effectiveMaxDate = activeBoundary === 'from'
    ? (filters.to.year ? filters.to : todayMaxDate)
    : todayMaxDate;

  if (!isOpen) return null;

  const activeCount = getActiveFilterCount(filters);
  const isAnyFilterActive = isWatchedFilterActive(filters);
  const isDateActive = isDateFilterActive(filters.from, filters.to);

  // Preset Handlers
  const handleClearAllDate = () => {
    setActiveBoundary(null);
    onChangeFilters({
      ...filters,
      from: { year: '', month: '', day: '' },
      to: { year: '', month: '', day: '' }
    });
  };

  const handlePresetThisYear = () => {
    setActiveBoundary(null);
    onChangeFilters({
      ...filters,
      from: { year: currentYear, month: '', day: '' },
      to: { year: currentYear, month: '', day: '' }
    });
  };

  const handlePresetLastYear = () => {
    setActiveBoundary(null);
    onChangeFilters({
      ...filters,
      from: { year: lastYear, month: '', day: '' },
      to: { year: lastYear, month: '', day: '' }
    });
  };

  const handlePresetThisMonth = () => {
    setActiveBoundary(null);
    onChangeFilters({
      ...filters,
      from: { year: currentYear, month: currentMonth, day: '' },
      to: { year: currentYear, month: currentMonth, day: '' }
    });
  };

  const handleResetAll = () => {
    setActiveBoundary(null);
    onChangeFilters(DEFAULT_WATCHED_FILTERS);
  };

  const handleMinRatingChange = (val: number) => {
    const safeVal = Math.min(val, filters.maxRating);
    onChangeFilters({
      ...filters,
      minRating: safeVal
    });
  };

  const handleMaxRatingChange = (val: number) => {
    const safeVal = Math.max(val, filters.minRating);
    onChangeFilters({
      ...filters,
      maxRating: safeVal
    });
  };

  const handleCalendarChange = (val: DatePrecisionValue) => {
    if (activeBoundary === 'from') {
      onChangeFilters({
        ...filters,
        from: {
          year: val.year || '',
          month: val.month || '',
          day: val.day || ''
        }
      });
    } else if (activeBoundary === 'to') {
      onChangeFilters({
        ...filters,
        to: {
          year: val.year || '',
          month: val.month || '',
          day: val.day || ''
        }
      });
    }
  };

  // Active preset checks
  const isThisYearActive =
    filters.from.year === currentYear &&
    filters.to.year === currentYear &&
    !filters.from.month &&
    !filters.to.month;

  const isLastYearActive =
    filters.from.year === lastYear &&
    filters.to.year === lastYear &&
    !filters.from.month &&
    !filters.to.month;

  const isThisMonthActive =
    filters.from.year === currentYear &&
    filters.to.year === currentYear &&
    filters.from.month === currentMonth &&
    filters.to.month === currentMonth &&
    !filters.from.day &&
    !filters.to.day;

  // Percentage positions for dual slider track
  const minPercent = ((filters.minRating - 1) / 9) * 100;
  const maxPercent = ((filters.maxRating - 1) / 9) * 100;

  const dateSummary = formatDateRangeSummary(filters.from, filters.to);
  const fromSummary = formatSingleDateFilter(filters.from) || 'Any start date';
  const toSummary = formatSingleDateFilter(filters.to) || 'Today';

  const activeValue = activeBoundary === 'from' ? filters.from : filters.to;

  return (
    <div className="filter-popover-backdrop" onClick={onClose}>
      <div className="filter-popover-menu" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="filter-modal-header">
          <div className="filter-modal-title">
            <Filter size={15} className="filter-title-icon" />
            <span>Filter List</span>
            {activeCount > 0 && (
              <span className="filter-badge-count">{activeCount} active</span>
            )}
          </div>
          <div className="filter-header-actions">
            {isAnyFilterActive && (
              <button
                type="button"
                className="filter-btn-reset"
                onClick={handleResetAll}
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset All</span>
              </button>
            )}
            <button
              type="button"
              className="filter-btn-close"
              onClick={onClose}
              title="Close filter menu"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="filter-modal-body">
          {/* 1. Media Type */}
          <div className="filter-row">
            <div className="filter-row-label">Media Type</div>
            <div className="filter-type-chips">
              <button
                type="button"
                className={`filter-chip ${filters.showMovies ? 'active' : ''}`}
                onClick={() => onChangeFilters({ ...filters, showMovies: !filters.showMovies })}
              >
                <Film size={12} />
                <span>Movies</span>
                <span className="filter-chip-count">{movieCount}</span>
              </button>
              <button
                type="button"
                className={`filter-chip ${filters.showTv ? 'active' : ''}`}
                onClick={() => onChangeFilters({ ...filters, showTv: !filters.showTv })}
              >
                <Tv size={12} />
                <span>TV Shows</span>
                <span className="filter-chip-count">{tvCount}</span>
              </button>
            </div>
          </div>

          {/* 2. Date Watched Range with Visual Flexible Calendar */}
          <div className="filter-row">
            <div className="filter-row-header-inline">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} style={{ color: 'var(--accent-color)' }} />
                <span className="filter-row-label" style={{ margin: 0 }}>Date Watched</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isDateActive ? (
                  <span className="filter-range-summary-badge" title="Active Date Range">
                    {dateSummary}
                  </span>
                ) : (
                  <span className="filter-range-summary-dim">All Time</span>
                )}
                {isDateActive && (
                  <button
                    type="button"
                    className="filter-btn-subreset"
                    onClick={handleClearAllDate}
                    title="Clear date range"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="filter-presets-scroll">
              <button
                type="button"
                className={`filter-preset-pill ${!isDateActive ? 'active' : ''}`}
                onClick={handleClearAllDate}
              >
                All Time
              </button>
              <button
                type="button"
                className={`filter-preset-pill ${isThisYearActive ? 'active' : ''}`}
                onClick={handlePresetThisYear}
              >
                This Year
              </button>
              <button
                type="button"
                className={`filter-preset-pill ${isLastYearActive ? 'active' : ''}`}
                onClick={handlePresetLastYear}
              >
                Last Year
              </button>
              <button
                type="button"
                className={`filter-preset-pill ${isThisMonthActive ? 'active' : ''}`}
                onClick={handlePresetThisMonth}
              >
                This Month
              </button>
            </div>

            {/* From / To Boundary Selector Tabs */}
            <div className="filter-date-boundary-tabs">
              <button
                type="button"
                className={`filter-date-tab-btn ${activeBoundary === 'from' ? 'active' : ''}`}
                onClick={() => setActiveBoundary(prev => prev === 'from' ? null : 'from')}
                title={activeBoundary === 'from' ? 'Click to collapse calendar' : 'Click to pick start date'}
              >
                <span className="tab-prefix">From:</span>
                <span className="tab-val">{fromSummary}</span>
                {Boolean(filters.from.year) && (
                  <span
                    className="filter-date-tab-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeFilters({
                        ...filters,
                        from: { year: '', month: '', day: '' }
                      });
                    }}
                    title="Clear start date"
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`filter-date-tab-btn ${activeBoundary === 'to' ? 'active' : ''}`}
                onClick={() => setActiveBoundary(prev => prev === 'to' ? null : 'to')}
                title={activeBoundary === 'to' ? 'Click to collapse calendar' : 'Click to pick end date'}
              >
                <span className="tab-prefix">To:</span>
                <span className="tab-val">{toSummary}</span>
                {Boolean(filters.to.year) && (
                  <span
                    className="filter-date-tab-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeFilters({
                        ...filters,
                        to: { year: '', month: '', day: '' }
                      });
                    }}
                    title="Clear end date"
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
            </div>

            {/* Interactive Visual Calendar (Expanded when From or To is selected) */}
            {activeBoundary !== null && (
              <FlexibleCalendar
                value={activeValue}
                onChange={handleCalendarChange}
                minDate={effectiveMinDate}
                maxDate={effectiveMaxDate}
              />
            )}
          </div>

          {/* 3. Rating Range Dual Slider */}
          <div className="filter-row">
            <div className="filter-row-header-inline">
              <div className="filter-row-label">Rating Range</div>
              <div className="filter-rating-value-badge">
                {filters.minRating === 1 && filters.maxRating === 10 ? (
                  <span className="rating-badge-dim">All Ratings (1 – 10)</span>
                ) : (
                  <span className="rating-badge-highlight">
                    {filters.minRating}★ to {filters.maxRating}★ {getRatingEmoji(filters.maxRating)}
                  </span>
                )}
              </div>
            </div>

            <div className="dual-slider-container">
              {/* Visual Track */}
              <div className="dual-slider-track-bg" />
              <div
                className="dual-slider-track-active"
                style={{
                  left: `${minPercent}%`,
                  width: `${maxPercent - minPercent}%`
                }}
              />

              {/* Min Input Slider */}
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={filters.minRating}
                onChange={(e) => handleMinRatingChange(parseInt(e.target.value, 10))}
                className="dual-slider-thumb thumb-left"
                aria-label="Minimum rating"
              />

              {/* Max Input Slider */}
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={filters.maxRating}
                onChange={(e) => handleMaxRatingChange(parseInt(e.target.value, 10))}
                className="dual-slider-thumb thumb-right"
                aria-label="Maximum rating"
              />
            </div>

            {/* Slider Scale Ticks */}
            <div className="dual-slider-ticks">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <span
                  key={num}
                  className={`dual-slider-tick ${
                    num >= filters.minRating && num <= filters.maxRating ? 'active' : ''
                  }`}
                  onClick={() => {
                    if (num < filters.minRating) handleMinRatingChange(num);
                    else if (num > filters.maxRating) handleMaxRatingChange(num);
                  }}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="filter-modal-footer">
          <div className="filter-matched-text">
            Showing <strong>{matchedCount}</strong> of <strong>{totalCount}</strong> items
          </div>
          <button
            type="button"
            className="btn btn-primary btn-filter-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};


