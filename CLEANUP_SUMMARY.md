# Netlify/Neon Database Code Cleanup Summary

## Changes Made

### 1. Removed Dependencies
- Removed `@netlify/database` from package.json
- Removed `@netlify/blobs` from package.json

### 2. Removed Files
- Deleted `netlify/lib/database.mjs` - Neon database with noteRepository
- Deleted `netlify/lib/store.mjs` - Blob store wrappers for Netlify Blobs
- Deleted `netlify/database/` directory - Migration files for Neon
- Deleted `tests/database.test.js` - Tests for Postgres migration logic

### 3. Created New Files
- Created `netlify/lib/store-file-db.mjs` - File-based store adapter using file-db.mjs
  - Implements `loadNotes()`, `createNote()`, `updateNote()`, `deleteNote()`
  - Implements `imageStore()` - stores images in .data/tables/images.jsonl
  - Implements `mediaStore()` - stores media chunks in .data/tables/media.jsonl

### 4. Updated Files
- `netlify/functions/notes.mjs` - Changed import from store.mjs to store-file-db.mjs
- `netlify/functions/export.mjs` - Changed import from store.mjs to store-file-db.mjs
- `netlify/functions/images.mjs` - Changed import from store.mjs to store-file-db.mjs
- `netlify/functions/media.mjs` - Changed import from store.mjs to store-file-db.mjs
- `netlify/lib/media.mjs` - Changed import from store.mjs to store-file-db.mjs
- `tests/support/database.mjs` - Refactored to use file-db instead of PGlite
- `tests/api.test.js` - Removed Netlify Blobs dependencies, use file-db based store
- `tests/media.test.js` - Removed Netlify Blobs dependencies, restored path imports
- `scripts/migrate-to-file-db.mjs` - Updated to use store-file-db.mjs

### 5. Data Storage
All data is now stored in `.data/tables/` as JSONL files:
- `.data/tables/notes.jsonl` - Journal notes
- `.data/tables/images.jsonl` - User-uploaded images
- `.data/tables/media.jsonl` - Media files (chunks and manifests)

The `.data/` directory is not tracked by git (.gitignored).

## Test Results
- 37 out of 38 tests passing
- 1 test failing: scripts/test-admin-browser.mjs (requires playwright, unrelated to this cleanup)
- All core functionality tests passing:
  - Note CRUD operations
  - Image management
  - Media upload and download
  - Export functionality
  - File-based database operations

## Architecture
- **Before**: Notes stored in Neon (Postgres), images and media in Netlify Blobs
- **After**: Everything stored in file-based system (.data/tables/*.jsonl)
- No external database required
- All data is portable and backed by simple JSON Lines format
- Data can be checked into version control if needed

## Migration Notes
The old `npm run migrate` script is still available but now works with the file-db system. Since we've completely switched to file-db, any existing data from the Postgres/Blobs era would need to be manually migrated or re-imported.
