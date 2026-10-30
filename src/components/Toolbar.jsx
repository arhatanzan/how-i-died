import { useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { MONTHS, daysInMonth } from '../lib/dates';

const VIEWS = [
  { key: 'masonry', label: 'Grid' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'calendar', label: 'Calendar' },
];

const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'longest', label: 'Longest first' },
];

export default function Toolbar({ filters, setFilters, total, shown, years, onDateChange }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = [filters.search, filters.year, filters.month, filters.day].filter(Boolean).length;
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const selectedDay = filters.day?.slice(-2).replace(/^0/, '') || '';
  const days = filters.year && filters.month
    ? daysInMonth(Number(filters.year), Number(filters.month) - 1)
    : 0;

  return (
    <section id="journal-filters" className="archive-toolbar" aria-label="Archive filters" data-expanded={expanded}>
      <div className="archive-intro">
        <div className="archive-title">
          <div>
            <h2>From the archive</h2>
            <p className="archive-count" aria-live="polite">{shown === total ? `${total} ${total === 1 ? 'entry' : 'entries'}` : `${shown} of ${total} entries`}</p>
          </div>
        </div>
        <div className="archive-views" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" aria-pressed={filters.view === v.key} onClick={() => set({ view: v.key })}>
              {v.label}
              <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 5C25 1 57 2 98 4M8 7C39 4 65 5 88 6" />
              </svg>
            </button>
          ))}
        </div>
        <label className="archive-order">
          <span className="sr-only">Sort by</span>
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className="archive-select" aria-label="Sort">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className="archive-filter-toggle" aria-expanded={expanded} aria-controls="archive-filter-controls" onClick={() => setExpanded((current) => !current)}>
          <SlidersHorizontal size={16} />
          <span>Filters{activeCount ? ` (${activeCount})` : ''}</span>
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
                  disabled={!filters.year || !days}
                  onChange={(e) => {
                    const day = e.target.value
                      ? `${filters.year}-${filters.month}-${e.target.value.padStart(2, '0')}`
                      : null;
                    onDateChange({ day });
                  }}
                  aria-label="Filter by day"
                >
                  <option value="">Any day</option>
                  {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
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
              <Search size={16} aria-hidden="true" />
              <input type="search" value={filters.search} onChange={(event) => set({ search: event.target.value })} placeholder="Search entries" />
            </label>
            <button type="button" className="archive-reset" disabled={!activeCount} aria-label="Clear filters" title="Clear filters" onClick={() => set({ search: '', year: '', month: '', day: null })}><RotateCcw size={16} /></button>
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
