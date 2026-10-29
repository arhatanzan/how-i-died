import { mediaStore } from './store-file-db.mjs';
import { MEDIA_PREFIX } from '../../shared/media.js';

export const manifestKey = (id) => `${id}/manifest`;
export const chunkKey = (id, index) => `${id}/parts/${index}`;
export const loadMedia = (id) => mediaStore().get(manifestKey(id), { type: 'json' });
export const mediaAttachment = (manifest) => ({
  assetId: manifest.id,
  url: `${MEDIA_PREFIX}${manifest.id}`,
  type: manifest.type,
  name: manifest.name,
  contentType: manifest.contentType,
  size: manifest.size,
});

export async function deleteMedia(id) {
  const manifest = await loadMedia(id);
  if (!manifest) return;
  for (let index = 0; index < manifest.parts; index++) await mediaStore().delete(chunkKey(id, index));
  await mediaStore().delete(manifestKey(id));
}

