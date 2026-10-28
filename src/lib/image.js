import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../../shared/attachments.js';

const MAX_EDGE = 2000;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, or GIF photo.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose a photo smaller than 30 MB.');
  if (file.type === 'image/gif' && file.size > MAX_IMAGE_BYTES) {
    throw new Error('Animated GIFs must be smaller than 4 MB so their animation can be preserved.');
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

export async function prepareImage(file) {
  validateImageFile(file);
  if (file.type === 'image/gif') return file;

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not prepare the photo. Try a different browser.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
  }
  throw new Error('That image is too heavy to carry.');
}
