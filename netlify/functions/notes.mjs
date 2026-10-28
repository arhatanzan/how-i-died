import crypto from 'node:crypto';
import { getSession } from '../lib/auth.mjs';
import { fail, isTrustedMutation, json, readJson } from '../lib/http.mjs';
import { IMAGE_PREFIX, imageStore, loadNotes, saveNotes } from '../lib/store.mjs';
import { sanitizeNoteInput } from '../lib/schema.mjs';
import { getAttachments, hasNoteContent } from '../../shared/attachments.js';

async function removeUnusedImages(removed, remainingNotes) {
  const remaining = new Set(remainingNotes.flatMap((note) => getAttachments(note).map((item) => item.url)));
  const urls = new Set(getAttachments(removed).filter((item) => item.type === 'image').map((item) => item.url));
  for (const url of urls) {
    if (!url.startsWith(IMAGE_PREFIX) || remaining.has(url)) continue;
    try {
      await imageStore().delete(url.slice(IMAGE_PREFIX.length));
    } catch (error) {
      console.error('Could not remove unused journal image.', { url, error });
    }
  }
}

export default async (req, context) => {
  const id = context.params?.id;
  const authed = Boolean(getSession(req));

  if (req.method === 'GET') {
    const notes = await loadNotes();
    return json(authed ? notes : notes.filter((n) => n.isPublic));
  }

  if (!authed) return fail(401, 'Only the keeper may write here.');
  if (!isTrustedMutation(req)) return fail(403, 'Forbidden');
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return fail(405, 'Method not allowed');

  const notes = await loadNotes();

  if (req.method === 'POST' && !id) {
    const body = await readJson(req);
    let input;
    try {
      input = sanitizeNoteInput(body);
    } catch (error) {
      return fail(400, error.message);
    }
    if (!hasNoteContent(input)) return fail(400, 'Add a few words, a photo, or a link.');
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      text: input.text ?? '',
      mood: input.mood ?? 'meh',
      isPublic: input.isPublic ?? false,
      featured: input.featured ?? false,
      imageUrl: input.imageUrl ?? null,
      attachments: getAttachments(input),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };
    await saveNotes([note, ...notes]);
    return json(note, 201);
  }

  const index = notes.findIndex((n) => n.id === id);
  if (!id || index === -1) return fail(404, 'No such note.');

  if (req.method === 'PATCH') {
    const body = await readJson(req);
    let input;
    try {
      input = sanitizeNoteInput(body, notes[index]);
    } catch (error) {
      return fail(400, error.message);
    }
    const previous = notes[index];
    const updated = { ...previous, ...input, updatedAt: new Date().toISOString() };
    if (!hasNoteContent(updated)) return fail(400, 'A note needs words, a photo, or a link.');
    notes[index] = updated;
    await saveNotes(notes);
    await removeUnusedImages(previous, notes);
    return json(updated);
  }

  if (req.method === 'DELETE') {
    const [removed] = notes.splice(index, 1);
    await saveNotes(notes);
    await removeUnusedImages(removed, notes);
    return json({ ok: true });
  }

  return fail(405, 'Method not allowed');
};

export const config = { path: ['/api/notes', '/api/notes/:id'] };
