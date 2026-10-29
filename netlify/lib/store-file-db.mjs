/**
 * Store adapter that uses Netlify Blobs for production and file-based storage for development
 * Provides the same interface as the Netlify blobs store
 */

import { readTable, appendRecord, updateRecord, deleteRecord, getRecord } from './blob-db.mjs';

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

// Image store simulation using file-db
export function imageStore() {
  return {
    async get(key, options = {}) {
      const record = await getRecord('images', IMAGE_PREFIX + key);
      if (!record || !record.data) return null;
      
      if (options.type === 'arrayBuffer') {
        return Buffer.from(record.data, 'base64');
      }
      if (options.type === 'json') {
        return JSON.parse(record.data);
      }
      return record.data;
    },

    async getWithMetadata(key, options = {}) {
      const record = await getRecord('images', IMAGE_PREFIX + key);
      if (!record) return null;
      
      let data = record.data;
      if (options.type === 'arrayBuffer') {
        // If data is stored as a string (base64), decode it
        if (typeof data === 'string') {
          data = Buffer.from(data, 'base64');
        } else if (data instanceof ArrayBuffer) {
          data = Buffer.from(data);
        } else {
          data = Buffer.from(data);
        }
      }
      
      return {
        data,
        metadata: record.metadata || {},
      };
    },

    async set(key, data, options = {}) {
      const fullKey = IMAGE_PREFIX + key;
      const existing = await getRecord('images', fullKey);
      
      // Convert data to base64 string for storage
      let encodedData = data;
      if (data instanceof Uint8Array) {
        encodedData = Buffer.from(data).toString('base64');
      } else if (data instanceof ArrayBuffer) {
        encodedData = Buffer.from(data).toString('base64');
      } else if (Buffer.isBuffer(data)) {
        encodedData = data.toString('base64');
      }
      
      const record = {
        key: fullKey,
        data: encodedData,
        metadata: options.metadata || {},
      };
      
      if (existing) {
        await updateRecord('images', existing._id, record);
      } else {
        await appendRecord('images', { ...record, _id: fullKey });
      }
    },

    async delete(key) {
      const fullKey = IMAGE_PREFIX + key;
      const record = await getRecord('images', fullKey);
      if (record) {
        await deleteRecord('images', record._id);
      }
    },

    async list() {
      const images = await readTable('images');
      return images.filter(img => img.key && img.key.startsWith(IMAGE_PREFIX)).map(img => ({
        key: img.key.slice(IMAGE_PREFIX.length),
      }));
    },
  };
}

// Media store simulation using file-db
export function mediaStore() {
  return {
    async get(key, options = {}) {
      const record = await getRecord('media', key);
      if (!record || !record.data) return null;
      
      if (options.type === 'arrayBuffer') {
        if (typeof record.data === 'string') {
          return Buffer.from(record.data, 'base64');
        }
        return record.data;
      }
      if (options.type === 'json') {
        if (typeof record.data === 'string') {
          return JSON.parse(record.data);
        }
        return record.data;
      }
      return record.data;
    },

    async getMetadata(key) {
      const record = await getRecord('media', key);
      if (!record) return null;
      // Return the full record so metadata is accessible as .metadata
      return record;
    },

    async set(key, data, options = {}) {
      const existing = await getRecord('media', key);
      
      // Convert data to base64 string for storage
      let encodedData = data;
      if (data instanceof Uint8Array) {
        encodedData = Buffer.from(data).toString('base64');
      } else if (data instanceof ArrayBuffer) {
        encodedData = Buffer.from(data).toString('base64');
      } else if (Buffer.isBuffer(data)) {
        encodedData = data.toString('base64');
      }
      
      const record = {
        data: encodedData,
        metadata: options.metadata || {},
      };
      
      if (existing) {
        await updateRecord('media', existing._id, record);
      } else {
        await appendRecord('media', { ...record, _id: key });
      }
    },

    async setJSON(key, data, options = {}) {
      const record = await getRecord('media', key);
      const jsonData = JSON.stringify(data);
      
      if (record) {
        await updateRecord('media', record._id, { data: jsonData, metadata: options.metadata || {} });
      } else {
        await appendRecord('media', { _id: key, data: jsonData, metadata: options.metadata || {} });
      }
    },

    async delete(key) {
      const record = await getRecord('media', key);
      if (record) {
        await deleteRecord('media', record._id);
      }
    },

    async list() {
      const media = await readTable('media');
      return media.map(m => ({ key: m._id }));
    },
  };
}
