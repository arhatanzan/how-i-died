import { useMemo } from 'react';
import { MONTHS, WEEKDAYS, dayKey, daysInMonth } from '../lib/dates';

export default function CalendarView({ notes, month, setMonth, selected, onSelect }) {
  const { year, index } = month;
  const byDay = useMemo(() => {
    const map = new Map();
    for (const n of notes) {
      const k = dayKey(n.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(n);
    }
    return map;
  }, [notes]);

  const offset = new Date(year, index, 1).getDay();
  const total = daysInMonth(year, index);
  const today = dayKey(new Date());
  const cells = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  const shift = (delta) => {
    const d = new Date(year, index + delta, 1);
    setMonth({ year: d.getFullYear(), index: d.getMonth() });
  };

  return (
    <section className="journal-calendar mx-auto mb-8 max-w-3xl p-4 animate-in sm:p-6" aria-label="Calendar">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">←</button>
        <h2 className="font-display text-xl font-semibold sm:text-2xl">
          {MONTHS[index]} <span className="font-normal text-muted">{year}</span>
        </h2>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted sm:gap-1.5">
        {WEEKDAYS.map((d) => <div key={d} className="pb-1">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`b${i}`} />;
          const key = dayKey(new Date(year, index, day));
          const list = byDay.get(key) ?? [];
          const isSel = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(isSel ? null : key)}
              className={`calendar-day flex aspect-square flex-col items-start justify-between border p-1 text-left transition-colors sm:p-1.5 ${isSel ? 'calendar-day-selected' : list.length ? 'calendar-day-has-notes' : ''}`}
              aria-label={`${key}: ${list.length} notes`}
              aria-pressed={isSel}
            >
              <span className={key === today ? 'calendar-today' : ''}>{day}</span>
              {list.length > 0 && (
                <span className="flex flex-wrap gap-0.5">
                  {list.slice(0, 4).map((n) => (
                    <span key={n.id} className="calendar-entry-dot h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2" />
                  ))}
                  {list.length > 4 && <span className="text-[9px] leading-none">+{list.length - 4}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
