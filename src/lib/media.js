import { api } from './api.js';
import { CHUNK_BYTES, fileMetadata, mediaId } from '../../shared/media.js';

export async function uploadFile(file, onProgress) {
  const metadata = fileMetadata(file);
  const upload = await api.startUpload({ ...metadata, type: metadata.contentType });
  try {
    for (let index = 0; index < upload.parts; index++) {
      await api.uploadPart(upload.id, index, file.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES));
      onProgress(Math.round(Math.min((index + 1) * CHUNK_BYTES, file.size) / file.size * 100));
    }
    return await api.completeUpload(upload.id);
  } catch (error) {
    try { await api.deleteUpload(upload.id); } catch (cleanupError) {
      console.error('Could not clean up an interrupted attachment upload.', cleanupError);
    }
    throw error;
  }
}

export async function fetchMedia(attachment, { signal, onProgress = () => {} } = {}) {
  const id = mediaId(attachment.url);
  if (!id) throw new Error('This is not a stored attachment.');
  const manifest = await api.mediaManifest(id, signal);
  const parts = [];
  for (let index = 0; index < manifest.parts; index++) {
    const response = await fetch(`${attachment.url}/parts/${index}`, { credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(`Could not load ${attachment.name} (file part ${index + 1}).`);
    const data = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.sha256[index]) throw new Error('Attachment integrity check failed. Please retry.');
    parts.push(data);
    onProgress(Math.round((index + 1) / manifest.parts * 100));
  }
  const blob = new Blob(parts, { type: manifest.contentType });
  if (blob.size !== manifest.size) throw new Error('The downloaded file is incomplete.');
  return blob;
}
