import React from 'react';
import { Film, Tv, Filter, X, RotateCcw } from 'lucide-react';
import type { WatchedFiltersState } from '../../types';
import { getDayOptions, getRatingEmoji, getYearOptions } from '../../utils';
import { DEFAULT_WATCHED_FILTERS, isWatchedFilterActive, getActiveFilterCount } from '../../utils/filter';

export interface WatchedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: WatchedFiltersState;
  onChangeFilters: (next: WatchedFiltersState) => void;
  movieCount: number;
  tvCount: number;
  totalCount: number;
  matchedCount: number;
}

export const WatchedFilterModal: React.FC<WatchedFilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  movieCount,
  tvCount,
  totalCount,
  matchedCount
}) => {
  if (!isOpen) return null;

  const activeCount = getActiveFilterCount(filters);
  const isAnyFilterActive = isWatchedFilterActive(filters);

  const handleResetAll = () => {
    onChangeFilters(DEFAULT_WATCHED_FILTERS);
  };

  const handleSetTodayForTo = () => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    onChangeFilters({
      ...filters,
      to: { year: y, month: m, day: d }
    });
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

  // Compute percentage positions for active dual slider track
  const minPercent = ((filters.minRating - 1) / 9) * 100;
  const maxPercent = ((filters.maxRating - 1) / 9) * 100;

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

          {/* 2. Date Watched Range */}
          <div className="filter-row">
            <div className="filter-row-header-inline">
              <div className="filter-row-label">Date Watched Range</div>
              {(filters.from.year || filters.to.year) && (
                <button
                  type="button"
                  className="filter-btn-subreset"
                  onClick={() => onChangeFilters({
                    ...filters,
                    from: { year: '', month: '', day: '' },
                    to: { year: '', month: '', day: '' }
                  })}
                >
                  Clear dates
                </button>
              )}
            </div>

            {/* From Date */}
            <div className="filter-date-row">
              <span className="filter-date-prefix">From</span>
              <div className="filter-date-selects">
                <select
                  className="input-field select-field filter-date-select"
                  value={filters.from.year}
                  onChange={(e) => onChangeFilters({
                    ...filters,
                    from: { ...filters.from, year: e.target.value, month: '', day: '' }
                  })}
                >
                  <option value="">Year...</option>
                  {getYearOptions(filters.from.year).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <select
                  className="input-field select-field filter-date-select"
                  value={filters.from.month}
                  disabled={!filters.from.year}
                  onChange={(e) => onChangeFilters({
                    ...filters,
                    from: { ...filters.from, month: e.target.value, day: '' }
                  })}
                >
                  <option value="">Month...</option>
                  <option value="01">Jan</option>
                  <option value="02">Feb</option>
                  <option value="03">Mar</option>
                  <option value="04">Apr</option>
                  <option value="05">May</option>
                  <option value="06">Jun</option>
                  <option value="07">Jul</option>
                  <option value="08">Aug</option>
                  <option value="09">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dec</option>
                </select>

                <select
                  className="input-field select-field filter-date-select"
                  value={filters.from.day}
                  disabled={!filters.from.year || !filters.from.month}
                  onChange={(e) => onChangeFilters({
                    ...filters,
                    from: { ...filters.from, day: e.target.value }
                  })}
                >
                  <option value="">Day...</option>
                  {getDayOptions(filters.from.year, filters.from.month).map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>

                {filters.from.year && (
                  <button
                    type="button"
                    className="filter-btn-date-clear"
                    onClick={() => onChangeFilters({
                      ...filters,
                      from: { year: '', month: '', day: '' }
                    })}
                    title="Clear From date"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* To Date */}
            <div className="filter-date-row">
              <span className="filter-date-prefix">To</span>
              <div className="filter-date-selects">
                <select
                  className="input-field select-field filter-date-select"
                  value={filters.to.year}
                  onChange={(e) => onChangeFilters({
                    ...filters,
                    to: { ...filters.to, year: e.target.value, month: '', day: '' }
                  })}
                >
                  <option value="">Year...</option>
                  {getYearOptions(filters.to.year).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <select
                  className="input-field select-field filter-date-select"
                  value={filters.to.month}
                  disabled={!filters.to.year}
                  onChange={(e) => onChangeFilters({
                    ...filters,
                    to: { ...filters.to, month: e.target.value, day: '' }
                  })}
                >
                  <option value="">Month...</option>
                  <option value="01">Jan</option>
                  <option value="02">Feb</option>
                  <option value="03">Mar</option>
                  <option value="04">Apr</option>
                  <option value="05">May</option>
                  <option value="06">Jun</option>
                  <option value="07">Jul</option>
                  <option value="08">Aug</option>
                  <option value="09">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dec</option>
                </select>

                <select
                  className="input-field select-field filter-date-select"
                  value={filters.to.day}
                  disabled={!filters.to.year || !filters.to.month}
                  onChange={(e) => onChangeFilters({
                    ...filters,
                    to: { ...filters.to, day: e.target.value }
                  })}
                >
                  <option value="">Day...</option>
                  {getDayOptions(filters.to.year, filters.to.month).map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="filter-btn-today"
                  onClick={handleSetTodayForTo}
                  title="Set To date to Today"
                >
                  Today
                </button>

                {filters.to.year && (
                  <button
                    type="button"
                    className="filter-btn-date-clear"
                    onClick={() => onChangeFilters({
                      ...filters,
                      to: { year: '', month: '', day: '' }
                    })}
                    title="Clear To date"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
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
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
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
