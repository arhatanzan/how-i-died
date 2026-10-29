# Admin Panel & File-Based Database Setup Guide

## Quick Start

### 1. Set Environment Variables

Add these to your `.env` file or Netlify environment variables:

```env
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
AUTH_SECRET=optional_extra_secret_for_signing
```

### 2. Access Admin Panel

Once deployed or running locally:
- URL: `http://localhost:3000/admin` (dev) or `https://your-site.com/admin` (production)
- Login with the credentials above

### 3. Initialize Sample Data (Optional)

For testing the system:

```bash
npm run init-sample-data
```

This creates sample notes you can view and edit in the admin panel.

## File-Based Database System

### Why File-Based?

Your data is stored in simple JSON files (JSONL format) instead of expensive cloud databases or blob storage:

✅ **Portable** - Works anywhere, easy to backup
✅ **No vendor lock-in** - Not tied to any cloud provider  
✅ **Free** - No database costs
✅ **Simple** - Easy to understand and modify
✅ **Versionable** - Can track with Git if desired

### Data Storage

All data lives in `.data/` directory (excluded from Git):

```
your-project/
├── .data/
│   └── tables/
│       ├── notes.jsonl
│       ├── users.jsonl
│       └── [more tables].jsonl
```

Each line in a `.jsonl` file is a complete JSON record:

```jsonl
{"_id":"uuid-here","_created":"2024-01-15T10:30:00Z","_updated":"2024-01-15T11:45:00Z","text":"Note content","mood":"happy"}
{"_id":"another-uuid","_created":"2024-01-16T14:20:00Z","_updated":"2024-01-16T15:30:00Z","text":"Another note","mood":"sad"}
```

## Admin Panel Features

### Dashboard

Shows database statistics:
- Number of tables
- Record counts per table
- File sizes

### Browse Tables

Left sidebar lists all tables. Click any to view its records.

### View Records

Table view shows:
- Record ID
- All fields as JSON
- Creation date
- Edit/Delete buttons

### Add Records

Form to create new records:
1. Enter field name (e.g., "text", "mood")
2. Enter field value
3. Click "Add Record"
4. Record appears immediately in table

### Edit Records

- Click "Edit" on any record
- Modify fields in modal dialog
- Click "Save Changes"
- Updates immediately

### Delete Records

- Click "Delete" on any record
- Confirm deletion
- Record removed immediately

### Export Data

On the table page, you can export all records as JSON for backup.

## API Reference

All admin endpoints require authentication and must include:
```
Header: x-requested-with: how-i-died
```

### Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -H "x-requested-with: how-i-died" \
  -d '{"username":"admin","password":"password"}'

# Check session
curl -X GET http://localhost:3000/api/session

# Logout
curl -X POST http://localhost:3000/api/logout \
  -H "x-requested-with: how-i-died"
```

### Tables

```bash
# List all tables
curl -X GET http://localhost:3000/api/admin/tables \
  -H "Cookie: hid_session=..."

# Get table data
curl -X GET http://localhost:3000/api/admin/table/notes \
  -H "Cookie: hid_session=..."

# Get database stats
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Cookie: hid_session=..."

# Export table
curl -X GET http://localhost:3000/api/admin/export/notes \
  -H "Cookie: hid_session=..." > notes-backup.json
```

### Records

```bash
# Create record
curl -X POST http://localhost:3000/api/admin/record/notes \
  -H "Content-Type: application/json" \
  -H "x-requested-with: how-i-died" \
  -H "Cookie: hid_session=..." \
  -d '{"text":"My note","mood":"happy"}'

# Get record
curl -X GET http://localhost:3000/api/admin/record/notes/{recordId} \
  -H "Cookie: hid_session=..."

# Update record
curl -X PATCH http://localhost:3000/api/admin/record/notes/{recordId} \
  -H "Content-Type: application/json" \
  -H "x-requested-with: how-i-died" \
  -H "Cookie: hid_session=..." \
  -d '{"text":"Updated note"}'

# Delete record
curl -X DELETE http://localhost:3000/api/admin/record/notes/{recordId} \
  -H "x-requested-with: how-i-died" \
  -H "Cookie: hid_session=..."
```

## Production Deployment

### Netlify

1. **Add Environment Variables**
   - Go to Site Settings → Build & Deploy → Environment
   - Add `ADMIN_USERNAME` and `ADMIN_PASSWORD`
   - Deploy

2. **Data Persistence Strategy**
   
   Option A: Backup before redeploy
   ```bash
   # Download data before deploying
   curl http://your-site.com/api/admin/export/notes \
     -H "Cookie: hid_session=..." > backup.json
   
   # After deploy, restore from backup
   ```

   Option B: Use Netlify Build Plugin (create a custom plugin)
   
   Option C: Use external storage (S3, GitHub, etc.)

3. **First Deploy**
   - Push code to repository
   - Netlify builds and deploys
   - Admin panel available at `/admin`

### Other Platforms

The system works on any platform that supports:
- Node.js serverless functions
- Persistent file storage between deploys
- Environment variables

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Or use UI dev server separately
npm run dev:ui

# Admin panel at: http://localhost:3000/admin
```

### Scripts

```bash
# Initialize sample data
npm run init-sample-data

# Migrate from old database (if upgrading)
npm run migrate

# Run tests
npm run test

# Export journal
npm run export
```

### Creating Custom Tables

Use the file-db library directly:

```javascript
import { appendRecord, readTable } from './netlify/lib/file-db.mjs';

// Create a new table automatically
const record = await appendRecord('my_table', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Read all records from it
const records = await readTable('my_table');
```

## Troubleshooting

### Admin panel shows "Authentication required"

- Verify environment variables are set: `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- Check that credentials are correct
- Clear browser cookies and try again

### Records not saving

- Check browser Network tab for API errors
- Verify `.data/tables/` directory exists and is writable
- Check server logs for file I/O errors
- Ensure `x-requested-with: how-i-died` header is sent (the UI does this automatically)

### Can't login

- Verify credentials match environment variables exactly
- Check if `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set in environment
- Try logging in from incognito/private window
- Check browser console for network errors

### Performance issues with large tables

If you have thousands of records:
- Consider archiving old records
- Export old data: `GET /api/admin/export/table_name`
- Delete archived records from main table
- Keep main table under 1000 active records

## Backup & Recovery

### Manual Backup

```bash
# Via API
curl http://your-site.com/api/admin/export/notes \
  -H "Cookie: hid_session=YOUR_SESSION_TOKEN" > backup.json

# Via file system (if you have access)
cp -r .data/ backup/.data/
```

### Restore from Backup

1. Via Admin Panel:
   - Manually add records from backup JSON
   - Or write custom import script

2. Via API:
   ```javascript
   const backup = require('./backup.json');
   for (const record of backup.records) {
     await appendRecord('notes', record);
   }
   ```

## Security Notes

- Admin credentials are hashed before storage in environment
- Session tokens are HMAC-SHA256 signed
- All mutations require authentication
- API requires `x-requested-with: how-i-died` header for mutations
- File paths are sanitized against directory traversal
- System fields cannot be modified via API

## Next Steps

1. Set up environment variables
2. Deploy to your platform
3. Access admin panel at `/admin`
4. Create and manage your data!

For more details, see [FILE_DB_GUIDE.md](./FILE_DB_GUIDE.md)
