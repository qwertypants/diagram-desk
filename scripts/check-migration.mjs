import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(join(root, 'catalog/index.json'), 'utf8'));
const legacyIds = JSON.parse(readFileSync(join(root, 'src/legacy-ids.json'), 'utf8'));
const fail = message => { throw new Error(message); };
const unique = values => new Set(values).size === values.length;
const companionRoot = join(root, 'src/content/companions');
const companionNames = existsSync(companionRoot) ? readdirSync(companionRoot).filter(name => name.endsWith('.mdx')).map(name => name.slice(0, -4)) : [];
const metadata = path => {
  const source = readFileSync(path, 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) fail(`Missing frontmatter: ${path}`);
  return parse(frontmatter[1]);
};

const articleNames = readdirSync(join(root, 'src/content/articles')).filter(name => name.endsWith('.mdx')).map(name => name.slice(0, -4));
if (catalog.length !== articleNames.length || !catalog.every(item => articleNames.includes(item.slug))) {
  fail('Catalog entries and MDX article files differ');
}
if (Object.keys(legacyIds).length !== 18) fail(`Expected 18 legacy UUID routes, found ${Object.keys(legacyIds).length}`);
if (!unique(catalog.map(item => item.slug))) fail('Catalog slugs are not unique');
for (const slug of companionNames) {
  if (!articleNames.includes(slug) || !catalog.some(item => item.slug === slug)) fail(`Orphan companion: ${slug}`);
  const data = metadata(join(companionRoot, `${slug}.mdx`));
  if (data.diagram !== slug) fail(`Companion ${slug} has the wrong diagram: ${data.diagram}`);
  for (const field of ['title', 'description']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) fail(`Companion ${slug} needs ${field}`);
  }
}

for (const item of catalog) {
  const source = readFileSync(join(root, 'catalog', item.file), 'utf8');
  const candidate = JSON.parse(source);
  if (candidate.diagram_type !== item.type || candidate.meta?.title !== item.title) {
    fail(`Catalog and Archify source disagree for ${item.slug}`);
  }
  const articlePath = join(root, 'src/content/articles', `${item.slug}.mdx`);
  if (!existsSync(articlePath)) fail(`Missing article: ${item.slug}`);
  const article = metadata(articlePath);
  if (article.title !== item.title) fail(`Article ${item.slug} title differs from catalog`);
  if (article.diagram !== item.slug) fail(`Article ${item.slug} has the wrong diagram`);
  if (!Array.isArray(article.legacyIds)) fail(`Article ${item.slug} needs legacyIds`);
  for (const original of item.original) {
    if (legacyIds[original.id] !== item.slug || !article.legacyIds.includes(original.id)) {
      fail(`Legacy ID ${original.id} does not lead to ${item.slug}`);
    }
  }
}

for (const [id, slug] of Object.entries(legacyIds)) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) fail(`Invalid legacy UUID: ${id}`);
  const item = catalog.find(row => row.slug === slug);
  if (!item) fail(`Legacy ID ${id} points to missing article ${slug}`);
  if (!metadata(join(root, 'src/content/articles', `${slug}.mdx`)).legacyIds.includes(id)) {
    fail(`Article ${slug} is missing legacy ID ${id}`);
  }
}

console.log(`Content relationships: ${catalog.length} articles, ${companionNames.length} companions, and ${Object.keys(legacyIds).length} legacy routes match the catalog.`);
