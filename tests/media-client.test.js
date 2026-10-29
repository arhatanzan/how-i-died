import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { uploadFile, fetchMedia } from '../src/lib/media.js';
import { CHUNK_BYTES, MEDIA_PREFIX } from '../shared/media.js';

test('browser upload sends bounded chunks and removes an interrupted upload', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const id = crypto.randomUUID();
  const file = new File([new Uint8Array(CHUNK_BYTES + 11)], 'recording.webm', { type: 'audio/webm' });
  const sizes = [];
  const progress = [];
  let deleted = false;
  let fail = false;
  globalThis.fetch = async (path, options) => {
    if (path === '/api/media') return Response.json({ id, parts: 2 });
    if (path.endsWith('/complete')) return Response.json({ assetId: id, url: `${MEDIA_PREFIX}${id}` });
    if (options.method === 'DELETE') { deleted = true; return Response.json({ ok: true }); }
    sizes.push(options.body.size);
    if (fail && path.endsWith('/1')) return Response.json({ error: 'Test network failure' }, { status: 503 });
    return Response.json({ ok: true });
  };
  assert.equal((await uploadFile(file, (percent) => progress.push(percent))).assetId, id);
  assert.deepEqual(sizes, [CHUNK_BYTES, 11]);
  assert.equal(progress.at(-1), 100);
  fail = true;
  await assert.rejects(uploadFile(file, () => {}), /Test network failure/);
  assert.equal(deleted, true);
});

test('browser downloads verify hashes, refuse corrupt bytes, and respect cancellation', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const id = crypto.randomUUID();
  const data = new TextEncoder().encode('original document');
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const attachment = { url: `${MEDIA_PREFIX}${id}`, name: 'notes.txt' };
  let corrupt = false;
  globalThis.fetch = async (path, options) => {
    options?.signal?.throwIfAborted();
    if (path.endsWith('/0')) return new Response(corrupt ? 'wrong bytes' : data);
    return Response.json({ parts: 1, contentType: 'text/plain', size: data.length, sha256: [sha256] });
  };
  assert.equal(await (await fetchMedia(attachment)).text(), 'original document');
  corrupt = true;
  await assert.rejects(fetchMedia(attachment), /integrity/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchMedia(attachment, { signal: controller.signal }), { name: 'AbortError' });
});
