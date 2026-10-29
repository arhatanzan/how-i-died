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
