import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database.mjs';
import { normalizeStoredNote, noteRepository } from '../netlify/lib/database.mjs';
import notesHandler from '../netlify/functions/notes.mjs';

const note = (id, fields = {}) => ({
  id, text: `Note ${id}`, mood: 'calm', isPublic: false,
  createdAt: '2026-10-28T10:00:00.000Z', ...fields,
});

test('Postgres migration preserves IDs, legacy moods, attachment URLs and unknown fields', async (t) => {
  const { repository, db } = await testDatabase(t, { mockRepository: false });
  const photo = '/api/images/12345678-1234-1234-1234-123456789abc';
  const legacy = note('legacy-non-uuid', { mood: 'solace', imageUrl: photo, extra: { preserved: true } });
  await repository.create(note('existing', { text: 'Newer database text' }));
  const first = await repository.migrateLegacy(async () => [legacy, note('existing', { text: 'Old Blobs text' })]);
  assert.deepEqual(first, { alreadyMigrated: false, imported: 1 });
  const notes = await repository.list();
  const migrated = notes.find((item) => item.id === legacy.id);
  assert.equal(migrated.mood, 'calm');
  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.attachments[0].url, photo);
  assert.deepEqual(migrated.extra, { preserved: true });
  assert.equal(notes.find((item) => item.id === 'existing').text, 'Newer database text');
  await repository.remove(legacy.id);
  const second = await repository.migrateLegacy(() => { throw new Error('Legacy Blobs must not be read twice'); });
  assert.deepEqual(second, { alreadyMigrated: true, imported: 1 });
  assert.equal((await repository.list()).some((item) => item.id === legacy.id), false);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM journal_migrations')).rows[0].count, 1);
});

test('failed imports roll back completely and can be retried; empty imports are marked complete', async (t) => {
  const { repository } = await testDatabase(t, { mockRepository: false });
  await assert.rejects(repository.migrateLegacy(async () => [note('one'), { id: 'invalid' }]), /creation date/);
  assert.deepEqual(await repository.list(), []);
  await assert.rejects(repository.migrateLegacy(async () => [note('one'), note('one')]), /duplicate/);
  assert.deepEqual(await repository.list(), []);
  assert.deepEqual(await repository.migrateLegacy(async () => []), { alreadyMigrated: false, imported: 0 });
  assert.equal((await repository.migrateLegacy(async () => [note('never-imported')])).alreadyMigrated, true);
  assert.deepEqual(await repository.list(), []);
});

test('individual note writes, row updates, rollback, filtering and safe SQL parameters', async (t) => {
  const { repository } = await testDatabase(t, { mockRepository: false });
  const hostileId = "one'; DROP TABLE journal_notes; --";
  await Promise.all([repository.create(note(hostileId)), repository.create(note('two', { isPublic: true, text: "A 'quoted' note" }))]);
  assert.equal((await repository.list()).length, 2);
  assert.deepEqual((await repository.list({ publicOnly: true })).map((item) => item.id), ['two']);
  const [first, second] = await Promise.all([
    repository.update(hostileId, (previous) => ({ ...previous, text: 'Edited' })),
    repository.update(hostileId, (previous) => ({ ...previous, featured: true })),
  ]);
  assert.equal(first.updated.text, 'Edited');
  assert.equal(second.updated.text, 'Edited');
  assert.equal(second.updated.featured, true);
  await assert.rejects(repository.update(hostileId, () => { throw new Error('Reject edit'); }), /Reject edit/);
  assert.equal((await repository.list()).find((item) => item.id === hostileId).text, 'Edited');
  assert.equal(await repository.update('missing', () => { throw new Error('Not called'); }), null);
  assert.equal(await repository.remove('missing'), null);
  await repository.remove(hostileId);
  assert.equal((await repository.list()).length, 1);
  await assert.rejects(repository.create(note('two')), /duplicate key/);
});

test('invalid legacy dates and IDs fail explicitly', () => {
  for (const input of [null, {}, note(''), note('one', { createdAt: 'bad' }), note('one', { updatedAt: 'bad' })]) {
    assert.throws(() => normalizeStoredNote(input));
  }
});

test('database outages return an explicit JSON error rather than an empty archive', async (t) => {
  t.mock.method(noteRepository, 'migrateLegacy', async () => { throw new Error('Test database outage'); });
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const response = await notesHandler(new Request('http://localhost/api/notes'), { params: {} });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /database is unavailable/);
  assert.equal(errors.length, 1);
});
