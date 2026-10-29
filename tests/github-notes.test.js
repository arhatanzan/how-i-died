import test from 'node:test';
import assert from 'node:assert/strict';

test('a newly saved private note can be published without GitHub search indexing', async (t) => {
  const environment = {
    GITHUB_TOKEN: 'test-token',
    GITHUB_OWNER: 'test-owner',
    GITHUB_REPO: 'test-journal',
    ADMIN_USERNAME: 'test-keeper',
    ADMIN_PASSWORD: 'local-test-only',
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const files = new Map();
  const unexpected = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = options?.method || 'GET';
    const prefix = '/repos/test-owner/test-journal/contents/';
    const respond = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    if (url.pathname === '/repos/test-owner/test-journal/git/trees/HEAD') {
      return respond({ truncated: false, tree: [
        ...Array.from(files.keys(), path => ({ path, type: 'blob' })),
        { path: 'data/journal/attachments/media/upload.meta.json', type: 'blob' },
        { path: 'data/journal/MANIFEST.json', type: 'blob' },
      ] });
    }
    if (url.pathname.startsWith(prefix)) {
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      if (method === 'PUT') {
        const body = JSON.parse(options.body);
        files.set(path, body.content);
        return respond({ content: { path }, commit: { html_url: 'https://example.org/commit' } });
      }
      if (files.has(path)) return respond({ content: files.get(path), sha: 'test-sha' });
      return respond({ message: 'Not Found' }, 404);
    }
    unexpected.push(`${method} ${url.pathname}`);
    return respond({ message: 'Code search is not available' }, 503);
  });

  const { default: notesHandler } = await import('../netlify/functions/notes.mjs');
  const { issueToken } = await import('../netlify/lib/auth.mjs');
  const { APP_REQUEST_ID } = await import('./constants.mjs');
  const cookie = `hid_session=${issueToken('test-keeper')}`;
  const request = (method, body, id, authenticated = true) => notesHandler(new Request('http://localhost/api/notes', {
    method,
    headers: {
      ...(authenticated ? { cookie } : {}),
      'x-requested-with': APP_REQUEST_ID,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { params: { id } });

  const created = await request('POST', { text: 'A private moment', isPublic: false });
  assert.equal(created.status, 201);
  const saved = await created.json();
  assert.equal(saved.isPublic, false);
  assert.deepEqual(await (await request('GET', undefined, undefined, false)).json(), []);

  const published = await request('PATCH', { isPublic: true }, saved.id);
  assert.equal(published.status, 200);
  assert.equal((await published.json()).isPublic, true);
  const publicNotes = await (await request('GET', undefined, undefined, false)).json();
  assert.equal(publicNotes.length, 1);
  assert.equal(publicNotes[0].id, saved.id);
  assert.equal(publicNotes[0].text, saved.text);
  assert.equal(publicNotes[0].isPublic, true);
  assert.equal((await request('PATCH', { isPublic: true }, 'missing')).status, 404);
  assert.deepEqual(unexpected, []);
});