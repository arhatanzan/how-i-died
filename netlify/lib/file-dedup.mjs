/**
 * File Deduplication via SHA-256
 * Detects and manages duplicate files across the storage system
 * Saves bandwidth and storage by identifying identical content
 * 
 * Features:
 * - SHA-256 hash-based deduplication
 * - Content-addressable storage
 * - Automatic duplicate detection
 * - Unified file references
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const STORE_DIR = path.join(process.cwd(), '.store');
const DEDUP_DIR = path.join(STORE_DIR, 'dedup');
const DEDUP_INDEX = path.join(DEDUP_DIR, 'index.json');
const DEDUP_REFS = path.join(DEDUP_DIR, 'refs.json');

/**
 * Ensure deduplication directories exist
 */
async function ensureDedupDir() {
  try {
    await fs.access(DEDUP_DIR);
  } catch {
    await fs.mkdir(DEDUP_DIR, { recursive: true });
  }
}

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    throw new Error(`Failed to calculate hash for ${filePath}: ${error.message}`);
  }
}

/**
 * Calculate SHA-256 hash of a buffer
 */
export function calculateBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Load or initialize the deduplication index
 */
async function loadDedupIndex() {
  await ensureDedupDir();
  try {
    const data = await fs.readFile(DEDUP_INDEX, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {}; // Empty index
  }
}

/**
 * Save the deduplication index
 */
async function saveDedupIndex(index) {
  await ensureDedupDir();
  await fs.writeFile(DEDUP_INDEX, JSON.stringify(index, null, 2));
}

/**
 * Load or initialize the deduplication references
 */
async function loadDedupRefs() {
  await ensureDedupDir();
  try {
    const data = await fs.readFile(DEDUP_REFS, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { hashes: {} }; // Empty refs
  }
}

/**
 * Save the deduplication references
 */
async function saveDedupRefs(refs) {
  await ensureDedupDir();
  await fs.writeFile(DEDUP_REFS, JSON.stringify(refs, null, 2));
}

/**
 * Register a file in the deduplication system
 */
export async function registerFile(filePath, fileInfo = {}) {
  try {
    const hash = await calculateFileHash(filePath);
    const fileName = path.basename(filePath);
    const fileSize = (await fs.stat(filePath)).size;

    const index = await loadDedupIndex();
    const refs = await loadDedupRefs();

    // Initialize hash entry if new
    if (!index[hash]) {
      index[hash] = {
        hash: hash,
        size: fileSize,
        firstSeen: new Date().toISOString(),
        contentAddressPath: path.join(DEDUP_DIR, 'content', hash.substring(0, 2), hash),
        count: 0,
      };
      refs.hashes[hash] = [];
    }

    // Add file reference
    const fileRef = {
      path: filePath,
      name: fileName,
      ...fileInfo,
      registeredAt: new Date().toISOString(),
    };

    refs.hashes[hash].push(fileRef);
    index[hash].count = refs.hashes[hash].length;

    await saveDedupIndex(index);
    await saveDedupRefs(refs);

    return {
      hash: hash,
      size: fileSize,
      isDuplicate: refs.hashes[hash].length > 1,
      referenceCount: refs.hashes[hash].length,
      potentialSavings: fileSize * (refs.hashes[hash].length - 1),
    };
  } catch (error) {
    console.error('Failed to register file:', error);
    return { error: error.message };
  }
}

/**
 * Find duplicate files in the store
 */
export async function findDuplicates() {
  try {
    const index = await loadDedupIndex();
    const duplicates = [];
    let totalPotentialSavings = 0;

    for (const [hash, info] of Object.entries(index)) {
      if (info.count > 1) {
        const savings = info.size * (info.count - 1);
        totalPotentialSavings += savings;

        duplicates.push({
          hash: hash,
          size: info.size,
          count: info.count,
          potentialSavings: savings,
          firstSeen: info.firstSeen,
        });
      }
    }

    // Sort by potential savings descending
    duplicates.sort((a, b) => b.potentialSavings - a.potentialSavings);

    return {
      duplicateGroups: duplicates.length,
      duplicateCount: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
      totalPotentialSavings: totalPotentialSavings,
      duplicates: duplicates,
    };
  } catch (error) {
    console.error('Failed to find duplicates:', error);
    return { error: error.message };
  }
}

/**
 * Get deduplication statistics
 */
export async function getDedupStats() {
  try {
    const index = await loadDedupIndex();
    const refs = await loadDedupRefs();

    let totalFiles = 0;
    let totalSize = 0;
    let duplicateFiles = 0;
    let uniqueHashes = 0;

    for (const [hash, info] of Object.entries(index)) {
      uniqueHashes++;
      totalFiles += info.count;
      totalSize += info.size * info.count;
      if (info.count > 1) {
        duplicateFiles += info.count - 1;
      }
    }

    const dedupRatio = totalFiles > 0 ? ((totalFiles - duplicateFiles) / totalFiles * 100).toFixed(2) : 0;
    const potentialSavings = Object.values(index).reduce((sum, info) => {
      return sum + (info.size * (info.count - 1));
    }, 0);

    return {
      uniqueHashes: uniqueHashes,
      totalFiles: totalFiles,
      totalSize: totalSize,
      duplicateFiles: duplicateFiles,
      dedupRatio: `${dedupRatio}%`,
      potentialSavings: potentialSavings,
      estimatedSavingsPercent: totalSize > 0 ? ((potentialSavings / totalSize) * 100).toFixed(2) : 0,
    };
  } catch (error) {
    console.error('Failed to get dedup stats:', error);
    return { error: error.message };
  }
}

/**
 * Get all files with a specific hash
 */
export async function getFilesByHash(hash) {
  try {
    const refs = await loadDedupRefs();
    return refs.hashes[hash] || [];
  } catch (error) {
    console.error('Failed to get files by hash:', error);
    return { error: error.message };
  }
}

/**
 * Scan storage directory and register all files
 */
export async function scanStorageForDuplicates() {
  try {
    const mediaDir = path.join(STORE_DIR, 'media');
    const imagesDir = path.join(STORE_DIR, 'images');
    const scannedFiles = [];
    const errors = [];

    // Scan media directory
    try {
      const uploads = await fs.readdir(mediaDir);
      for (const uploadId of uploads) {
        const uploadDir = path.join(mediaDir, uploadId);
        const stat = await fs.stat(uploadDir);
        
        if (!stat.isDirectory()) continue;

        const files = await fs.readdir(uploadDir);
        for (const file of files) {
          if (!file.endsWith('.json')) {
            const filePath = path.join(uploadDir, file);
            try {
              const result = await registerFile(filePath, { type: 'media', uploadId });
              scannedFiles.push({
                path: filePath,
                ...result,
              });
            } catch (e) {
              errors.push({ path: filePath, error: e.message });
            }
          }
        }
      }
    } catch (e) {
      // Media directory might not exist
    }

    // Scan images directory
    try {
      const files = await fs.readdir(imagesDir);
      for (const file of files) {
        if (!file.endsWith('.json')) {
          const filePath = path.join(imagesDir, file);
          try {
            const result = await registerFile(filePath, { type: 'image' });
            scannedFiles.push({
              path: filePath,
              ...result,
            });
          } catch (e) {
            errors.push({ path: filePath, error: e.message });
          }
        }
      }
    } catch (e) {
      // Images directory might not exist
    }

    const duplicates = await findDuplicates();

    return {
      scanned: scannedFiles.length,
      errors: errors,
      duplicates: duplicates,
      scanTime: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to scan storage:', error);
    return { error: error.message };
  }
}

/**
 * Create a hard link for duplicate file (unix-like systems)
 * This saves actual disk space
 */
export async function consolidateDuplicates(hash) {
  try {
    const refs = await loadDedupRefs();
    const files = refs.hashes[hash];

    if (!files || files.length < 2) {
      return { error: 'Hash has less than 2 references' };
    }

    // Keep the first file as the primary, create hard links for others
    const primaryFile = files[0].path;
    const linkedFiles = [];
    const failedLinks = [];

    for (let i = 1; i < files.length; i++) {
      const linkPath = files[i].path;
      try {
        // Try to create hard link (Unix-like systems)
        try {
          await fs.link(primaryFile, linkPath);
          linkedFiles.push({ path: linkPath, status: 'linked' });
        } catch (e) {
          // If hard link fails, suggest file pooling alternative
          linkedFiles.push({ 
            path: linkPath, 
            status: 'failed',
            reason: 'Hard link not supported on this system',
            alternative: 'Use content-addressable storage instead',
          });
        }
      } catch (error) {
        failedLinks.push({ path: linkPath, error: error.message });
      }
    }

    return {
      primaryFile: primaryFile,
      linkedFiles: linkedFiles,
      failedLinks: failedLinks,
      potentialSavings: files[0].size * (files.length - 1),
    };
  } catch (error) {
    console.error('Failed to consolidate duplicates:', error);
    return { error: error.message };
  }
}

/**
 * Generate deduplication report
 */
export async function generateDedupReport() {
  try {
    const stats = await getDedupStats();
    const duplicates = await findDuplicates();

    return {
      summary: stats,
      duplicates: duplicates.duplicates,
      recommendations: generateRecommendations(stats, duplicates),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to generate report:', error);
    return { error: error.message };
  }
}

/**
 * Generate recommendations based on deduplication analysis
 */
function generateRecommendations(stats, duplicates) {
  const recommendations = [];

  if (stats.duplicateFiles && stats.duplicateFiles > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Duplicate Files Detected',
      message: `${stats.duplicateFiles} duplicate file(s) found`,
      action: 'Review and consolidate duplicates',
      potentialBenefit: stats.potentialSavings,
    });
  }

  if (stats.potentialSavings > 1024 * 1024 * 100) { // > 100MB
    recommendations.push({
      priority: 'high',
      title: 'Significant Storage Savings Possible',
      message: `Up to ${(stats.potentialSavings / 1024 / 1024).toFixed(2)}MB could be saved`,
      action: 'Implement file consolidation',
      potentialBenefit: stats.potentialSavings,
    });
  }

  if (stats.estimatedSavingsPercent > 5) {
    recommendations.push({
      priority: 'medium',
      title: 'High Deduplication Ratio',
      message: `${stats.estimatedSavingsPercent}% of storage is duplicated content`,
      action: 'Consider enabling automatic deduplication',
    });
  }

  return recommendations;
}
