import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { installReaderTouch } from './reader-touch.js';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(join(root, 'catalog/index.json'), 'utf8'));
const cli = join(root, 'vendor/archify/bin/archify.mjs');
const outputRoot = join(root, 'public/diagrams');
const allowedTypes = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle', 'erd', 'class', 'tree', 'timeline', 'waterfall']);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const item of catalog) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || !allowedTypes.has(item.type)) {
    throw new Error(`Invalid catalog diagram: ${item.slug}`);
  }
  const source = await readFile(join(root, 'catalog', item.file), 'utf8');
  const candidate = JSON.parse(source);
  if (candidate.diagram_type !== item.type || candidate.meta?.title !== item.title) {
    throw new Error(`Catalog and Archify source disagree for ${item.slug}`);
  }
  const digest = createHash('sha256').update(source).digest('hex');
  const temp = await mkdtemp(join(tmpdir(), 'diagram-desk-static-'));
  try {
    const input = join(temp, 'candidate.json');
    const output = join(temp, 'reader.html');
    candidate.meta.output = 'reader.html';
    await writeFile(input, JSON.stringify(candidate));
    await exec(process.execPath, [cli, 'render', item.type, 'candidate.json', 'reader.html'], {
      cwd: temp,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    let html = await readFile(output, 'utf8');
    if (!html.includes('</head>') || !html.includes('</body>') || !html.includes('Archify')) {
      throw new Error(`Archify did not produce a complete reader for ${item.slug}`);
    }
    html = html.replace('</head>', `<meta name="diagram-source-sha256" content="${digest}">\n<style>@media (pointer: coarse) { .diagram-container.is-pannable { touch-action: none; } }</style>\n</head>`);
    html = html.replace('</body>', `<script>(${installReaderTouch.toString()})();</script>\n</body>`);
    const target = join(outputRoot, item.slug);
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'reader.html'), html);
    console.log(`Rendered /diagrams/${item.slug}/reader.html`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
