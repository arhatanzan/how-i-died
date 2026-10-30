import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNotes, matchesDate, selectFeaturedNotes, groupTimelineDates } from '../src/lib/journal.js';

const notes = [
  { id: 'a', text: 'A little morning', createdAt: '2026-10-28T12:00:00', attachments: [] },
  { id: 'b', text: 'Yesterday', createdAt: '2026-10-27T12:00:00', attachments: [{ type: 'image', url: 'https://example.org/photo.png', alt: 'A garden' }] },
  { id: 'c', text: 'Last month', createdAt: '2026-09-10T12:00:00', attachments: [{ type: 'link', url: 'https://example.org', title: 'Reading list' }] },
];
const filters = { year: '', month: '', day: null, view: 'masonry', sort: 'newest', search: '' };
const month = { year: 2026, index: 9 };

test('timeline groups only populated local years and months with counts in date order', () => {
  const entries = [...notes, { id: 'd', createdAt: '2025-12-31T23:59:00' }];
  const original = [...entries];
  assert.deepEqual(groupTimelineDates(entries), [
    { year: '2026', count: 3, months: [{ month: '10', count: 2 }, { month: '09', count: 1 }] },
    { year: '2025', count: 1, months: [{ month: '12', count: 1 }] },
  ]);
  assert.deepEqual(groupTimelineDates(entries, 'oldest'), [
    { year: '2025', count: 1, months: [{ month: '12', count: 1 }] },
    { year: '2026', count: 3, months: [{ month: '09', count: 1 }, { month: '10', count: 2 }] },
  ]);
  assert.deepEqual(entries, original);
  assert.deepEqual(groupTimelineDates([]), []);
});

test('timeline year and month filters combine with search and ordering', () => {
  const timeline = { ...filters, view: 'timeline', year: '2026', month: '10', sort: 'oldest' };
  assert.deepEqual(selectNotes(notes, timeline, month).map((n) => n.id), ['b', 'a']);
  assert.deepEqual(selectNotes(notes, { ...timeline, search: 'garden' }, month).map((n) => n.id), ['b']);
  assert.deepEqual(selectNotes(notes, { ...timeline, month: '' }, month).map((n) => n.id), ['c', 'b', 'a']);
});

test('archive date and calendar selection preserve note ordering without mutating source', () => {
  assert.equal(matchesDate(notes[0], { year: '2026', month: '10', day: '2026-10-28' }), true);
  assert.equal(matchesDate(notes[1], { day: '2026-10-28' }), false);
  assert.deepEqual(selectNotes(notes, { ...filters, view: 'calendar' }, month).map((n) => n.id), ['a', 'b']);
  assert.deepEqual(selectNotes(notes, { ...filters, sort: 'oldest' }, month).map((n) => n.id), ['c', 'b', 'a']);
  assert.deepEqual(notes.map((n) => n.id), ['a', 'b', 'c']);
});

test('search includes text, photo descriptions, link titles and URLs', () => {
  for (const [search, expected] of [[' morning ', 'a'], ['GARDEN', 'b'], ['reading', 'c'], ['photo.png', 'b']]) {
    assert.deepEqual(selectNotes(notes, { ...filters, search }, month).map((note) => note.id), [expected]);
  }
  assert.deepEqual(selectNotes(notes, { ...filters, search: 'unwritten' }, month), []);
});

test('timeline and calendar support newest-first and oldest-first ordering', () => {
  for (const view of ['timeline', 'calendar']) {
    const expected = view === 'calendar' ? ['a', 'b'] : ['a', 'b', 'c'];
    assert.deepEqual(selectNotes(notes, { ...filters, view, sort: 'newest' }, month).map((note) => note.id), expected);
    assert.deepEqual(selectNotes(notes, { ...filters, view, sort: 'oldest' }, month).map((note) => note.id), [...expected].reverse());
  }
});

test('homepage selects at most six explicitly featured entries, newest first, without changing source', () => {
  const entries = Array.from({ length: 9 }, (_, i) => ({
    id: String(i), featured: true, createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
  }));
  entries.push({ id: 'unmarked', createdAt: '2026-11-01T12:00:00Z' });
  entries.push({ id: 'false', featured: false, createdAt: '2026-11-01T12:00:00Z' });
  entries.push({ id: 'invalid', featured: 'true', createdAt: '2026-11-01T12:00:00Z' });
  const original = [...entries];
  assert.deepEqual(selectFeaturedNotes(entries).map((n) => n.id), ['8', '7', '6', '5', '4', '3']);
  assert.deepEqual(entries, original);
  assert.deepEqual(selectFeaturedNotes(entries.slice(-3)), []);
});
