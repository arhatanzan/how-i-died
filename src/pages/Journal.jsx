import { useEffect, useMemo, useState } from 'react';
import CalendarView from '../components/CalendarView';
import ArchiveStatus from '../components/ArchiveStatus';
import Composer from '../components/Composer';
import Feed from '../components/Feed';
import Toolbar from '../components/Toolbar';
import { matchesDate, selectNotes } from '../lib/journal';

const VIEW_KEY = 'hid:view';

function initialFilters() {
  const savedView = localStorage.getItem(VIEW_KEY);
  return {
    sort: 'newest',
    year: '',
    month: '',
    day: null,
    search: '',
    view: ['masonry', 'timeline', 'calendar'].includes(savedView) ? savedView : 'masonry',
  };
}

export default function Journal({ notes, status, error, retry, freshIds, onAdd, onUpdate, onDelete, authenticated }) {
  const [filters, setFilters] = useState(initialFilters);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), index: new Date().getMonth() }));

  useEffect(() => localStorage.setItem(VIEW_KEY, filters.view), [filters.view]);

  const years = useMemo(
    () => [...new Set([new Date().getFullYear(), ...notes.map((n) => new Date(n.createdAt).getFullYear())])]
      .sort((a, b) => b - a)
      .map(String),
    [notes],
  );
  const setDateFilters = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    const next = { ...filters, ...patch };
    const monthIndex = Number(next.month) - 1;
    if (next.year) setMonth((current) => ({ year: Number(next.year), index: monthIndex >= 0 ? monthIndex : current.index }));
  };
  const filtered = useMemo(() => selectNotes(notes, filters, month), [notes, filters, month]);

  const calendarNotes = useMemo(
    () => (filters.view === 'calendar' ? notes.filter((note) => matchesDate(note, { year: filters.year, month: filters.month })) : []),
    [notes, filters.view, filters.year, filters.month],
  );

  return (
    <div className="journal-page relative mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8">
      <div className="journal-page-heading">
        <p>A small record of a life in progress</p>
        <h1>The Journal</h1>
        <a href="/#journal-archive">Back to selected entries ↗</a>
      </div>

      {authenticated && (
        <div className="journal-composer-wrap">
          <Composer onCreated={onAdd} />
        </div>
      )}

      <Toolbar filters={filters} setFilters={setFilters} total={notes.length} shown={filtered.length} years={years} onDateChange={setDateFilters} />

      {filters.view === 'calendar' && (
        <CalendarView
          notes={calendarNotes}
          month={month}
          setMonth={(m) => {
            setMonth(m);
            setFilters((f) => ({ ...f, year: String(m.year), month: String(m.index + 1).padStart(2, '0'), day: null }));
          }}
          selected={filters.day}
          onSelect={(day) => setFilters((f) => ({
            ...f,
            year: day ? day.slice(0, 4) : f.year,
            month: day ? day.slice(5, 7) : f.month,
            day,
          }))}
        />
      )}

      <ArchiveStatus status={status} error={error} onRetry={retry} />
      {status === 'ready' && (
        <Feed
          notes={filtered}
          layout={filters.view === 'masonry' ? 'masonry' : 'timeline'}
          isAdmin={authenticated}
          onUpdate={onUpdate}
          onDelete={onDelete}
          freshIds={freshIds}
          emptyText={notes.length ? 'No notes match these filters.' : 'Nothing written here yet.'}
        />
      )}
    </div>
  );
}
