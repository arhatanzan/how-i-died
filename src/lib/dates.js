export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD key */
export const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

export function formatShort(date) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Value for a datetime-local input from a Date */
export function toLocalInput(date) {
  const d = new Date(date);
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
