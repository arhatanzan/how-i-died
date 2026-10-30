import { useMemo } from 'react';
import { MONTHS } from '../lib/dates';
import { groupTimelineDates } from '../lib/journal';

export default function TimelineNav({ notes, filters, onDateChange }) {
  const years = useMemo(() => groupTimelineDates(notes, filters.sort), [notes, filters.sort]);

  return (
    <nav className="journal-timeline-nav" aria-label="Timeline dates">
      <h2 className="font-display text-2xl">Timeline</h2>
      <button type="button" aria-pressed={!filters.year && !filters.month && !filters.day} onClick={() => onDateChange({ year: '', month: '', day: null })}>
        <span>All dates</span><span className="text-muted">{notes.length}</span>
      </button>
      {!years.length && <p className="text-sm text-muted">No entry dates yet.</p>}
      <ol>
        {years.map(({ year, count, months }) => (
          <li key={year}>
            <button type="button" className="timeline-year" aria-pressed={filters.year === year && !filters.month && !filters.day} onClick={() => onDateChange({ year, month: '', day: null })}>
              <span>{year}</span><span className="text-muted">{count}</span>
            </button>
            <ol className="timeline-months">
              {months.map(({ month, count }) => (
                <li key={month}>
                  <button type="button" aria-pressed={filters.year === year && filters.month === month} onClick={() => onDateChange({ year, month, day: null })}>
                    <span>{MONTHS[Number(month) - 1]}</span><span className="text-muted">{count}</span>
                  </button>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}
