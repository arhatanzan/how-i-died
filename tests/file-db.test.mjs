#!/usr/bin/env node
/**
 * Test file-based database system
 * Usage: node tests/file-db.test.mjs
 */

import { strict as assert } from 'node:assert';
import {
  readTable,
  appendRecord,
  updateRecord,
  deleteRecord,
  getRecord,
  listTables,
  exportTable,
  getStats,
} from '../netlify/lib/file-db.mjs';

async function runTests() {
  console.log('🧪 Testing File-Based Database System\n');

  const testTable = 'test-table';
  let testRecordId;

  try {
    // Test 1: Read empty table
    console.log('Test 1: Read empty table');
    let records = await readTable(testTable);
    assert.strictEqual(records.length, 0, 'Empty table should have 0 records');
    console.log('✅ Pass\n');

    // Test 2: Append record
    console.log('Test 2: Append record');
    const created = await appendRecord(testTable, {
      text: 'Test note',
      mood: 'happy',
    });
    assert(created._id, 'Record should have _id');
    assert(created._created, 'Record should have _created');
    assert(created._updated, 'Record should have _updated');
    assert.strictEqual(created.text, 'Test note');
    assert.strictEqual(created.mood, 'happy');
    testRecordId = created._id;
    console.log(`✅ Pass (ID: ${testRecordId.slice(0, 8)}...)\n`);

    // Test 3: Read table with record
    console.log('Test 3: Read table with record');
    records = await readTable(testTable);
    assert.strictEqual(records.length, 1, 'Table should have 1 record');
    assert.strictEqual(records[0]._id, testRecordId);
    console.log('✅ Pass\n');

    // Test 4: Get single record
    console.log('Test 4: Get single record');
    const retrieved = await getRecord(testTable, testRecordId);
    assert(retrieved, 'Record should exist');
    assert.strictEqual(retrieved.text, 'Test note');
    console.log('✅ Pass\n');

    // Test 5: Update record
    console.log('Test 5: Update record');
    const updated = await updateRecord(testTable, testRecordId, {
      text: 'Updated note',
      mood: 'calm',
    });
    assert.strictEqual(updated.text, 'Updated note');
    assert.strictEqual(updated.mood, 'calm');
    const prevUpdated = updated._updated;
    
    // Wait a bit to ensure timestamp changes
    await new Promise(r => setTimeout(r, 10));
    
    const updated2 = await updateRecord(testTable, testRecordId, {
      text: 'Updated again',
    });
    assert(updated2._updated >= prevUpdated, '_updated should be newer');
    console.log('✅ Pass\n');

    // Test 6: Add more records
    console.log('Test 6: Add more records');
    await appendRecord(testTable, { text: 'Record 2', mood: 'sad' });
    await appendRecord(testTable, { text: 'Record 3', mood: 'neutral' });
    records = await readTable(testTable);
    assert.strictEqual(records.length, 3, 'Table should have 3 records');
    console.log('✅ Pass\n');

    // Test 7: List tables
    console.log('Test 7: List tables');
    const tables = await listTables();
    assert(tables.includes(testTable), 'Test table should be listed');
    console.log(`✅ Pass (found tables: ${tables.join(', ')})\n`);

    // Test 8: Export table
    console.log('Test 8: Export table');
    const exported = await exportTable(testTable);
    assert.strictEqual(exported.tableName, testTable);
    assert.strictEqual(exported.count, 3);
    assert(exported.records.length === 3);
    assert(exported.exportedAt);
    console.log('✅ Pass\n');

    // Test 9: Get stats
    console.log('Test 9: Get database stats');
    const stats = await getStats();
    assert(stats[testTable], 'Stats should include test table');
    assert.strictEqual(stats[testTable].count, 3);
    console.log(`✅ Pass (size: ${stats[testTable].size} bytes)\n`);

    // Test 10: Delete record
    console.log('Test 10: Delete record');
    const deleted = await deleteRecord(testTable, testRecordId);
    assert.strictEqual(deleted._id, testRecordId);
    records = await readTable(testTable);
    assert.strictEqual(records.length, 2, 'Table should have 2 records after delete');
    const found = records.find(r => r._id === testRecordId);
    assert(!found, 'Deleted record should not exist');
    console.log('✅ Pass\n');

    // Test 11: Error handling - invalid table name
    console.log('Test 11: Error handling - invalid table name');
    try {
      await readTable('../malicious');
      assert.fail('Should throw error for invalid table name');
    } catch (error) {
      assert(error.message.includes('Invalid'), 'Should throw error');
      console.log('✅ Pass\n');
    }

    // Test 12: Error handling - nonexistent record
    console.log('Test 12: Error handling - nonexistent record');
    try {
      await updateRecord(testTable, 'nonexistent-id', { text: 'test' });
      assert.fail('Should throw error for nonexistent record');
    } catch (error) {
      assert(error.message.includes('not found'), 'Should throw error');
      console.log('✅ Pass\n');
    }

    console.log('━'.repeat(50));
    console.log('✅ All tests passed!\n');
    console.log('Summary:');
    console.log('- File creation: ✅');
    console.log('- CRUD operations: ✅');
    console.log('- Data persistence: ✅');
    console.log('- Error handling: ✅');
    console.log('- Statistics: ✅');
    console.log('\n📁 Test data stored in: .data/tables/test-table.jsonl');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

runTests();
