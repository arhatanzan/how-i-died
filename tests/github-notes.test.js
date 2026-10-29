import test from 'node:test';
import assert from 'node:assert/strict';

test('GitHub-backed notes and attachments work without search indexing', async (t) => {
  const environment = {
    GITHUB_TOKEN: 'test-token',
    GITHUB_OWNER: 'test-owner',
    GITHUB_REPO: 'test-journal',
    ADMIN_USERNAME: 'test-keeper',
    ADMIN_PASSWORD: 'local-test-only',
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const files = new Map();
  const unexpected = [];
  let unavailable = false;
  let deletionUnavailable = false;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = options?.method || 'GET';
    const prefix = '/repos/test-owner/test-journal/contents/';
    const respond = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    if (url.pathname === '/repos/test-owner/test-journal/git/trees/HEAD') {
      if (unavailable) return respond({ message: 'Storage unavailable' }, 403);
      return respond({ truncated: false, tree: [
        ...Array.from(files.keys(), path => ({ path, type: 'blob' })),
        { path: 'data/journal/attachments/media/upload.meta.json', type: 'blob' },
        { path: 'data/journal/MANIFEST.json', type: 'blob' },
      ] });
    }
    if (url.pathname.startsWith(prefix)) {
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      if (method === 'PUT') {
        const body = JSON.parse(options.body);
        files.set(path, body.content);
        return respond({ content: { path }, commit: { html_url: 'https://example.org/commit' } });
      }
      if (method === 'DELETE') {
        if (deletionUnavailable) return respond({ message: 'Deletion unavailable' }, 403);
        if (!files.delete(path)) return respond({ message: 'Not Found' }, 404);
        return respond({ commit: { html_url: 'https://example.org/delete' } });
      }
      if (files.has(path)) {
        const content = files.get(path);
        const headers = new Headers(options.headers);
        if (headers.get('accept')?.includes('raw')) {
          return new Response(Buffer.from(content, 'base64'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
        if (Buffer.from(content, 'base64').length > 1024 * 1024) return respond({ content: '', encoding: 'none', sha: 'test-sha' });
        return respond({ content, sha: 'test-sha' });
      }
      return respond({ message: 'Not Found' }, 404);
    }
    unexpected.push(`${method} ${url.pathname}`);
    return respond({ message: 'Code search is not available' }, 503);
  });

  const { default: notesHandler } = await import('../netlify/functions/notes.mjs');
  const { issueToken } = await import('../netlify/lib/auth.mjs');
  const { APP_REQUEST_ID } = await import('./constants.mjs');
  const cookie = `hid_session=${issueToken('test-keeper')}`;
  const request = (method, body, id, authenticated = true) => notesHandler(new Request('http://localhost/api/notes', {
    method,
    headers: {
      ...(authenticated ? { cookie } : {}),
      'x-requested-with': APP_REQUEST_ID,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { params: { id } });

  const created = await request('POST', { text: 'A private moment', isPublic: false });
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal(saved.isPublic, false);
  assert.deepEqual(await (await request('GET', undefined, undefined, false)).json(), []);

  const published = await request('PATCH', { isPublic: true }, saved.id);
  assert.equal(published.status, 200);
  assert.equal((await published.json()).isPublic, true);
  const publicNotes = await (await request('GET', undefined, undefined, false)).json();
  assert.equal(publicNotes.length, 1);
  assert.equal(publicNotes[0].id, saved.id);
  assert.equal(publicNotes[0].text, saved.text);
  assert.equal(publicNotes[0].isPublic, true);
  assert.equal((await request('PATCH', { isPublic: true }, 'missing')).status, 404);

  await t.test('note validation and write authorization reject invalid mutations', async () => {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      assert.equal((await request(method, method === 'DELETE' ? undefined : { text: 'Not allowed' }, saved.id, false)).status, 401);
    }
    for (const body of [null, {}, { text: 'x'.repeat(20001) }, { text: 'Invalid', featured: 'true' }]) {
      assert.equal((await request('POST', body)).status, 400);
    }
    assert.equal((await notesHandler(new Request('http://localhost/api/notes', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Untrusted' }),
    }), { params: {} })).status, 403);
  });

  await t.test('storage failures return an explicit error instead of empty notes or false 404s', async () => {
    unavailable = true;
    try {
      assert.equal((await request('GET')).status, 503);
      assert.equal((await request('PATCH', { isPublic: true }, saved.id)).status, 503);
      assert.equal((await request('DELETE', undefined, saved.id)).status, 503);
    } finally {
      unavailable = false;
    }
    deletionUnavailable = true;
    try {
      assert.equal((await request('DELETE', undefined, saved.id)).status, 503);
      assert.equal((await (await request('GET')).json()).some(item => item.id === saved.id), true);
    } finally {
      deletionUnavailable = false;
    }
  });

  await t.test('large chunks use raw GitHub bytes and JSON-looking documents stay binary', async () => {
    const { mediaStore } = await import('../netlify/lib/store-file-db.mjs');
    const assetId = '23456789-1234-1234-1234-123456789abc';
    const large = Buffer.alloc(4 * 1024 * 1024);
    for (let index = 0; index < large.length; index++) large[index] = index % 256;
    files.set(`data/journal/attachments/media/${assetId}-part-0`, large.toString('base64'));
    const bytes = await mediaStore().get(`${assetId}/parts/0`, { type: 'arrayBuffer' });
    assert.deepEqual(Buffer.from(bytes), large);
    const document = Buffer.from('{"journal":"original bytes"}');
    files.set(`data/journal/attachments/media/${assetId}-part-1`, document.toString('base64'));
    assert.deepEqual(Buffer.from(await mediaStore().get(`${assetId}/parts/1`, { type: 'arrayBuffer' })), document);
    files.delete(`data/journal/attachments/media/${assetId}-part-0`);
    files.delete(`data/journal/attachments/media/${assetId}-part-1`);
  });

  await t.test('changing the note date updates one file and deletion uses its stored path', async () => {
    const changed = await request('PATCH', { createdAt: '2025-02-03T10:30:00.000Z' }, saved.id);
    assert.equal(changed.status, 200);
    const notes = (await (await request('GET')).json()).filter(item => item.id === saved.id);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].createdAt, '2025-02-03T10:30:00.000Z');
    assert.equal(Array.from(files.keys()).filter(path => path.endsWith(`/${saved.id}.json`)).length, 1);
    assert.equal((await request('DELETE', undefined, saved.id)).status, 200);
    assert.equal((await (await request('GET')).json()).some(item => item.id === saved.id), false);
  });

  await t.test('uploaded attachment metadata survives saving, reloading, and editing', async () => {
    const assetId = '12345678-1234-1234-1234-123456789abc';
    const attachment = {
      assetId,
      url: `/api/media/${assetId}`,
      type: 'file',
      name: 'journal.txt',
      contentType: 'text/plain',
      size: 12,
      title: 'A document',
    };
    files.set(`data/journal/attachments/media/${assetId}-manifest`, Buffer.from(JSON.stringify({
      id: assetId, type: attachment.type, name: attachment.name,
      contentType: attachment.contentType, size: attachment.size, complete: true, parts: 1,
    })).toString('base64'));
    const response = await request('POST', { attachments: [attachment] });
    assert.equal(response.status, 201);
    const note = await response.json();
    const reloaded = (await (await request('GET')).json()).find(item => item.id === note.id);
    assert.deepEqual(reloaded.attachments, [attachment]);
    const edited = await request('PATCH', { isPublic: true }, note.id);
    assert.equal(edited.status, 200);
    assert.deepEqual((await edited.json()).attachments, [attachment]);

    const path = Array.from(files.keys()).find(key => key.endsWith(`/${note.id}.json`));
    const legacy = JSON.parse(Buffer.from(files.get(path), 'base64').toString());
    legacy.attachments = [{ type: attachment.type, url: attachment.url, title: attachment.title }];
    files.set(path, Buffer.from(JSON.stringify(legacy)).toString('base64'));
    const restored = (await (await request('GET')).json()).find(item => item.id === note.id);
    assert.deepEqual(restored.attachments, [attachment]);
    const repaired = await request('PATCH', { text: 'Editable again' }, note.id);
    assert.equal(repaired.status, 200);
    assert.deepEqual((await repaired.json()).attachments, [attachment]);

    const shared = await (await request('POST', { attachments: [attachment] })).json();
    const prefix = `data/journal/attachments/media/${assetId}`;
    files.set(`${prefix}-part-0`, Buffer.from('file content').toString('base64'));
    files.set(`${prefix}-part-0.meta.json`, Buffer.from('{}').toString('base64'));
    assert.equal((await request('DELETE', undefined, note.id)).status, 200);
    assert.equal(files.has(`${prefix}-manifest`), true);
    assert.equal(files.has(`${prefix}-part-0`), true);
    assert.equal((await request('DELETE', undefined, shared.id)).status, 200);
    assert.equal(files.has(`${prefix}-manifest`), false);
    assert.equal(files.has(`${prefix}-part-0`), false);
    assert.equal(files.has(`${prefix}-part-0.meta.json`), false);
  });

  await t.test('legacy image visibility follows its notes and final deletion removes the image', async () => {
    const { imageStore } = await import('../netlify/lib/store-file-db.mjs');
    const { default: imagesHandler } = await import('../netlify/functions/images.mjs');
    const key = '34567890-1234-1234-1234-123456789abc';
    const url = `/api/images/${key}`;
    await imageStore().set(key, new Uint8Array([137, 80, 78, 71]), { metadata: { contentType: 'image/png' } });
    const image = (authenticated = true) => imagesHandler(new Request(`http://localhost${url}`, {
      headers: authenticated ? { cookie } : {},
    }), { params: { key } });
    const note = await (await request('POST', { imageUrl: url })).json();
    assert.equal((await image()).status, 200);
    assert.equal((await image(false)).status, 404);
    assert.equal((await request('PATCH', { isPublic: true }, note.id)).status, 200);
    assert.equal((await image(false)).status, 200);
    const shared = await (await request('POST', { imageUrl: url })).json();
    assert.equal((await request('DELETE', undefined, note.id)).status, 200);
    assert.equal((await image()).status, 200);
    assert.equal((await image(false)).status, 404);
    assert.equal((await request('DELETE', undefined, shared.id)).status, 200);
    assert.equal((await image()).status, 404);
    assert.equal(files.has(`data/journal/attachments/images/${key}.meta.json`), false);
  });

  await t.test('chunk upload completion, public reads, and note deletion preserve byte integrity', async () => {
    const { default: mediaHandler } = await import('../netlify/functions/media.mjs');
    const media = (method, body, params = {}, authenticated = true) => mediaHandler(new Request('http://localhost/api/media', {
      method,
      headers: {
        ...(authenticated ? { cookie } : {}), 'x-requested-with': APP_REQUEST_ID,
        'content-type': body instanceof Uint8Array ? 'application/octet-stream' : 'application/json',
      },
      body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
    }), { params });
    const bytes = Buffer.from('{"journal":"original bytes"}');
    assert.equal((await media('POST', { name: 'journal.txt', size: bytes.length }, {}, false)).status, 401);
    const started = await media('POST', { name: 'journal.txt', size: bytes.length, contentType: 'text/plain' });
    assert.equal(started.status, 201);
    const upload = await started.json();
    assert.equal((await media('POST', {}, { id: upload.id, action: 'complete' })).status, 400);
    assert.equal((await media('PUT', bytes, { id: upload.id, part: '0' })).status, 200);
    const completed = await media('POST', {}, { id: upload.id, action: 'complete' });
    assert.equal(completed.status, 200);
    const attachment = await completed.json();
    const note = await (await request('POST', { attachments: [attachment] })).json();
    const { default: exportHandler } = await import('../netlify/functions/export.mjs');
    assert.equal((await exportHandler(new Request('http://localhost/api/export'))).status, 401);
    const exported = await exportHandler(new Request('http://localhost/api/export', { headers: { cookie } }));
    assert.equal(exported.status, 200);
    const backup = await exported.json();
    assert.deepEqual(backup.notes.find(item => item.id === note.id).attachments, note.attachments);
    assert.equal(backup.assets.find(item => item.id === upload.id).size, bytes.length);
    assert.equal(backup.assets.find(item => item.id === upload.id).sha256.length, 1);
    assert.equal((await media('GET', undefined, { id: upload.id }, false)).status, 404);
    assert.equal((await media('DELETE', undefined, { id: upload.id })).status, 409);
    assert.equal((await request('PATCH', { isPublic: true }, note.id)).status, 200);
    assert.equal((await media('GET', undefined, { id: upload.id }, false)).status, 200);
    const downloaded = await media('GET', undefined, { id: upload.id, part: '0' }, false);
    assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    assert.equal((await request('DELETE', undefined, note.id)).status, 200);
    assert.equal((await media('GET', undefined, { id: upload.id })).status, 404);
  });
  assert.deepEqual(unexpected, []);
});