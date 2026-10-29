/**
 * Store adapter that uses Netlify Blobs for production and file-based storage for development
 * Provides the same interface as the Netlify blobs store
 * Images are stored as binary files in .data/images/ instead of base64-encoded blobs
 */

import { readTable, appendRecord, updateRecord, deleteRecord, getRecord } from './blob-db.mjs';
import { imageStorage, mediaStorage } from './file-storage.mjs';

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

// Image store simulation using file-based storage
export function imageStore() {
  return {
    async get(key, options = {}) {
      const result = await imageStorage.load(key);
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
      const result = await imageStorage.load(key);
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
      
      await imageStorage.save(key, buffer, options.metadata || {});
    },

    async delete(key) {
      await imageStorage.delete(key);
    },

    async list() {
      return await imageStorage.list();
    },
  };
}

// Media store simulation using file-based storage
export function mediaStore() {
  return {
    async get(key, options = {}) {
      const result = await mediaStorage.loadManifest(key);
      if (!result) return null;
      
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
    },

    async getMetadata(key) {
      const result = await mediaStorage.loadManifest(key);
      if (!result) return null;
      return {
        metadata: result,
        data: result,
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
        buffer = Buffer.from(data, 'base64');
      } else {
        buffer = Buffer.from(data);
      }
      
      // Extract upload ID and part index from key format: "uploadId/parts/index"
      const match = key.match(/^([^/]+)\/parts\/(\d+)$/);
      if (match) {
        const uploadId = match[1];
        const partIndex = parseInt(match[2], 10);
        await mediaStorage.savePart(uploadId, partIndex, buffer);
      }
    },

    async setJSON(key, data, options = {}) {
      // For manifest keys in format: "uploadId/manifest"
      const match = key.match(/^([^/]+)\/manifest$/);
      if (match) {
        const uploadId = match[1];
        await mediaStorage.saveManifest(uploadId, data);
      }
    },

    async delete(key) {
      const match = key.match(/^([^/]+)(?:\/parts\/\d+|\/manifest)?$/);
      if (match) {
        const uploadId = match[1];
        await mediaStorage.deleteUpload(uploadId);
      }
    },

    async list() {
      return await mediaStorage.listUploads();
    },
  };
}
