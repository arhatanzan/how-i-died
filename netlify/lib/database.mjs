import { getDatabase } from '@netlify/database';
import { getAttachments } from '../../shared/attachments.js';
import { MOOD_KEYS } from './schema.mjs';

const LEGACY_MOODS = { withered: 'sad', weeping: 'sad', hollow: 'meh', overcast: 'sad', bruised: 'sad', longing: 'sad', numb: 'meh', seething: 'angry', solace: 'calm', fleeting: 'happy' };

export function normalizeStoredNote(note) {
  if (!note || typeof note !== 'object' || typeof note.id !== 'string' || !note.id) {
    throw new Error('Cannot migrate a note without a stable ID.');
  }
  if (Number.isNaN(Date.parse(note.createdAt))) throw new Error('Cannot migrate a note without a valid creation date.');
  return {
    ...note,
    schemaVersion: 1,
    text: note.text ?? '',
    mood: MOOD_KEYS.includes(note.mood) ? note.mood : LEGACY_MOODS[note.mood] ?? 'meh',
    isPublic: note.isPublic === true,
    featured: note.featured === true,
    imageUrl: note.imageUrl ?? null,
    attachments: getAttachments(note),
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt ?? note.createdAt).toISOString(),
  };
}

let database;
function pool() {
  database ??= getDatabase();
  return database.pool;
}

export function createNoteRepository(getPool) {
  async function transaction(operation) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Could not roll back journal database transaction.', rollbackError);
      }
      throw error;
    } finally { client.release(); }
  }

  return {
    async list({ publicOnly = false } = {}) {
      const result = await getPool().query(
        `SELECT document FROM journal_notes
         WHERE ($1::boolean = false OR document->'isPublic' = 'true'::jsonb)
         ORDER BY document->>'createdAt' DESC, id`, [publicOnly],
      );
      return result.rows.map(({ document }) => normalizeStoredNote(document));
    },
    async create(note) {
      const normalized = normalizeStoredNote(note);
      const result = await getPool().query(
        'INSERT INTO journal_notes (id, document) VALUES ($1, $2::jsonb) RETURNING document',
        [normalized.id, JSON.stringify(normalized)],
      );
      return result.rows[0].document;
    },
    async update(id, change) {
      return transaction(async (client) => {
        const result = await client.query('SELECT document FROM journal_notes WHERE id = $1 FOR UPDATE', [id]);
        if (!result.rows.length) return null;
        const previous = normalizeStoredNote(result.rows[0].document);
        const updated = normalizeStoredNote(await change(previous));
        if (updated.id !== id) throw new Error('A note ID cannot be changed.');
        await client.query('UPDATE journal_notes SET document = $2::jsonb WHERE id = $1', [id, JSON.stringify(updated)]);
        return { previous, updated };
      });
    },
    async remove(id) {
      const result = await getPool().query('DELETE FROM journal_notes WHERE id = $1 RETURNING document', [id]);
      return result.rows.length ? normalizeStoredNote(result.rows[0].document) : null;
    },
    async migrateLegacy(loadLegacy) {
      return transaction(async (client) => {
        // All importers serialize before checking the marker, including empty journals.
        await client.query("SELECT pg_advisory_xact_lock(684221905)");
        const existing = await client.query("SELECT note_count FROM journal_migrations WHERE name = 'blobs-notes-v1'");
        if (existing.rows.length) return { alreadyMigrated: true, imported: existing.rows[0].note_count };
        const notes = await loadLegacy();
        if (!Array.isArray(notes)) throw new Error('The legacy journal is not a note array.');
        const seen = new Set();
        let imported = 0;
        for (const note of notes) {
          const normalized = normalizeStoredNote(note);
          if (seen.has(normalized.id)) throw new Error('The legacy journal contains duplicate note IDs.');
          seen.add(normalized.id);
          const result = await client.query(
            'INSERT INTO journal_notes (id, document) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id',
            [normalized.id, JSON.stringify(normalized)],
          );
          imported += result.rows.length;
        }
        await client.query("INSERT INTO journal_migrations (name, note_count) VALUES ('blobs-notes-v1', $1)", [imported]);
        return { alreadyMigrated: false, imported };
      });
    },
  };
}

export const noteRepository = createNoteRepository(pool);
