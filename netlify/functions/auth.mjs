import { adminConfigured, checkCredentials, clearCookie, getSession, issueToken, sessionCookie } from '../lib/auth.mjs';
import { fail, isTrustedMutation, json, readJson } from '../lib/http.mjs';

export default async (req) => {
  const { pathname } = new URL(req.url);

  if (pathname === '/api/session' && req.method === 'GET') {
    const session = getSession(req);
    return json({ authenticated: Boolean(session), username: session?.sub ?? null, configured: adminConfigured() });
  }

  if (req.method !== 'POST') return fail(405, 'Method not allowed');
  if (!isTrustedMutation(req)) return fail(403, 'Forbidden');

  if (pathname === '/api/logout') {
    return json({ ok: true }, 200, { 'set-cookie': clearCookie(req) });
  }

  if (pathname === '/api/login') {
    if (!adminConfigured()) return fail(503, 'ADMIN_USERNAME / ADMIN_PASSWORD are not configured');
    const body = await readJson(req);
    if (!checkCredentials(body?.username, body?.password)) {
      await new Promise((r) => setTimeout(r, 700));
      return fail(401, 'The lock does not yield.');
    }
    return json({ authenticated: true, username: body.username }, 200, {
      'set-cookie': sessionCookie(req, issueToken(body.username)),
    });
  }

  return fail(404, 'Not found');
};

export const config = { path: ['/api/login', '/api/logout', '/api/session'] };
