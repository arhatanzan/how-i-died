import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mediaHandler from '../netlify/functions/media.mjs';
import notesHandler from '../netlify/functions/notes.mjs';
import exportHandler from '../netlify/functions/export.mjs';
import imagesHandler from '../netlify/functions/images.mjs';
import authHandler from '../netlify/functions/auth.mjs';
import { issueToken } from '../netlify/lib/auth.mjs';
import { imageStore, mediaStore } from '../netlify/lib/store-file-db.mjs';
import { chunkKey, loadMedia } from '../netlify/lib/media.mjs';
import { CHUNK_BYTES, fileMetadata, MAX_FILE_BYTES, MEDIA_PREFIX } from '../shared/media.js';
import { validateAttachments } from '../shared/attachments.js';
import { exportJournal } from '../scripts/export-journal.mjs';
import { selectNotes } from '../src/lib/journal.js';
import { validateFileHeader } from '../netlify/lib/file-validation.mjs';
import { testDatabase } from './support/database.mjs';
import { APP_REQUEST_ID } from './constants.mjs';

test('supported uploads use a strict format allowlist and exact size limits', () => {
  for (const name of ['photo.jpg', 'photo.gif', 'clip.mp4', 'clip.mov', 'clip.webm', 'song.mp3', 'memo.m4a', 'memo.ogg', 'scan.pdf', 'report.doc', 'report.docx', 'data.xlsx', 'slides.pptx', 'art.svg', 'essay.txt', 'data.csv', 'sheet.ods', 'slides.odp']) {
    assert.doesNotThrow(() => fileMetadata({ name, size: MAX_FILE_BYTES }));
  }
  for (const name of ['app.apk', 'app.exe', 'script.js', 'script.sh', 'site.html', 'package.zip', 'macros.docm', 'sheet.xlsm', '../photo.jpg', 'bad\nfile.pdf']) {
    assert.throws(() => fileMetadata({ name, size: 10 }));
  }
  for (const size of [0, -1, 0.5, '20', MAX_FILE_BYTES + 1]) assert.throws(() => fileMetadata({ name: 'file.pdf', size }));
  assert.equal(fileMetadata({ name: 'memo.webm', type: 'audio/webm;codecs=opus', size: 20 }).type, 'audio');
});

test('uploaded attachment metadata is validated and filenames are searchable', () => {
  const assetId = crypto.randomUUID();
  const attachment = { assetId, url: `${MEDIA_PREFIX}${assetId}`, ...fileMetadata({ name: 'report.pdf', size: 20 }), title: ' A document ' };
  assert.equal(validateAttachments([attachment])[0].title, 'A document');
  for (const patch of [{ assetId: crypto.randomUUID() }, { type: 'video' }, { contentType: 'text/html' }, { name: 'app.apk' }, { size: MAX_FILE_BYTES + 1 }, { title: 'x'.repeat(201) }]) {
    assert.throws(() => validateAttachments([{ ...attachment, ...patch }]));
  }
  assert.throws(() => validateAttachments([{ type: 'file', url: 'https://example.org/script.html' }]));
  const note = { id: 'one', text: '', createdAt: new Date().toISOString(), attachments: [attachment] };
  assert.equal(selectNotes([note], { search: 'report.pdf' }).length, 1);
});

test('server signature checks reject renamed executables, APK/ZIP packages and fake media', () => {
  const bytes = (value) => new TextEncoder().encode(value).buffer;
  for (const data of ['MZbinary', '\u007fELF', 'dex\n035', 'PK\u0003\u0004package']) {
    assert.throws(() => validateFileHeader({ contentType: 'text/plain' }, bytes(data)));
  }
  assert.throws(() => validateFileHeader({ contentType: 'image/png' }, bytes('<html>bad image</html>')), /format/);
  assert.throws(() => validateFileHeader({ contentType: 'application/pdf' }, bytes('<html>bad pdf</html>')), /format/);
  assert.doesNotThrow(() => validateFileHeader({ contentType: 'application/pdf' }, bytes('%PDF-1.7')));
  assert.doesNotThrow(() => validateFileHeader({ contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, bytes('PK\u0003\u0004container')));
});

test('large attachments and portable exports persist through file-based storage', async (t) => {
  const { seed } = await testDatabase(t);
  const directory = await mkdtemp(join(tmpdir(), 'journal-media-test-'));
  const previous = { ADMIN_USERNAME: process.env.ADMIN_USERNAME, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD };
  process.env.ADMIN_USERNAME = 'test-keeper';
  process.env.ADMIN_PASSWORD = 'local-test-only';
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const cookie = `hid_session=${issueToken('test-keeper')}`;
  const req = (path, method = 'GET', body, authenticated = true, trusted = true) => new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(authenticated ? { cookie } : {}),
      ...(trusted ? { 'x-requested-with': APP_REQUEST_ID } : {}),
      'content-type': body instanceof Uint8Array ? 'application/octet-stream' : 'application/json',
    },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const media = (method, body, id, part, action, authenticated = true, trusted = true) => mediaHandler(req('/api/media', method, body, authenticated, trusted), { params: { id, part, action } });
  const notes = (method, body, id, authenticated = true) => notesHandler(req('/api/notes', method, body, authenticated), { params: { id } });
  await seed([]);
  let upload;
  let attachment;
  let note;
  const data = new Uint8Array(CHUNK_BYTES * 2 + 19);
  crypto.randomFillSync(data);
  data.set(new TextEncoder().encode('ftyp'), 4);

  await t.test('rejects unauthorized uploads, unsafe types and out-of-limit sizes', async () => {
    assert.equal((await media('POST', { name: 'clip.mp4', size: 1 }, undefined, undefined, undefined, false)).status, 401);
    assert.equal((await media('POST', { name: 'clip.mp4', size: 1 }, undefined, undefined, undefined, true, false)).status, 403);
    for (const body of [null, { name: 'app.apk', size: 10 }, { name: 'clip.mp4', size: MAX_FILE_BYTES + 1 }]) assert.equal((await media('POST', body)).status, 400);
    const maximum = await (await media('POST', { name: 'large.mp4', size: MAX_FILE_BYTES })).json();
    assert.equal(maximum.size, MAX_FILE_BYTES);
    assert.equal(maximum.parts, 63);
    await media('DELETE', undefined, maximum.id);
  });
  await t.test('upload chunks are bounded and unfinished files cannot be attached or read', async () => {
    upload = await (await media('POST', { name: 'clip.mp4', size: data.length })).json();
    assert.equal(upload.parts, 3);
    assert.equal((await media('GET', undefined, upload.id)).status, 404);
    assert.equal((await media('POST', {}, upload.id, undefined, 'complete')).status, 400);
    const pending = { assetId: upload.id, url: `${MEDIA_PREFIX}${upload.id}`, type: 'video', name: upload.name, size: upload.size, contentType: upload.contentType };
    assert.equal((await notes('POST', { attachments: [pending] })).status, 400);
    assert.equal((await media('PUT', data.slice(0, 1), upload.id, '0')).status, 400);
    assert.equal((await media('PUT', data.slice(0, 20), upload.id, '2')).status, 413);
    assert.equal((await media('PUT', data.slice(0, 1), upload.id, '3')).status, 400);
    assert.equal((await media('PUT', data.slice(0, 1), upload.id, '0.0')).status, 400);
    for (let index = 0; index < upload.parts; index++) {
      assert.equal((await media('PUT', data.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES), upload.id, String(index))).status, 200);
    }
    attachment = await (await media('POST', {}, upload.id, undefined, 'complete')).json();
    assert.deepEqual(await (await media('POST', {}, upload.id, undefined, 'complete')).json(), attachment);
    assert.equal((await media('PUT', data.slice(0, CHUNK_BYTES), upload.id, '0')).status, 409);
  });
  await t.test('private/public visibility, canonical metadata and all file bytes survive a save', async () => {
    assert.equal((await media('GET', undefined, upload.id, undefined, undefined, false)).status, 404);
    assert.equal((await notes('POST', { attachments: [{ ...attachment, size: 1 }] })).status, 400);
    note = await (await notes('POST', { attachments: [attachment] })).json();
    assert.equal(note.schemaVersion, 1);
    assert.equal(note.text, '');
    assert.equal((await media('DELETE', undefined, upload.id)).status, 409);
    await notes('PATCH', { isPublic: true }, note.id);
    assert.equal((await media('GET', undefined, upload.id, undefined, undefined, false)).status, 200);
    const loaded = [];
    for (let index = 0; index < upload.parts; index++) {
      const response = await media('GET', undefined, upload.id, String(index), undefined, false);
      assert.equal(response.headers.get('content-type'), 'application/octet-stream');
      assert.equal(response.headers.get('content-disposition'), 'attachment');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), (await loadMedia(upload.id)).sha256[index]);
      loaded.push(bytes);
    }
    assert.deepEqual(Buffer.concat(loaded), Buffer.from(data));
    await notes('PATCH', { isPublic: false }, note.id);
    assert.equal((await media('GET', undefined, upload.id, '0', undefined, false)).status, 404);
  });
  await t.test('versioned export includes private notes, legacy images, external links and verified actual files', async () => {
    assert.equal((await exportHandler(req('/api/export', 'GET', undefined, false))).status, 401);
    const legacyId = crypto.randomUUID();
    const legacy = new Uint8Array([137, 80, 78, 71]);
    await imageStore().set(legacyId, legacy.buffer, { metadata: { contentType: 'image/png' } });
    const link = { type: 'link', url: 'https://docs.google.com/document/d/example/edit', title: 'Google document' };
    await notes('POST', { text: 'Old photo and cloud doc', attachments: [{ type: 'image', url: `/api/images/${legacyId}`, alt: '' }, link] });
    const manifest = await (await exportHandler(req('/api/export'))).json();
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.notes.length, 2);
    assert.equal(manifest.assets.length, 2);
    const destination = join(directory, 'backup');
    const fetcher = async (url, options) => {
      const request = new Request(url, options);
      const path = new URL(url).pathname;
      if (path === '/api/login') return authHandler(request);
      if (path === '/api/export') return exportHandler(request);
      if (path.startsWith('/api/images/')) return imagesHandler(request, { params: { key: path.split('/').at(-1) } });
      const [, , , id, , part] = path.split('/');
      return mediaHandler(request, { params: { id, part } });
    };
    assert.deepEqual(await exportJournal({ baseUrl: 'http://localhost', directory: destination, username: 'test-keeper', password: 'local-test-only', fetcher }), { notes: 2, assets: 2 });
    const exported = JSON.parse(await readFile(join(destination, 'journal.json'), 'utf8'));
    assert.equal(exported.notes.find((item) => item.id === note.id).isPublic, false);
    assert.equal(exported.notes.some((item) => item.attachments.some((entry) => entry.url === link.url)), true);
    assert.deepEqual(await readFile(join(destination, 'assets', upload.id)), Buffer.from(data));
    assert.deepEqual(await readFile(join(destination, 'assets', legacyId)), Buffer.from(legacy));
    await assert.rejects(exportJournal({ baseUrl: 'http://example.org', directory: destination, username: 'test', password: 'test', fetcher }), /HTTPS/);
  });
  await t.test('shared attachments are kept until the final reference disappears, including all chunks', async () => {
    const second = await (await notes('POST', { attachments: [attachment], isPublic: true })).json();
    await notes('DELETE', undefined, note.id);
    assert.equal((await media('GET', undefined, upload.id, '0', undefined, false)).status, 200);
    await notes('DELETE', undefined, second.id);
    assert.equal(await loadMedia(upload.id), null);
    for (let index = 0; index < upload.parts; index++) assert.equal(await mediaStore().get(chunkKey(upload.id, index)), null);
  });
  await t.test('an abandoned upload can be explicitly discarded', async () => {
    const abandoned = await (await media('POST', { name: 'memo.webm', type: 'audio/webm', size: 4 })).json();
    await media('PUT', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), abandoned.id, '0');
    assert.equal((await media('DELETE', undefined, abandoned.id)).status, 200);
    assert.equal(await loadMedia(abandoned.id), null);
    assert.equal(await mediaStore().get(chunkKey(abandoned.id, 0)), null);
  });
  await t.test('renamed executable bytes are refused even with an allowed document filename', async () => {
    const disguised = await (await media('POST', { name: 'notes.txt', size: 4 })).json();
    assert.equal((await media('PUT', new Uint8Array([77, 90, 0, 0]), disguised.id, '0')).status, 415);
    assert.equal((await media('POST', {}, disguised.id, undefined, 'complete')).status, 400);
    await media('DELETE', undefined, disguised.id);
  });
});
