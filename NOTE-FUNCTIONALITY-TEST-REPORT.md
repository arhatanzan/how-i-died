# Note Functionality Verification

Date: 2026-10-29

## Environments

- Tested the deployed journal at https://how-i-died.netlify.app/journal with the keeper's browser session and explicitly marked temporary notes.
- Tested patched code in a real browser at http://localhost:8891/journal. This environment runs the built React app and actual auth, note, image, media, and export functions against disposable in-memory GitHub storage. It never writes to the live repository.
- Backend regressions exercise the actual handlers with mocked GitHub responses, including delayed/unavailable search, outages, shared attachments, and raw binary downloads.
- Fixes are local workspace changes, not a deployment. The live site still needs these changes deployed.

## Fixes

1. Preserve uploaded attachment IDs, filenames, MIME types, and sizes in saved note JSON. Previously these fields disappeared on refresh, causing `NaN KB` and failed edits/publishing.
2. Restore missing attachment metadata in previously saved notes from their complete upload manifests, without manually rewriting existing entries.
3. Keep an existing note's repository path stable when its displayed date changes. Previously changing a date created a duplicate file/note.
4. Provide document downloads and audio/video download fallbacks after loading file bytes.
5. Implement removal of unreferenced images, media chunks, manifests, and metadata sidecars. Preserve files while another note references them.
6. Read chunks larger than 1 MB through GitHub's raw response stream, preserving binary bytes even when response headers describe text. Do not parse JSON-looking document bytes as metadata.
7. Return explicit storage errors instead of empty archives or false "No such note" responses when reads or deletions fail.
8. Replace Instagram's inert React-inserted script/blockquote with the shared consent-gated iframe renderer and canonical embed URLs.

## Browser Coverage

| Area | Result |
| --- | --- |
| Empty/invalid notes, unsupported executable selection, forged image signatures | Passed; rejected without losing the draft; failed upload cleaned up |
| Text creation, inline links, HTML-like text rendered literally | Passed on deployed site |
| Private save, immediate publish, anonymous visibility, unpublish | Passed; media manifests hidden anonymously while private |
| Edit, cancel, save, mood selection, backdated creation, date changes, refresh persistence | Passed; date-change duplication reproduced and fixed |
| Long-text expand/collapse, featured selection, private featured visibility on sign-out | Passed |
| Link-only and attachment-only notes; titles and captions | Passed |
| Photo URL, file input, pasted photo, dropped files | Passed |
| Eight attachments, rejection of a ninth | Passed |
| Photo gallery, next/previous, arrow keys, Escape | Passed |
| Camera/microphone permission denial and cancellation | Passed with simulated denied permission |
| Photo capture/review/discard; audio/video recording/review/add | Passed using synthetic camera/microphone streams and real MediaRecorder; tracks stopped afterward |
| Recorded media save/reload; audio/video download fallback | Passed; codec playback limitation described below |
| Multi-chunk document over 4 MB, JSON-looking text document | Original downloaded bytes verified |
| Save failure and retry | Draft and completed uploads retained; retry issued no additional upload initialization |
| Attachment removal and note deletion | Passed; isolated storage returned to zero files after all test notes were deleted |
| Shared-file retention | Passed in real-handler API regressions |
| Search, attachment-title search, no results, clear filters | Passed |
| Sort modes, year/month/day filters, calendar navigation and day selection | Passed |
| Grid, Timeline, Calendar, dark/light modes | Passed |
| YouTube and Instagram consent-gated embed creation | Passed; original links retained |
| Invalid login, valid login, logout, anonymous write rejection | Passed |
| Mobile/tablet/desktop widths: 320, 375, 768, 1440 px | No horizontal page/control overflow; mobile and desktop screenshots inspected |
| Authenticated export metadata, referenced asset size/hash metadata, unauthenticated export rejection | Passed in API regressions |

## Verification

The focused command passes **27 tests**:

```bash
node --test tests/attachments.test.js tests/github-notes.test.js tests/journal.test.js tests/media-client.test.js tests/moods.test.js tests/schema.test.js
npm run build
git diff --check
```

The broader existing suite still has four pre-existing files that cannot start because removed storage modules are imported: [tests/api.test.js](tests/api.test.js), [tests/media.test.js](tests/media.test.js), [tests/file-db.test.mjs](tests/file-db.test.mjs), and [tests/storage-management.test.mjs](tests/storage-management.test.mjs). These were not silently treated as passing or replaced with unrelated storage implementations.

## Limits

- The automated browser could record WebM but rejected its playback codecs, and YouTube also reported unsupported playback. The app displayed its fallback messages/download links correctly. Actual playback needs confirmation in a normal supported browser.
- Physical cameras/microphones, a full 250 MB upload, a ten-minute recording, every supported document format, and playback inside every third-party provider were not exhaustively tested.
- Instagram's iframe/consent behavior was checked using a test URL; the availability of real posts remains controlled by Instagram.
- The final backend changes were verified with actual-handler regressions and isolated browser storage, not deployed to production during this session.

## Production Test Data

- The temporary public text/featured test note was deleted.
- One explicitly private test note, `COPILOT-QA-20261029 media note`, remains with three tiny test uploads. Delete it after deploying the cleanup fix so its files are removed rather than orphaned by the currently deployed no-op deletion code.
- The two original private entries were not edited or deleted.

## Repeat Isolated Browser Checks

```bash
npm run build
node tests/support/browser-server.mjs
```

Open http://localhost:8891/journal. Disposable credentials: `browser-test` / `browser-test-only`. All fixture data disappears when the process restarts. This is a test-only server, not a production storage replacement.