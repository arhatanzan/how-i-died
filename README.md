# How I Died

A personal journal with an original animated bilingual nameplate, black-and-white garden illustration, and an open, editorial archive. Built with React, Tailwind CSS, Netlify Functions, and Netlify Blobs.

## Journal

- `/` is the landing page; `/journal` is the separate, directly accessible journal page. `/#journal-archive` scrolls to the homepage's selected entries, not the full archive. Both page URLs support refresh and browser back/forward navigation using the existing SPA fallback.
- Mark an entry **Featured** in the editor to include it on the homepage. Up to six explicitly featured entries appear, newest first; unmarked entries are never substituted. Visitors see only public notes; the keeper can also see their private featured notes.
- Write public or private notes with five moods. Only the authenticated keeper can create, edit, publish, and delete notes.
- Browse a photo-led masonry layout, a single-column reading view, or a calendar. Search words, attachment titles, captions, and URLs; filter dates and sort newest, oldest, or longest.
- Attach up to **eight photos and links combined** per note. Upload multiple files, drag them in, paste images, or use a photo URL. Captions also serve as image descriptions. Open photos in a keyboard-accessible gallery.
- JPEG, PNG, and WebP files (up to 30 MB each before processing) are resized to a 2,000-pixel maximum edge and encoded to WebP, preserving transparency. Animated GIFs up to 4 MB are uploaded unchanged. Each uploaded file must be at most 4 MB after processing.
- Add titled link cards or YouTube, Vimeo, Spotify, and SoundCloud URLs. Embedded players connect to their provider **only after a reader clicks Load**. Every player retains an original link if embedding is blocked or unavailable. Arbitrary HTML and third-party embed scripts are not accepted.
- Plain HTTP(S) links in note text become clickable; text is rendered without raw HTML.
- The same editor supports creating and updating text, photos, links, mood, date, and visibility. Failed saves retain the draft and completed uploads for retry.
- The landing page uses original ink-style artwork: a writer beneath a tree, a sleeping cat, and underground roots. Latin letters have staggered hand-drawn movement; intact Urdu words drift independently without breaking connected letterforms. Readers can pause all landing animations; reduced-motion preferences disable animations.
- Dark mode is the default, regardless of the system theme. The navigation's **Light mode / Dark mode** text button switches themes and remembers the reader's choice in their browser. Notes, filters, calendars, editors, dialogs, and illustration fills and strokes share the theme's paper and ink colors, fine borders, and handwritten accents. Mood faces use the same monochrome line icons in the picker and notes; photos retain their original colors. Theme tokens live in `src/index.css`; muted red is reserved for errors and destructive actions.

Existing single-image notes remain readable without a migration. Uploaded images inherit the visibility of notes that reference them and are served without browser caching so visibility changes are rechecked. Removing an attachment or deleting a note cleans up uploaded images only when no remaining note references them.

## Setup

Set these in Netlify’s environment-variable configuration:

- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: the keeper’s sign-in credentials.
- `AUTH_SECRET`: a long random secret for signing session cookies.

Connect this repository to Netlify. The build command is `npm run build`, the publish directory is `dist`, and function configuration is in `netlify.toml`. Journal and image data persist in Netlify Blobs.

## Development

```bash
npm install
npx netlify dev --offline
```

Provide credentials using local environment variables. Open **http://localhost:8888**, not Vite’s port 5173: API functions require Netlify dev. Offline mode uses local Blobs storage. `npm run dev:ui` starts only the interface and will display an archive connection error without the functions.

```bash
npm test
npm run build
```

Tests cover attachment validation, embed URL allowlisting, legacy notes, image limits, note input validation, and archive selection. Tracker, finance, and public-statistics features and endpoints have been removed; previously stored tracker data is not deleted.
