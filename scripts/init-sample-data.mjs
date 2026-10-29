#!/usr/bin/env node
/**
 * Initialize sample data for testing the file-based database
 * Usage: node scripts/init-sample-data.mjs
 */

import { appendRecord, readTable } from '../netlify/lib/file-db.mjs';

async function initSampleData() {
  console.log('Initializing sample data...\n');

  try {
    // Check if data already exists
    const existing = await readTable('notes');
    if (existing.length > 0) {
      console.log(`✓ Found ${existing.length} existing notes. Skipping initialization.`);
      return;
    }

    // Create sample notes
    const sampleNotes = [
      {
        text: 'A beautiful autumn morning. The leaves are changing colors and the air feels crisp.',
        mood: 'happy',
        isPublic: true,
        featured: false,
        imageUrl: null,
        attachments: [],
      },
      {
        text: 'Spent time reflecting on life. Sometimes the path forward isn\'t clear, but that\'s okay.',
        mood: 'contemplative',
        isPublic: false,
        featured: false,
        imageUrl: null,
        attachments: [],
      },
      {
        text: 'Met an old friend today. Time moves differently when you\'re with someone who truly knows you.',
        mood: 'calm',
        isPublic: true,
        featured: true,
        imageUrl: null,
        attachments: [],
      },
      {
        text: 'Challenging day at work, but learned something valuable about patience.',
        mood: 'neutral',
        isPublic: false,
        featured: false,
        imageUrl: null,
        attachments: [],
      },
      {
        text: 'Finished reading that book I started months ago. The ending was unexpected but perfect.',
        mood: 'sad',
        isPublic: true,
        featured: false,
        imageUrl: null,
        attachments: [],
      },
    ];

    console.log('Creating sample notes...');
    for (let i = 0; i < sampleNotes.length; i++) {
      const note = sampleNotes[i];
      await appendRecord('notes', note);
      console.log(`✓ Created note ${i + 1}/${sampleNotes.length}`);
    }

    console.log('\n✅ Sample data initialization complete!');
    console.log('\nYou can now:');
    console.log('1. View data via admin panel: /admin');
    console.log('2. Check file database: .data/tables/notes.jsonl');
    console.log('3. Query via API: GET /api/admin/table/notes');

  } catch (error) {
    console.error('Failed to initialize sample data:', error);
    process.exit(1);
  }
}

initSampleData();
