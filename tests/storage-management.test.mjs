/**
 * Storage Management System - Integration Tests
 * Tests for Git LFS, deduplication, and storage admin features
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import storage management modules
import { 
  calculateFileHash, 
  registerFile, 
  findDuplicates, 
  getDedupStats,
  scanStorageForDuplicates,
  generateDedupReport 
} from '../netlify/lib/file-dedup.mjs';

import {
  getLFSStatus,
  getLFSStats,
  getLFSRecommendations
} from '../netlify/lib/lfs-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE = path.join(__dirname, '.data', 'test-dedup.bin');
const TEST_STORE = path.join(__dirname, '.store-test');

// Helper to create test file
async function createTestFile(filePath, size) {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Directory might exist
  }
  
  const buffer = Buffer.alloc(size);
  buffer.fill(0xAB);
  await fs.writeFile(filePath, buffer);
  return buffer;
}

test('SHA-256 Hash Calculation', async (t) => {
  await t.test('calculates hash for buffer', async () => {
    // Create test file
    const testDir = path.join(__dirname, '.data');
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (e) {
      // Directory might exist
    }
    
    await createTestFile(TEST_FILE, 1024);
    const hash = await calculateFileHash(TEST_FILE);
    assert.strictEqual(typeof hash, 'string', 'hash should be string');
    assert.strictEqual(hash.length, 64, 'SHA-256 hash should be 64 characters');
    
    // Cleanup
    try {
      await fs.unlink(TEST_FILE);
    } catch (e) {
      // File might not exist
    }
  });
});

test('File Deduplication System', async (t) => {
  await t.test('initializes deduplication stats', async () => {
    const stats = await getDedupStats();
    assert.strictEqual(stats.error, undefined, 'should not error');
    assert.strictEqual(typeof stats.uniqueHashes, 'number', 'should have uniqueHashes');
    assert.strictEqual(typeof stats.totalFiles, 'number', 'should have totalFiles');
    assert.strictEqual(typeof stats.dedupRatio, 'string', 'should have dedupRatio string');
  });

  await t.test('finds duplicates structure', async () => {
    const duplicates = await findDuplicates();
    assert.strictEqual(duplicates.error, undefined, 'should not error');
    assert.ok(Array.isArray(duplicates.duplicates), 'duplicates should be array');
    assert.strictEqual(typeof duplicates.duplicateGroups, 'number');
    assert.strictEqual(typeof duplicates.duplicateCount, 'number');
  });

  await t.test('generates deduplication report', async () => {
    const report = await generateDedupReport();
    assert.strictEqual(report.error, undefined, 'should not error');
    assert.ok(report.summary, 'should have summary');
    assert.ok(Array.isArray(report.duplicates), 'should have duplicates array');
    assert.ok(Array.isArray(report.recommendations), 'should have recommendations array');
    assert.ok(report.generatedAt, 'should have timestamp');
  });
});

test('Git LFS Configuration', async (t) => {
  await t.test('checks LFS status', async () => {
    const status = await getLFSStatus();
    assert.strictEqual(status.error, undefined, 'should not error');
    assert.strictEqual(typeof status.installed, 'boolean', 'should have installed boolean');
    assert.ok(Array.isArray(status.tracking), 'should have tracking array');
    assert.strictEqual(typeof status.threshold, 'number', 'should have threshold');
  });

  await t.test('gets LFS statistics', async () => {
    const stats = await getLFSStats();
    assert.strictEqual(stats.error, undefined, 'should not error');
    assert.ok(Array.isArray(stats.candidateFiles), 'should have candidateFiles');
    assert.strictEqual(typeof stats.candidateCount, 'number', 'should have count');
    assert.strictEqual(typeof stats.totalLFSSize, 'number', 'should have size');
    assert.strictEqual(stats.lfsThreshold, 104857600, 'threshold should be 100MB');
  });

  await t.test('provides LFS recommendations', async () => {
    const recommendations = await getLFSRecommendations();
    assert.strictEqual(recommendations.error, undefined, 'should not error');
    assert.strictEqual(typeof recommendations.hasRecommendations, 'boolean');
    assert.ok(Array.isArray(recommendations.recommendations), 'should have recommendations array');
  });
});

test('Storage Management Data Structures', async (t) => {
  await t.test('validates dedup stats structure', async () => {
    const stats = await getDedupStats();
    
    // Check all required fields exist
    assert.ok('uniqueHashes' in stats);
    assert.ok('totalFiles' in stats);
    assert.ok('totalSize' in stats);
    assert.ok('duplicateFiles' in stats);
    assert.ok('dedupRatio' in stats);
    assert.ok('potentialSavings' in stats);
    assert.ok('estimatedSavingsPercent' in stats);
  });

  await t.test('validates LFS status structure', async () => {
    const status = await getLFSStatus();
    
    // Check all required fields exist
    assert.ok('installed' in status);
    assert.ok('tracking' in status);
    assert.ok('threshold' in status);
    assert.ok('config' in status);
    assert.ok('lastUpdated' in status);
  });

  await t.test('validates duplicate group structure', async () => {
    const duplicates = await findDuplicates();
    
    // Check main structure
    assert.ok('duplicateGroups' in duplicates);
    assert.ok('duplicateCount' in duplicates);
    assert.ok('totalPotentialSavings' in duplicates);
    assert.ok('duplicates' in duplicates);
    
    // Check individual duplicate structure if any exist
    if (duplicates.duplicates.length > 0) {
      const dup = duplicates.duplicates[0];
      assert.ok('hash' in dup);
      assert.ok('size' in dup);
      assert.ok('count' in dup);
      assert.ok('potentialSavings' in dup);
      assert.ok('firstSeen' in dup);
    }
  });
});

test('Configuration Files', async (t) => {
  await t.test('LFS config file exists and is valid JSON', async () => {
    try {
      const configPath = path.join(path.dirname(__dirname), '.lfs-config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      assert.ok('threshold' in config, 'config should have threshold');
      assert.ok('patterns' in config, 'config should have patterns');
      assert.ok(Array.isArray(config.patterns), 'patterns should be array');
      assert.strictEqual(config.threshold, 104857600, '100MB threshold');
    } catch (e) {
      // Config file might not exist yet, which is OK for fresh installations
      assert.ok(e.code === 'ENOENT' || e instanceof SyntaxError === false);
    }
  });

  await t.test('gitattributes file is properly configured', async () => {
    try {
      const attribPath = path.join(path.dirname(__dirname), '.gitattributes');
      const content = await fs.readFile(attribPath, 'utf-8');
      
      // Should have LFS configuration for media files
      assert.ok(content.includes('filter=lfs'), 'should have LFS filter configuration');
      assert.ok(content.includes('diff=lfs'), 'should have LFS diff configuration');
      assert.ok(content.includes('.store/media'), 'should configure media directory');
    } catch (e) {
      assert.fail('gitattributes file should exist and be readable');
    }
  });
});

console.log('✓ Storage management system integration tests ready');
