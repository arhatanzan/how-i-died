# Storage Management Admin UI

## Overview

The Storage Management Admin UI provides a unified interface for managing:
- **Git LFS** - Large file handling for files over 100MB
- **Deduplication** - SHA-256 based duplicate detection and consolidation
- **Storage Statistics** - Real-time monitoring of storage usage

## Features

### Dashboard
- Real-time storage statistics (total size, file counts)
- Git LFS installation and configuration status
- Deduplication ratio and potential savings
- Quick access to all storage management functions

### Git LFS Management
- Check LFS installation and status
- View files eligible for LFS migration (>100MB)
- Initialize Git LFS for the repository
- Migrate large files to LFS storage
- Track custom file patterns with LFS
- View actionable recommendations

### Deduplication Analysis
- Identify duplicate files via SHA-256 hashing
- View deduplication statistics and ratios
- List all duplicate groups with potential savings
- Consolidate duplicate files (create hard links)
- Scan storage for new duplicates
- Generate detailed deduplication reports

## API Reference

### Storage Endpoints

All endpoints require authentication (session cookie).

#### Dashboard Data
```
GET /api/storage/dashboard
```

Returns combined data for all three storage management areas.

**Response:**
```json
{
  "dashboard": {
    "storage": { ... },
    "lfs": { ... },
    "dedup": { ... },
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

---

### Git LFS Endpoints

#### Get LFS Status
```
GET /api/storage/lfs/status
```

**Response:**
```json
{
  "lfs": {
    "installed": true,
    "tracking": [".store/media/**/*.mp4", ...],
    "threshold": 104857600,
    "config": { ... },
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

#### Get LFS Statistics
```
GET /api/storage/lfs/stats
```

**Response:**
```json
{
  "lfs": {
    "lfsThreshold": 104857600,
    "candidateFiles": [
      {
        "id": "upload-id",
        "file": "part-0.bin",
        "size": 157286400,
        "lfsCandidate": true,
        "path": ".store/media/upload-id/part-0.bin"
      }
    ],
    "candidateCount": 2,
    "totalLFSSize": 314572800,
    "estimatedBandwidthSaved": "300.00 MB"
  }
}
```

#### Get LFS Recommendations
```
GET /api/storage/lfs/recommendations
```

**Response:**
```json
{
  "lfs": {
    "hasRecommendations": true,
    "recommendations": [
      {
        "severity": "high",
        "title": "Git LFS Not Installed",
        "message": "Install Git LFS to efficiently handle large files",
        "action": "apt-get install git-lfs && git lfs install"
      }
    ]
  }
}
```

#### Initialize Git LFS
```
POST /api/storage/lfs/init
```

Installs and configures Git LFS in the repository.

**Response:**
```json
{
  "lfs": {
    "success": true,
    "message": "Git LFS initialized successfully",
    "tracking": [".store/media/**/*.mp4", ...]
  }
}
```

#### Migrate Large Files
```
POST /api/storage/lfs/migrate
```

Queues all files over 100MB for LFS migration.

**Response:**
```json
{
  "lfs": {
    "success": true,
    "migratedCount": 5,
    "files": [
      {
        "id": "upload-id",
        "file": "part-0.bin",
        "size": 157286400,
        "status": "queued-for-lfs"
      }
    ],
    "nextSteps": [
      "Run: git lfs migrate import --include='*.mp4,*.webm,*.bin'",
      "Then: git lfs push origin --all"
    ]
  }
}
```

#### Track Pattern
```
POST /api/storage/lfs/track
Content-Type: application/json

{
  "pattern": ".store/media/**/*.mkv"
}
```

**Response:**
```json
{
  "lfs": {
    "success": true,
    "pattern": ".store/media/**/*.mkv"
  }
}
```

---

### Deduplication Endpoints

#### Get Deduplication Statistics
```
GET /api/storage/dedup/stats
```

**Response:**
```json
{
  "dedup": {
    "uniqueHashes": 127,
    "totalFiles": 156,
    "totalSize": 524288000,
    "duplicateFiles": 29,
    "dedupRatio": "81.41%",
    "potentialSavings": 62914560,
    "estimatedSavingsPercent": "12.00"
  }
}
```

#### Find Duplicates
```
GET /api/storage/dedup/duplicates
```

**Response:**
```json
{
  "dedup": {
    "duplicateGroups": 8,
    "duplicateCount": 29,
    "totalPotentialSavings": 62914560,
    "duplicates": [
      {
        "hash": "abc123def456...",
        "size": 5242880,
        "count": 5,
        "potentialSavings": 20971520,
        "firstSeen": "2024-01-10T08:00:00Z"
      }
    ]
  }
}
```

#### Scan for Duplicates
```
POST /api/storage/dedup/scan
```

Scans all files in storage and registers them in the deduplication index.

**Response:**
```json
{
  "dedup": {
    "scanned": 156,
    "errors": [],
    "duplicates": { ... },
    "scanTime": "2024-01-15T10:30:00Z"
  }
}
```

#### Generate Deduplication Report
```
GET /api/storage/dedup/report
```

**Response:**
```json
{
  "dedup": {
    "summary": { ... },
    "duplicates": [...],
    "recommendations": [
      {
        "priority": "high",
        "title": "Duplicate Files Detected",
        "message": "29 duplicate file(s) found",
        "action": "Review and consolidate duplicates",
        "potentialBenefit": 62914560
      }
    ],
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Consolidate Duplicates
```
POST /api/storage/dedup/consolidate
Content-Type: application/json

{
  "hash": "abc123def456..."
}
```

Creates hard links for duplicate files (Unix-like systems only).

**Response:**
```json
{
  "dedup": {
    "primaryFile": ".store/media/upload-1/part-0.bin",
    "linkedFiles": [
      {
        "path": ".store/media/upload-2/part-0.bin",
        "status": "linked"
      }
    ],
    "failedLinks": [],
    "potentialSavings": 20971520
  }
}
```

#### Register File
```
POST /api/storage/dedup/register
Content-Type: application/json

{
  "filePath": "/path/to/file",
  "metadata": {
    "type": "media",
    "uploadId": "upload-id"
  }
}
```

**Response:**
```json
{
  "dedup": {
    "hash": "abc123def456...",
    "size": 5242880,
    "isDuplicate": false,
    "referenceCount": 1,
    "potentialSavings": 0
  }
}
```

---

### Storage Endpoints

#### Get Storage Statistics
```
GET /api/storage/storage/stats
```

**Response:**
```json
{
  "storage": {
    "storeDir": "/path/to/.store",
    "images": {
      "count": 42,
      "size": 12582912
    },
    "media": {
      "count": 8,
      "size": 987654321
    },
    "totalSize": 1000237233
  }
}
```

---

## Integration Examples

### React Component Usage

```jsx
import StorageAdminUI from './components/StorageAdminUI';

function AdminPage() {
  return (
    <div className="admin-container">
      <StorageAdminUI />
    </div>
  );
}

export default AdminPage;
```

### Direct API Usage

```javascript
// Check storage status
async function checkStorageStatus() {
  const response = await fetch('/api/storage/dashboard', {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to load dashboard');
  }
  
  const { dashboard } = await response.json();
  console.log('Storage Status:', dashboard);
  
  // Check if LFS needs initialization
  if (!dashboard.lfs.installed) {
    console.log('LFS is not installed. Recommend installation.');
  }
  
  // Check deduplication status
  const dedupPercent = parseFloat(dashboard.dedup.estimatedSavingsPercent);
  if (dedupPercent > 5) {
    console.log(`Potential savings: ${dedupPercent}% of storage`);
  }
}

// Initialize LFS
async function setupLFS() {
  const response = await fetch('/api/storage/lfs/init', {
    method: 'POST',
    credentials: 'include'
  });
  
  const result = await response.json();
  console.log('LFS Initialized:', result.lfs.message);
}

// Scan for duplicates
async function findAndConsolidateDuplicates() {
  // Scan
  const scanResponse = await fetch('/api/storage/dedup/scan', {
    method: 'POST',
    credentials: 'include'
  });
  
  const scanResult = await scanResponse.json();
  console.log(`Scanned ${scanResult.dedup.scanned} files`);
  
  // Get duplicates
  const dupResponse = await fetch('/api/storage/dedup/duplicates', {
    credentials: 'include'
  });
  
  const { dedup } = await dupResponse.json();
  
  // Consolidate largest duplicates
  for (const dup of dedup.duplicates.slice(0, 5)) {
    const consolidateResponse = await fetch('/api/storage/dedup/consolidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ hash: dup.hash })
    });
    
    const consolidateResult = await consolidateResponse.json();
    console.log(`Consolidated ${consolidateResult.dedup.linkedFiles.length} files`);
  }
}
```

---

## Authentication

All endpoints require authentication. Ensure:

1. User is logged in (valid session)
2. Cookie with session token is sent with requests
3. User has appropriate permissions (admin access recommended)

```javascript
// Requests automatically include credentials
const response = await fetch('/api/storage/dashboard', {
  credentials: 'include'  // Important: include cookies
});
```

---

## Performance Tips

### For Dashboard
- Dashboard loads all data at once on component mount
- Individual tabs load their data when clicked (lazy loading)
- Consider disabling auto-refresh for large installations

### For Scans
- Deduplication scan can take time for large storage
- Schedule scans during off-peak hours
- Consider implementing background job queuing

### For LFS
- Initial LFS setup requires network access
- Migration can be bandwidth-intensive
- Consider staging migrations over time

---

## Troubleshooting

### Admin UI Not Loading
- Check browser console for errors
- Verify API endpoints are accessible
- Ensure you're authenticated (check session cookie)

### LFS Not Initializing
- Verify Git LFS is installed on system: `git lfs version`
- Check filesystem write permissions on repository
- Verify git configuration is correct: `git config --list`

### Deduplication Not Finding Files
- Ensure storage directories exist and are readable
- Try running scan endpoint manually
- Check file permissions in .store directory

### Consolidation Failing
- Some filesystems don't support hard links (Windows, network drives)
- Verify sufficient disk space available
- Check file permissions

---

## Support

For issues or questions:
1. Check API responses for error messages
2. Review browser console logs
3. Verify authentication and permissions
4. Check file system permissions
5. Consult STORAGE-MANAGEMENT.md for detailed documentation
