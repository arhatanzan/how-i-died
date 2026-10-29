/**
 * Store adapter that persists all files
 * - Notes: Stored in .data/ directory (persists across deployments)
 * - Media: Stored in GitHub repository via storeAttachment() API
 * - Images: Stored in GitHub repository via storeAttachment() API
 */

import { readTable, appendRecord, updateRecord, deleteRecord, getRecord } from './blob-db.mjs';
import { storeAttachment, loadAttachment, storeAttachmentMetadata, loadAttachmentMetadata } from './github-storage.mjs';

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

// Image store using GitHub storage
export function imageStore() {
  return {
    async get(key, options = {}) {
      const result = await loadAttachment(key, 'images');
      if (!result) return null;
      
      if (options.type === 'arrayBuffer') {
        if (Buffer.isBuffer(result)) return new Uint8Array(result);
        if (typeof result === 'string') return Buffer.from(result, 'base64');
        return result;
      }
      if (options.type === 'json') {
        if (Buffer.isBuffer(result)) return JSON.parse(result.toString());
        return result;
      }
      if (Buffer.isBuffer(result)) return result.toString('base64');
      return result;
    },

    async getWithMetadata(key, options = {}) {
      const data = await this.get(key, options);
      if (!data) return null;
      
      const metadata = await loadAttachmentMetadata(key, 'images');
      return {
        data,
        metadata: metadata || {},
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
      
      const result = await storeAttachment(key, 'images', buffer, options.metadata || {});
      if (!result) {
        throw new Error('Failed to store image in GitHub');
      }
      
      if (options.metadata) {
        await storeAttachmentMetadata(key, 'images', options.metadata);
      }
    },

    async delete(key) {
      // Note: GitHub storage doesn't support deletion
      console.warn('Image deletion not implemented for GitHub storage:', key);
    },

    async list() {
      // Note: Image listing not implemented for GitHub storage
      return [];
    },
  };
}

// Media store - uses GitHub API for persistent storage on Netlify
export function mediaStore() {
  return {
    async get(key, options = {}) {
      // key format: "uploadId/manifest" or "uploadId/parts/index"
      // Extract upload ID and part index from key
      let attachmentId, type;
      
      const manifestMatch = key.match(/^([^/]+)\/manifest$/);
      if (manifestMatch) {
        attachmentId = `${manifestMatch[1]}-manifest`;
        type = 'media';
      } else {
        const partsMatch = key.match(/^([^/]+)\/parts\/(\d+)$/);
        if (partsMatch) {
          attachmentId = `${partsMatch[1]}-part-${partsMatch[2]}`;
          type = 'media';
        }
      }
      
      if (!attachmentId) {
        console.error('get: key does not match expected pattern', { key });
        return null;
      }
      
      console.log('get: loading from GitHub', { attachmentId, type, key });
      const result = await loadAttachment(attachmentId, type);
      
      if (!result) {
        console.warn('get: attachment not found', { attachmentId });
        return null;
      }
      
      if (options.type === 'arrayBuffer') {
        if (typeof result === 'string') {
          return Buffer.from(result, 'base64');
        }
        if (Buffer.isBuffer(result)) {
          return new Uint8Array(result);
        }
        return result;
      }
      if (options.type === 'json') {
        if (Buffer.isBuffer(result)) {
          try {
            return JSON.parse(result.toString('utf-8'));
          } catch {
            return result;
          }
        }
        return result;
      }
      return result;
    },

    async getMetadata(key) {
      console.log('getMetadata: loading from GitHub', { key });
      // For metadata keys, load the .meta.json file
      const partsMatch = key.match(/^([^/]+)\/parts\/(\d+)$/);
      if (partsMatch) {
        const uploadId = partsMatch[1];
        const partIndex = partsMatch[2];
        const attachmentId = `${uploadId}-part-${partIndex}`;
        const metadata = await loadAttachmentMetadata(attachmentId, 'media');
        if (!metadata) return null;
        return { metadata, data: metadata };
      }
      // For manifest keys, load the JSON directly
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
        
        // Store media part in GitHub
        const attachmentId = `${uploadId}-part-${partIndex}`;
        console.log('set: storing media part in GitHub', { attachmentId, size: buffer.length });
        const result = await storeAttachment(attachmentId, 'media', buffer, options.metadata || {});
        if (!result) {
          throw new Error('Failed to store media part in GitHub');
        }
        
        // Store metadata alongside the binary data
        if (options.metadata) {
          console.log('set: storing media part metadata', { attachmentId, metadata: options.metadata });
          await storeAttachmentMetadata(attachmentId, 'media', options.metadata);
        }
      }
    },

    async setJSON(key, data, options = {}) {
      // For manifest keys in format: "uploadId/manifest"
      const match = key.match(/^([^/]+)\/manifest$/);
      if (!match) {
        console.error('setJSON: key does not match manifest pattern', { key });
        throw new Error(`Invalid manifest key format: ${key}`);
      }
      
      const uploadId = match[1];
      console.log('setJSON: storing manifest in GitHub', { uploadId, size: JSON.stringify(data).length });
      
      // Store manifest in GitHub
      const manifestJson = JSON.stringify(data);
      const result = await storeAttachment(`${uploadId}-manifest`, 'media', Buffer.from(manifestJson), {});
      
      if (!result) {
        console.error('setJSON: storeAttachment returned null', { uploadId });
        throw new Error('Failed to store media manifest in GitHub');
      }
      console.log('setJSON: manifest stored successfully', { uploadId, path: result.path });
    },

    async delete(key) {
      const match = key.match(/^([^/]+)(?:\/parts\/\d+|\/manifest)?$/);
      if (match) {
        const uploadId = match[1];
        console.log('delete: deleting media upload from GitHub', { uploadId });
        // TODO: implement deleteAttachment in github-storage.mjs
      }
    },

    async list() {
      // TODO: implement listAttachments in github-storage.mjs
      console.warn('list: not implemented yet');
      return [];
    },
  };
}
