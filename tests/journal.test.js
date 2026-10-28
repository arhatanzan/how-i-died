import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNotes, matchesDate, selectFeaturedNotes } from '../src/lib/journal.js';

const notes = [
  { id: 'a', text: 'A little morning', createdAt: '2026-10-28T12:00:00', attachments: [] },
  { id: 'b', text: 'Yesterday', createdAt: '2026-10-27T12:00:00', attachments: [{ type: 'image', url: 'https://example.org/photo.png', alt: 'A garden' }] },
  { id: 'c', text: 'Last month', createdAt: '2026-09-10T12:00:00', attachments: [{ type: 'link', url: 'https://example.org', title: 'Reading list' }] },
];
const filters = { year: '', month: '', day: null, view: 'masonry', sort: 'newest', search: '' };
const month = { year: 2026, index: 9 };

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
