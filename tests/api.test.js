import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setEnvironmentContext } from '@netlify/blobs';
import { BlobsServer } from '@netlify/blobs/server';
import notesHandler from '../netlify/functions/notes.mjs';
import imagesHandler from '../netlify/functions/images.mjs';
import { issueToken } from '../netlify/lib/auth.mjs';
import { imageStore } from '../netlify/lib/store.mjs';
import { testDatabase } from './support/database.mjs';
import { MAX_IMAGE_BYTES } from '../shared/attachments.js';

test('note APIs use Postgres and image APIs use an isolated Blobs store', async (t) => {
  const { seed } = await testDatabase(t);
  const directory = await mkdtemp(join(tmpdir(), 'journal-api-test-'));
  const server = new BlobsServer({ directory, token: 'local-test-token' });
  const { port } = await server.start();
  setEnvironmentContext({ siteID: 'local-journal-test', token: 'local-test-token', edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}` });
  const previous = { ADMIN_USERNAME: process.env.ADMIN_USERNAME, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD };
  process.env.ADMIN_USERNAME = 'test-keeper';
  process.env.ADMIN_PASSWORD = 'local-test-only';
  t.after(async () => {
    await server.stop();
    await rm(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const cookie = `hid_session=${issueToken('test-keeper')}`;
  const request = (path, method = 'GET', body, authenticated = true) => new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(authenticated ? { cookie } : {}),
      'x-requested-with': 'how-i-died',
      'content-type': body instanceof Uint8Array ? 'image/png' : 'application/json',
    },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const notes = (method, body, id, authenticated = true) => notesHandler(request('/api/notes', method, body, authenticated), { params: { id } });
  const image = (url, authenticated = true) => imagesHandler(request(url, 'GET', undefined, authenticated), { params: { key: url.split('/').at(-1) } });
  await seed([]);
  let uploaded;
  let saved;

  await t.test('rejects unauthenticated writes, malformed notes, and oversized uploads', async () => {
    assert.equal((await notes('POST', { text: 'Not allowed' }, undefined, false)).status, 401);
    assert.equal((await notes('POST', null)).status, 400);
    assert.equal((await notes('POST', { attachments: [{ type: 'link', url: 'javascript:alert(1)' }] })).status, 400);
    const response = await imagesHandler(request('/api/images', 'POST', new Uint8Array(MAX_IMAGE_BYTES + 1)), { params: {} });
    assert.equal(response.status, 413);
  });

  await t.test('uploads remain private until referenced by a public note', async () => {
    const response = await imagesHandler(request('/api/images', 'POST', new Uint8Array([137, 80, 78, 71])), { params: {} });
    assert.equal(response.status, 201);
    uploaded = (await response.json()).url;
    assert.equal((await image(uploaded, false)).status, 404);
    const privateImage = await image(uploaded);
    assert.equal(privateImage.status, 200);
    assert.equal(privateImage.headers.get('cache-control'), 'private, no-store');
    const created = await notes('POST', { text: 'A private moment', attachments: [{ type: 'image', url: uploaded, alt: 'A photo' }, { type: 'link', url: 'https://youtu.be/abcdefghijk', title: 'A film' }] });
    assert.equal(created.status, 201);
    saved = await created.json();
    assert.equal(saved.attachments.length, 2);
    assert.equal((await notes('GET', undefined, undefined, false)).status, 200);
    assert.deepEqual(await (await notes('GET', undefined, undefined, false)).json(), []);
    assert.equal((await image(uploaded, false)).status, 404);
    assert.equal((await notes('PATCH', { isPublic: true }, saved.id)).status, 200);
    assert.equal((await image(uploaded, false)).status, 200);
    assert.equal((await (await notes('GET', undefined, undefined, false)).json()).length, 1);
  });

  await t.test('shared images are retained until their final reference is removed', async () => {
    const second = await (await notes('POST', { imageUrl: uploaded, isPublic: true })).json();
    assert.equal((await notes('PATCH', { attachments: [] }, saved.id)).status, 200);
    assert.equal((await image(uploaded, false)).status, 200);
    assert.equal((await notes('DELETE', undefined, second.id)).status, 200);
    assert.equal((await image(uploaded)).status, 404);
    assert.equal(await imageStore().get(uploaded.split('/').at(-1)), null);
  });

  await t.test('link-only notes persist without requiring text or a photo', async () => {
    const attachments = [{ type: 'link', url: 'https://youtu.be/abcdefghijk', title: 'A film to keep' }];
    const response = await notes('POST', { attachments });
    assert.equal(response.status, 201);
    const note = await response.json();
    assert.equal(note.text, '');
    assert.equal(note.imageUrl, null);
    assert.equal(note.isPublic, false);
    assert.deepEqual(note.attachments, attachments);
    const updated = await notes('PATCH', { attachments: [{ type: 'link', url: 'https://example.org/', title: 'An essay' }] }, note.id);
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).attachments[0].title, 'An essay');
    assert.equal((await notes('DELETE', undefined, note.id)).status, 200);
  });

  await t.test('featured selection persists across create, unrelated edits, reads, and deselection', async () => {
    const note = await (await notes('POST', { text: 'Selected moment', featured: true, isPublic: true })).json();
    assert.equal(note.featured, true);
    await notes('PATCH', { text: 'Still selected' }, note.id);
    const publicNotes = await (await notes('GET', undefined, undefined, false)).json();
    assert.equal(publicNotes.find((item) => item.id === note.id).featured, true);
    assert.equal((await notes('PATCH', { featured: 'true' }, note.id)).status, 400);
    const updated = await (await notes('PATCH', { featured: false }, note.id)).json();
    assert.equal(updated.featured, false);
    const reread = await (await notes('GET')).json();
    assert.equal(reread.find((item) => item.id === note.id).featured, false);
    await notes('DELETE', undefined, note.id);
  });

  await t.test('empty edits are rejected, private toggles hide images, and legacy images still work', async () => {
    assert.equal((await notes('PATCH', { text: '', attachments: [] }, saved.id)).status, 400);
    const legacyKey = '12345678-1234-1234-1234-123456789abc';
    await imageStore().set(legacyKey, new Uint8Array([1, 2, 3]).buffer);
    await seed([{ id: 'legacy', text: '', mood: 'calm', isPublic: true, imageUrl: `/api/images/${legacyKey}`, createdAt: new Date().toISOString() }]);
    assert.equal((await image(`/api/images/${legacyKey}`, false)).status, 200);
    await notes('PATCH', { isPublic: false }, 'legacy');
    assert.equal((await image(`/api/images/${legacyKey}`, false)).status, 404);
    assert.equal((await image(`/api/images/${legacyKey}`)).status, 200);
    await notes('DELETE', undefined, 'legacy');
    assert.equal((await image(`/api/images/${legacyKey}`)).status, 404);
  });
});
