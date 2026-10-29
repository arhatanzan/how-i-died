/**
 * Database adapter for persistent storage via GitHub
 * Stores all note data in the repository under data/journal/notes/
 * Works in both local development and Netlify production
 */

import { storeNoteMetadata, loadNoteMetadata, listNotes, deleteNoteData, updateNoteIndex } from './github-storage.mjs';

// GitHub-backed storage for all environments
// Notes are stored as individual JSON files in GitHub

async function ensureDataDir() {
  // No-op for GitHub-backed storage - directories are implicit
}

function getTablePath(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Invalid table name: must be a non-empty string');
  }
  
  if (tableName.includes('/') || tableName.includes('\\') || tableName.includes('..')) {
    throw new Error('Invalid table name: cannot contain path separators or traversal sequences');
  }
  
  return tableName;
}

// GitHub-based operations
async function readTableFromFile(tableName) {
  await ensureDataDir();
  
  if (tableName !== 'notes') {
    // Only 'notes' table is supported for GitHub storage
    console.warn('readTableFromFile called for non-notes table:', tableName);
    return [];
  }
  
  try {
    const notes = await listNotes();
    return notes || [];
  } catch (error) {
    console.error('Failed to read notes from GitHub:', error);
    return [];
  }
}

async function appendRecordToFile(tableName, record) {
  await ensureDataDir();
  
  if (tableName !== 'notes') {
    throw new Error('Only notes table is supported');
  }
  
  try {
    // Store the note in GitHub
    const result = await storeNoteMetadata(record);
    if (!result) {
      throw new Error('Failed to store note in GitHub');
    }
    
    // Return record with _id for consistency
    return {
      _id: record.id,
      ...record,
    };
  } catch (error) {
    console.error('Failed to append record to GitHub:', error);
    throw error;
  }
}

async function updateRecordInFile(tableName, recordId, updates) {
  if (tableName !== 'notes') {
    throw new Error('Only notes table is supported');
  }
  
  try {
    // Load the note, update it, and store back
    const note = await loadNoteMetadata(recordId);
    if (!note) return null;
    
    const updated = { ...note, ...updates };
    const result = await storeNoteMetadata(updated);
    if (!result) {
      throw new Error('Failed to update note in GitHub');
    }
    
    return updated;
  } catch (error) {
    console.error('Failed to update record in GitHub:', error);
    throw error;
  }
}

async function deleteRecordFromFile(tableName, recordId) {
  if (tableName !== 'notes') {
    throw new Error('Only notes table is supported');
  }
  
  try {
    // Load the note before deletion to return it
    const note = await loadNoteMetadata(recordId);
    if (!note) return null;
    
    // Delete from GitHub
    const result = await deleteNoteData(recordId);
    if (!result) {
      throw new Error('Failed to delete note from GitHub');
    }
    
    return note;
  } catch (error) {
    console.error('Failed to delete record from GitHub:', error);
    throw error;
  }
}

async function getRecordFromFile(tableName, recordId) {
  if (tableName !== 'notes') {
    return null;
  }
  
  try {
    return await loadNoteMetadata(recordId);
  } catch (error) {
    console.error('Failed to get record from GitHub:', error);
    return null;
  }
}

// Public API - uses GitHub storage
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
