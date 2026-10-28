import crypto from 'node:crypto';

const COOKIE = 'hid_session';
const TTL_SECONDS = 60 * 60 * 24 * 14;

const env = (key) => (globalThis.Netlify?.env?.get(key) ?? process.env[key] ?? '').toString();

// Tokens are signed with a key derived from the credentials, so rotating the
// admin password in Netlify immediately invalidates every existing session.
function signingKey() {
  const explicit = env('AUTH_SECRET');
  const user = env('ADMIN_USERNAME');
  const pass = env('ADMIN_PASSWORD');
  if (!user || !pass) return null;
  return crypto.createHash('sha256').update(`${explicit}\u0000${user}\u0000${pass}`).digest();
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function hmac(payload, key) {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function adminConfigured() {
  return Boolean(env('ADMIN_USERNAME') && env('ADMIN_PASSWORD'));
}

export function checkCredentials(username, password) {
  if (!adminConfigured()) return false;
  const userOk = safeEqual(username ?? '', env('ADMIN_USERNAME'));
  const passOk = safeEqual(password ?? '', env('ADMIN_PASSWORD'));
  return userOk && passOk;
}

export function issueToken(username) {
  const key = signingKey();
  const payload = b64url(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }));
  return `${payload}.${hmac(payload, key)}`;
}

function readCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Returns the session payload if the request carries a valid session cookie. */
export function getSession(req) {
  const key = signingKey();
  if (!key) return null;
  const token = readCookie(req, COOKIE);
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!safeEqual(sig, hmac(payload, key))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function isSecure(req) {
  const url = new URL(req.url);
  return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export function sessionCookie(req, token) {
  const secure = isSecure(req) ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_SECONDS}${secure}`;
}

export function clearCookie(req) {
  const secure = isSecure(req) ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
