import test from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, moodOf } from '../src/lib/moods.js';
import { MOOD_KEYS } from '../netlify/lib/schema.mjs';

test('display moods match the persisted schema keys and retain distinct labels', () => {
  assert.deepEqual(MOODS.map((mood) => mood.key), MOOD_KEYS);
  assert.equal(new Set(MOODS.map((mood) => mood.label)).size, MOOD_KEYS.length);
  for (const mood of MOODS) assert.equal(moodOf(mood.key), mood);
});

test('unknown and legacy missing moods use the neutral expression', () => {
  for (const key of [undefined, null, '', 'unknown']) {
    assert.equal(moodOf(key).key, 'meh');
  }
});
