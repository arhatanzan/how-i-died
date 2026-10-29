/**
 * Netlify Blobs-based database adapter
 * 
 * This adapter provides persistent storage for Netlify deployments using @netlify/blobs.
 * It automatically falls back to file-based storage during local development.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

let blobsStore;
let isProduction = false;

// Initialize blobs store on production
async function initializeBlobs() {
  if (blobsStore) return;
  
  try {
    // @netlify/blobs is only available in production Netlify environment
    // It will throw in local dev, which we catch and fallback to file storage
    const { getStore } = await import('@netlify/blobs');
    blobsStore = getStore({ name: 'journal-db', consistency: 'strong' });
    isProduction = true;
  } catch (e) {
    // Not in production environment, will use file storage
    blobsStore = null;
    isProduction = false;
  }
}

// File-based fallback for local development
const DATA_DIR = path.join(process.cwd(), '.data');
const TABLES_DIR = path.join(DATA_DIR, 'tables');

async function ensureDataDir() {
  try {
    await fs.access(TABLES_DIR);
  } catch {
    await fs.mkdir(TABLES_DIR, { recursive: true });
  }
}

function getTablePath(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Invalid table name: must be a non-empty string');
  }
  
  if (tableName.includes('/') || tableName.includes('\\') || tableName.includes('..')) {
    throw new Error('Invalid table name: cannot contain path separators or traversal sequences');
  }
  
  if (path.isAbsolute(tableName)) {
    throw new Error('Invalid table name: cannot be an absolute path');
  }
  
  const safeName = path.basename(tableName);
  if (!safeName || safeName !== tableName) {
    throw new Error('Invalid table name: path traversal detected');
  }
  
  return path.join(TABLES_DIR, `${safeName}.jsonl`);
}

// File-based operations
async function readTableFromFile(tableName) {
  await ensureDataDir();
  const filePath = getTablePath(tableName);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error('Failed to parse JSONL line:', line, e);
          return null;
        }
      })
      .filter(item => item !== null);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function appendRecordToFile(tableName, record) {
  await ensureDataDir();
  const filePath = getTablePath(tableName);
  
  const withId = {
    _id: crypto.randomUUID(),
    ...record,
  };
  
  const line = JSON.stringify(withId);
  await fs.appendFile(filePath, line + '\n', 'utf-8');
  
  return withId;
}

async function updateRecordInFile(tableName, recordId, updates) {
  const records = await readTableFromFile(tableName);
  const index = records.findIndex(r => r._id === recordId);
  
  if (index === -1) return null;
  
  const updated = { ...records[index], ...updates };
  records[index] = updated;
  
  const filePath = getTablePath(tableName);
  const content = records.map(r => JSON.stringify(r)).join('\n');
  await fs.writeFile(filePath, content + '\n', 'utf-8');
  
  return updated;
}

async function deleteRecordFromFile(tableName, recordId) {
  const records = await readTableFromFile(tableName);
  const removed = records.find(r => r._id === recordId);
  
  if (!removed) return null;
  
  const filtered = records.filter(r => r._id !== recordId);
  const filePath = getTablePath(tableName);
  const content = filtered.map(r => JSON.stringify(r)).join('\n');
  
  if (filtered.length === 0) {
    await fs.writeFile(filePath, '', 'utf-8');
  } else {
    await fs.writeFile(filePath, content + '\n', 'utf-8');
  }
  
  return removed;
}

async function getRecordFromFile(tableName, recordId) {
  const records = await readTableFromFile(tableName);
  return records.find(r => r._id === recordId);
}

// Blob-based operations (production)
async function readTableFromBlobs(tableName) {
  try {
    const key = `table:${tableName}`;
    const data = await blobsStore.get(key);
    
    if (!data) return [];
    
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    return text
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error('Failed to parse JSONL line from blob:', line, e);
          return null;
        }
      })
      .filter(item => item !== null);
  } catch (error) {
    console.error('Failed to read from blobs:', error);
    return [];
  }
}

async function appendRecordToBlobs(tableName, record) {
  const withId = {
    _id: crypto.randomUUID(),
    ...record,
  };
  
  try {
    const key = `table:${tableName}`;
    const records = await readTableFromBlobs(tableName);
    records.push(withId);
    const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
    
    await blobsStore.set(key, content);
    return withId;
  } catch (error) {
    console.error('Failed to append to blobs:', error);
    throw error;
  }
}

async function updateRecordInBlobs(tableName, recordId, updates) {
  try {
    const records = await readTableFromBlobs(tableName);
    const index = records.findIndex(r => r._id === recordId);
    
    if (index === -1) return null;
    
    const updated = { ...records[index], ...updates };
    records[index] = updated;
    
    const key = `table:${tableName}`;
    const content = records.map(r => JSON.stringify(r)).join('\n') + '\n';
    await blobsStore.set(key, content);
    
    return updated;
  } catch (error) {
    console.error('Failed to update in blobs:', error);
    throw error;
  }
}

async function deleteRecordFromBlobs(tableName, recordId) {
  try {
    const records = await readTableFromBlobs(tableName);
    const removed = records.find(r => r._id === recordId);
    
    if (!removed) return null;
    
    const filtered = records.filter(r => r._id !== recordId);
    const key = `table:${tableName}`;
    const content = filtered.map(r => JSON.stringify(r)).join('\n');
    
    if (filtered.length === 0) {
      await blobsStore.set(key, '');
    } else {
      await blobsStore.set(key, content + '\n');
    }
    
    return removed;
  } catch (error) {
    console.error('Failed to delete from blobs:', error);
    throw error;
  }
}

async function getRecordFromBlobs(tableName, recordId) {
  try {
    const records = await readTableFromBlobs(tableName);
    return records.find(r => r._id === recordId);
  } catch (error) {
    console.error('Failed to get record from blobs:', error);
    return null;
  }
}

// Public API - automatically selects file or blob storage
export async function readTable(tableName) {
  await initializeBlobs();
  return isProduction && blobsStore ? readTableFromBlobs(tableName) : readTableFromFile(tableName);
}

export async function appendRecord(tableName, record) {
  await initializeBlobs();
  return isProduction && blobsStore ? appendRecordToBlobs(tableName, record) : appendRecordToFile(tableName, record);
}

export async function updateRecord(tableName, recordId, updates) {
  await initializeBlobs();
  return isProduction && blobsStore ? updateRecordInBlobs(tableName, recordId, updates) : updateRecordInFile(tableName, recordId, updates);
}

export async function deleteRecord(tableName, recordId) {
  await initializeBlobs();
  return isProduction && blobsStore ? deleteRecordFromBlobs(tableName, recordId) : deleteRecordFromFile(tableName, recordId);
}

export async function getRecord(tableName, recordId) {
  await initializeBlobs();
  return isProduction && blobsStore ? getRecordFromBlobs(tableName, recordId) : getRecordFromFile(tableName, recordId);
}
