import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { sendJson } from './http.js';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const STATIC_METHODS = ['GET', 'HEAD'];

export function createStaticHandler(distDirectory) {
  const root = resolve(distDirectory);
  const fallbackPath = join(root, 'index.html');

  return async function handleStaticRequest(req, res, url) {
    if (!STATIC_METHODS.includes(req.method)) {
      return sendJson(res, 405, { error: 'Method not allowed' }, { allow: STATIC_METHODS.join(', ') });
    }

    const filePath = resolveFilePath(root, url.pathname);
    const contents = filePath === null ? null : await readFileOrNull(filePath);
    if (contents !== null) return sendFile(res, filePath, contents);

    const fallback = extname(url.pathname) === '' ? await readFileOrNull(fallbackPath) : null;
    if (fallback !== null) return sendFile(res, fallbackPath, fallback, 'no-cache');

    return sendJson(res, 404, { error: 'Not found' });
  };
}

function resolveFilePath(root, pathname) {
  const decoded = decodePathname(pathname);
  if (decoded === null) return null;

  const candidate = resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;

  return candidate;
}

function decodePathname(pathname) {
  if (pathname.includes('\0')) return null;
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

async function readFileOrNull(filePath) {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

function sendFile(res, filePath, contents, cacheControl) {
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': contents.byteLength,
    ...(cacheControl === undefined ? {} : { 'cache-control': cacheControl }),
  });
  res.end(contents);
}
