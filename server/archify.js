import { installReaderTouch } from './reader-touch.js';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../vendor/archify/bin/archify.mjs', import.meta.url));
export const DIAGRAM_TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle', 'erd', 'class', 'tree', 'timeline', 'waterfall'];
const cache = new Map();
const pending = new Map();
const TTL = 10 * 60 * 1000;

export function parseCandidate(source, type) {
  if (!DIAGRAM_TYPES.includes(type)) throw new Error('Choose a supported Archify diagram type.');
  let candidate;
  try { candidate = JSON.parse(source); } catch { throw new Error('Archify source must be valid JSON.'); }
  if (!candidate || candidate.diagram_type !== type) throw new Error('The selected type must match diagram_type in the JSON.');
  if (!candidate.meta || typeof candidate.meta.title !== 'string') throw new Error('The candidate needs meta.title.');
  return candidate;
}

export async function compileDiagram(source, type) {
  const candidate = parseCandidate(source, type);
  const digest = createHash('sha256').update(`archify-3.2.0\0${type}\0${source}`).digest('hex');
  const previous = readPreview(digest);
  if (previous) return { digest, html: previous };
  if (pending.has(digest)) return pending.get(digest);
  if (pending.size >= 2) throw new Error('The renderer is busy. Try the preview again in a moment.');
  const task = (async () => {
    const directory = await mkdtemp(join(tmpdir(), 'diagram-desk-render-'));
    try {
      // User output paths never become filesystem authority in the application.
      candidate.meta.output = 'diagram.html';
      await writeFile(join(directory, 'candidate.json'), JSON.stringify(candidate));
      await execute(process.execPath, [cli, 'render', type, 'candidate.json', 'diagram.html'], {
        cwd: directory, timeout: 30000, maxBuffer: 2 * 1024 * 1024,
      });
      const html = await readFile(join(directory, 'diagram.html'), 'utf8');
      if (cache.size >= 32) cache.delete(cache.keys().next().value);
      cache.set(digest, { html, expires: Date.now() + TTL });
      return { digest, html };
    } catch (error) {
      throw new Error((error.stderr || error.message || 'Archify could not render this candidate.').slice(0, 3000));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  })();
  pending.set(digest, task);
  try { return await task; } finally { pending.delete(digest); }
}

export function readPreview(digest) {
  const entry = cache.get(digest);
  if (!entry) return null;
  if (entry.expires < Date.now()) { cache.delete(digest); return null; }
  return entry.html;
}

export function sendReader(res, html) {
  // Native pointer panning needs browser gestures suppressed only while zoomed in.
  html = html.replace('</head>', '<style>@media (pointer: coarse) { .diagram-container.is-pannable { touch-action: none; } }</style></head>');
  html = html.replace('</body>', `<script>(${installReaderTouch.toString()})();</script></body>`);
  // Only compiler-owned and application-owned scripts execute. The opaque sandbox cannot access the host.
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-downloads`,
  });
  res.end(html);
}
