# File-Based Database System

## Overview

The application now includes a **file-based database system** that stores data as JSON files instead of relying on cloud databases or blob storage. This approach provides:

- **Portability**: Database is stored locally, not dependent on external services
- **Safety**: Data persists with your code and deployment configuration
- **Privacy**: Complete control over where and how data is stored
- **Admin Interface**: Built-in UI to view and manage database records

## Architecture

### Database Location

All data is stored in the `.data/` directory at the project root:

```
project-root/
├── .data/                  # Database directory (not in public or git)
│   └── tables/
│       ├── notes.jsonl
│       └── [other-tables].jsonl
└── ...
```

**Important:** The `.data/` directory is:
- ✅ Excluded from Git (`.gitignore`)
- ✅ Excluded from public access
- ✅ Protected by admin authentication
- ❌ Not deployed directly (must be managed separately)

### File Format

Each table is stored as a **JSONL** (JSON Lines) file where each line is a separate record:

```jsonl
{"_id":"550e8400-e29b-41d4-a716-446655440000","_created":"2024-01-15T10:30:00Z","_updated":"2024-01-15T11:45:00Z","text":"My first note","mood":"happy"}
{"_id":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","_created":"2024-01-16T14:20:00Z","_updated":"2024-01-16T15:30:00Z","text":"Another entry","mood":"contemplative"}
```

### System Fields

Every record has system fields (prefixed with `_`):

| Field | Type | Description |
|-------|------|-------------|
| `_id` | UUID | Unique identifier, auto-generated if not provided |
| `_created` | ISO 8601 | Timestamp when record was created |
| `_updated` | ISO 8601 | Timestamp when record was last updated |

## Admin Panel

Access the admin panel at: `/admin`

### Features

- **Authentication**: Login with admin credentials (ADMIN_USERNAME / ADMIN_PASSWORD)
- **Tables View**: Browse all available tables
- **Records Table**: View all records in a table with pagination
- **Add Records**: Create new records directly from the UI
- **Edit Records**: Modify existing record data
- **Delete Records**: Remove records with confirmation
- **Database Stats**: View table sizes and record counts
- **Export**: Download table data as JSON

### Using the Admin Panel

1. **Login**
   ```
   URL: https://your-site.com/admin
   Username: [ADMIN_USERNAME from environment]
   Password: [ADMIN_PASSWORD from environment]
   ```

2. **View Records**
   - Click on a table name in the left panel
   - Records appear in the table view with all fields displayed

3. **Add Records**
   - Fill in field name and value
   - Click "Add Record"
   - Record appears immediately in the table

4. **Edit Records**
   - Click "Edit" button on any record
   - Modify field values in the modal
   - Click "Save Changes"

5. **Delete Records**
   - Click "Delete" button
   - Confirm deletion
   - Record is removed immediately

## API Endpoints

All admin endpoints require authentication (valid session cookie).

### List Tables
```
GET /api/admin/tables
Response: { tables: ["notes", "users", ...] }
```

### Get Table Data
```
GET /api/admin/table/{tableName}
Response: { table: "notes", records: [...], count: 5 }
```

### Get Database Stats
```
GET /api/admin/stats
Response: { stats: { notes: { count: 5, size: 1024 }, ... } }
```

### Create Record
```
POST /api/admin/record/{tableName}
Body: { "text": "My note", "mood": "happy" }
Response: { success: true, record: { _id: "...", _created: "...", ... } }
```

### Update Record
```
PATCH /api/admin/record/{tableName}/{recordId}
Body: { "text": "Updated note" }
Response: { success: true, record: { ... } }
```

### Delete Record
```
DELETE /api/admin/record/{tableName}/{recordId}
Response: { success: true, deleted: { ... } }
```

### Export Table
```
GET /api/admin/export/{tableName}
Response: { tableName: "notes", count: 5, records: [...] }
```

## Environment Configuration

Set these environment variables:

```env
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_password
AUTH_SECRET=optional_additional_secret
```

For Netlify:
1. Go to Site Settings → Build & Deploy → Environment
2. Add the variables above
3. Redeploy your site

## Data Migration

### Migrating from Old Database

If you have data in the old database, use the migration script:

```bash
npm run migrate
```

Or manually:

```bash
node scripts/migrate-to-file-db.mjs
```

This script:
- Loads all notes from the current database
- Converts them to the file-based format
- Stores them in `.data/tables/notes.jsonl`

## Production Deployment

### Important Considerations

1. **Data Persistence**
   - The `.data/` directory is NOT version-controlled
   - You need a strategy to preserve data between deployments
   - Options:
     - Store backups externally
     - Use a post-deployment hook to restore from backup
     - Archive data before redeploy

2. **Backup Strategy**
   ```bash
   # Download backup from /api/admin/export/notes
   # Store in secure location
   # Restore by uploading to /admin panel
   ```

3. **Multiple Instances**
   - If deploying to multiple instances, data is local to each
   - Consider using a shared storage solution for production

## File-Based Database Library

### Core API

Located in: `netlify/lib/file-db.mjs`

```javascript
import {
  readTable,      // Read all records from a table
  appendRecord,   // Add new record
  updateRecord,   // Update existing record
  deleteRecord,   // Remove record
  getRecord,      // Get single record by ID
  listTables,     // List all available tables
  exportTable,    // Export table data
  getStats        // Get database statistics
} from '../lib/file-db.mjs';
```

### Usage Example

```javascript
import { appendRecord, readTable, updateRecord } from './netlify/lib/file-db.mjs';

// Create a record
const note = await appendRecord('notes', {
  text: 'Hello world',
  mood: 'happy',
  isPublic: true
});
// Returns: { _id: "...", _created: "...", _updated: "...", text: "...", ... }

// Read all records
const notes = await readTable('notes');
// Returns: [{ _id: "...", text: "...", ... }, ...]

// Update a record
const updated = await updateRecord('notes', note._id, {
  text: 'Updated text'
});
// Returns: { _id: "...", text: "Updated text", _updated: "...", ... }
```

## Security

### Access Control

- **Public**: `/` and `/journal` routes (with filters for public notes)
- **Authenticated**: Full journal access for logged-in admins
- **Admin Only**: `/admin` panel and `/api/admin/*` endpoints

### Authentication

- Sessions use HMAC-SHA256 signed tokens
- Session tokens are:
  - Signed with a key derived from admin credentials
  - Stored in secure HttpOnly cookies
  - Validated on every request
  - Auto-invalidate when credentials change

### File Security

- File paths are sanitized to prevent directory traversal
- System fields (`_id`, `_created`, `_updated`) cannot be modified via API
- All admin operations require authentication

## Troubleshooting

### Admin panel won't load
- Ensure `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set
- Check browser console for errors
- Verify you're logged in via `/api/session`

### Records not saving
- Check browser Network tab for API errors
- Verify `.data/tables/` directory exists and is writable
- Check server logs for file I/O errors

### Can't access admin panel
- Verify you're entering correct credentials
- Check environment variables are deployed
- Clear cookies and try again

## Best Practices

1. **Regular Backups**
   - Export tables weekly using admin panel
   - Store backups in secure location

2. **Record Organization**
   - Use consistent field names across records
   - Include timestamps for audit trail

3. **Performance**
   - For large tables (1000+ records), consider archiving old records
   - Export old data and store separately if table grows large

4. **Data Validation**
   - Validate data before creating/updating records
   - Use the UI to catch format errors before submission

## Migration Path

As your application grows, you can:

1. **Keep file-based DB** - Simple and portable
2. **Add proper database** - Export data and import to PostgreSQL/MongoDB
3. **Hybrid approach** - File-based DB for backup, real DB for performance
