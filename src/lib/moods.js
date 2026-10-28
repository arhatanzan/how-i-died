// Keep keys in sync with netlify/lib/schema.mjs. Ordered from worst to best.
export const MOODS = [
  { key: 'angry', label: 'Angry' },
  { key: 'sad', label: 'Sad' },
  { key: 'meh', label: 'Meh' },
  { key: 'calm', label: 'Calm' },
  { key: 'happy', label: 'Happy' },
];

export const MOOD_MAP = Object.fromEntries(MOODS.map((m) => [m.key, m]));
export const moodOf = (key) => MOOD_MAP[key] ?? MOOD_MAP.meh;
