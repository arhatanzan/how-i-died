const HEADERS = { 'x-requested-with': 'how-i-died' };

async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...HEADERS,
        ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch (cause) {
    throw new Error('Could not connect to the archive API. Run `npm run dev` and open http://localhost:8888/.', { cause });
  }
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    const err = new Error('The archive is unreachable. (Run `netlify dev` and open port 8888.)');
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  session: () => request('/api/session'),
  login: (username, password) => request('/api/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/logout', { method: 'POST', body: {} }),

  listNotes: () => request('/api/notes'),
  createNote: (note) => request('/api/notes', { method: 'POST', body: note }),
  updateNote: (id, patch) => request(`/api/notes/${id}`, { method: 'PATCH', body: patch }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),

  uploadImage: (blob) =>
    request('/api/images', { method: 'POST', body: blob, raw: true, headers: { 'content-type': blob.type } }),

};
