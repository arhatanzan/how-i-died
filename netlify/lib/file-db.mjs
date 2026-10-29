import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.join(process.cwd(), '.data');
const TABLES_DIR = path.join(DATA_DIR, 'tables');

// Ensure data directory exists and is not in public directory
async function ensureDataDir() {
  try {
    await fs.access(TABLES_DIR);
  } catch {
    await fs.mkdir(TABLES_DIR, { recursive: true });
  }
}

// Get table file path - prevents directory traversal attacks
function getTablePath(tableName) {
  const safeName = path.basename(tableName);
  if (!safeName || safeName.includes('..') || safeName.includes('/')) {
    throw new Error('Invalid table name');
  }
  return path.join(TABLES_DIR, `${safeName}.jsonl`);
}

// Read all records from a table
export async function readTable(tableName) {
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

// Append a new record to a table
export async function appendRecord(tableName, record) {
  await ensureDataDir();
  const filePath = getTablePath(tableName);
  
  const enrichedRecord = {
    ...record,
    _id: record._id || crypto.randomUUID(),
    _created: record._created || new Date().toISOString(),
    _updated: new Date().toISOString(),
  };
  
  await fs.appendFile(filePath, JSON.stringify(enrichedRecord) + '\n', 'utf-8');
  return enrichedRecord;
}

// Update a record in a table
export async function updateRecord(tableName, recordId, updates) {
  await ensureDataDir();
  const records = await readTable(tableName);
  const filePath = getTablePath(tableName);
  
  const updated = records.map(record => 
    record._id === recordId 
      ? { ...record, ...updates, _id: recordId, _updated: new Date().toISOString() }
      : record
  );
  
  const found = updated.some(r => r._id === recordId);
  if (!found) {
    throw new Error(`Record with ID ${recordId} not found in table ${tableName}`);
  }
  
  // Rewrite the entire file
  await fs.writeFile(
    filePath,
    updated.map(r => JSON.stringify(r)).join('\n') + '\n',
    'utf-8'
  );
  
  return updated.find(r => r._id === recordId);
}

// Delete a record from a table
export async function deleteRecord(tableName, recordId) {
  await ensureDataDir();
  const records = await readTable(tableName);
  const filePath = getTablePath(tableName);
  
  const deleted = records.find(r => r._id === recordId);
  if (!deleted) {
    throw new Error(`Record with ID ${recordId} not found in table ${tableName}`);
  }
  
  const remaining = records.filter(r => r._id !== recordId);
  
  await fs.writeFile(
    filePath,
    remaining.map(r => JSON.stringify(r)).join('\n') + (remaining.length > 0 ? '\n' : ''),
    'utf-8'
  );
  
  return deleted;
}

// Get single record by ID
export async function getRecord(tableName, recordId) {
  const records = await readTable(tableName);
  return records.find(r => r._id === recordId) || null;
}

// Get all tables available
export async function listTables() {
  await ensureDataDir();
  try {
    const files = await fs.readdir(TABLES_DIR);
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Export data
export async function exportTable(tableName) {
  const records = await readTable(tableName);
  return {
    tableName,
    count: records.length,
    records,
    exportedAt: new Date().toISOString(),
  };
}

// Get database stats
export async function getStats() {
  const tables = await listTables();
  const stats = {};
  
  for (const table of tables) {
    const records = await readTable(table);
    stats[table] = {
      count: records.length,
      size: records.length > 0 ? JSON.stringify(records).length : 0,
    };
  }
  
  return stats;
}
