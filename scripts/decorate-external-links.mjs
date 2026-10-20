import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decorateExternalLinks } from './external-links.mjs';

const root = new URL('../dist/', import.meta.url);
const siteUrl = process.env.SITE_URL ?? 'http://localhost:4321';

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
      await writeFile(path, decorateExternalLinks(html, siteUrl));
    }
  }
}

await visit(root.pathname);
