import crypto from 'node:crypto';
import { getSession } from '../lib/auth.mjs';
import { fail, isTrustedMutation, json, readJson } from '../lib/http.mjs';
import { IMAGE_PREFIX, imageStore, loadNotes, createNote, updateNote, deleteNote } from '../lib/store.mjs';
import { sanitizeNoteInput } from '../lib/schema.mjs';
import { getAttachments, hasNoteContent } from '../../shared/attachments.js';
import { mediaId } from '../../shared/media.js';
import { deleteMedia, loadMedia, mediaAttachment } from '../lib/media.mjs';

async function validateStoredAttachments(input) {
  for (const attachment of getAttachments(input)) {
    const id = mediaId(attachment.url);
    if (!id) continue;
    const manifest = await loadMedia(id);
    if (!manifest?.complete) throw new InvalidNoteError('An attached file has not finished uploading.');
    const canonical = mediaAttachment(manifest);
    if (Object.entries(canonical).some(([key, value]) => attachment[key] !== value)) {
      throw new InvalidNoteError('Attachment metadata does not match the stored file.');
    }
  }
}

async function removeUnusedAttachments(removed, remainingNotes) {
  const remaining = new Set(remainingNotes.flatMap((note) => getAttachments(note).map((item) => item.url)));
  const urls = new Set(getAttachments(removed).map((item) => item.url));
  for (const url of urls) {
    if (remaining.has(url)) continue;
    try {
      if (mediaId(url)) await deleteMedia(mediaId(url));
      else if (url.startsWith(IMAGE_PREFIX)) await imageStore().delete(url.slice(IMAGE_PREFIX.length));
    } catch (error) {
      console.error('Could not remove unused journal attachment.', { url, error });
    }
  }
}

class InvalidNoteError extends Error {}

async function validateInput(body, existing) {
  let input;
  try {
    input = sanitizeNoteInput(body, existing);
  } catch (error) {
    throw new InvalidNoteError(error.message, { cause: error });
  }
  await validateStoredAttachments(input);
  return input;
}

async function handleNotes(req, context) {
  const id = context.params?.id;
  const authed = Boolean(getSession(req));

  if (req.method === 'GET') {
    return json(await loadNotes({ publicOnly: !authed }));
  }

  if (!authed) return fail(401, 'Only the keeper may write here.');
  if (!isTrustedMutation(req)) return fail(403, 'Forbidden');
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return fail(405, 'Method not allowed');

  if (req.method === 'POST' && !id) {
    const body = await readJson(req);
    let input;
    try {
      input = await validateInput(body);
    } catch (error) {
      if (error instanceof InvalidNoteError) return fail(400, error.message);
      throw error;
    }
    if (!hasNoteContent(input)) return fail(400, 'Add a few words, a photo, or a link.');
    const now = new Date().toISOString();
    const note = {
      schemaVersion: 1,
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
    return json(await createNote(note), 201);
  }

  if (!id) return fail(404, 'No such note.');

  if (req.method === 'PATCH') {
    const body = await readJson(req);
    let result;
    try {
      result = await updateNote(id, async (previous) => {
        const input = await validateInput(body, previous);
        const updated = { ...previous, ...input, schemaVersion: 1, updatedAt: new Date().toISOString() };
        if (!hasNoteContent(updated)) throw new InvalidNoteError('A note needs words, an attachment, or a link.');
        return updated;
      });
    } catch (error) {
      if (error instanceof InvalidNoteError) return fail(400, error.message);
      throw error;
    }
    if (!result) return fail(404, 'No such note.');
    await removeUnusedAttachments(result.previous, await loadNotes());
    return json(result.updated);
  }

  if (req.method === 'DELETE') {
    const removed = await deleteNote(id);
    if (!removed) return fail(404, 'No such note.');
    await removeUnusedAttachments(removed, await loadNotes());
    return json({ ok: true });
  }

  return fail(405, 'Method not allowed');
}

export default async (req, context) => {
  try { return await handleNotes(req, context); } catch (error) {
    console.error('Journal database request failed.', { method: req.method, error });
    return fail(503, 'The journal database is unavailable. Please try again; your draft has not been cleared.');
  }
};

export const config = { path: ['/api/notes', '/api/notes/:id'] };
