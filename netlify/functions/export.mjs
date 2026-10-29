import crypto from 'node:crypto';
import { getSession } from '../lib/auth.mjs';
import { fail, json } from '../lib/http.mjs';
import { imageStore, loadNotes } from '../lib/store.mjs';
import { loadMedia } from '../lib/media.mjs';
import { getAttachments, IMAGE_PREFIX } from '../../shared/attachments.js';
import { mediaId } from '../../shared/media.js';

export default async (req) => {
  if (!getSession(req)) return fail(401, 'Only the keeper may export the journal.');
  if (req.method !== 'GET') return fail(405, 'Method not allowed');
  const notes = (await loadNotes()).map((note) => ({ ...note, schemaVersion: 1, attachments: getAttachments(note) }));
  const assets = [];
  const urls = new Set(notes.flatMap((note) => note.attachments.map((item) => item.url)));
  for (const url of urls) {
    const id = mediaId(url);
    if (id) {
      const manifest = await loadMedia(id);
      if (!manifest?.complete) return fail(409, `Cannot export: attachment ${id} is missing or incomplete.`);
      assets.push({ ...manifest, url, path: `assets/${id}`, downloadParts: Array.from({ length: manifest.parts }, (_, index) => `${url}/parts/${index}`) });
    } else if (url.startsWith(IMAGE_PREFIX)) {
      const key = url.slice(IMAGE_PREFIX.length);
      const blob = await imageStore().getWithMetadata(key, { type: 'arrayBuffer' });
      if (!blob) return fail(409, `Cannot export: legacy image ${key} is missing.`);
      assets.push({
        id: key, url, path: `assets/${key}`, type: 'image', name: key,
        contentType: blob.metadata?.contentType || 'application/octet-stream',
        size: blob.data.byteLength, parts: 1, downloadParts: [url],
        sha256: [crypto.createHash('sha256').update(new Uint8Array(blob.data)).digest('hex')],
      });
    }
  }
  return json({ schemaVersion: 1, exportedAt: new Date().toISOString(), notes, assets }, 200, {
    'content-disposition': 'attachment; filename="journal.json"',
  });
};

export const config = { path: '/api/export' };
