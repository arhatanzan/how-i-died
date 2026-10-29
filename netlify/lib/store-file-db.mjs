/**
 * Store adapter that persists all files
 * - Notes: Stored in .data/ directory (persists across deployments)
 * - Media: Stored in .data/media/ directory (works on Netlify production)
 * - Images: Stored via git-storage or GitHub (for large files)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { readTable, appendRecord, updateRecord, deleteRecord, getRecord } from './blob-db.mjs';
import { gitImageStorage, gitMediaStorage } from './git-storage.mjs';
import { storeAttachment } from './github-storage.mjs';

export const IMAGE_PREFIX = '/api/images/';

// Note repository using file-db
export async function loadNotes(options = {}) {
  const notes = await readTable('notes');
  if (options.publicOnly) {
    return notes.filter(note => note.isPublic === true);
  }
  return notes;
}

export async function createNote(note) {
  const record = await appendRecord('notes', note);
  return record;
}

export async function updateNote(id, change) {
  const notes = await readTable('notes');
  const previousIndex = notes.findIndex(n => n.id === id);
  
  if (previousIndex === -1) {
    return null;
  }
  
  const previous = notes[previousIndex];
  const updated = await change(previous);
  
  // Update by finding the record by the note's id field, then by its _id
  const record = notes[previousIndex];
  await updateRecord('notes', record._id, updated);
  
  return { previous, updated };
}

export async function deleteNote(id) {
  const notes = await readTable('notes');
  const note = notes.find(n => n.id === id);
  
  if (!note) {
    return null;
  }
  
  return await deleteRecord('notes', note._id);
}

// Image store simulation using git-backed file storage
export function imageStore() {
  return {
    async get(key, options = {}) {
      const result = await gitImageStorage.load(key);
      if (!result) return null;
      
      if (options.type === 'arrayBuffer') {
        return result.data;
      }
      if (options.type === 'json') {
        return JSON.parse(result.data.toString());
      }
      return result.data.toString('base64');
    },

    async getWithMetadata(key, options = {}) {
      const result = await gitImageStorage.load(key);
      if (!result) return null;
      
      let data = result.data;
      if (options.type === 'arrayBuffer') {
        // Already a buffer
        if (!(data instanceof Buffer)) {
          data = Buffer.from(data);
        }
      }
      
      return {
        data,
        metadata: result.metadata || {},
      };
    },

    async set(key, data, options = {}) {
      let buffer;
      if (data instanceof Uint8Array) {
        buffer = Buffer.from(data);
      } else if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
      } else if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        // Assume base64 string
        buffer = Buffer.from(data, 'base64');
      } else {
        buffer = Buffer.from(data);
      }
      
      await gitImageStorage.save(key, buffer, options.metadata || {});
    },

    async delete(key) {
      await gitImageStorage.delete(key);
    },

    async list() {
      return await gitImageStorage.list();
    },
  };
}

// Media store - stores uploads in .data/media/ directory (works on Netlify)
export function mediaStore() {
  return {
    async get(key, options = {}) {
      // Load from .data/media/{uploadId}/manifest.json
      const match = key.match(/^([^/]+)(?:\/manifest)?$/);
      if (!match) return null;
      
      const uploadId = match[1];
      const mediaDir = path.join(process.cwd(), '.data', 'media');
      const manifestPath = path.join(mediaDir, uploadId, 'manifest.json');
      
      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        const result = JSON.parse(content);
        
        if (options.type === 'arrayBuffer') {
          if (typeof result === 'string') {
            return Buffer.from(result, 'base64');
          }
          return result;
        }
        if (options.type === 'json') {
          return result;
        }
        return result;
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },

    async getMetadata(key) {
      const result = await this.get(key, { type: 'json' });
      if (!result) return null;
      return { metadata: result, data: result };
    },

    async set(key, data, options = {}) {
      let buffer;
      if (data instanceof Uint8Array) {
        buffer = Buffer.from(data);
      } else if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
      } else if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data, 'base64');
      } else {
        buffer = Buffer.from(data);
      }
      
      // Extract upload ID and part index from key format: "uploadId/parts/index"
      const match = key.match(/^([^/]+)\/parts\/(\d+)$/);
      if (match) {
        const uploadId = match[1];
        const partIndex = parseInt(match[2], 10);
        
        const mediaDir = path.join(process.cwd(), '.data', 'media');
        const uploadDir = path.join(mediaDir, uploadId);
        
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          const partPath = path.join(uploadDir, `part-${partIndex}.bin`);
          await fs.writeFile(partPath, buffer);
        } catch (error) {
          console.error('Failed to write media part:', error);
          throw error;
        }
      }
    },

    async setJSON(key, data, options = {}) {
      // For manifest keys in format: "uploadId/manifest"
      const match = key.match(/^([^/]+)\/manifest$/);
      if (match) {
        const uploadId = match[1];
        const mediaDir = path.join(process.cwd(), '.data', 'media');
        const uploadDir = path.join(mediaDir, uploadId);
        
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          const manifestPath = path.join(uploadDir, 'manifest.json');
          await fs.writeFile(manifestPath, JSON.stringify(data, null, 2));
        } catch (error) {
          console.error('Failed to write media manifest:', error);
          throw error;
        }
      }
    },

    async delete(key) {
      const match = key.match(/^([^/]+)(?:\/parts\/\d+|\/manifest)?$/);
      if (match) {
        const uploadId = match[1];
        const mediaDir = path.join(process.cwd(), '.data', 'media');
        const uploadDir = path.join(mediaDir, uploadId);
        
        try {
          const files = await fs.readdir(uploadDir);
          for (const file of files) {
            await fs.unlink(path.join(uploadDir, file));
          }
          await fs.rmdir(uploadDir);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error('Failed to delete media:', error);
          }
        }
      }
    },

    async list() {
      const mediaDir = path.join(process.cwd(), '.data', 'media');
      try {
        const dirs = await fs.readdir(mediaDir);
        return dirs.map(d => ({ id: d }));
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    },
  };
}
