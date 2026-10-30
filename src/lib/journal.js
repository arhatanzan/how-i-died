import { getAttachments } from '../../shared/attachments.js';
import { dayKey } from './dates.js';

export function selectFeaturedNotes(notes) {
  return notes.filter((note) => note.featured === true)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
}

export function matchesDate(note, filters) {
  const date = new Date(note.createdAt);
  return (!filters.year || String(date.getFullYear()) === filters.year)
    && (!filters.month || String(date.getMonth() + 1).padStart(2, '0') === filters.month)
    && (!filters.day || dayKey(date) === filters.day);
}

export function groupTimelineDates(notes, sort = 'newest') {
  const years = new Map();
  for (const note of notes) {
    const date = new Date(note.createdAt);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    if (!years.has(year)) years.set(year, { year, count: 0, months: new Map() });
    const group = years.get(year);
    group.count += 1;
    group.months.set(month, (group.months.get(month) || 0) + 1);
  }
  const direction = sort === 'oldest' ? 1 : -1;
  return [...years.values()]
    .sort((a, b) => direction * (Number(a.year) - Number(b.year)))
    .map(({ year, count, months }) => ({
      year,
      count,
      months: [...months].sort(([a], [b]) => direction * (Number(a) - Number(b)))
        .map(([month, count]) => ({ month, count })),
    }));
}

export function selectNotes(notes, filters, month) {
  const query = filters.search?.trim().toLowerCase();
  const filtered = notes.filter((note) => {
    if (!matchesDate(note, filters)) return false;
    if (query && ![note.text, ...getAttachments(note).map((item) => `${item.title || item.alt || ''} ${item.name || ''} ${item.url}`)].join(' ').toLowerCase().includes(query)) return false;
    if (filters.view === 'calendar' && !filters.year && !filters.month && !filters.day) {
      const date = new Date(note.createdAt);
      return date.getFullYear() === month.year && date.getMonth() === month.index;
    }
    return true;
  });
  const byDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  const sorters = {
    newest: byDate,
    oldest: (a, b) => -byDate(a, b),
    longest: (a, b) => b.text.length - a.text.length,
  };
  return filtered.sort(sorters[filters.sort] || byDate);
}
