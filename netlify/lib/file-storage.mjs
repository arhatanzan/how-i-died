/**
 * File-based storage for images and media
 * Stores files in .data/images and .data/media directories
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), '.data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

// Ensure directories exist
async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Validate key to prevent directory traversal
function validateKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid key: must be a non-empty string');
  }
  if (key.includes('/') || key.includes('\\') || key.includes('..')) {
    throw new Error('Invalid key: cannot contain path separators');
  }
  if (path.isAbsolute(key)) {
    throw new Error('Invalid key: cannot be an absolute path');
  }
  return path.basename(key);
}

// Image storage
export const imageStorage = {
  async save(key, buffer, metadata = {}) {
    await ensureDir(IMAGES_DIR);
    const validKey = validateKey(key);
    const filePath = path.join(IMAGES_DIR, validKey);
    const metaPath = path.join(IMAGES_DIR, `${validKey}.json`);
    
    // Save the binary data
    await fs.writeFile(filePath, buffer);
    
    // Save metadata separately
    await fs.writeFile(metaPath, JSON.stringify({
      contentType: metadata.contentType || 'application/octet-stream',
      size: buffer.length,
      savedAt: new Date().toISOString(),
    }));
  },

  async load(key) {
    const validKey = validateKey(key);
    const filePath = path.join(IMAGES_DIR, validKey);
    const metaPath = path.join(IMAGES_DIR, `${validKey}.json`);
    
    try {
      const data = await fs.readFile(filePath);
      let metadata = {};
      try {
        metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      } catch {
        // Metadata file might not exist for older files
      }
      return { data, metadata };
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  },

  async delete(key) {
    const validKey = validateKey(key);
    const filePath = path.join(IMAGES_DIR, validKey);
    const metaPath = path.join(IMAGES_DIR, `${validKey}.json`);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    
    try {
      await fs.unlink(metaPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  },

  async list() {
    try {
      await ensureDir(IMAGES_DIR);
      const files = await fs.readdir(IMAGES_DIR);
      return files
        .filter(f => !f.endsWith('.json'))
        .map(f => ({ key: f }));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  },
};

// Media storage (for chunked uploads)
export const mediaStorage = {
  async savePart(uploadId, partIndex, buffer) {
    await ensureDir(path.join(MEDIA_DIR, uploadId));
    const partPath = path.join(MEDIA_DIR, uploadId, `part-${partIndex}`);
    await fs.writeFile(partPath, buffer);
  },

  async loadPart(uploadId, partIndex) {
    const partPath = path.join(MEDIA_DIR, uploadId, `part-${partIndex}`);
    try {
      return await fs.readFile(partPath);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  },

  async saveManifest(uploadId, manifest) {
    await ensureDir(path.join(MEDIA_DIR, uploadId));
    const manifestPath = path.join(MEDIA_DIR, uploadId, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
  },

  async loadManifest(uploadId) {
    const manifestPath = path.join(MEDIA_DIR, uploadId, 'manifest.json');
    try {
      const data = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  },

  async deleteUpload(uploadId) {
    const uploadDir = path.join(MEDIA_DIR, uploadId);
    try {
      const files = await fs.readdir(uploadDir);
      for (const file of files) {
        await fs.unlink(path.join(uploadDir, file));
      }
      await fs.rmdir(uploadDir);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  },

  async listUploads() {
    try {
      await ensureDir(MEDIA_DIR);
      const dirs = await fs.readdir(MEDIA_DIR);
      return dirs.map(d => ({ id: d }));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  },
};
