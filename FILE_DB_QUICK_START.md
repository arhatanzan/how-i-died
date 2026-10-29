# File-Based Database - Quick Reference

## What You Get

✅ **File-based database** - Data stored in `.data/tables/` as JSONL files (not in Git)
✅ **Admin panel** - Full UI at `/admin` to view and edit data in rows & columns
✅ **API access** - REST endpoints to manage data programmatically
✅ **Authentication** - Admin-only access with session cookies
✅ **Portability** - No vendor lock-in, take your data anywhere
✅ **Cost-free** - No database fees, just file storage

## Setup (5 minutes)

### Step 1: Set Environment Variables

Create or update your `.env` file:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

For Netlify, add these to: **Site Settings → Build & Deploy → Environment**

### Step 2: Deploy

Push your code to deploy. The `.data/` directory will be created automatically.

### Step 3: Access Admin Panel

Visit: `https://your-site.com/admin`

Login with the credentials above.

### Step 4 (Optional): Load Sample Data

For testing:

```bash
npm run init-sample-data
```

## Admin Panel Tour

| Feature | How To |
|---------|--------|
| **View Data** | Click table name → See all records |
| **Add Record** | Fill form at top → Click "Add Record" |
| **Edit Record** | Click "Edit" button → Modify → Save |
| **Delete Record** | Click "Delete" → Confirm |
| **Export Backup** | Click "Export" → Download JSON |
| **View Stats** | Dashboard shows sizes and counts |

## API Quick Reference

```bash
# View all tables
curl https://your-site.com/api/admin/tables \
  -H "Cookie: hid_session=YOUR_TOKEN"

# View records in a table
curl https://your-site.com/api/admin/table/notes \
  -H "Cookie: hid_session=YOUR_TOKEN"

# Create record
curl -X POST https://your-site.com/api/admin/record/notes \
  -H "Content-Type: application/json" \
  -H "x-requested-with: how-i-died" \
  -H "Cookie: hid_session=YOUR_TOKEN" \
  -d '{"text":"Hello","mood":"happy"}'

# Update record
curl -X PATCH https://your-site.com/api/admin/record/notes/RECORD_ID \
  -H "Content-Type: application/json" \
  -H "x-requested-with: how-i-died" \
  -H "Cookie: hid_session=YOUR_TOKEN" \
  -d '{"text":"Updated"}'

# Delete record
curl -X DELETE https://your-site.com/api/admin/record/notes/RECORD_ID \
  -H "x-requested-with: how-i-died" \
  -H "Cookie: hid_session=YOUR_TOKEN"
```

## File Structure

```
your-project/
├── .data/                    ← Auto-created on first data write
│   └── tables/
│       ├── notes.jsonl      ← One JSON record per line
│       ├── users.jsonl
│       └── [other].jsonl
├── netlify/
│   ├── functions/
│   │   └── admin.mjs        ← Admin API endpoints
│   └── lib/
│       └── file-db.mjs      ← Database library
├── src/
│   └── pages/
│       └── admin.jsx        ← Admin panel UI
└── .gitignore              ← Excludes .data/
```

## Data Format

Each table is a `.jsonl` file (JSON Lines):

```jsonl
{"_id":"abc-123","_created":"2024-01-15T10:30:00Z","_updated":"2024-01-15T11:45:00Z","text":"Note 1","mood":"happy"}
{"_id":"def-456","_created":"2024-01-16T14:20:00Z","_updated":"2024-01-16T15:30:00Z","text":"Note 2","mood":"sad"}
```

System fields (auto-managed):
- `_id` - Unique UUID
- `_created` - ISO 8601 timestamp
- `_updated` - ISO 8601 timestamp

## Common Tasks

### Create a New Table

It's automatic! Just add the first record:

```javascript
// In your API or script
import { appendRecord } from './netlify/lib/file-db.mjs';

await appendRecord('users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// File .data/tables/users.jsonl is auto-created
```

### Backup Your Data

```bash
# Via API (recommended)
curl https://your-site.com/api/admin/export/notes \
  -H "Cookie: hid_session=YOUR_TOKEN" > backup.json

# Via file system (if you have server access)
cp -r .data/ backup/
```

### Restore from Backup

1. Download backup.json from admin panel
2. Use browser DevTools or custom script to re-add records
3. Or replace `.data/tables/notes.jsonl` file directly

### Migrate from Old Database

If you're upgrading:

```bash
npm run migrate
```

This copies all data from the old database to `.data/tables/notes.jsonl`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't login to `/admin` | Check ADMIN_USERNAME & ADMIN_PASSWORD in environment |
| Admin panel shows 404 | Ensure site is deployed, check `/admin` URL |
| Records not saving | Check browser Network tab, verify `x-requested-with` header |
| Database is empty | Run `npm run init-sample-data` or add records manually |
| `.data/` doesn't exist | It's created automatically on first write |

## Key Concepts

### Why Files Instead of Database?

| | File DB | Cloud DB |
|---|---------|----------|
| Cost | $0 | $20+/month |
| Portability | ✅ Easy | ❌ Vendor locked |
| Backup | ✅ Simple | ⚠️ Complex |
| Scalability | ⚠️ For 10K+ records, consider DB | ✅ Unlimited |
| Simplicity | ✅ Easy to understand | ❌ Complex setup |

### File Security

- `.data/` is NOT served publicly (not in `/public`)
- `.data/` is NOT in Git (in `.gitignore`)
- Admin panel requires authentication
- File paths are validated (no directory traversal)
- Session tokens are cryptographically signed

## Next Steps

1. ✅ Set environment variables
2. ✅ Deploy
3. ✅ Visit `/admin` and explore
4. ✅ Create some records
5. ✅ Backup important data
6. ✅ Share with team (keep credentials secure!)

## Documentation

- **Full guide**: [FILE_DB_GUIDE.md](./FILE_DB_GUIDE.md)
- **Setup details**: [ADMIN_SETUP.md](./ADMIN_SETUP.md)
- **API docs**: See ADMIN_SETUP.md → API Reference section

## Questions?

Check the documentation files or review:
- `netlify/lib/file-db.mjs` - Database implementation
- `netlify/functions/admin.mjs` - API endpoints
- `src/pages/admin.jsx` - Admin UI
