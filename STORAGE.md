# Git-Backed Persistent File Storage

## Overview

Files (images, videos, audio) are now stored directly in the git repository in the `.store/` directory, not in ephemeral Netlify blobs. This ensures data persistence across:

- Netlify infrastructure changes
- Service provider migrations
- Application redeployments
- Developer environment changes

## Directory Structure

```
.store/
├── images/                    # Image uploads
│   ├── <uuid>                # Binary image file
│   ├── <uuid>.json           # Image metadata
│   └── ...
├── media/                      # Video, audio, and large files
│   ├── <upload-id>/
│   │   ├── part-0.bin        # Chunked file part
│   │   ├── part-1.bin
│   │   └── manifest.json     # Upload metadata
│   └── ...
└── index.jsonl               # File index (for future use)
```

## How It Works

### Image Upload
1. User uploads image via `/api/images` endpoint
2. Image is saved to `.store/images/<uuid>`
3. Metadata (content-type, size, hash) saved to `.store/images/<uuid>.json`
4. Changes automatically committed to git

### Video/Audio Upload
1. User uploads large file, which is chunked by client
2. Each chunk sent to `/api/media/<upload-id>/parts/<index>`
3. Chunks saved to `.store/media/<upload-id>/part-N.bin`
4. Manifest saved to `.store/media/<upload-id>/manifest.json`
5. Changes committed to git after each part and completion

### File Playback
1. Browser requests file from `/api/media/<upload-id>`
2. Server reconstructs file from parts using manifest
3. Correct `content-type` header sent based on manifest
4. Browser plays audio/video with proper codec support

## Storage Management

### File Sizes
- Images: Typically 50KB-5MB each
- Videos: Can be very large (100MB+)
- Audio: Typically 1-10MB each

### Git Storage Considerations
- Binary files handled via `.gitattributes`
- Git LFS could be used for very large files
- Regular cleanup recommended for old uploads

### Checking Storage Stats
```javascript
import { getStoreStats } from 'netlify/lib/git-storage.mjs';
const stats = await getStoreStats();
console.log(stats);
// {
//   storeDir: '/home/user/project/.store',
//   images: { count: 42, size: 12582912 },
//   media: { count: 5, size: 987654321 },
//   totalSize: 1000237233
// }
```

## Advantages Over Blobs

| Feature | Blobs | Git Storage |
|---------|-------|-------------|
| Persistence | Depends on Netlify | Permanent in git |
| Availability | Requires Netlify | Always in repo |
| Cost | Potentially billed | No extra cost |
| Portability | Service-locked | Portable anywhere |
| Backups | Relies on Netlify | Git history |
| Integrity | Not guaranteed | SHA-256 verified |

## Disadvantages & Mitigations

| Issue | Impact | Mitigation |
|-------|--------|-----------|
| Repo bloat | Large files | Use `.gitattributes`, consider Git LFS |
| Performance | Slow clones | Shallow clones, sparse checkout |
| Bandwidth | High on transfer | Deltas reduce impact, CDN caches |

## Git LFS Setup (Optional)

For very large files, set up Git LFS:

```bash
git lfs install
git lfs track "*.mp4" "*.webm" ".store/media/**/*.bin"
git add .gitattributes
git commit -m "Configure Git LFS for large files"
```

## Automatic Git Commits

Files are automatically committed with messages like:
- `store: add image <uuid>`
- `store: media-part upload-id/0`
- `store: media-manifest upload-id`
- `store: delete-image <uuid>`

This creates an audit trail of file operations.

## Deployment

- **Netlify:** `.store/` directory is included in deployment
- **Other platforms:** All files automatically included with git clone
- **Docker/Containers:** Files baked into image with git clone

## Troubleshooting

### Files not persisting after deployment
- Check that `.store/` is not in `.gitignore`
- Verify git commits are happening
- Check `.gitattributes` for correct binary config

### Audio/Video not playing
- Check manifest has correct `contentType`
- Verify all parts uploaded successfully
- Check browser console for CORS errors

### Slow deployments
- Use `git clone --depth 1` for shallow clones
- Consider Git LFS for files > 100MB each
- Implement cleanup script for old uploads

## Migration from Blobs

To migrate existing files from Netlify Blobs:

```javascript
// 1. Export blob data
const images = await readTable('images');

// 2. Convert to new format
for (const img of images) {
  const buffer = Buffer.from(img.data, 'base64');
  await gitImageStorage.save(img.key, buffer, {
    contentType: img.metadata.contentType
  });
}

// 3. Update database references
// ...

// 4. Commit changes
```

## Future Enhancements

- [ ] Automatic cleanup of old uploads
- [ ] Duplicate detection (SHA-256 based)
- [ ] Compression for smaller repo size
- [ ] CDN integration for faster delivery
- [ ] Admin UI for storage management
- [ ] Analytics on file usage
