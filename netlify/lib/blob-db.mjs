/**
 * File-based database adapter for persistent storage
 * Stores all note metadata in .data/ directory
 * Works in both local development and Netlify production
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// File-based storage for all environments
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

// Public API - uses file storage only
export async function readTable(tableName) {
  return readTableFromFile(tableName);
}

export async function appendRecord(tableName, record) {
  return appendRecordToFile(tableName, record);
}

export async function updateRecord(tableName, recordId, updates) {
  return updateRecordInFile(tableName, recordId, updates);
}

export async function deleteRecord(tableName, recordId) {
  return deleteRecordFromFile(tableName, recordId);
}

export async function getRecord(tableName, recordId) {
  return getRecordFromFile(tableName, recordId);
}
