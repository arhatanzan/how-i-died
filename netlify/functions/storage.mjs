/**
 * Storage Management API for Admin UI
 * Provides endpoints for viewing and managing storage
 * Note: File-based storage has been replaced with GitHub-backed storage
 */

import { getSession } from '../lib/auth.mjs';
import { fail, json } from '../lib/http.mjs';

async function handleStorageAdmin(req, context) {
  const session = getSession(req);
  
  // Check authentication
  if (!session) {
    return fail(401, 'Authentication required. Please log in.');
  }

  // Storage management is now handled through GitHub
  // This endpoint is kept for API compatibility but returns limited info
  if (req.method === 'GET') {
    return json({
      storage: {
        backend: 'github',
        location: 'data/journal/',
        message: 'All data is stored in GitHub repository',
      },
    });
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
