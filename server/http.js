const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export function sendJson(res, status, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'content-type': JSON_CONTENT_TYPE,
    'content-length': payload.byteLength,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

export function sendNoContent(res) {
  res.writeHead(204, { 'cache-control': 'no-store' });
  res.end();
}

/** Writes must declare a JSON body. `application/json` is not a CORS-safelisted
 *  content type, so any cross-origin attempt is preflighted and the browser
 *  drops it: no `Access-Control-Allow-*` here means no `cors` response either.
 *  A simple `text/plain` or form POST from another page cannot reach the store. */
export function hasJsonContentType(req) {
  const header = req.headers['content-type'] ?? '';
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

export async function readJsonBody(req) {
  let text;
  try {
    text = await readBodyText(req);
  } catch {
    return { error: 'Request body could not be read' };
  }

  if (text === null) return { error: 'Request body is too large' };

  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: 'Request body must be valid JSON' };
  }
}

async function readBodyText(req) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) tooLarge = true;
    if (!tooLarge) chunks.push(chunk);
  }

  return tooLarge ? null : Buffer.concat(chunks).toString('utf8');
}
