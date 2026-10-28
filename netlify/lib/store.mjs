import { getStore } from '@netlify/blobs';
import { MOOD_KEYS } from './schema.mjs';

// Moods from the original ten-mood palette, folded into the current five.
const LEGACY_MOODS = { withered: 'sad', weeping: 'sad', hollow: 'meh', overcast: 'sad', bruised: 'sad', longing: 'sad', numb: 'meh', seething: 'angry', solace: 'calm', fleeting: 'happy' };

export const journalStore = () => getStore({ name: 'journal', consistency: 'strong' });
export const imageStore = () => getStore({ name: 'images', consistency: 'strong' });

export async function loadNotes() {
  const notes = (await journalStore().get('notes', { type: 'json' })) ?? [];
  return notes.map((n) => (MOOD_KEYS.includes(n.mood) ? n : { ...n, mood: LEGACY_MOODS[n.mood] ?? 'meh' }));
}

export async function saveNotes(notes) {
  await journalStore().setJSON('notes', notes);
}

export { IMAGE_PREFIX } from '../../shared/attachments.js';
