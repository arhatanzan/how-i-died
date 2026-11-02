import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { MONTHS, daysInMonth } from '../lib/dates';
import { NOTE_VIEW_TYPES, NOTE_SORT_TYPES } from '../lib/constants';

export default function Toolbar({ filters, setFilters, total, shown, years, onDateChange }) {
  const [expanded, setExpanded] = useState(false);
  const toolbar = useRef(null);

  useEffect(() => {
    const element = toolbar.current;
    const journal = element.closest('.journal-page');
    if (!journal) return;

    const updateHeight = () => {
      journal.style.setProperty('--archive-toolbar-height', `${element.getBoundingClientRect().height}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => {
      observer.disconnect();
      journal.style.removeProperty('--archive-toolbar-height');
    };
  }, []);

  const activeFilterCount = [filters.search, filters.year, filters.month, filters.day].filter(Boolean).length;
  const setFilters_ = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const selectedDay = filters.day?.slice(-2).replace(/^0/, '') || '';
  const daysAvailable = filters.year && filters.month
    ? daysInMonth(Number(filters.year), Number(filters.month) - 1)
    : 0;

  return (
    <section ref={toolbar} id="journal-filters" className="archive-toolbar" aria-label="Archive filters" data-expanded={expanded}>
      <div className="archive-intro">
        <div className="archive-title">
          <div>
            <h2>From the archive</h2>
            <p className="archive-count" aria-live="polite">{shown === total ? `${total} ${total === 1 ? 'entry' : 'entries'}` : `${shown} of ${total} entries`}</p>
          </div>
        </div>
        <div className="archive-views" role="group" aria-label="View">
          {NOTE_VIEW_TYPES.map((v) => (
            <button key={v.key} type="button" aria-pressed={filters.view === v.key} onClick={() => setFilters_({ view: v.key })}>
              {v.label}
              <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 5C25 1 57 2 98 4M8 7C39 4 65 5 88 6" />
              </svg>
            </button>
          ))}
        </div>
        <label className="archive-order">
          <span className="sr-only">Sort by</span>
          <select value={filters.sort} onChange={(e) => setFilters_({ sort: e.target.value })} className="archive-select" aria-label="Sort">
            {NOTE_SORT_TYPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className="archive-filter-toggle" aria-expanded={expanded} aria-controls="archive-filter-controls" onClick={() => setExpanded((current) => !current)}>
          <SlidersHorizontal size={16} />
          <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
        </button>
      </div>
      <div id="archive-filter-controls" className="archive-filters-container">
        <div className="archive-filters-left">
          <div className="archive-browse">
            <div className="archive-dates" aria-label="Filter entries by date">
              <label>
                <span className="sr-only">Year</span>
                <select
                  className="archive-select"
                  value={filters.year}
                  onChange={(e) => onDateChange({
                    year: e.target.value,
                    ...(!e.target.value ? { month: '' } : {}),
                    day: null,
                  })}
                  aria-label="Filter by year"
                >
                  <option value="">Any year</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Month</span>
                <select
                  className="archive-select"
                  value={filters.month}
                  disabled={!filters.year}
                  onChange={(e) => onDateChange({ month: e.target.value, day: null })}
                  aria-label="Filter by month"
                >
                  <option value="">Any month</option>
                  {MONTHS.map((month, index) => (
                    <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Day</span>
                <select
                  className="archive-select"
                  value={selectedDay}
                  disabled={!filters.year || !daysAvailable}
                  onChange={(e) => {
                    const day = e.target.value
                      ? `${filters.year}-${filters.month}-${e.target.value.padStart(2, '0')}`
                      : null;
                    onDateChange({ day });
                  }}
                  aria-label="Filter by day"
                >
                  <option value="">Any day</option>
                  {Array.from({ length: daysAvailable }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="archive-filters-right">
          <div className="archive-search">
            <label>
              <span className="sr-only">Search notes</span>
              <input type="search" value={filters.search} onChange={(event) => setFilters_({ search: event.target.value })} placeholder="Search entries" />
            </label>
            <button type="button" className="archive-reset" disabled={!activeFilterCount} aria-label="Clear filters" title="Clear filters" onClick={() => setFilters_({ search: '', year: '', month: '', day: null })}>↻</button>
          </div>
        </div>
      </div>

      {filters.day && (
        <div className="archive-date-caption">
          <span>Showing notes from {new Date(`${filters.day}T00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
        </div>
      )}
    </section>
  );
}
