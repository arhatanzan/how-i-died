/**
 * Git-backed file storage for persistent data
 * Files are stored directly in the repository, committed to git
 * This ensures data persists even if Netlify blobs are lost or service changes
 * 
 * Structure:
 * - .store/images/ - Image files with metadata
 * - .store/media/ - Uploaded media files (videos, audio, etc.)
 * - .store/index.jsonl - Index of all stored files
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const STORE_DIR = path.join(process.cwd(), '.store');
const IMAGES_DIR = path.join(STORE_DIR, 'images');
const MEDIA_DIR = path.join(STORE_DIR, 'media');
const INDEX_FILE = path.join(STORE_DIR, 'index.jsonl');

// Ensure .store directory exists
async function ensureStoreDir() {
  try {
    await fs.access(STORE_DIR);
  } catch {
    await fs.mkdir(STORE_DIR, { recursive: true });
    // Initialize git tracking if in a git repo
    try {
      execSync('git init', { cwd: STORE_DIR, stdio: 'ignore' });
    } catch (e) {
      // git might not be available or already initialized
    }
  }
  
  try {
    await fs.access(IMAGES_DIR);
  } catch {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  }
  
  try {
    await fs.access(MEDIA_DIR);
  } catch {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
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

// Commit changes to git
async function gitCommit(filePath, operation = 'add') {
  try {
    const relPath = path.relative(process.cwd(), filePath);
    execSync(`git add "${relPath}"`, { cwd: process.cwd(), stdio: 'ignore' });
    execSync(`git commit -m "store: ${operation} ${relPath}" --author="Store System <store@system>" 2>/dev/null || true`, {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
  } catch (e) {
    // git might not be available, continue anyway
  }
}

// Image storage backed by git
export const gitImageStorage = {
  async save(key, buffer, metadata = {}) {
    await ensureStoreDir();
    const validKey = validateKey(key);
    const filePath = path.join(IMAGES_DIR, validKey);
    const metaPath = path.join(IMAGES_DIR, `${validKey}.json`);
    
    // Save binary image
    await fs.writeFile(filePath, buffer);
    
    // Save metadata
    const metaData = {
      key: validKey,
      contentType: metadata.contentType || 'application/octet-stream',
      size: buffer.length,
      hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      savedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(metaData, null, 2));
    
    // Commit to git
    await gitCommit(filePath, 'image');
    
    return metaData;
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
        // Metadata might not exist
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
      await gitCommit(filePath, 'delete-image');
    } catch (e) {
      // File might not exist
    }
    
    try {
      await fs.unlink(metaPath);
    } catch (e) {
      // Metadata might not exist
    }
  },

  async list() {
    try {
      await ensureStoreDir();
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

// Media storage (videos, audio, large files) backed by git
export const gitMediaStorage = {
  async savePart(uploadId, partIndex, buffer) {
    await ensureStoreDir();
    const uploadDir = path.join(MEDIA_DIR, uploadId);
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    
    const partPath = path.join(uploadDir, `part-${partIndex}.bin`);
    await fs.writeFile(partPath, buffer);
    
    // Commit to git
    await gitCommit(partPath, `media-part ${uploadId}/${partIndex}`);
  },

  async loadPart(uploadId, partIndex) {
    const partPath = path.join(MEDIA_DIR, uploadId, `part-${partIndex}.bin`);
    try {
      return await fs.readFile(partPath);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  },

  async saveManifest(uploadId, manifest) {
    await ensureStoreDir();
    const uploadDir = path.join(MEDIA_DIR, uploadId);
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    
    const manifestPath = path.join(uploadDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Commit to git
    await gitCommit(manifestPath, `media-manifest ${uploadId}`);
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
      await gitCommit(uploadDir, `delete-media ${uploadId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  },

  async listUploads() {
    try {
      await ensureStoreDir();
      const dirs = await fs.readdir(MEDIA_DIR);
      return dirs.map(d => ({ id: d }));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  },
};

// Utility to get git repository info
export async function getStoreStats() {
  try {
    const images = await gitImageStorage.list();
    const uploads = await gitMediaStorage.listUploads();
    
    let imageSize = 0;
    let mediaSize = 0;
    
    // Calculate image storage
    for (const img of images) {
      try {
        const stat = await fs.stat(path.join(IMAGES_DIR, img.key));
        imageSize += stat.size;
      } catch (e) {
        // File might have been deleted
      }
    }
    
    // Calculate media storage
    for (const upload of uploads) {
      const uploadDir = path.join(MEDIA_DIR, upload.id);
      try {
        const files = await fs.readdir(uploadDir);
        for (const file of files) {
          if (!file.endsWith('.json')) {
            const stat = await fs.stat(path.join(uploadDir, file));
            mediaSize += stat.size;
          }
        }
      } catch (e) {
        // Directory might not exist
      }
    }
    
    return {
      storeDir: STORE_DIR,
      images: {
        count: images.length,
        size: imageSize,
      },
      media: {
        count: uploads.length,
        size: mediaSize,
      },
      totalSize: imageSize + mediaSize,
    };
  } catch (error) {
    console.error('Failed to get store stats:', error);
    return { error: error.message };
  }
}
