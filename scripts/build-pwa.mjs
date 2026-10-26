import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizeBase(value = '/') {
  const segments = value.split('/').filter(Boolean);
  if (segments.some(segment => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
    throw new Error(`Invalid PWA deployment base: ${value}`);
  }
  return `/${segments.length ? `${segments.join('/')}/` : ''}`;
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function* files(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.isFile()) yield path;
    else throw new Error(`Unsupported build entry: ${path}`);
  }
}

export async function buildPwa({ root = resolve(import.meta.dirname, '..'), base = process.env.BASE_PATH || '/', maxBytes = 30 * 1024 * 1024 } = {}) {
  base = normalizeBase(base);
  const dist = join(root, 'dist');
  const catalog = JSON.parse(await readFile(join(root, 'catalog/index.json'), 'utf8'));
  for (const item of catalog) {
    const target = join(dist, 'diagrams', item.slug);
    await mkdir(target, { recursive: true });
    await copyFile(join(root, 'catalog', item.file), join(target, 'diagram.json'));
  }
  const entries = [];
  for await (const file of files(dist)) {
    const path = relative(dist, file).split('\\').join('/');
    if (path === 'sw.js') continue;
    const bytes = await readFile(file);
    if (bytes.length > 5 * 1024 * 1024) throw new Error(`PWA file exceeds 5 MiB: ${path}`);
    const url = base + path.split('/').map(encodeURIComponent).join('/').replace(/(^|\/)index\.html$/, '$1');
    entries.push({ url, sha256: digest(bytes), bytes: bytes.length });
  }
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes > maxBytes) throw new Error(`PWA library exceeds cache budget: ${totalBytes} > ${maxBytes} bytes. Review the offline strategy before growing the budget.`);
  if (!entries.some(entry => entry.url === base)) throw new Error('PWA build needs a home page');
  const template = await readFile(join(root, 'scripts/pwa-worker.js'), 'utf8');
  const version = digest(JSON.stringify({ base, entries, template })).slice(0, 20);
  const config = { base, version, entries, totalBytes };
  await writeFile(join(dist, 'sw.js'), template.replace('/* BUILD_CONFIG */ {}', JSON.stringify(config)));
  console.log(`PWA ${base}: ${entries.length} files, ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB), version ${version}`);
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildPwa();
