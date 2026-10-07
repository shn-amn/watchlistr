import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import {
  MONTH_OPTIONS,
  getMonthName,
  isDateAfterMax,
  isDateBeforeMin,
  type PrecisionDateObject
} from '../../utils/dates';

export type DatePrecisionValue = PrecisionDateObject;

export interface FlexibleCalendarProps {
  value: DatePrecisionValue;
  onChange: (val: DatePrecisionValue) => void;
  minDate?: DatePrecisionValue;
  maxDate?: DatePrecisionValue;
}

export const FlexibleCalendar: React.FC<FlexibleCalendarProps> = ({
  value,
  onChange,
  minDate,
  maxDate
}) => {
  const now = new Date();
  const currentYearNum = now.getFullYear();
  const currentMonthNum = now.getMonth();

  const initialYear = value.year ? parseInt(value.year, 10) : currentYearNum;
  const initialMonth = value.month ? parseInt(value.month, 10) - 1 : currentMonthNum;

  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth);
  const [decadeStart, setDecadeStart] = useState<number>(() => Math.floor(initialYear / 12) * 12);

  // Sync view when selected value changes
  useEffect(() => {
    if (value.year) {
      const y = parseInt(value.year, 10);
      if (!isNaN(y)) {
        setViewYear(y);
        setDecadeStart(Math.floor(y / 12) * 12);
      }
    }
    if (value.month) {
      const m = parseInt(value.month, 10) - 1;
      if (!isNaN(m) && m >= 0 && m <= 11) setViewMonth(m);
    }
  }, [value.year, value.month]);

  // Navigation handlers with boundary checks
  const canPrev = () => {
    if (!minDate || !minDate.year) return true;
    const minY = parseInt(minDate.year, 10);
    const minM = minDate.month ? parseInt(minDate.month, 10) - 1 : 0;

    if (viewMode === 'days') {
      if (viewYear < minY) return false;
      if (viewYear === minY && viewMonth <= minM) return false;
    } else if (viewMode === 'months') {
      if (viewYear <= minY) return false;
    } else if (viewMode === 'years') {
      if (decadeStart <= minY) return false;
    }
    return true;
  };

  const canNext = () => {
    if (!maxDate || !maxDate.year) return true;
    const maxY = parseInt(maxDate.year, 10);
    const maxM = maxDate.month ? parseInt(maxDate.month, 10) - 1 : 11;

    if (viewMode === 'days') {
      if (viewYear > maxY) return false;
      if (viewYear === maxY && viewMonth >= maxM) return false;
    } else if (viewMode === 'months') {
      if (viewYear >= maxY) return false;
    } else if (viewMode === 'years') {
      if (decadeStart + 11 >= maxY) return false;
    }
    return true;
  };

  const handlePrev = () => {
    if (!canPrev()) return;
    if (viewMode === 'days') {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    } else if (viewMode === 'months') {
      setViewYear(viewYear - 1);
    } else if (viewMode === 'years') {
      setDecadeStart(decadeStart - 12);
    }
  };

  const handleNext = () => {
    if (!canNext()) return;
    if (viewMode === 'days') {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    } else if (viewMode === 'months') {
      setViewYear(viewYear + 1);
    } else if (viewMode === 'years') {
      setDecadeStart(decadeStart + 12);
    }
  };

  // Implicit selection handlers
  const handleSelectYear = (yearNum: number) => {
    const yrStr = String(yearNum);
    // Implicitly select year only
    onChange({
      year: yrStr,
      month: '',
      day: ''
    });
    setViewYear(yearNum);
    setViewMode('months');
  };

  const handleSelectMonth = (monthIdx: number) => {
    const monthStr = String(monthIdx + 1).padStart(2, '0');
    // Implicitly select year + month
    onChange({
      year: String(viewYear),
      month: monthStr,
      day: ''
    });
    setViewMonth(monthIdx);
    setViewMode('days');
  };

  const handleSelectDay = (dayNum: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    // Implicitly select exact day
    onChange({
      year: String(viewYear),
      month: monthStr,
      day: dayStr
    });
  };

  // Calendar Day Grid Computation
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  // Normalize to Monday start: 0 = Mon, ..., 6 = Sun
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Selection states
  const isExactDaySelected = (day: number) => {
    if (!value.year || !value.month || !value.day) return false;
    return (
      parseInt(value.year, 10) === viewYear &&
      parseInt(value.month, 10) - 1 === viewMonth &&
      parseInt(value.day, 10) === day
    );
  };

  const isWholeMonthSelectedForDay = () => {
    if (!value.year || !value.month || value.day) return false;
    return (
      parseInt(value.year, 10) === viewYear &&
      parseInt(value.month, 10) - 1 === viewMonth
    );
  };

  const isToday = (day: number) => {
    return (
      now.getFullYear() === viewYear &&
      now.getMonth() === viewMonth &&
      now.getDate() === day
    );
  };

  const isMonthActive = (monthIdx: number) => {
    if (!value.year || !value.month) return false;
    return (
      parseInt(value.year, 10) === viewYear &&
      parseInt(value.month, 10) - 1 === monthIdx
    );
  };

  const isYearActive = (yearNum: number) => {
    if (!value.year) return false;
    return parseInt(value.year, 10) === yearNum;
  };

  // Boundary checks for cells
  const isDayDisabled = (day: number) => {
    const dateObj: DatePrecisionValue = {
      year: String(viewYear),
      month: String(viewMonth + 1).padStart(2, '0'),
      day: String(day).padStart(2, '0')
    };
    if (minDate && isDateBeforeMin(dateObj, minDate)) return true;
    if (maxDate && isDateAfterMax(dateObj, maxDate)) return true;
    return false;
  };

  const isMonthDisabled = (monthIdx: number) => {
    const dateObj: DatePrecisionValue = {
      year: String(viewYear),
      month: String(monthIdx + 1).padStart(2, '0')
    };
    if (minDate && isDateBeforeMin(dateObj, minDate)) return true;
    if (maxDate && isDateAfterMax(dateObj, maxDate)) return true;
    return false;
  };

  const isYearDisabled = (yearNum: number) => {
    const dateObj: DatePrecisionValue = {
      year: String(yearNum)
    };
    if (minDate && isDateBeforeMin(dateObj, minDate)) return true;
    if (maxDate && isDateAfterMax(dateObj, maxDate)) return true;
    return false;
  };

  return (
    <div className="flex-cal-container">
      {/* Calendar Navigation Header */}
      <div className="flex-cal-header">
        <button
          type="button"
          className="flex-cal-nav-btn"
          onClick={handlePrev}
          disabled={!canPrev()}
          title="Previous"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-cal-header-titles">
          {viewMode === 'days' && (
            <>
              <button
                type="button"
                className="flex-cal-title-btn"
                onClick={() => setViewMode('months')}
                title="Click to change month"
              >
                <span>{getMonthName(String(viewMonth + 1).padStart(2, '0'))}</span>
                <ChevronDown size={11} className="flex-cal-title-chevron" />
              </button>
              <button
                type="button"
                className="flex-cal-title-btn"
                onClick={() => {
                  setDecadeStart(Math.floor(viewYear / 12) * 12);
                  setViewMode('years');
                }}
                title="Click to change year"
              >
                <span>{viewYear}</span>
                <ChevronDown size={11} className="flex-cal-title-chevron" />
              </button>
            </>
          )}

          {viewMode === 'months' && (
            <button
              type="button"
              className="flex-cal-title-btn active-level"
              onClick={() => {
                setDecadeStart(Math.floor(viewYear / 12) * 12);
                setViewMode('years');
              }}
              title="Click to change year"
            >
              <span>{viewYear}</span>
              <ChevronDown size={11} className="flex-cal-title-chevron" />
            </button>
          )}

          {viewMode === 'years' && (
            <span className="flex-cal-title-label">
              {decadeStart} – {decadeStart + 11}
            </span>
          )}
        </div>

        <button
          type="button"
          className="flex-cal-nav-btn"
          onClick={handleNext}
          disabled={!canNext()}
          title="Next"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 1. DAYS VIEW */}
      {viewMode === 'days' && (
        <div className="flex-cal-body">
          <div className="flex-cal-weekdays">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d} className="flex-cal-weekday">
                {d}
              </span>
            ))}
          </div>

          <div className="flex-cal-grid-days">
            {/* Trailing days of previous month */}
            {Array.from({ length: startOffset }).map((_, i) => {
              const prevDay = daysInPrevMonth - startOffset + i + 1;
              return (
                <button
                  key={`prev-${i}`}
                  type="button"
                  disabled={!canPrev()}
                  className="flex-cal-day-cell dim"
                  onClick={() => {
                    if (canPrev()) {
                      if (viewMonth === 0) {
                        setViewMonth(11);
                        setViewYear(viewYear - 1);
                      } else {
                        setViewMonth(viewMonth - 1);
                      }
                    }
                  }}
                >
                  {prevDay}
                </button>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isExactDaySelected(day);
              const wholeMonthSelected = isWholeMonthSelectedForDay();
              const today = isToday(day);
              const disabled = isDayDisabled(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  disabled={disabled}
                  className={`flex-cal-day-cell ${selected ? 'selected' : ''} ${
                    wholeMonthSelected && !selected ? 'month-covered' : ''
                  } ${today ? 'today' : ''}`}
                  onClick={() => handleSelectDay(day)}
                >
                  {day}
                </button>
              );
            })}

            {/* Leading days of next month */}
            {Array.from({ length: (7 - ((startOffset + daysInCurrentMonth) % 7)) % 7 }).map((_, i) => {
              const nextDay = i + 1;
              return (
                <button
                  key={`next-${i}`}
                  type="button"
                  disabled={!canNext()}
                  className="flex-cal-day-cell dim"
                  onClick={() => {
                    if (canNext()) {
                      if (viewMonth === 11) {
                        setViewMonth(0);
                        setViewYear(viewYear + 1);
                      } else {
                        setViewMonth(viewMonth + 1);
                      }
                    }
                  }}
                >
                  {nextDay}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. MONTHS VIEW */}
      {viewMode === 'months' && (
        <div className="flex-cal-body">
          <div className="flex-cal-grid-months">
            {MONTH_OPTIONS.map((m, idx) => {
              const isActive = isMonthActive(idx);
              const isCurrent = now.getMonth() === idx && now.getFullYear() === viewYear;
              const disabled = isMonthDisabled(idx);

              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={disabled}
                  className={`flex-cal-month-cell ${isActive ? 'selected' : ''} ${
                    isCurrent ? 'current' : ''
                  }`}
                  onClick={() => handleSelectMonth(idx)}
                >
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. YEARS VIEW */}
      {viewMode === 'years' && (
        <div className="flex-cal-body">
          <div className="flex-cal-grid-years">
            {Array.from({ length: 12 }).map((_, i) => {
              const yr = decadeStart + i;
              const isActive = isYearActive(yr);
              const isCurrent = now.getFullYear() === yr;
              const disabled = isYearDisabled(yr);

              return (
                <button
                  key={yr}
                  type="button"
                  disabled={disabled}
                  className={`flex-cal-year-cell ${isActive ? 'selected' : ''} ${
                    isCurrent ? 'current' : ''
                  }`}
                  onClick={() => handleSelectYear(yr)}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

