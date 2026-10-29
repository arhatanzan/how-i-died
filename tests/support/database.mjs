import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createNoteRepository, noteRepository, normalizeStoredNote } from '../../netlify/lib/database.mjs';

export async function testDatabase(t, { mockRepository = true } = {}) {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../../netlify/database/migrations/20261029060000_create_journal.sql', import.meta.url), 'utf8'));
  let pending = Promise.resolve();
  async function acquire() {
    let release;
    const previous = pending;
    pending = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  }
  const pool = {
    async query(sql, params) {
      const release = await acquire();
      try { return await db.query(sql, params); } finally { release(); }
    },
    async connect() {
      const release = await acquire();
      return { query: (sql, params) => db.query(sql, params), release };
    },
  };
  const repository = createNoteRepository(() => pool);
  if (mockRepository) {
    for (const [name, method] of Object.entries(repository)) t.mock.method(noteRepository, name, method);
  }
  t.after(() => db.close());
  return {
    db, pool, repository,
    async seed(notes) {
      await db.exec('TRUNCATE journal_notes');
      for (const note of notes) await repository.create(normalizeStoredNote(note));
    },
  };
}
