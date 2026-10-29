import { Octokit } from '@octokit/rest';

/**
 * GitHub-based permanent storage for journal data
 * Stores all note metadata and attachments as files in the repository
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'arhatanzan';
// Repository name from environment - must be set on Netlify
const GITHUB_REPO = process.env.GITHUB_REPO;
const DATA_FOLDER = 'data/journal';

let octokit = null;

function getOctokit() {
  if (!octokit) {
    if (!GITHUB_TOKEN) {
      console.warn('GITHUB_TOKEN not set. GitHub storage will be unavailable.');
      return null;
    }
    octokit = new Octokit({ auth: GITHUB_TOKEN });
  }
  return octokit;
}

/**
 * Store a note's metadata in GitHub
 * Path: data/journal/{year}/{month}/{date}/{noteId}.json
 */
export async function storeNoteMetadata(note) {
  const client = getOctokit();
  if (!client) return null;

  try {
    const date = new Date(note.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const path = `${DATA_FOLDER}/${year}/${month}/${day}/${note.id}.json`;
    
    // Remove binary data for storage
    const storageNote = {
      ...note,
      attachments: note.attachments?.map(att => ({
        type: att.type,
        url: att.url,
        title: att.title,
        alt: att.alt,
      })) || [],
      _storedAt: new Date().toISOString(),
      _githubPath: path,
    };

    const content = JSON.stringify(storageNote, null, 2);
    const contentBase64 = Buffer.from(content).toString('base64');

    // Try to get existing file to get its SHA
    let sha;
    try {
      const existing = await client.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path,
      });
      sha = existing.data.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const result = await client.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `Store note: ${note.id}`,
      content: contentBase64,
      sha,
    });

    return {
      url: result.data.html_url,
      path,
      githubCommitUrl: result.data.commit.html_url,
    };
  } catch (error) {
    console.error('Failed to store note metadata in GitHub:', error);
    return null;
  }
}

/**
 * Store an attachment (image/media) in GitHub
 * Path: data/journal/attachments/{type}/{id}
 */
export async function storeAttachment(attachmentId, type, data, metadata = {}) {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return null;
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return null;
  }

  try {
    const path = `${DATA_FOLDER}/attachments/${type}/${attachmentId}`;
    
    // For binary data, store as base64
    let contentBase64;
    if (data instanceof Uint8Array || data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
      contentBase64 = Buffer.from(data).toString('base64');
    } else {
      contentBase64 = Buffer.from(JSON.stringify(data)).toString('base64');
    }

    // Try to get existing file
    let sha;
    try {
      const existing = await client.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path,
      });
      sha = existing.data.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const result = await client.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `Store ${type} attachment: ${attachmentId}`,
      content: contentBase64,
      sha,
    });

    return {
      url: result.data.html_url,
      path,
      githubCommitUrl: result.data.commit.html_url,
    };
  } catch (error) {
    console.error('Failed to store attachment in GitHub:', { 
      attachmentId, 
      type, 
      error: error.message,
      status: error.status,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO
    });
    return null;
  }
}

/**
 * Create a manifest file linking all notes and their GitHub URLs
 */
export async function updateManifest(notes) {
  const client = getOctokit();
  if (!client) return null;

  try {
    const manifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      totalNotes: notes.length,
      notes: notes.map(note => ({
        id: note.id,
        title: note.text?.substring(0, 100) || 'Untitled',
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        mood: note.mood,
        isPublic: note.isPublic,
        featured: note.featured,
        githubPath: `${DATA_FOLDER}/${new Date(note.createdAt).getFullYear()}/${String(new Date(note.createdAt).getMonth() + 1).padStart(2, '0')}/${String(new Date(note.createdAt).getDate()).padStart(2, '0')}/${note.id}.json`,
      })),
    };

    const path = `${DATA_FOLDER}/MANIFEST.json`;
    const content = JSON.stringify(manifest, null, 2);
    const contentBase64 = Buffer.from(content).toString('base64');

    // Get existing file SHA
    let sha;
    try {
      const existing = await client.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path,
      });
      sha = existing.data.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const result = await client.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `Update journal manifest: ${notes.length} notes`,
      content: contentBase64,
      sha,
    });

    return {
      url: result.data.html_url,
      path,
    };
  } catch (error) {
    console.error('Failed to update manifest in GitHub:', error);
    return null;
  }
}

/**
 * Load an attachment's metadata from GitHub
 * For binary files, loads the associated .meta.json file
 */
export async function loadAttachmentMetadata(attachmentId, type) {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return null;
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return null;
  }

  try {
    // Try to load metadata file
    const metaPath = `${DATA_FOLDER}/attachments/${type}/${attachmentId}.meta.json`;
    
    const response = await client.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: metaPath,
    });

    if (!response.data.content) {
      return null;
    }

    // GitHub returns base64-encoded content
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      // Metadata file not found is not an error
      return null;
    }
    console.error('Failed to load attachment metadata from GitHub:', { 
      attachmentId, 
      type, 
      error: error.message,
      status: error.status
    });
    return null;
  }
}

/**
 * Store an attachment's metadata in GitHub
 */
export async function storeAttachmentMetadata(attachmentId, type, metadata) {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return null;
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return null;
  }

  try {
    const metaPath = `${DATA_FOLDER}/attachments/${type}/${attachmentId}.meta.json`;
    
    const content = JSON.stringify(metadata, null, 2);
    const contentBase64 = Buffer.from(content).toString('base64');

    // Try to get existing file
    let sha;
    try {
      const existing = await client.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: metaPath,
      });
      sha = existing.data.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const result = await client.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: metaPath,
      message: `Store ${type} metadata: ${attachmentId}`,
      content: contentBase64,
      sha,
    });

    return {
      url: result.data.html_url,
      path: metaPath,
    };
  } catch (error) {
    console.error('Failed to store attachment metadata in GitHub:', { 
      attachmentId, 
      type, 
      error: error.message,
      status: error.status
    });
    return null;
  }
}

/**
 * Load an attachment from GitHub
 * Retrieves base64-encoded binary data
 */
export async function loadAttachment(attachmentId, type) {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return null;
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return null;
  }

  try {
    const path = `${DATA_FOLDER}/attachments/${type}/${attachmentId}`;
    
    const response = await client.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
    });

    if (!response.data.content) {
      console.warn('Attachment found but has no content:', { path });
      return null;
    }

    // GitHub returns base64-encoded content
    const content = Buffer.from(response.data.content, 'base64');
    
    // Try to parse as JSON first (for manifests)
    try {
      return JSON.parse(content.toString('utf-8'));
    } catch {
      // If not JSON, return as buffer
      return content;
    }
  } catch (error) {
    if (error.status === 404) {
      // File not found is not an error
      return null;
    }
    console.error('Failed to load attachment from GitHub:', { 
      attachmentId, 
      type, 
      error: error.message,
      status: error.status
    });
    return null;
  }
}

/**
 * Get a note's GitHub URL
 */
export function getNoteGitHubPath(noteId, createdAt) {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const path = `${DATA_FOLDER}/${year}/${month}/${day}/${noteId}.json`;
  return {
    path,
    url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/${path}`,
  };
}

/**
 * Load a note's metadata from GitHub by ID
 * Searches across all date folders
 */
export async function loadNoteMetadata(noteId) {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return null;
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return null;
  }

  try {
    // Try to search for the note file
    const results = await client.search.code({
      q: `repo:${GITHUB_OWNER}/${GITHUB_REPO} filename:${noteId}.json path:data/journal`,
    });

    if (!results.data.items || results.data.items.length === 0) {
      return null;
    }

    // Get the first matching file
    const item = results.data.items[0];
    const response = await client.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: item.path,
    });

    if (!response.data.content) {
      return null;
    }

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    console.error('Failed to load note metadata from GitHub:', { 
      noteId, 
      error: error.message,
      status: error.status
    });
    return null;
  }
}

/**
 * List all notes from GitHub
 */
export async function listNotes() {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return [];
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return [];
  }

  try {
    // Search for all .json files in data/journal
    const results = await client.search.code({
      q: `repo:${GITHUB_OWNER}/${GITHUB_REPO} path:data/journal filename:.json extension:json`,
    });

    if (!results.data.items || results.data.items.length === 0) {
      return [];
    }

    const notes = [];
    for (const item of results.data.items) {
      try {
        // Skip metadata and attachment files
        if (item.path.includes('attachments') || item.path.includes('.meta.json')) {
          continue;
        }
        
        const response = await client.repos.getContent({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: item.path,
        });

        if (!response.data.content) continue;

        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        const note = JSON.parse(content);
        // Add _id for consistency with file-based storage
        note._id = note.id;
        notes.push(note);
      } catch (error) {
        console.error('Failed to load note:', item.path, error.message);
        continue;
      }
    }

    return notes;
  } catch (error) {
    console.error('Failed to list notes from GitHub:', error.message);
    return [];
  }
}

/**
 * Delete a note from GitHub
 */
export async function deleteNoteData(noteId) {
  const client = getOctokit();
  if (!client) {
    console.error('GitHub client not initialized: GITHUB_TOKEN missing');
    return null;
  }

  if (!GITHUB_REPO) {
    console.error('GitHub storage not available: GITHUB_REPO environment variable not set');
    return null;
  }

  try {
    // First find the note
    const note = await loadNoteMetadata(noteId);
    if (!note) return null;

    const date = new Date(note.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const path = `${DATA_FOLDER}/${year}/${month}/${day}/${noteId}.json`;

    // Get the current file to get its SHA
    const existing = await client.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
    });

    // Delete the file
    const result = await client.repos.deleteFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
      message: `Delete note: ${noteId}`,
      sha: existing.data.sha,
    });

    return result;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    console.error('Failed to delete note from GitHub:', { 
      noteId, 
      error: error.message,
      status: error.status
    });
    return null;
  }
}

/**
 * Update the notes index (stub - not needed with GitHub search)
 */
export async function updateNoteIndex(notes) {
  // Index is maintained automatically by GitHub search
  return true;
}
