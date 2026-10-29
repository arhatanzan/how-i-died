import crypto from 'node:crypto';
import { getSession } from '../lib/auth.mjs';
import { fail, isTrustedMutation, json, readJson } from '../lib/http.mjs';
import { loadNotes, mediaStore } from '../lib/store-file-db.mjs';
import { chunkKey, deleteMedia, loadMedia, manifestKey, mediaAttachment } from '../lib/media.mjs';
import { getAttachments } from '../../shared/attachments.js';
import { CHUNK_BYTES, fileMetadata, isMediaId, MEDIA_PREFIX } from '../../shared/media.js';
import { readFilePart, validateFileHeader } from '../lib/file-validation.mjs';

async function handleMedia(req, context) {
  const { id, part, action } = context.params || {};
  const authed = Boolean(getSession(req));
  if (id && !isMediaId(id)) return fail(404, 'Not found');
  if (req.method !== 'GET' && (!authed || !isTrustedMutation(req))) {
    return fail(authed ? 403 : 401, authed ? 'Forbidden' : 'Only the keeper may upload here.');
  }
  if (req.method === 'POST' && !id) {
    let metadata;
    try { metadata = fileMetadata(await readJson(req)); } catch (error) { return fail(400, error.message); }
    const uploadId = crypto.randomUUID();
    const manifest = { schemaVersion: 1, id: uploadId, ...metadata, parts: Math.ceil(metadata.size / CHUNK_BYTES), chunkBytes: CHUNK_BYTES, complete: false, createdAt: new Date().toISOString() };
    await mediaStore().setJSON(manifestKey(uploadId), manifest);
    return json(manifest, 201);
  }
  if (!id) return fail(405, 'Method not allowed');
  const manifest = await loadMedia(id);
  if (!manifest) return fail(404, 'Not found');
  if (req.method === 'GET') {
    if (!manifest.complete) return fail(404, 'Upload is not complete.');
    if (!authed) {
      const publicFile = (await loadNotes()).some((note) => note.isPublic
        && getAttachments(note).some((item) => item.url === `${MEDIA_PREFIX}${id}`));
      if (!publicFile) return fail(404, 'Not found');
    }
    if (part === undefined) return json(manifest);
    if (!/^(0|[1-9]\d*)$/.test(part) || Number(part) >= manifest.parts) return fail(404, 'Not found');
    const data = await mediaStore().get(chunkKey(id, Number(part)), { type: 'arrayBuffer' });
    if (!data) return fail(404, 'File part is missing.');
    return new Response(data, { headers: {
      'content-type': manifest.contentType || 'application/octet-stream',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    } });
  }
  if (req.method === 'DELETE' && part === undefined && !action) {
    if ((await loadNotes()).some((note) => getAttachments(note).some((item) => item.url === `${MEDIA_PREFIX}${id}`))) {
      return fail(409, 'This file is still attached to a note.');
    }
    await deleteMedia(id);
    return json({ ok: true });
  }
  if (req.method === 'PUT' && part !== undefined) {
    if (manifest.complete) return fail(409, 'This upload is already complete.');
    if (!/^(0|[1-9]\d*)$/.test(part) || Number(part) >= manifest.parts) return fail(400, 'Invalid file part.');
    const index = Number(part);
    const expected = Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES);
    if (Number(req.headers.get('content-length')) > expected) return fail(413, 'File part is too large.');
    let data;
    try { data = await readFilePart(req, expected); } catch (error) { return fail(413, error.message); }
    if (data.byteLength !== expected) return fail(400, 'File part has an unexpected size.');
    if (index === 0) {
      try { validateFileHeader(manifest, data); } catch (error) { return fail(415, error.message); }
    }
    const sha256 = crypto.createHash('sha256').update(new Uint8Array(data)).digest('hex');
    await mediaStore().set(chunkKey(id, index), data, { metadata: { size: expected, sha256 } });
    return json({ index, sha256 });
  }
  if (req.method === 'POST' && action === 'complete') {
    if (!manifest.complete) {
      const hashes = [];
      for (let index = 0; index < manifest.parts; index++) {
        const metadata = await mediaStore().getMetadata(chunkKey(id, index));
        if (!metadata?.metadata?.sha256) return fail(400, 'Upload is missing file parts. Retry the upload.');
        hashes.push(metadata.metadata.sha256);
      }
      manifest.complete = true;
      manifest.sha256 = hashes;
      await mediaStore().setJSON(manifestKey(id), manifest);
    }
    return json(mediaAttachment(manifest));
  }
  return fail(405, 'Method not allowed');
}

export default async (req, context) => {
  try {
    return await handleMedia(req, context);
  } catch (error) {
    console.error('Media upload request failed.', { method: req.method, url: req.url, error });
    return fail(503, 'The media storage is unavailable. Please try again; your upload has not been cleared.');
  }
};

export const config = { path: ['/api/media', '/api/media/:id', '/api/media/:id/parts/:part', '/api/media/:id/:action'] };
