export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const fail = (status, message) => json({ error: message }, status);

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Mutating requests must come from our own frontend: requiring a JSON (or image)
 * content type plus a custom header blocks simple cross-site form posts.
 */
export function isTrustedMutation(req) {
  return req.headers.get('x-requested-with') === 'how-i-died';
}
