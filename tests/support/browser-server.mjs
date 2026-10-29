import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

Object.assign(process.env, {
  GITHUB_TOKEN: 'browser-test-token',
  GITHUB_OWNER: 'browser-test',
  GITHUB_REPO: 'journal',
  ADMIN_USERNAME: 'browser-test',
  ADMIN_PASSWORD: 'browser-test-only',
  AUTH_SECRET: 'browser-test-secret',
});

const files = new Map();
let revision = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname !== 'api.github.com') return originalFetch(input, options);
  const respond = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  });
  if (url.pathname === '/repos/browser-test/journal/git/trees/HEAD') {
    return respond({ truncated: false, tree: Array.from(files.keys(), file => ({ path: file, type: 'blob' })) });
  }
  const prefix = '/repos/browser-test/journal/contents/';
  if (!url.pathname.startsWith(prefix)) return respond({ message: 'Unexpected GitHub request' }, 400);
  const file = decodeURIComponent(url.pathname.slice(prefix.length));
  const current = files.get(file);
  if (options.method === 'PUT') {
    const body = JSON.parse(options.body);
    if (current && body.sha !== current.sha) return respond({ message: 'SHA conflict' }, 409);
    const record = { content: body.content, sha: String(++revision) };
    files.set(file, record);
    return respond({ content: { path: file, sha: record.sha }, commit: { html_url: 'https://example.org/test-commit' } });
  }
  if (options.method === 'DELETE') {
    if (!current) return respond({ message: 'Not Found' }, 404);
    const body = JSON.parse(options.body);
    if (body.sha !== current.sha) return respond({ message: 'SHA conflict' }, 409);
    files.delete(file);
    return respond({ commit: { html_url: 'https://example.org/test-delete' } });
  }
  if (!current) return respond({ message: 'Not Found' }, 404);
  if (new Headers(options.headers).get('accept')?.includes('raw')) {
    return new Response(Buffer.from(current.content, 'base64'), { headers: { 'content-type': 'application/octet-stream' } });
  }
  if (Buffer.from(current.content, 'base64').length > 1024 * 1024) return respond({ ...current, content: '', encoding: 'none' });
  return respond(current);
};

const handlers = await Promise.all(['auth', 'notes', 'media', 'images', 'export'].map(async name => {
  const handler = await import(`../../netlify/functions/${name}.mjs`);
  return { ...handler, config: { ...handler.config, path: [].concat(handler.config.path) } };
}));
const root = fileURLToPath(new URL('../../dist/', import.meta.url));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'http://localhost:8891');
    if (url.pathname === '/__test/storage') {
      outgoing.setHeader('content-type', 'application/json');
      outgoing.end(JSON.stringify({ files: Array.from(files.keys()) }));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const handler = handlers.find(entry => entry.config.path.some(pattern => {
        const expression = new RegExp(`^${pattern.replace(/:[^/]+/g, '([^/]+)')}$`);
        return expression.test(url.pathname);
      }));
      if (!handler) { outgoing.writeHead(404); outgoing.end(); return; }
      const pattern = handler.config.path.find(route => new RegExp(`^${route.replace(/:[^/]+/g, '([^/]+)')}$`).test(url.pathname));
      const values = url.pathname.match(new RegExp(`^${pattern.replace(/:[^/]+/g, '([^/]+)')}$`)).slice(1);
      const names = Array.from(pattern.matchAll(/:([^/]+)/g), match => match[1]);
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request(url, { method: incoming.method, headers: incoming.headers,
        ...(body.length ? { body } : {}),
      });
      const response = await handler.default(request, { params: Object.fromEntries(names.map((name, index) => [name, values[index]])) });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (target !== path.resolve(root) && !target.startsWith(root)) { outgoing.writeHead(403); outgoing.end(); return; }
    const asset = path.extname(target) ? target : path.join(root, 'index.html');
    outgoing.setHeader('content-type', types[path.extname(asset)] || 'application/octet-stream');
    outgoing.end(await readFile(asset));
  } catch (error) {
    if (error.code === 'ENOENT') { outgoing.writeHead(404); outgoing.end(); return; }
    console.error(error);
    outgoing.writeHead(500);
    outgoing.end('Browser test server failed');
  }
});
server.listen(8891, '0.0.0.0', () => console.log('Isolated browser journal: http://localhost:8891 (browser-test / browser-test-only)'));