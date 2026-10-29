import { getStore } from '@netlify/blobs';
import { noteRepository } from './database.mjs';

export const journalStore = () => getStore({ name: 'journal', consistency: 'strong' });
export const imageStore = () => getStore({ name: 'images', consistency: 'strong' });
export const mediaStore = () => getStore({ name: 'media', consistency: 'strong' });

export async function migrateLegacyNotes() {
  return noteRepository.migrateLegacy(async () => (await journalStore().get('notes', { type: 'json' })) ?? []);
}

let migration;
async function ensureMigrated() {
  migration ??= migrateLegacyNotes().catch((error) => { migration = undefined; throw error; });
  await migration;
}

export async function loadNotes(options) {
  await ensureMigrated();
  return noteRepository.list(options);
}
export async function createNote(note) {
  await ensureMigrated();
  return noteRepository.create(note);
}
export async function updateNote(id, change) {
  await ensureMigrated();
  return noteRepository.update(id, change);
}
export async function deleteNote(id) {
  await ensureMigrated();
  return noteRepository.remove(id);
}

export { IMAGE_PREFIX } from '../../shared/attachments.js';
