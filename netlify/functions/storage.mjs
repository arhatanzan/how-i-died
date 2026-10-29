/**
 * Storage Management API for Admin UI
 * Provides endpoints for viewing and managing storage, LFS, and deduplication
 */

import { getSession } from '../lib/auth.mjs';
import { fail, isTrustedMutation, json, readJson } from '../lib/http.mjs';
import { getStoreStats } from '../lib/git-storage.mjs';
import {
  getLFSStatus,
  initializeLFS,
  trackPattern,
  getLFSStats,
  migrateLargeFilesToLFS,
  getLFSRecommendations,
} from '../lib/lfs-config.mjs';
import {
  findDuplicates,
  getDedupStats,
  scanStorageForDuplicates,
  generateDedupReport,
  getFilesByHash,
  consolidateDuplicates,
  registerFile,
  calculateFileHash,
} from '../lib/file-dedup.mjs';

async function handleStorageAdmin(req, context) {
  const session = getSession(req);
  
  // Check authentication
  if (!session) {
    return fail(401, 'Authentication required. Please log in.');
  }

  const action = context.params?.action;
  const subaction = context.params?.subaction;

  // GET endpoints - no mutation check needed
  if (req.method === 'GET') {
    try {
      // Storage statistics
      if (action === 'storage') {
        if (subaction === 'stats') {
          const stats = await getStoreStats();
          return json({ storage: stats });
        }
      }

      // Git LFS management
      if (action === 'lfs') {
        if (subaction === 'status') {
          const status = await getLFSStatus();
          return json({ lfs: status });
        }
        if (subaction === 'stats') {
          const stats = await getLFSStats();
          return json({ lfs: stats });
        }
        if (subaction === 'recommendations') {
          const recommendations = await getLFSRecommendations();
          return json({ lfs: recommendations });
        }
      }

      // File deduplication management
      if (action === 'dedup') {
        if (subaction === 'stats') {
          const stats = await getDedupStats();
          return json({ dedup: stats });
        }
        if (subaction === 'duplicates') {
          const duplicates = await findDuplicates();
          return json({ dedup: duplicates });
        }
        if (subaction === 'report') {
          const report = await generateDedupReport();
          return json({ dedup: report });
        }
      }

      // Combined dashboard view
      if (action === 'dashboard') {
        const [storage, lfs, dedup] = await Promise.all([
          getStoreStats(),
          getLFSStatus(),
          getDedupStats(),
        ]);

        return json({
          dashboard: {
            storage,
            lfs,
            dedup,
            lastUpdated: new Date().toISOString(),
          },
        });
      }

      return fail(404, 'Endpoint not found');
    } catch (error) {
      console.error('Storage admin GET error:', error);
      return fail(500, `Error: ${error.message}`);
    }
  }

  // Mutation requests must come from trusted source
  if (!isTrustedMutation(req)) {
    return fail(403, 'Forbidden');
  }

  // POST endpoints - mutations
  if (req.method === 'POST') {
    try {
      // Initialize Git LFS
      if (action === 'lfs' && subaction === 'init') {
        const result = await initializeLFS();
        return json({ lfs: result });
      }

      // Migrate large files to LFS
      if (action === 'lfs' && subaction === 'migrate') {
        const result = await migrateLargeFilesToLFS();
        return json({ lfs: result });
      }

      // Track a pattern with LFS
      if (action === 'lfs' && subaction === 'track') {
        const body = await readJson(req);
        const pattern = body.pattern;
        
        if (!pattern || typeof pattern !== 'string') {
          return fail(400, 'Pattern is required');
        }

        const result = await trackPattern(pattern);
        return json({ lfs: result });
      }

      // Scan storage for duplicates
      if (action === 'dedup' && subaction === 'scan') {
        const result = await scanStorageForDuplicates();
        return json({ dedup: result });
      }

      // Consolidate duplicates
      if (action === 'dedup' && subaction === 'consolidate') {
        const body = await readJson(req);
        const hash = body.hash;
        
        if (!hash || typeof hash !== 'string') {
          return fail(400, 'Hash is required');
        }

        const result = await consolidateDuplicates(hash);
        return json({ dedup: result });
      }

      // Register a file for deduplication tracking
      if (action === 'dedup' && subaction === 'register') {
        const body = await readJson(req);
        const filePath = body.filePath;
        
        if (!filePath || typeof filePath !== 'string') {
          return fail(400, 'File path is required');
        }

        const result = await registerFile(filePath, body.metadata);
        return json({ dedup: result });
      }

      return fail(404, 'Endpoint not found');
    } catch (error) {
      console.error('Storage admin POST error:', error);
      return fail(500, `Error: ${error.message}`);
    }
  }

  // DELETE endpoints
  if (req.method === 'DELETE') {
    try {
      // Future: implement file deletion endpoints here
      return fail(405, 'Method not allowed');
    } catch (error) {
      console.error('Storage admin DELETE error:', error);
      return fail(500, `Error: ${error.message}`);
    }
  }

  return fail(405, 'Method not allowed');
}

export default async (req, context) => {
  try {
    return await handleStorageAdmin(req, context);
  } catch (error) {
    console.error('Storage admin error:', error);
    return fail(500, `Error: ${error.message}`);
  }
};

export const config = {
  path: [
    '/api/storage/:action',
    '/api/storage/:action/:subaction',
  ]
};
