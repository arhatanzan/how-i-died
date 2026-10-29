/**
 * Database export formatters for popular database systems
 * Converts the GitHub-backed database to standard database formats
 */

import { readTable } from './blob-db.mjs';

/**
 * Export to MongoDB format (BSON-like JSON array)
 */
export async function exportToMongoDB(tableName) {
  const records = await readTable(tableName);
  
  return {
    format: 'mongodb',
    database: tableName,
    collection: tableName,
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: records.map(record => ({
      _id: record._id,
      ...record,
    })),
    importInstructions: `
# MongoDB Import Instructions
# Replace YOUR_MONGODB_URI and YOUR_DB_NAME

mongoimport --uri "YOUR_MONGODB_URI" \\
  --db YOUR_DB_NAME \\
  --collection ${tableName} \\
  --file export-${tableName}-mongodb.json \\
  --jsonArray
    `.trim(),
  };
}

/**
 * Export to PostgreSQL format (SQL INSERT statements)
 */
export async function exportToPostgres(tableName) {
  const records = await readTable(tableName);
  
  // Generate schema
  const schema = generatePostgresSchema(tableName, records);
  
  // Generate SQL statements
  const sqlStatements = records.map(record => {
    const keys = Object.keys(record);
    const values = keys.map(key => {
      const value = record[key];
      if (value === null) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    });
    
    return `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});`;
  });
  
  return {
    format: 'postgresql',
    database: tableName,
    version: '1.0',
    exportedAt: new Date().toISOString(),
    schema,
    sqlStatements,
    importInstructions: `
# PostgreSQL Import Instructions
# 1. Create the database schema:
${schema}

# 2. Import the data:
psql -U your_user -d your_database -f export-${tableName}-postgres.sql
    `.trim(),
  };
}

/**
 * Export to MySQL format (SQL INSERT statements)
 */
export async function exportToMySQL(tableName) {
  const records = await readTable(tableName);
  
  // Generate schema
  const schema = generateMySQLSchema(tableName, records);
  
  // Generate SQL statements with MySQL-specific syntax
  const sqlStatements = records.map(record => {
    const keys = Object.keys(record);
    const values = keys.map(key => {
      const value = record[key];
      if (value === null) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    });
    
    return `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});`;
  });
  
  return {
    format: 'mysql',
    database: tableName,
    version: '1.0',
    exportedAt: new Date().toISOString(),
    schema,
    sqlStatements,
    importInstructions: `
# MySQL Import Instructions
# 1. Create the database schema:
${schema}

# 2. Import the data:
mysql -u your_user -p your_database < export-${tableName}-mysql.sql
    `.trim(),
  };
}

/**
 * Export to AWS RDS/Aurora format
 */
export async function exportToAWSRDS(tableName, dbType = 'postgres') {
  if (dbType === 'postgres') {
    return exportToPostgres(tableName);
  } else if (dbType === 'mysql') {
    return exportToMySQL(tableName);
  }
  throw new Error('Unsupported AWS RDS database type');
}

/**
 * Export to DynamoDB format (AWS NoSQL)
 */
export async function exportToDynamoDB(tableName) {
  const records = await readTable(tableName);
  
  return {
    format: 'dynamodb',
    table: tableName,
    version: '1.0',
    exportedAt: new Date().toISOString(),
    // Convert to DynamoDB JSON format (with type descriptors)
    data: records.map(record => {
      const item = {};
      for (const [key, value] of Object.entries(record)) {
        item[key] = dynamoDBType(value);
      }
      return item;
    }),
    importInstructions: `
# AWS DynamoDB Import Instructions
# 1. Create a table with partition key _id (String)
# 2. Use AWS DataPipeline or boto3 to import:

import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('${tableName}')

with open('export-${tableName}-dynamodb.json') as f:
    data = json.load(f)
    for item in data['data']:
        table.put_item(Item=item)
    `.trim(),
  };
}

/**
 * Export to Firestore format (Google Cloud)
 */
export async function exportToFirestore(tableName) {
  const records = await readTable(tableName);
  
  return {
    format: 'firestore',
    collection: tableName,
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: records,
    importInstructions: `
# Google Cloud Firestore Import Instructions
# Using Firebase CLI:

firebase firestore:import export-${tableName}-firestore.json

# Or using Node.js:

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const data = require('./export-${tableName}-firestore.json');
data.forEach(doc => {
  db.collection('${tableName}').add(doc);
});
    `.trim(),
  };
}

/**
 * Export to CSV format for spreadsheets
 */
export async function exportToCSV(tableName) {
  const records = await readTable(tableName);
  
  if (records.length === 0) {
    return { format: 'csv', data: '' };
  }
  
  const keys = Object.keys(records[0]);
  const headers = keys.join(',');
  
  const rows = records.map(record => {
    return keys.map(key => {
      const value = record[key];
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      // Escape CSV values
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  
  return {
    format: 'csv',
    table: tableName,
    data: [headers, ...rows].join('\n'),
  };
}

// Helper functions

function generatePostgresSchema(tableName, records) {
  if (records.length === 0) {
    return `CREATE TABLE IF NOT EXISTS ${tableName} (id UUID PRIMARY KEY);`;
  }
  
  const columnDefs = {};
  
  // Infer column types from records
  records.forEach(record => {
    for (const [key, value] of Object.entries(record)) {
      if (!columnDefs[key]) {
        columnDefs[key] = inferPostgresType(value);
      }
    }
  });
  
  const columns = Object.entries(columnDefs)
    .map(([name, type]) => `  ${name} ${type}`)
    .join(',\n');
  
  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columns}\n);`;
}

function generateMySQLSchema(tableName, records) {
  if (records.length === 0) {
    return `CREATE TABLE IF NOT EXISTS ${tableName} (id VARCHAR(36) PRIMARY KEY);`;
  }
  
  const columnDefs = {};
  
  records.forEach(record => {
    for (const [key, value] of Object.entries(record)) {
      if (!columnDefs[key]) {
        columnDefs[key] = inferMySQLType(value);
      }
    }
  });
  
  const columns = Object.entries(columnDefs)
    .map(([name, type]) => `  ${name} ${type}`)
    .join(',\n');
  
  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columns}\n);`;
}

function inferPostgresType(value) {
  if (value === null || value === undefined) return 'TEXT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
  }
  if (value instanceof Date) return 'TIMESTAMP';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'TIMESTAMP';
    return `VARCHAR(${Math.max(255, value.length)})`;
  }
  return 'JSONB';
}

function inferMySQLType(value) {
  if (value === null || value === undefined) return 'TEXT';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INT' : 'DECIMAL(10,2)';
  }
  if (value instanceof Date) return 'DATETIME';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'DATETIME';
    return `VARCHAR(${Math.max(255, value.length)})`;
  }
  return 'JSON';
}

function dynamoDBType(value) {
  if (value === null || value === undefined) return { NULL: true };
  if (typeof value === 'boolean') return { BOOL: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'string') return { S: value };
  if (Array.isArray(value)) return { L: value.map(v => dynamoDBType(v)) };
  if (typeof value === 'object') {
    return { M: Object.entries(value).reduce((acc, [k, v]) => {
      acc[k] = dynamoDBType(v);
      return acc;
    }, {}) };
  }
  return { S: String(value) };
}
