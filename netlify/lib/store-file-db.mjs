/**
 * Store adapter that persists all files
 * - Notes: Uses Netlify Blobs in production, files in development
 * - Media: Uses Netlify Blobs in production, files in development
 */

import { readTable, appendRecord, updateRecord, deleteRecord, getRecord } from './blob-db.mjs';
import { gitImageStorage, gitMediaStorage } from './git-storage.mjs';

let blobsStore;
let isProduction = false;

// Initialize blobs store on production
async function initializeBlobs() {
  if (blobsStore !== undefined) return;
  
  try {
    const { getStore } = await import('@netlify/blobs');
    blobsStore = getStore({ name: 'journal-media', consistency: 'strong' });
    isProduction = true;
  } catch (e) {
    blobsStore = null;
    isProduction = false;
  }
}

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

// Image store - uses Netlify Blobs in production, git storage in development
export function imageStore() {
  return {
    async get(key, options = {}) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `image:${key}`;
          const data = await blobsStore.get(blobKey);
          if (!data) return null;
          if (options.type === 'arrayBuffer') return data;
          if (options.type === 'json') {
            const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
            return JSON.parse(text);
          }
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          return buffer.toString('base64');
        } catch (e) {
          console.error('Blob get failed for image:', key, e);
          return null;
        }
      } else {
        const result = await gitImageStorage.load(key);
        if (!result) return null;
        if (options.type === 'arrayBuffer') return result.data;
        if (options.type === 'json') return JSON.parse(result.data.toString());
        return result.data.toString('base64');
      }
    },

    async getWithMetadata(key, options = {}) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `image:${key}`;
          const data = await blobsStore.get(blobKey);
          if (!data) return null;
          const metaKey = `image-meta:${key}`;
          let metadata = {};
          try {
            const metaData = await blobsStore.get(metaKey);
            if (metaData) {
              const text = typeof metaData === 'string' ? metaData : new TextDecoder().decode(metaData);
              metadata = JSON.parse(text);
            }
          } catch (e) {
            // Metadata might not exist
          }
          let dataResult = data;
          if (options.type === 'arrayBuffer') {
            if (!(data instanceof ArrayBuffer) && !Buffer.isBuffer(data)) {
              dataResult = Buffer.from(data);
            }
          }
          return { data: dataResult, metadata };
        } catch (e) {
          console.error('Blob get failed for image:', key, e);
          return null;
        }
      } else {
        const result = await gitImageStorage.load(key);
        if (!result) return null;
        let data = result.data;
        if (options.type === 'arrayBuffer') {
          if (!(data instanceof Buffer)) data = Buffer.from(data);
        }
        return { data, metadata: result.metadata || {} };
      }
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
      
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `image:${key}`;
          await blobsStore.set(blobKey, buffer);
          if (options.metadata) {
            const metaKey = `image-meta:${key}`;
            await blobsStore.set(metaKey, JSON.stringify(options.metadata));
          }
        } catch (e) {
          console.error('Blob set failed for image:', key, e);
          throw e;
        }
      } else {
        await gitImageStorage.save(key, buffer, options.metadata || {});
      }
    },

    async delete(key) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `image:${key}`;
          await blobsStore.delete(blobKey);
          const metaKey = `image-meta:${key}`;
          await blobsStore.delete(metaKey);
        } catch (e) {
          console.error('Blob delete failed for image:', key, e);
        }
      } else {
        await gitImageStorage.delete(key);
      }
    },

    async list() {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const keys = await blobsStore.list();
          return keys
            .filter(k => k.key.startsWith('image:'))
            .map(k => ({ key: k.key.substring(6) }));
        } catch (e) {
          console.error('Blob list failed for images:', e);
          return [];
        }
      } else {
        return await gitImageStorage.list();
      }
    },
  };
}

// Media store - uses Netlify Blobs in production, git storage in development
export function mediaStore() {
  return {
    async get(key, options = {}) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `media:${key}`;
          const data = await blobsStore.get(blobKey);
          if (!data) return null;
          if (options.type === 'arrayBuffer') return data;
          if (options.type === 'json') {
            const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
            return JSON.parse(text);
          }
          return data;
        } catch (e) {
          console.error('Blob get failed for media:', key, e);
          return null;
        }
      } else {
        const result = await gitMediaStorage.loadManifest(key);
        if (!result) return null;
        if (options.type === 'arrayBuffer') {
          if (typeof result === 'string') return Buffer.from(result, 'base64');
          return result;
        }
        if (options.type === 'json') return result;
        return result;
      }
    },

    async getMetadata(key) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `media:${key}`;
          const data = await blobsStore.get(blobKey);
          if (!data) return null;
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
          return { metadata: JSON.parse(text), data };
        } catch (e) {
          console.error('Blob get failed for media metadata:', key, e);
          return null;
        }
      } else {
        const result = await gitMediaStorage.loadManifest(key);
        if (!result) return null;
        return { metadata: result, data: result };
      }
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
      
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `media:${key}`;
          await blobsStore.set(blobKey, buffer);
        } catch (e) {
          console.error('Blob set failed for media:', key, e);
          throw e;
        }
      } else {
        // Extract upload ID and part index from key format: "uploadId/parts/index"
        const match = key.match(/^([^/]+)\/parts\/(\d+)$/);
        if (match) {
          const uploadId = match[1];
          const partIndex = parseInt(match[2], 10);
          await gitMediaStorage.savePart(uploadId, partIndex, buffer);
        }
      }
    },

    async setJSON(key, data, options = {}) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `media:${key}`;
          await blobsStore.set(blobKey, JSON.stringify(data));
        } catch (e) {
          console.error('Blob setJSON failed for media:', key, e);
          throw e;
        }
      } else {
        // For manifest keys in format: "uploadId/manifest"
        const match = key.match(/^([^/]+)\/manifest$/);
        if (match) {
          const uploadId = match[1];
          await gitMediaStorage.saveManifest(uploadId, data);
        }
      }
    },

    async delete(key) {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const blobKey = `media:${key}`;
          await blobsStore.delete(blobKey);
        } catch (e) {
          console.error('Blob delete failed for media:', key, e);
        }
      } else {
        const match = key.match(/^([^/]+)(?:\/parts\/\d+|\/manifest)?$/);
        if (match) {
          const uploadId = match[1];
          await gitMediaStorage.deleteUpload(uploadId);
        }
      }
    },

    async list() {
      await initializeBlobs();
      if (isProduction && blobsStore) {
        try {
          const keys = await blobsStore.list();
          return keys
            .filter(k => k.key.startsWith('media:'))
            .map(k => ({ id: k.key.substring(6) }));
        } catch (e) {
          console.error('Blob list failed for media:', e);
          return [];
        }
      } else {
        return await gitMediaStorage.listUploads();
      }
    },
  };
}
