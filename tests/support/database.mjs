/**
 * Test database support using file-db instead of Postgres
 */

import { readTable, appendRecord, deleteRecord } from '../../netlify/lib/file-db.mjs';

export async function testDatabase(t, { mockRepository = true } = {}) {
  // Clean up the test database before running
  const existingNotes = await readTable('notes');
  for (const note of existingNotes) {
    try {
      await deleteRecord('notes', note._id);
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  const existingImages = await readTable('images');
  for (const image of existingImages) {
    try {
      await deleteRecord('images', image._id);
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  const existingMedia = await readTable('media');
  for (const media of existingMedia) {
    try {
      await deleteRecord('media', media._id);
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  return {
    db: null,
    pool: null,
    repository: null,
    async seed(notes) {
      // Clear existing notes
      const existing = await readTable('notes');
      for (const note of existing) {
        try {
          await deleteRecord('notes', note._id);
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Add new notes
      for (const note of notes) {
        await appendRecord('notes', note);
      }
    },
  };
}
