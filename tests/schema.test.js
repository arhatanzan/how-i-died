import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeNoteInput } from '../netlify/lib/schema.mjs';
import { validateImageFile, prepareImage } from '../src/lib/image.js';
import { MAX_IMAGE_BYTES } from '../shared/attachments.js';

test('text is trimmed, limited, and non-note input fails explicitly', () => {
  assert.deepEqual(sanitizeNoteInput({ text: '  A day  ' }), { text: 'A day' });
  for (const input of [null, [], 3, 'a', { text: 4 }, { text: 'a'.repeat(20001) }, { isPublic: 'true' }, { mood: 'fake' }, { createdAt: 'bad-date' }, { createdAt: true }, { createdAt: false }, { createdAt: null }, { createdAt: '' }]) {
    assert.throws(() => sanitizeNoteInput(input));
  }
});

test('featured selection accepts only explicit booleans and leaves unrelated edits untouched', () => {
  assert.deepEqual(sanitizeNoteInput({ featured: true }), { featured: true });
  assert.deepEqual(sanitizeNoteInput({ featured: false }), { featured: false });
  assert.deepEqual(sanitizeNoteInput({ text: 'Updated' }, { featured: true }), { text: 'Updated' });
  for (const featured of ['true', 1, null, [], {}]) {
    assert.throws(() => sanitizeNoteInput({ featured }), /featured/);
  }
});

test('legacy images migrate on edit and new attachments retain a first-image compatibility URL', () => {
  assert.deepEqual(sanitizeNoteInput({ imageUrl: null }), { imageUrl: null, attachments: [] });
  const attachments = [{ type: 'image', url: 'https://example.org/photo.jpg', alt: 'A view' }, { type: 'link', url: 'https://example.org/', title: '' }];
  assert.deepEqual(sanitizeNoteInput({ attachments }), { attachments, imageUrl: 'https://example.org/photo.jpg' });
  assert.deepEqual(sanitizeNoteInput({ isPublic: true }, { text: 'Legacy', imageUrl: 'https://example.org/old.png' }), { isPublic: true });
  assert.throws(() => sanitizeNoteInput({ imageUrl: 'javascript:alert(1)' }));
  assert.deepEqual(sanitizeNoteInput({ text: 'Caption' }, { attachments }), { text: 'Caption', attachments });
});

test('uploaded GIFs stay animated; unsupported and oversized files fail before upload', async () => {
  const gif = { type: 'image/gif', size: MAX_IMAGE_BYTES };
  assert.equal(await prepareImage(gif), gif);
  for (const file of [{ type: 'image/svg+xml', size: 10 }, { type: 'text/plain', size: 1 }, { type: 'image/png', size: 31 * 1024 * 1024 }, { type: 'image/gif', size: MAX_IMAGE_BYTES + 1 }]) {
    assert.throws(() => validateImageFile(file));
  }
  assert.doesNotThrow(() => validateImageFile({ type: 'image/png', size: 10 * 1024 * 1024 }));
});
