#!/usr/bin/env node
/**
 * Migration script: Convert database to file-based system
 * Usage: node scripts/migrate-to-file-db.mjs
 */

import { loadNotes } from '../netlify/lib/store-file-db.mjs';
import { appendRecord, readTable } from '../netlify/lib/file-db.mjs';

async function migrateNotesToFileDB() {
  console.log('Starting migration to file-based database...\n');

  try {
    // Load all notes from current database
    console.log('Loading notes from file database...');
    const notes = await loadNotes({ publicOnly: false });
    console.log(`Found ${notes.length} notes\n`);

    if (notes.length === 0) {
      console.log('No notes to migrate. Exiting.');
      return;
    }

    // Check if already migrated
    const existingRecords = await readTable('notes');
    if (existingRecords.length > 0) {
      console.warn(
        `⚠️  Warning: ${existingRecords.length} records already exist in file DB`
      );
      const answer = await askYesNo('Overwrite existing records?');
      if (!answer) {
        console.log('Migration cancelled.');
        return;
      }
    }

    // Migrate each note
    console.log('Migrating notes...');
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      try {
        await appendRecord('notes', {
          id: note.id,
          text: note.text,
          mood: note.mood,
          isPublic: note.isPublic,
          featured: note.featured,
          imageUrl: note.imageUrl,
          attachments: note.attachments,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          schemaVersion: note.schemaVersion,
        });
        process.stdout.write(`\rMigrated ${i + 1}/${notes.length}`);
      } catch (error) {
        console.error(`\nFailed to migrate note ${note.id}:`, error.message);
      }
    }

    console.log(`\n\n✅ Migration complete! ${notes.length} notes migrated.\n`);
    console.log('File database location: .data/tables/notes.jsonl');
    console.log('The file database is not tracked by git (.gitignored).\n');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

function askYesNo(question) {
  return new Promise((resolve) => {
    console.log(`${question} (y/n)`);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim().toLowerCase() === 'y');
    });
  });
}

migrateNotesToFileDB();

