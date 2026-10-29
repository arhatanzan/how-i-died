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
  if (!client) return null;

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
    console.error('Failed to store attachment in GitHub:', error);
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
