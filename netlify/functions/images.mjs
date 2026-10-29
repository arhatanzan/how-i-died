import crypto from 'node:crypto';
import { getSession } from '../lib/auth.mjs';
import { fail, isTrustedMutation, json } from '../lib/http.mjs';
import { IMAGE_PREFIX, imageStore, loadNotes } from '../lib/store-file-db.mjs';
import { getAttachments, IMAGE_TYPES, MAX_IMAGE_BYTES } from '../../shared/attachments.js';


export default async (req, context) => {
  const key = context.params?.key;
  const store = imageStore();

  if (req.method === 'GET' && key) {
    if (!/^[0-9a-f-]{36}$/.test(key)) return fail(404, 'Not found');
    // Images belonging to private notes (or not yet attached) are visible only to the keeper.
    if (!getSession(req)) {
      const notes = await loadNotes();
      const publicImage = notes.some((note) => note.isPublic
        && getAttachments(note).some((item) => item.type === 'image' && item.url === `${IMAGE_PREFIX}${key}`));
      if (!publicImage) return fail(404, 'Not found');
    }
    const blob = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!blob) return fail(404, 'Not found');
    return new Response(blob.data, {
      headers: {
        'content-type': blob.metadata?.contentType || 'application/octet-stream',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  if (req.method === 'POST' && !key) {
    if (!getSession(req)) return fail(401, 'Only the keeper may write here.');
    if (!isTrustedMutation(req)) return fail(403, 'Forbidden');
    const contentType = (req.headers.get('content-type') || '').split(';')[0].trim();
    if (!IMAGE_TYPES.includes(contentType)) return fail(415, 'Upload a JPEG, PNG, WebP, or GIF image.');
    if (Number(req.headers.get('content-length')) > MAX_IMAGE_BYTES) return fail(413, 'Image too large');
    const data = await req.arrayBuffer();
    if (!data.byteLength) return fail(400, 'Empty image');
    if (data.byteLength > MAX_IMAGE_BYTES) return fail(413, 'Image too large');
    const id = crypto.randomUUID();
    await store.set(id, data, { metadata: { contentType } });
    return json({ url: `${IMAGE_PREFIX}${id}` }, 201);
  }

  return req.method === 'GET' ? fail(404, 'Not found') : fail(405, 'Method not allowed');
};

export const config = { path: ['/api/images', '/api/images/:key'] };
