# How I Died

A personal journal with an original animated bilingual nameplate, black-and-white garden illustration, and an open, editorial archive. Built with React, Tailwind CSS, Netlify Functions, Netlify Database (Postgres), and Netlify Blobs for files.

## Journal

- `/` is the landing page; `/journal` is the separate, directly accessible journal page. `/#journal-archive` scrolls to the homepage's selected entries, not the full archive. Both page URLs support refresh and browser back/forward navigation using the existing SPA fallback.
- Mark an entry **Featured** in the editor to include it on the homepage. Up to six explicitly featured entries appear, newest first; unmarked entries are never substituted. Visitors see only public notes; the keeper can also see their private featured notes.
- Write public or private notes with five moods. Only the authenticated keeper can create, edit, publish, and delete notes.
- Browse a photo-led masonry layout, a single-column reading view, or a calendar. Search words, attachment titles, captions, and URLs; filter dates and sort newest, oldest, or longest.
- Attach up to **eight files and links combined** per note. Upload multiple files, drag them in, paste images, or use a photo URL. Captions also serve as image descriptions. Open photos in a keyboard-accessible gallery.
- **Take photo**, **Record video**, and **Record audio** open a permission-gated capture dialog. Review the result before adding it; Cancel/Discard stops the camera/microphone and discards the capture. Live capture needs HTTPS (or localhost), device permission, and browser support for `getUserMedia` / `MediaRecorder`. Uploads remain available if recording is unsupported or permission is denied.
- Files are preserved in their original format, up to **250 MB per file**. Live recordings stop at **10 minutes** or near the size limit. JPEG/PNG/WebP/GIF render as photos; common audio/video formats have native players with a download fallback for unsupported codecs. Upload progress is shown; completed uploads stay in a failed-save draft for retry.
- PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, SVG, TXT/Markdown, CSV/TSV, and RTF are **download-only**. Google Docs, Sheets, and Slides work as link cards, or as files after exporting. Executables, installers (including APK), scripts, archives, and macro-enabled Office extensions are not allowed. The server checks supported file signatures and blocks obvious executables; **this is not a malware scanner**. Office documents and SVGs may still contain dangerous content: only download/open files from trusted sources.
- Large files use authenticated **4 MB chunks**, each with a SHA-256 integrity hash, so no single function request/response carries a large recording. Audio, video, and documents load only on request, and are reassembled in the reader's browser before playback/download (not progressive streaming). Allow enough browser memory for the chosen file size; photos load automatically.
- Add titled link cards or YouTube, Vimeo, Spotify, and SoundCloud URLs. Embedded players connect to their provider **only after a reader clicks Load**. Every player retains an original link if embedding is blocked or unavailable. Arbitrary HTML and third-party embed scripts are not accepted.
- Plain HTTP(S) links in note text become clickable; text is rendered without raw HTML.
- The same editor supports creating and updating text, photos, links, mood, date, and visibility. Failed saves retain the draft and completed uploads for retry.
- The landing page uses original ink-style artwork: a writer beneath a tree, a sleeping cat, and underground roots. Latin letters have staggered hand-drawn movement; intact Urdu words drift independently without breaking connected letterforms. Readers can pause all landing animations; reduced-motion preferences disable animations.
- Dark mode is the default, regardless of the system theme. The navigation's **Light mode / Dark mode** text button switches themes and remembers the reader's choice in their browser. Notes, filters, calendars, editors, dialogs, and illustration fills and strokes share the theme's paper and ink colors, fine borders, and handwritten accents. Mood faces use the same monochrome line icons in the picker and notes; photos retain their original colors. Theme tokens live in `src/index.css`; muted red is reserved for errors and destructive actions.

Existing single-image notes remain readable without a migration. Uploaded files inherit the visibility of notes that reference them and are served without browser caching so visibility changes are rechecked. Removing an attachment or deleting a note cleans up its file/chunks only when no remaining note references them. Failed file uploads attempt cleanup; closing the browser mid-upload or abandoning an already-uploaded unsaved draft can leave unreferenced blobs, which are excluded from exports.

## Database and file storage

Notes now use **Netlify Database / Postgres** through the server-only `@netlify/database` SDK. Netlify supplies `NETLIFY_DB_URL` for the appropriate deployment branch; credentials never go into the frontend. The `journal_notes` table stores one versioned JSONB document per stable note ID, preserving the portable note format and unknown legacy fields. Indexes support creation-date ordering and public-entry selection. Creates/deletes affect individual rows; edits lock their row in a transaction, preventing simultaneous updates from replacing an entire notes array.

Uploaded bytes remain in **Netlify Blobs**: `images` retains legacy uploads and `media` holds upload manifests and binary chunks. Large files do not belong in database rows. Their ordered metadata and links stay with each note. File visibility checks, exports, and attachment cleanup all read notes from Postgres. Only display preferences use browser localStorage.

### Setup and existing-note migration

1. Link the intended Netlify site (`netlify link`) and install dependencies.
2. Deploy with the `@netlify/database` dependency. Netlify provisions its managed database and applies SQL from `netlify/database/migrations` before publication. Verify database availability and plan/usage costs in the site's Database settings. The current SDK replaces the earlier `@netlify/neon` integration; do not copy production URLs into preview or browser configuration.
3. Before switching, export/back up the existing journal and avoid editing notes from an older deployment during cutover.
4. On the first note read/write in each running instance, the app checks a database migration marker. Once per database, it imports the original `journal` Blobs `notes` array in one transaction. Concurrent importers serialize using a transaction advisory lock. Existing database IDs are never overwritten, and the marker prevents deleted entries from being re-imported later. Empty imports also receive a marker. A failed import rolls back and can be retried.
5. IDs, ISO timestamps, privacy, featured selection, attachment URLs, and extra fields survive the import. Legacy moods are normalized as before. The original Blobs notes are **left untouched**, but they are no longer updated after cutover: they are a migration source, not a synchronized backup.

Database outages fail explicitly; the app does **not** silently fall back to writing Blobs or present an empty journal. Check Netlify function logs if the schema, connection, or migration is unavailable. The migration/CRUD implementation is in `netlify/lib/database.mjs`; file access remains in `netlify/lib/media.mjs`.

Postgres is the primary store, **not a separate backup**. This does not enable Google Sheets synchronization. Check your Netlify/Neon plan's recovery/retention settings and keep independent exports including file bytes. Restoring database rows alone will not restore deleted media files.

### Portable backups

Notes retain stable IDs, ISO timestamps, visibility/mood/featured fields, and ordered attachment arrays. Uploaded attachments contain `assetId`, `type`, `name`, `contentType`, `size`, `url`, and a title or photo description. Notes and media manifests carry `schemaVersion: 1`.

Export both public **and private** notes and all locally stored referenced files using Node 20+:

```bash
# Supply ADMIN_USERNAME and ADMIN_PASSWORD securely in the process environment.
# The destination directory must not already exist.
npm run export -- https://your-site.example ./journal-backup
# For the offline archive:
npm run export -- http://localhost:8888 ./journal-backup
```

The authenticated `/api/export` endpoint supplies a versioned manifest. The CLI downloads files in bounded chunks, verifies hashes and byte counts, and writes `journal.json` **only after every file succeeds**. A failed export is explicitly incomplete; remove its specific partial destination before retrying. Keep backups private and outside the public directory/repository.

The portable folder contains:

```text
journal.json           # schemaVersion, exportedAt, notes[], assets[]
assets/<asset-uuid>     # original file bytes, deduplicated across notes
```

Each asset records its relative `path`, original filename/content type, size, source URL, and per-part hashes. Legacy image uploads are included too; external image and cloud-document URLs remain links, are not fetched, and must be exported separately if you need offline copies.

To move to another provider, import notes by their existing IDs, copy the actual files keyed by `assetId` (or legacy asset ID), and map each attachment's source `url` to its new location. Preserve attachment order and note visibility. The export contains no Netlify credentials or storage tokens and does not require Netlify to read the saved file bytes.

## Setup

Set these in Netlify’s environment-variable configuration:

- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: the keeper’s sign-in credentials.
- `AUTH_SECRET`: a long random secret for signing session cookies.

Connect this repository to Netlify. The build command is `npm run build`, the publish directory is `dist`, and function configuration is in `netlify.toml`. Notes persist in Postgres; media persists in Blobs. Let Netlify manage the database connection rather than adding a `VITE_` database secret.

## Development

```bash
npm install
netlify database migrations apply
netlify dev --offline
```

Use Netlify CLI 26+ and Node 20.12.2+ for database commands. Provide keeper credentials using local environment variables. Open **http://localhost:8888**, not Vite’s port 5173: API functions require Netlify dev. Netlify provides an isolated local Postgres-compatible database and local Blobs storage; local migration never reads production Blobs. `npm run dev:ui` starts only the interface and will display an archive connection error without the functions. `netlify database status` shows applied/pending schema migrations; do not use database-reset commands on a journal you need to preserve.

```bash
npm test
npm run build
```

Tests execute the actual SQL schema and repository against isolated PGlite Postgres instances (no cloud credentials). They cover note CRUD and transaction rollback, legacy imports and reruns, privacy, attachments, archive selection, multi-chunk uploads, cleanup, explicit database errors, and portable exports with file integrity checks. Tracker, finance, and public-statistics features and endpoints have been removed; previously stored tracker data is not deleted.

## Database Export & Backup

The journal supports exporting data to multiple database formats for future migration or backup:

### Supported Export Formats
- **JSON** - Default universal format
- **CSV** - Excel/spreadsheet compatible
- **PostgreSQL** - Open-source SQL database
- **MySQL** - MySQL/MariaDB database
- **MongoDB** - NoSQL database
- **AWS DynamoDB** - Serverless NoSQL
- **Google Firestore** - Cloud NoSQL database
- **AWS RDS** - Amazon managed databases

### Export Data
Access the admin panel at `/admin` and use the "Export Database" button to download notes in any format. Each export includes schema and import instructions.

### Manual Export (API)
```bash
# Export as PostgreSQL
curl http://localhost:8888/api/admin/export-db/notes/postgres \
  -H "x-requested-with: how-i-died" \
  > journal-backup.sql

# Export as MongoDB
curl http://localhost:8888/api/admin/export-db/notes/mongodb \
  -H "x-requested-with: how-i-died" \
  > journal-backup.json
```

### GitHub Permanent Storage
All notes can be automatically stored in your GitHub repository for permanent backup and version control. Set `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` environment variables to enable.

See [SCHEMA.md](./SCHEMA.md) for complete database schema and [REFACTORING.md](./REFACTORING.md) for migration guide.
