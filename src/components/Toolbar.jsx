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
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const selectedDay = filters.day?.slice(-2).replace(/^0/, '') || '';
  const days = filters.year && filters.month
    ? daysInMonth(Number(filters.year), Number(filters.month) - 1)
    : 0;

  return (
    <section id="journal-filters" className="archive-toolbar" aria-label="Archive filters">
      <div className="archive-intro">
        <div className="archive-title">
          <svg className="archive-sketch" viewBox="0 0 52 64" fill="none" aria-hidden="true">
            <path d="M25 59C29 46 25 32 29 18M27 44C17 43 10 36 9 28C20 29 27 35 27 44ZM28 33C37 31 43 24 43 16C33 18 28 24 28 33Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M29 19C21 19 18 13 21 9C24 5 29 8 29 13C29 7 34 4 37 8C40 12 36 18 29 19Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M18 60C24 58 31 58 37 60" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
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
      </div>
      <div className="archive-browse">
        <div className="archive-dates" aria-label="Filter entries by date">
          <span className="archive-prompt">Wander through</span>
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
        <label className="archive-order">
          <span className="sr-only">Sort by</span>
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className="archive-select" aria-label="Sort">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <div className="archive-search">
        <label>
          <span className="sr-only">Search notes</span>
          <input type="search" value={filters.search} onChange={(event) => set({ search: event.target.value })} placeholder="Find a word, a place, a memory…" />
        </label>
        {(filters.search || filters.year || filters.month || filters.day) && (
          <button type="button" className="text-button" onClick={() => set({ search: '', year: '', month: '', day: null })}>Clear filters ↺</button>
        )}
      </div>

      {filters.day && (
        <div className="archive-date-caption">
          <span>Showing notes from {new Date(`${filters.day}T00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
        </div>
      )}
    </section>
  );
}
