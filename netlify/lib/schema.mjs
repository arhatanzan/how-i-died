import { getAttachments, isImageUrl, validateAttachments } from '../../shared/attachments.js';

export const MOOD_KEYS = ['angry', 'sad', 'meh', 'calm', 'happy'];

export function sanitizeNoteInput(body, existing = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Send a note object.');
  const out = {};
  if ('text' in body) {
    if (typeof body.text !== 'string' || body.text.length > 20000) throw new Error('Notes must be 20,000 characters or fewer.');
    out.text = body.text.trim();
  }
  if ('mood' in body) {
    if (!MOOD_KEYS.includes(body.mood)) throw new Error('Choose a valid mood.');
    out.mood = body.mood;
  }
  if ('isPublic' in body) {
    if (typeof body.isPublic !== 'boolean') throw new Error('Choose public or private visibility.');
    out.isPublic = body.isPublic;
  }
  if ('featured' in body) {
    if (typeof body.featured !== 'boolean') throw new Error('Choose featured or not featured.');
    out.featured = body.featured;
  }
  if ('attachments' in body) {
    out.attachments = validateAttachments(body.attachments);
    out.imageUrl = out.attachments.find((item) => item.type === 'image')?.url || null;
  } else if ('imageUrl' in body) {
    if (body.imageUrl !== null && !isImageUrl(body.imageUrl)) throw new Error('Use a valid image URL.');
    out.imageUrl = body.imageUrl;
    out.attachments = getAttachments({ imageUrl: body.imageUrl });
  }
  if ('createdAt' in body) {
    if (typeof body.createdAt !== 'string') throw new Error('Choose a valid date.');
    const date = new Date(body.createdAt);
    if (Number.isNaN(date.getTime())) throw new Error('Choose a valid date.');
    out.createdAt = date.toISOString();
  }
  // Unchanged legacy notes keep their original image until explicitly edited.
  if (!('attachments' in out) && 'attachments' in existing) out.attachments = existing.attachments;
  return out;
}
