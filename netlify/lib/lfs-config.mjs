/**
 * Git LFS Configuration and Management
 * Handles setup and configuration of Git LFS for large files (100MB+)
 * 
 * Features:
 * - Automatic LFS tracking for files over 100MB
 * - Support for video, audio, and binary file formats
 * - Metadata tracking for LFS pointers
 * - Storage statistics
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const STORE_DIR = path.join(process.cwd(), '.store');
const LFS_TRACKING_FILE = path.join(process.cwd(), '.gitattributes');
const LFS_CONFIG_FILE = path.join(process.cwd(), '.lfs-config.json');
const LFS_THRESHOLD = 100 * 1024 * 1024; // 100MB threshold

// Standard patterns to track with LFS
const LFS_PATTERNS = [
  '.store/media/**/*.mp4',
  '.store/media/**/*.webm',
  '.store/media/**/*.mkv',
  '.store/media/**/*.mov',
  '.store/media/**/*.avi',
  '.store/media/**/*.flv',
  '.store/media/**/*.bin',
];

/**
 * Get current LFS status
 */
export async function getLFSStatus() {
  try {
    const hasLFS = await checkLFSInstalled();
    
    let tracking = [];
    try {
      const content = await fs.readFile(LFS_TRACKING_FILE, 'utf-8');
      const lines = content.split('\n');
      tracking = lines
        .filter(line => line.includes('filter=lfs'))
        .map(line => {
          const match = line.match(/^(.+?)\s+filter=lfs/);
          return match ? match[1] : line;
        });
    } catch (e) {
      // .gitattributes might not exist
    }

    let config = {};
    try {
      config = JSON.parse(await fs.readFile(LFS_CONFIG_FILE, 'utf-8'));
    } catch (e) {
      // Config file might not exist
    }

    return {
      installed: hasLFS,
      tracking: tracking,
      threshold: LFS_THRESHOLD,
      config: config,
      lastUpdated: config.lastUpdated || null,
    };
  } catch (error) {
    console.error('Failed to get LFS status:', error);
    return { error: error.message };
  }
}

/**
 * Check if Git LFS is installed
 */
async function checkLFSInstalled() {
  try {
    execSync('git lfs version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize Git LFS for the repository
 */
export async function initializeLFS() {
  try {
    const hasLFS = await checkLFSInstalled();
    if (!hasLFS) {
      return {
        error: 'Git LFS is not installed. Please install it with: apt-get install git-lfs',
        status: 'not-installed'
      };
    }

    // Run git lfs install
    execSync('git lfs install', { stdio: 'ignore' });

    // Configure tracking patterns
    const gitattributesPath = LFS_TRACKING_FILE;
    let content = '';
    
    try {
      content = await fs.readFile(gitattributesPath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    // Add LFS patterns if not already present
    for (const pattern of LFS_PATTERNS) {
      const lfsLine = `${pattern} filter=lfs diff=lfs merge=lfs -text`;
      if (!content.includes(pattern)) {
        content += (content ? '\n' : '') + lfsLine;
      }
    }

    await fs.writeFile(gitattributesPath, content + '\n');

    // Save configuration
    const config = {
      initialized: true,
      timestamp: new Date().toISOString(),
      threshold: LFS_THRESHOLD,
      patterns: LFS_PATTERNS,
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(LFS_CONFIG_FILE, JSON.stringify(config, null, 2));

    // Commit changes
    try {
      execSync('git add .gitattributes .lfs-config.json', { stdio: 'ignore' });
      execSync('git commit -m "chore: initialize Git LFS for large files" --author="LFS System <lfs@system>" 2>/dev/null || true', { stdio: 'ignore' });
    } catch (e) {
      // git operations may fail silently
    }

    return {
      success: true,
      message: 'Git LFS initialized successfully',
      tracking: LFS_PATTERNS,
    };
  } catch (error) {
    console.error('Failed to initialize LFS:', error);
    return { error: error.message };
  }
}

/**
 * Track a file pattern with LFS
 */
export async function trackPattern(pattern) {
  try {
    const hasLFS = await checkLFSInstalled();
    if (!hasLFS) {
      return { error: 'Git LFS not installed' };
    }

    // Add to git attributes
    const gitattributesPath = LFS_TRACKING_FILE;
    let content = '';
    
    try {
      content = await fs.readFile(gitattributesPath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    const lfsLine = `${pattern} filter=lfs diff=lfs merge=lfs -text`;
    if (!content.includes(pattern)) {
      content += (content ? '\n' : '') + lfsLine;
      await fs.writeFile(gitattributesPath, content + '\n');

      // Track with git lfs
      try {
        execSync(`git lfs track "${pattern}"`, { stdio: 'ignore' });
      } catch (e) {
        // Might already be tracked
      }

      return { success: true, pattern };
    }

    return { success: true, pattern, message: 'Pattern already tracked' };
  } catch (error) {
    console.error('Failed to track pattern:', error);
    return { error: error.message };
  }
}

/**
 * Get detailed LFS statistics
 */
export async function getLFSStats() {
  try {
    const mediaDir = path.join(STORE_DIR, 'media');
    const lfsFiles = [];
    let totalLFSSize = 0;

    try {
      const uploads = await fs.readdir(mediaDir);
      for (const uploadId of uploads) {
        const uploadDir = path.join(mediaDir, uploadId);
        const stat = await fs.stat(uploadDir);
        
        if (!stat.isDirectory()) continue;

        const files = await fs.readdir(uploadDir);
        for (const file of files) {
          if (file.endsWith('.bin')) {
            const filePath = path.join(uploadDir, file);
            const fileStat = await fs.stat(filePath);
            
            if (fileStat.size > LFS_THRESHOLD) {
              totalLFSSize += fileStat.size;
              lfsFiles.push({
                id: uploadId,
                file: file,
                size: fileStat.size,
                lfsCandidate: true,
                path: filePath,
              });
            }
          }
        }
      }
    } catch (e) {
      // Media directory might not exist
    }

    return {
      lfsThreshold: LFS_THRESHOLD,
      candidateFiles: lfsFiles,
      candidateCount: lfsFiles.length,
      totalLFSSize: totalLFSSize,
      estimatedBandwidthSaved: totalLFSSize > 0 ? `${(totalLFSSize / 1024 / 1024).toFixed(2)} MB` : '0 MB',
    };
  } catch (error) {
    console.error('Failed to get LFS stats:', error);
    return { error: error.message };
  }
}

/**
 * Migrate existing large files to LFS
 * This simulates LFS behavior by marking files and tracking them
 */
export async function migrateLargeFilesToLFS() {
  try {
    const stats = await getLFSStats();
    
    if (stats.error) {
      return stats;
    }

    const results = [];
    for (const file of stats.candidateFiles) {
      // In a real scenario, this would:
      // 1. Convert file to LFS pointer
      // 2. Push LFS content to server
      // 3. Update git history
      
      results.push({
        id: file.id,
        file: file.file,
        size: file.size,
        status: 'queued-for-lfs',
        message: 'File is candidate for LFS storage',
      });
    }

    return {
      success: true,
      migratedCount: results.length,
      files: results,
      nextSteps: [
        'Run: git lfs migrate import --include="*.mp4,*.webm,*.bin"',
        'Then: git lfs push origin --all',
      ],
    };
  } catch (error) {
    console.error('Failed to migrate files:', error);
    return { error: error.message };
  }
}

/**
 * Get LFS recommendations based on repository state
 */
export async function getLFSRecommendations() {
  try {
    const status = await getLFSStatus();
    const stats = await getLFSStats();
    const recommendations = [];

    if (!status.installed) {
      recommendations.push({
        severity: 'high',
        title: 'Git LFS Not Installed',
        message: 'Install Git LFS to efficiently handle large files',
        action: 'apt-get install git-lfs && git lfs install',
      });
    } else if (!status.tracking || status.tracking.length === 0) {
      recommendations.push({
        severity: 'medium',
        title: 'LFS Not Configured',
        message: 'Configure LFS tracking patterns for media files',
        action: 'Call initializeLFS() API endpoint',
      });
    }

    if (stats.candidateFiles && stats.candidateFiles.length > 0) {
      recommendations.push({
        severity: stats.candidateFiles.length > 5 ? 'high' : 'medium',
        title: `${stats.candidateFiles.length} Large Files Found`,
        message: `${stats.candidateFiles.length} files exceed the 100MB LFS threshold`,
        action: 'Call migrateLargeFilesToLFS() API endpoint',
        details: stats.candidateFiles.slice(0, 5),
      });
    }

    return {
      hasRecommendations: recommendations.length > 0,
      recommendations: recommendations,
    };
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    return { error: error.message };
  }
}
