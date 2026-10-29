/**
 * Database schema definition for relational database structure
 * Maps the journal application data model
 */

export const schema = {
  version: 1,
  description: 'How-I-Died Journal Database Schema',
  tables: {
    notes: {
      description: 'User journal entries',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        text: { type: 'text', required: false },
        mood: { type: 'enum', values: ['terrible', 'sad', 'meh', 'ok', 'good', 'great'], default: 'meh' },
        isPublic: { type: 'boolean', default: false, index: true },
        featured: { type: 'boolean', default: false, index: true },
        imageUrl: { type: 'string', required: false },
        createdAt: { type: 'timestamp', required: true, index: true },
        updatedAt: { type: 'timestamp', required: true },
        schemaVersion: { type: 'integer', default: 1 },
      },
      indexes: [
        { fields: ['createdAt'] },
        { fields: ['isPublic'] },
        { fields: ['featured'] },
        { fields: ['mood'] },
      ],
    },
    
    attachments: {
      description: 'Note attachments (images, links, files, etc.)',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        noteId: { type: 'uuid', required: true, foreignKey: 'notes.id', index: true },
        type: { type: 'enum', values: ['image', 'link', 'file', 'video', 'audio'], required: true },
        url: { type: 'string', required: true },
        title: { type: 'string', required: false },
        alt: { type: 'string', required: false },
        mimeType: { type: 'string', required: false },
        size: { type: 'integer', required: false },
        githubUrl: { type: 'string', required: false, description: 'Permanent storage URL in GitHub' },
        createdAt: { type: 'timestamp', required: true },
      },
      indexes: [
        { fields: ['noteId'] },
        { fields: ['type'] },
      ],
    },
    
    images: {
      description: 'Image metadata and storage',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        noteId: { type: 'uuid', required: true, foreignKey: 'notes.id', index: true },
        data: { type: 'binary', required: true, description: 'Base64 encoded image data' },
        metadata: { type: 'json', required: false },
        githubPath: { type: 'string', required: false, description: 'Path in GitHub repository' },
        createdAt: { type: 'timestamp', required: true },
      },
      indexes: [
        { fields: ['noteId'] },
      ],
    },
    
    media: {
      description: 'Large media files (audio, video, attachments)',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        noteId: { type: 'uuid', required: true, foreignKey: 'notes.id', index: true },
        type: { type: 'string', required: true },
        metadata: { type: 'json', required: true },
        complete: { type: 'boolean', default: false },
        githubPath: { type: 'string', required: false, description: 'Path in GitHub repository' },
        createdAt: { type: 'timestamp', required: true },
        updatedAt: { type: 'timestamp', required: true },
      },
      indexes: [
        { fields: ['noteId'] },
        { fields: ['complete'] },
      ],
    },
    
    sessions: {
      description: 'User authentication sessions',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        userId: { type: 'string', required: true, index: true },
        createdAt: { type: 'timestamp', required: true },
        expiresAt: { type: 'timestamp', required: true, index: true },
        userAgent: { type: 'string', required: false },
      },
      indexes: [
        { fields: ['userId'] },
        { fields: ['expiresAt'] },
      ],
    },
    
    auditLog: {
      description: 'Audit trail for all modifications',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        action: { type: 'enum', values: ['create', 'update', 'delete', 'login', 'export'], required: true },
        entity: { type: 'enum', values: ['note', 'attachment', 'session', 'export'], required: true },
        entityId: { type: 'string', required: true, index: true },
        userId: { type: 'string', required: false },
        changes: { type: 'json', required: false, description: 'Before/after values for updates' },
        ipAddress: { type: 'string', required: false },
        createdAt: { type: 'timestamp', required: true, index: true },
      },
      indexes: [
        { fields: ['action', 'createdAt'] },
        { fields: ['entityId'] },
        { fields: ['userId'] },
      ],
    },
    
    exports: {
      description: 'Database exports for migration/backup',
      primaryKey: 'id',
      fields: {
        id: { type: 'uuid', required: true, index: true },
        format: { type: 'enum', values: ['mongodb', 'postgres', 'mysql', 'dynamodb', 'firestore', 'csv', 'json'], required: true },
        table: { type: 'string', required: true },
        status: { type: 'enum', values: ['pending', 'completed', 'failed'], default: 'pending' },
        recordCount: { type: 'integer', required: false },
        fileSize: { type: 'integer', required: false },
        githubPath: { type: 'string', required: false, description: 'Path to export file in GitHub' },
        downloadUrl: { type: 'string', required: false },
        error: { type: 'text', required: false },
        createdAt: { type: 'timestamp', required: true },
        completedAt: { type: 'timestamp', required: false },
      },
      indexes: [
        { fields: ['format'] },
        { fields: ['createdAt'] },
      ],
    },
  },
};

/**
 * Generate SQL schema for PostgreSQL
 */
export function generatePostgresSchema() {
  const statements = [];
  
  statements.push(`
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY,
  text TEXT,
  mood VARCHAR(10) DEFAULT 'meh',
  "isPublic" BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  "imageUrl" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "schemaVersion" INTEGER DEFAULT 1
);

CREATE INDEX idx_notes_created_at ON notes("createdAt");
CREATE INDEX idx_notes_public ON notes("isPublic");
CREATE INDEX idx_notes_featured ON notes(featured);
CREATE INDEX idx_notes_mood ON notes(mood);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY,
  "noteId" UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  url VARCHAR(500) NOT NULL,
  title VARCHAR(200),
  alt VARCHAR(200),
  "mimeType" VARCHAR(50),
  size INTEGER,
  "githubUrl" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL
);

CREATE INDEX idx_attachments_note_id ON attachments("noteId");
CREATE INDEX idx_attachments_type ON attachments(type);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY,
  "noteId" UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  data BYTEA NOT NULL,
  metadata JSONB,
  "githubPath" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL
);

CREATE INDEX idx_images_note_id ON images("noteId");
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY,
  "noteId" UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL,
  complete BOOLEAN DEFAULT FALSE,
  "githubPath" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

CREATE INDEX idx_media_note_id ON media("noteId");
CREATE INDEX idx_media_complete ON media(complete);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  "userId" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "userAgent" TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions("userId");
CREATE INDEX idx_sessions_expires_at ON sessions("expiresAt");
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  action VARCHAR(20) NOT NULL,
  entity VARCHAR(20) NOT NULL,
  "entityId" VARCHAR(100) NOT NULL,
  "userId" VARCHAR(100),
  changes JSONB,
  "ipAddress" VARCHAR(50),
  "createdAt" TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_action_created ON audit_log(action, "createdAt");
CREATE INDEX idx_audit_entity_id ON audit_log("entityId");
CREATE INDEX idx_audit_user_id ON audit_log("userId");
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY,
  format VARCHAR(20) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  "recordCount" INTEGER,
  "fileSize" INTEGER,
  "githubPath" VARCHAR(500),
  "downloadUrl" VARCHAR(500),
  error TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "completedAt" TIMESTAMP
);

CREATE INDEX idx_exports_format ON exports(format);
CREATE INDEX idx_exports_created_at ON exports("createdAt");
  `.trim());

  return statements.join('\n\n');
}

/**
 * Generate SQL schema for MySQL
 */
export function generateMySQLSchema() {
  const statements = [];

  statements.push(`
CREATE TABLE IF NOT EXISTS notes (
  id CHAR(36) PRIMARY KEY,
  text LONGTEXT,
  mood VARCHAR(10) DEFAULT 'meh',
  isPublic BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  imageUrl VARCHAR(500),
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  schemaVersion INT DEFAULT 1,
  INDEX idx_created_at (createdAt),
  INDEX idx_public (isPublic),
  INDEX idx_featured (featured),
  INDEX idx_mood (mood)
);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS attachments (
  id CHAR(36) PRIMARY KEY,
  noteId CHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  url VARCHAR(500) NOT NULL,
  title VARCHAR(200),
  alt VARCHAR(200),
  mimeType VARCHAR(50),
  size INT,
  githubUrl VARCHAR(500),
  createdAt TIMESTAMP NOT NULL,
  FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
  INDEX idx_note_id (noteId),
  INDEX idx_type (type)
);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS images (
  id CHAR(36) PRIMARY KEY,
  noteId CHAR(36) NOT NULL,
  data LONGBLOB NOT NULL,
  metadata JSON,
  githubPath VARCHAR(500),
  createdAt TIMESTAMP NOT NULL,
  FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
  INDEX idx_note_id (noteId)
);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS media (
  id CHAR(36) PRIMARY KEY,
  noteId CHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  metadata JSON NOT NULL,
  complete BOOLEAN DEFAULT FALSE,
  githubPath VARCHAR(500),
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
  INDEX idx_note_id (noteId),
  INDEX idx_complete (complete)
);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) PRIMARY KEY,
  userId VARCHAR(100) NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  userAgent TEXT,
  INDEX idx_user_id (userId),
  INDEX idx_expires_at (expiresAt)
);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) PRIMARY KEY,
  action VARCHAR(20) NOT NULL,
  entity VARCHAR(20) NOT NULL,
  entityId VARCHAR(100) NOT NULL,
  userId VARCHAR(100),
  changes JSON,
  ipAddress VARCHAR(50),
  createdAt TIMESTAMP NOT NULL,
  INDEX idx_action_created (action, createdAt),
  INDEX idx_entity_id (entityId),
  INDEX idx_user_id (userId)
);
  `.trim());

  statements.push(`
CREATE TABLE IF NOT EXISTS exports (
  id CHAR(36) PRIMARY KEY,
  format VARCHAR(20) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  recordCount INT,
  fileSize INT,
  githubPath VARCHAR(500),
  downloadUrl VARCHAR(500),
  error TEXT,
  createdAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  INDEX idx_format (format),
  INDEX idx_created_at (createdAt)
);
  `.trim());

  return statements.join('\n\n');
}

/**
 * MongoDB collection schema (for reference)
 */
export const mongoDBSchema = {
  notes: {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'id', 'createdAt'],
        properties: {
          _id: { bsonType: 'objectId' },
          id: { bsonType: 'string' },
          text: { bsonType: 'string' },
          mood: { enum: ['terrible', 'sad', 'meh', 'ok', 'good', 'great'] },
          isPublic: { bsonType: 'bool' },
          featured: { bsonType: 'bool' },
          imageUrl: { bsonType: 'string' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { createdAt: -1 } },
      { key: { isPublic: 1 } },
      { key: { featured: 1 } },
    ],
  },
};
