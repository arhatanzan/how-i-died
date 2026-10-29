export const MAX_ATTACHMENTS = 8;
export const IMAGE_PREFIX = '/api/images/';
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function normalizeWebUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isImageUrl(value) {
  return typeof value === 'string'
    && (/^\/api\/images\/[0-9a-f-]{36}$/.test(value) || Boolean(normalizeWebUrl(value)));
}

export function getAttachments(note) {
  if (Array.isArray(note.attachments)) return note.attachments;
  return note.imageUrl ? [{ type: 'image', url: note.imageUrl, alt: '' }] : [];
}

export function validateAttachments(value) {
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    throw new Error(`Use up to ${MAX_ATTACHMENTS} attachments per note.`);
  }
  return value.map((item) => {
    if (!item || !['image', 'link', 'audio', 'video', 'file'].includes(item.type)) throw new Error('Unsupported attachment type.');
    if (mediaId(item.url)) {
      const metadata = fileMetadata({ name: item.name, size: item.size, type: item.contentType });
      if (metadata.type !== item.type || metadata.contentType !== item.contentType || item.assetId !== mediaId(item.url)) {
        throw new Error('Attachment metadata does not match the uploaded file.');
      }
      const labelKey = item.type === 'image' ? 'alt' : 'title';
      const limit = item.type === 'image' ? 500 : 200;
      if (item[labelKey] !== undefined && (typeof item[labelKey] !== 'string' || item[labelKey].length > limit)) {
        throw new Error(`Attachment descriptions must be ${limit} characters or fewer.`);
      }
      return { ...metadata, assetId: item.assetId, url: item.url, [labelKey]: item[labelKey]?.trim() || '' };
    }
    if (!['image', 'link'].includes(item.type)) throw new Error('Audio, video, and documents must be uploaded first.');
    if (item.type === 'image') {
      if (!isImageUrl(item.url)) throw new Error('Images need a valid image upload or http(s) URL.');
      if (item.alt !== undefined && (typeof item.alt !== 'string' || item.alt.length > 500)) {
        throw new Error('Photo descriptions must be 500 characters or fewer.');
      }
      return { type: 'image', url: item.url, alt: item.alt?.trim() || '' };
    }
    const url = normalizeWebUrl(item.url);
    if (!url) throw new Error('Links must be valid http(s) URLs without embedded credentials.');
    if (item.title !== undefined && (typeof item.title !== 'string' || item.title.length > 200)) {
      throw new Error('Link titles must be 200 characters or fewer.');
    }
    return { type: 'link', url, title: item.title?.trim() || '' };
  });
}

export function hasNoteContent(note) {
  return Boolean(note.text?.trim() || getAttachments(note).length);
}

export function getEmbed(value) {
  const normalized = normalizeWebUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    const id = host === 'youtu.be' ? parts[0]
      : ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : url.searchParams.get('v');
    if (!/^[\w-]{11}$/.test(id || '')) return null;
    return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}`, kind: 'video' };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parts[0] === 'video' ? parts[1] : parts[0];
    if (!/^\d{6,12}$/.test(id || '')) return null;
    const hash = parts[0] === 'video' ? url.searchParams.get('h') : parts[1];
    const query = new URLSearchParams({ dnt: '1' });
    if (/^[a-f0-9]{6,20}$/i.test(hash || '')) query.set('h', hash);
    return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${id}?${query}`, kind: 'video' };
  }
  if (host === 'instagram.com' || host === 'instagra.ms') {
    if (parts[0] === 'reel' || parts[0] === 'p') {
      const id = parts[1];
      if (id && /^[\w-]+$/.test(id)) {
        return { provider: 'Instagram', src: `https://www.instagram.com/embed/captioned/?url=${encodeURIComponent(normalized)}`, kind: 'video' };
      }
    }
  }
  if (host === 'open.spotify.com') {
    const start = parts[0]?.startsWith('intl-') ? 1 : 0;
    const [type, id] = parts.slice(start);
    if (!['track', 'album', 'playlist', 'episode', 'show'].includes(type) || !/^[a-zA-Z0-9]{22}$/.test(id || '')) return null;
    return { provider: 'Spotify', src: `https://open.spotify.com/embed/${type}/${id}`, kind: 'audio' };
  }
  if (host === 'soundcloud.com' && parts.length === 2) {
    return { provider: 'SoundCloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(normalized)}&auto_play=false`, kind: 'audio' };
  }
  if (host === 'bandcamp.com') {
    const match = value.match(/bandcamp\.com\/(track|album)\/([^/?#]+)/i);
    if (match) {
      return { provider: 'Bandcamp', src: normalized, kind: 'audio' };
    }
  }
  if (host === 'apod.nasa.gov' || host === 'nasa.gov') {
    return { provider: 'NASA', src: normalized, kind: 'video' };
  }
  return null;
}

export function splitLinks(text) {
  return text.split(/(https?:\/\/[^\s<>]+)/g).filter(Boolean).flatMap((part) => {
    const candidate = part.replace(/[.,!?;:)\]}]+$/, '');
    const url = normalizeWebUrl(candidate);
    return url ? [{ text: candidate, url }, ...(part.length > candidate.length ? [{ text: part.slice(candidate.length) }] : [])] : [{ text: part }];
  });
}
import { fileMetadata, mediaId } from './media.js';
