import crypto from 'node:crypto';
import { mkdir, open, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMediaId } from '../shared/media.js';

export async function exportJournal({ baseUrl, directory, username, password, fetcher = fetch }) {
  const origin = new URL(baseUrl);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
    throw new Error('Use an HTTPS site origin (or HTTP localhost for development).');
  }
  if (!username || !password) throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD for the keeper account.');
  const login = await fetcher(new URL('/api/login', origin), {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'how-i-died' },
    body: JSON.stringify({ username, password }),
  });
  if (!login.ok) throw new Error(`Keeper sign-in failed (${login.status}).`);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('The server did not issue a session cookie.');
  async function get(path) {
    if (!path.startsWith('/api/')) throw new Error('Export contains an invalid asset path.');
    const url = new URL(path, origin);
    if (url.origin !== origin.origin) throw new Error('Export points outside the journal site.');
    const response = await fetcher(url, { headers: { cookie }, redirect: 'error' });
    if (!response.ok) throw new Error(`Export failed at ${path} (${response.status}).`);
    return response;
  }
  const manifest = await (await get('/api/export')).json();
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.notes) || !Array.isArray(manifest.assets)) {
    throw new Error('Unsupported journal export format.');
  }
  await mkdir(directory);
  await mkdir(join(directory, 'assets'));
  for (const asset of manifest.assets) {
    if (!isMediaId(asset.id) || asset.path !== `assets/${asset.id}` || asset.downloadParts.length !== asset.parts || asset.sha256.length !== asset.parts) {
      throw new Error('Export contains invalid attachment metadata.');
    }
    const destination = join(directory, 'assets', asset.id);
    const file = await open(`${destination}.partial`, 'wx');
    let size = 0;
    try {
      for (let index = 0; index < asset.parts; index++) {
        const data = new Uint8Array(await (await get(asset.downloadParts[index])).arrayBuffer());
        if (crypto.createHash('sha256').update(data).digest('hex') !== asset.sha256[index]) {
          throw new Error(`Integrity check failed for ${asset.id}, part ${index}.`);
        }
        await file.writeFile(data);
        size += data.byteLength;
      }
      if (size !== asset.size) throw new Error(`Size check failed for ${asset.id}.`);
    } finally { await file.close(); }
    await rename(`${destination}.partial`, destination);
  }
  await writeFile(join(directory, 'journal.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { notes: manifest.notes.length, assets: manifest.assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [baseUrl, directory] = process.argv.slice(2);
    if (!baseUrl || !directory) throw new Error('Usage: npm run export -- https://your-site.example ./journal-backup');
    const result = await exportJournal({ baseUrl, directory, username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD });
    console.log(`Exported ${result.notes} notes and ${result.assets} files. Keep this backup private.`);
  } catch (error) {
    console.error(`Export failed: ${error.message} Incomplete exports have no journal.json; remove the partial folder before retrying.`);
    process.exitCode = 1;
  }
}
