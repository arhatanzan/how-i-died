# Storage Management Features

This document describes the three major storage management features added to the How I Died application:

## 1. Git LFS (Large File Storage)

Git LFS is configured for automatically tracking files larger than 100MB, preventing repository bloat from large media files.

### Features

- **Automatic LFS Tracking**: Files over 100MB are tracked with Git LFS
- **Bandwidth Optimization**: Only metadata pointers are stored in git, actual files stored on LFS servers
- **Pattern-Based Tracking**: Configurable file patterns (`.mp4`, `.webm`, `.bin`, etc.)
- **Storage Statistics**: Monitor files eligible for LFS migration
- **Migration Support**: Tools to migrate existing large files to LFS

### Configuration

Git LFS patterns are defined in `.gitattributes`:

```
.store/media/**/*.mp4 filter=lfs diff=lfs merge=lfs -text
.store/media/**/*.webm filter=lfs diff=lfs merge=lfs -text
.store/media/**/*.bin filter=lfs diff=lfs merge=lfs -text
```

Configuration is stored in `.lfs-config.json`:

```json
{
  "initialized": true,
  "threshold": 104857600,
  "patterns": [
    ".store/media/**/*.mp4",
    ".store/media/**/*.webm",
    ".store/media/**/*.bin"
  ]
}
```

### API Endpoints

#### Get LFS Status
```
GET /api/storage/lfs/status
```

Returns current LFS configuration and tracking status.

#### Initialize LFS
```
POST /api/storage/lfs/init
```

Installs and configures Git LFS for the repository.

#### Get LFS Statistics
```
GET /api/storage/lfs/stats
```

Returns analysis of large files and LFS candidates.

#### Migrate Files to LFS
```
POST /api/storage/lfs/migrate
```

Queues large files for LFS migration.

#### Track Pattern
```
POST /api/storage/lfs/track
```

Add a new file pattern to LFS tracking.

#### Get Recommendations
```
GET /api/storage/lfs/recommendations
```

Returns actionable recommendations for LFS usage.

### Usage Example

```javascript
// Check LFS status
const statusResponse = await fetch('/api/storage/lfs/status');
const { lfs } = await statusResponse.json();

if (!lfs.installed) {
  // Initialize LFS
  const initResponse = await fetch('/api/storage/lfs/init', { method: 'POST' });
  const result = await initResponse.json();
  console.log('LFS initialized:', result);
}

// Migrate large files
const migrateResponse = await fetch('/api/storage/lfs/migrate', { method: 'POST' });
const migrationResult = await migrateResponse.json();
console.log(`${migrationResult.lfs.migratedCount} files queued for migration`);
```

---

## 2. File Deduplication via SHA-256

The deduplication system identifies identical files and provides tools to consolidate them, saving storage space.

### Features

- **SHA-256 Hash-Based Detection**: Files with identical content have the same hash
- **Automatic Registration**: Files are registered with their hash when uploaded
- **Duplicate Detection**: Identifies multiple copies of the same content
- **Consolidation Support**: Create hard links or content-addressable storage
- **Detailed Reporting**: Potential savings and impact analysis

### Data Structure

The deduplication system maintains two JSON files:

**`.store/dedup/index.json`** - Hash index:
```json
{
  "abc123def456...": {
    "hash": "abc123def456...",
    "size": 5242880,
    "firstSeen": "2024-01-15T10:30:00Z",
    "count": 3,
    "contentAddressPath": ".store/dedup/content/ab/abc123def456..."
  }
}
```

**`.store/dedup/refs.json`** - File references:
```json
{
  "hashes": {
    "abc123def456...": [
      {
        "path": ".store/media/upload-id/part-0.bin",
        "name": "part-0.bin",
        "type": "media",
        "registeredAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### API Endpoints

#### Get Deduplication Statistics
```
GET /api/storage/dedup/stats
```

Returns overview of deduplication status:
- Unique hashes
- Total files
- Deduplication ratio
- Potential storage savings

#### Find Duplicates
```
GET /api/storage/dedup/duplicates
```

Returns list of duplicate groups with potential savings for each.

#### Scan Storage
```
POST /api/storage/dedup/scan
```

Scans all files in storage and registers them in the deduplication system.

#### Generate Report
```
GET /api/storage/dedup/report
```

Generates comprehensive deduplication report with recommendations.

#### Consolidate Duplicates
```
POST /api/storage/dedup/consolidate
```

Creates hard links for duplicate files (Unix-like systems).

**Request body:**
```json
{
  "hash": "abc123def456..."
}
```

#### Register File
```
POST /api/storage/dedup/register
```

Manually register a file for deduplication tracking.

**Request body:**
```json
{
  "filePath": "/path/to/file",
  "metadata": {
    "type": "media",
    "uploadId": "upload-id"
  }
}
```

### Usage Example

```javascript
// Scan for duplicates
const scanResponse = await fetch('/api/storage/dedup/scan', { method: 'POST' });
const scanResult = await scanResponse.json();
console.log(`Scanned ${scanResult.dedup.scanned} files`);

// Get statistics
const statsResponse = await fetch('/api/storage/dedup/stats');
const { dedup } = await statsResponse.json();

console.log(`Dedup Ratio: ${dedup.dedupRatio}`);
console.log(`Potential Savings: ${dedup.potentialSavings} bytes`);

// Find duplicates
const dupResponse = await fetch('/api/storage/dedup/duplicates');
const duplicates = await dupResponse.json();

// Consolidate the largest duplicate group
const largest = duplicates.dedup.duplicates[0];
const consolidateResponse = await fetch('/api/storage/dedup/consolidate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hash: largest.hash })
});
const consolidateResult = await consolidateResponse.json();
console.log(`Consolidated ${consolidateResult.dedup.linkedFiles.length} files`);
```

---

## 3. Admin UI for Storage Management

A comprehensive React-based admin interface for viewing and managing all storage operations.

### Features

- **Dashboard Overview**: Summary of storage, LFS, and deduplication status
- **Git LFS Management**: Initialize, track patterns, migrate files
- **Deduplication Tools**: Scan, analyze, and consolidate duplicates
- **Real-Time Statistics**: Storage usage, file counts, potential savings
- **Actionable Recommendations**: Suggestions based on current state
- **Responsive Design**: Works on desktop and mobile

### Components

#### Dashboard Tab

Shows high-level overview:
- Total storage size
- Image and media file counts
- Git LFS installation status
- Deduplication ratio
- Potential storage savings

#### Git LFS Tab

Provides LFS configuration and management:
- Installation status
- Configured patterns
- Large files analysis
- Migration tools
- Recommendations

#### Deduplication Tab

Displays deduplication analysis:
- Unique files and total files
- Deduplication ratio
- Potential savings
- List of duplicate groups
- Consolidation tools

### Usage

The StorageAdminUI component should be integrated into your admin panel:

```jsx
import StorageAdminUI from './components/StorageAdminUI';

export default function AdminPanel() {
  return (
    <div>
      <StorageAdminUI />
    </div>
  );
}
```

### Authentication

The storage management API requires authentication. All requests must include valid session credentials:

```javascript
// API calls automatically include credentials
const response = await fetch('/api/storage/dashboard', {
  credentials: 'include'
});
```

### Security Considerations

- **Authentication Required**: All endpoints require logged-in user session
- **Trusted Mutations**: POST/PATCH/DELETE requests validated via `isTrustedMutation`
- **Authorization**: Currently requires admin/authenticated access
- **Input Validation**: File paths and patterns validated to prevent traversal attacks

---

## Integration Guide

### 1. Backend Setup

All backend modules are already in place:

- `netlify/lib/lfs-config.mjs` - Git LFS configuration and management
- `netlify/lib/file-dedup.mjs` - Deduplication system
- `netlify/functions/storage.mjs` - Storage management API

### 2. Frontend Integration

Add the admin UI to your admin panel:

```jsx
// In your admin page/component
import StorageAdminUI from '../components/StorageAdminUI';

function AdminPage() {
  return (
    <div>
      <StorageAdminUI />
    </div>
  );
}
```

### 3. Routes Configuration

The storage API uses these routes:

```
GET  /api/storage/dashboard               - Full dashboard data
GET  /api/storage/storage/stats           - Storage statistics
GET  /api/storage/lfs/status              - LFS configuration
GET  /api/storage/lfs/stats               - LFS file analysis
GET  /api/storage/lfs/recommendations     - LFS recommendations
POST /api/storage/lfs/init                - Initialize LFS
POST /api/storage/lfs/migrate             - Migrate files
POST /api/storage/lfs/track               - Track pattern
GET  /api/storage/dedup/stats             - Dedup statistics
GET  /api/storage/dedup/duplicates        - Duplicate list
GET  /api/storage/dedup/report            - Full report
POST /api/storage/dedup/scan              - Scan for duplicates
POST /api/storage/dedup/consolidate       - Consolidate duplicates
POST /api/storage/dedup/register          - Register file
```

### 4. Initial Setup

When first deploying:

1. Initialize Git LFS (if system is available):
   ```bash
   git lfs install
   git add .gitattributes
   git commit -m "Configure Git LFS"
   ```

2. Scan storage for deduplication:
   ```bash
   curl -X POST http://localhost/api/storage/dedup/scan
   ```

3. Check recommendations:
   ```bash
   curl http://localhost/api/storage/lfs/recommendations
   curl http://localhost/api/storage/dedup/report
   ```

---

## Performance Considerations

### Git LFS

- **Bandwidth**: LFS reduces bandwidth for very large files (100MB+)
- **Clone Speed**: Initial clones are faster without LFS object content
- **Bandwidth Limit**: Verify LFS quota with your hosting provider
- **Storage Cost**: May have per-GB costs depending on provider

### Deduplication

- **Scan Time**: Initial scan of all files may take time for large storage
- **Index Size**: Deduplication index grows with file count (relatively small)
- **Consolidation**: Hard linking works on Unix-like systems only
- **Periodicity**: Schedule scans during off-peak hours

### Admin UI

- **API Calls**: Batches related requests to reduce network overhead
- **Caching**: Dashboard data refreshed manually or on tab change
- **Responsive**: Lazy-loads data for each tab section

---

## Troubleshooting

### Git LFS Not Installed

**Problem**: `git lfs: not a git command`

**Solution**: Install Git LFS on the system:
```bash
# Ubuntu/Debian
apt-get install git-lfs

# macOS
brew install git-lfs

# Then initialize in repo
git lfs install
```

### Files Not Being Tracked by LFS

**Problem**: Large files still stored in git history

**Solution**: 
1. Check `.gitattributes` has correct patterns
2. Run: `git lfs migrate import --include="*.mp4,*.webm"`
3. Push changes: `git lfs push origin --all`

### Deduplication Index Issues

**Problem**: Stale or incorrect deduplication data

**Solution**: Rescan storage:
```bash
curl -X POST /api/storage/dedup/scan
```

### Admin UI Not Showing Data

**Problem**: Charts/stats not loading

**Solution**:
1. Check browser console for errors
2. Verify authentication (ensure session cookie present)
3. Check network tab for failed API requests
4. Verify user has admin access

---

## Future Enhancements

Potential improvements for future versions:

- **Compression**: GZIP/BROTLI compression for text files
- **Archival**: Automatic cleanup of old uploads after retention period
- **Tiered Storage**: Move old files to cheaper storage tiers
- **Bandwidth Monitoring**: Track download usage and costs
- **Notifications**: Alert on storage threshold or unusual patterns
- **Backup Integration**: Automated backup to S3/GCS/Azure Blob
- **File Versioning**: Keep multiple versions with delta compression
- **Access Analytics**: Track which files are downloaded most frequently
