# How I Died

A personal journal with an original animated bilingual nameplate, black-and-white garden illustration, and an open, editorial archive. Built with React, Tailwind CSS, Netlify Functions, and GitHub-backed persistent storage.

## Journal

- `/` is the landing page; `/journal` is the separate, directly accessible journal page. `/#journal-archive` scrolls to the homepage's selected entries, not the full archive. Both page URLs support refresh and browser back/forward navigation using the existing SPA fallback.
- Mark an entry **Featured** in the editor to include it on the homepage. Up to six explicitly featured entries appear, newest first; unmarked entries are never substituted. Visitors see only public notes; the keeper can also see their private featured notes.
- Write public or private notes with five moods. Only the authenticated keeper can create, edit, publish, and delete notes.
- Browse a photo-led masonry layout, a single-column reading view, or a calendar. Search words, attachment titles, captions, and URLs; filter dates and sort newest, oldest, or longest.
- Sorting remains visible when filters are collapsed. At widths of 640px and above, calendar and timeline views have a left navigation panel while entries scroll independently on the right; smaller screens stack the panels. The timeline lists populated years and months with entry counts; select a year/month to filter, or **All dates** to clear date filters. Date selection preserves search and sorting; newest/oldest ordering also orders the timeline dates.
- Attach up to **eight files and links combined** per note. Upload multiple files, drag them in, paste images, or use a photo URL. Captions also serve as image descriptions. Open photos in a keyboard-accessible gallery.
- **Take photo**, **Record video**, and **Record audio** open a permission-gated capture dialog. Photos and videos start with the front camera; use **Switch to rear camera / Switch to front camera** before capturing or during a video recording. Camera changes stay in one clip, with continuous microphone audio and the last video frame held while the next camera opens. The recording keeps its initial dimensions and fits alternate camera views without stretching. Browsers without canvas capture can still record, but must stop before switching cameras. If a camera is unavailable, switch back; an ongoing recording remains active. Review the result before adding it; Cancel/Discard stops the camera/microphone and discards the capture. Live capture needs HTTPS (or localhost), device permission, and browser support for `getUserMedia` / `MediaRecorder`. Uploads remain available if recording is unsupported or permission is denied.
- Files are preserved in their original format, up to **250 MB per file**. Live recordings stop at **10 minutes** or near the size limit. JPEG/PNG/WebP/GIF render as photos; common audio/video formats have native players with a download fallback for unsupported codecs. Upload progress is shown; completed uploads stay in a failed-save draft for retry.
- Audio and video recordings support **Pause recording / Resume recording** within one clip; paused time does not count toward the 10-minute limit. Stop to review even while paused, or cancel to discard and release the camera/microphone. Saved attachments, draft previews, and capture reviews have visible **Play / Pause** buttons alongside native playback controls. Provider embeds retain their own playback controls.
- PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, SVG, TXT/Markdown, CSV/TSV, and RTF are **download-only**. Google Docs, Sheets, and Slides work as link cards, or as files after exporting. Executables, installers (including APK), scripts, archives, and macro-enabled Office extensions are not allowed. The server checks supported file signatures and blocks obvious executables; **this is not a malware scanner**. Office documents and SVGs may still contain dangerous content: only download/open files from trusted sources.
- Large files use authenticated **4 MB chunks**, each with a SHA-256 integrity hash, so no single function request/response carries a large recording. Audio, video, and documents load only on request, and are reassembled in the reader's browser before playback/download (not progressive streaming). Allow enough browser memory for the chosen file size; photos load automatically.
- Add titled link cards or YouTube, Vimeo, Spotify, and SoundCloud URLs. Embedded players connect to their provider **only after a reader clicks Load**. Every player retains an original link if embedding is blocked or unavailable. Arbitrary HTML and third-party embed scripts are not accepted.
- Plain HTTP(S) links in note text become clickable; text is rendered without raw HTML.
- The same editor supports creating and updating text, photos, links, mood, date, and visibility. Failed saves retain the draft and completed uploads for retry.
- The landing page uses original ink-style artwork: a writer beneath a tree, a sleeping cat, and underground roots. Latin letters have staggered hand-drawn movement; intact Urdu words drift independently without breaking connected letterforms. Readers can pause all landing animations; reduced-motion preferences disable animations.
- Dark mode is the default, regardless of the system theme. The navigation's **Light mode / Dark mode** text button switches themes and remembers the reader's choice in their browser. Notes, filters, calendars, editors, dialogs, and illustration fills and strokes share the theme's paper and ink colors, fine borders, and handwritten accents. Mood faces use the same monochrome line icons in the picker and notes; photos retain their original colors. Theme tokens live in `src/index.css`; muted red is reserved for errors and destructive actions.

Existing single-image notes remain readable without a migration. Uploaded files inherit the visibility of notes that reference them and are served without browser caching so visibility changes are rechecked. Removing an attachment or deleting a note cleans up its file/chunks only when no remaining note references them. Failed file uploads attempt cleanup; closing the browser mid-upload or abandoning an already-uploaded unsaved draft can leave unreferenced blobs, which are excluded from exports.

## Database and file storage

All notes, original uploaded bytes, and file metadata live in the configured **GitHub repository on a dedicated data branch**, not the deploy filesystem or browser localStorage. The default data branch is `journal-data`; set `GITHUB_DATA_BRANCH` to change it. Every content read, write, and deletion explicitly targets that branch. Code pushes and deploys do not replace its files. The repository owner and name come only from server environment variables.

Notes are individual JSON files at `data/journal/YYYY/MM/DD/<note-id>.json`. Legacy images and metadata live under `data/journal/attachments/images/`. Media manifests, ordered binary chunks, and chunk metadata live under `data/journal/attachments/media/`. Stable IDs, original filenames, content types, sizes, and SHA-256 hashes support portable exports and future database migration. A note keeps its stored path when its date changes; reads enumerate the branch tree rather than relying on a generated index or GitHub search. Only display preferences use browser localStorage.

### Setup and existing-note migration

1. Use a **private repository** for storage: application-level privacy cannot hide private notes or media committed to a public repository. A separate private data repository is supported by setting its owner and name.
2. Set `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` on the server. A fine-grained token needs repository Contents read/write permission, including branch creation. Never expose it through `VITE_` variables.
3. Before deploying this change, take an export and pause writes from older deployments. On first access, a missing data branch is created from the storage repository's current default-branch commit, preserving all existing journal files there. An existing data branch is used as-is and is never reseeded on deployment. Files present only on your local disk must be backed up and transferred separately.
4. Keep `GITHUB_DATA_BRANCH` stable across production deploys. It must not be the storage repository's default branch or any branch targeted by code pushes. Do not merge code into it, reset it, or delete it. Configure Netlify to deploy only the code branch, not commits to the data branch.
5. Give local development and deploy previews a separate test repository or data branch so they cannot modify production notes. Changing the repository or branch selects a different archive; it does not migrate data automatically.

Storage outages fail explicitly rather than silently presenting an empty archive. Uploads fail when file metadata cannot be persisted. GitHub API limits, repository size limits, and write conflicts still apply; failed saves retain the draft for retry. This is file-backed storage, not a transactional database.

Git history is useful for recovery but is **not an independent backup**. Keep portable exports outside the repository. This change cannot recover files already removed before the data branch was created; restore those from existing Git history or backups before cutover. No Postgres database is currently provisioned or used by the app.

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
- `GITHUB_TOKEN`: server-only token with Contents read/write access to the private storage repository.
- `GITHUB_OWNER`, `GITHUB_REPO`: the storage repository owner and name, with no account-specific defaults.
- `GITHUB_DATA_BRANCH`: optional stable data branch name, defaults to `journal-data`.

Connect this repository to Netlify. The build command is `npm run build`, the publish directory is `dist`, and function configuration is in `netlify.toml`. Notes and media persist on the configured GitHub data branch, independently of deploy output.

## Development

```bash
npm install
npm run dev
```

Provide keeper and GitHub credentials using local environment variables, selecting a separate test repository or branch. Open **http://localhost:8888**, not Vite's port 5173: API functions require Netlify dev. Storage requires GitHub connectivity; there is no offline production-data fallback. `npm run dev:ui` starts only the interface and will display an archive connection error without the functions.

```bash
npm test
npm run build
```

The focused GitHub integration suite runs without cloud credentials: `node --test tests/github-notes.test.js`. It covers branch initialization, preservation across code pushes, note CRUD, privacy, attachments, original byte integrity, metadata failures, and complete portable exports. Some older tests still reference removed local database modules and need migration before the full `npm test` suite can pass.

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
  -H "x-requested-with: journal-app" \
  > journal-backup.sql

# Export as MongoDB
curl http://localhost:8888/api/admin/export-db/notes/mongodb \
  -H "x-requested-with: journal-app" \
  > journal-backup.json
```

### GitHub Permanent Storage
GitHub is the primary store, not an optional backup. The database-format exports above contain note records only; use `npm run export` for a complete migration bundle including original file bytes. The manual admin endpoints require an authenticated keeper session cookie in addition to the request header.
