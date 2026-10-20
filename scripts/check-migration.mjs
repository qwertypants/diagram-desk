import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(join(root, 'catalog/index.json'), 'utf8'));
const legacyIds = JSON.parse(readFileSync(join(root, 'src/legacy-ids.json'), 'utf8'));
const fail = message => { throw new Error(message); };
const unique = values => new Set(values).size === values.length;

const articleNames = readdirSync(join(root, 'src/content/articles')).filter(name => name.endsWith('.mdx')).map(name => name.slice(0, -4));
if (catalog.length !== articleNames.length || !catalog.every(item => articleNames.includes(item.slug))) {
  fail('Catalog entries and MDX article files differ');
}
if (Object.keys(legacyIds).length !== 18) fail(`Expected 18 legacy UUID routes, found ${Object.keys(legacyIds).length}`);
if (!unique(catalog.map(item => item.slug))) fail('Catalog slugs are not unique');

for (const item of catalog) {
  const source = readFileSync(join(root, 'catalog', item.file), 'utf8');
  const candidate = JSON.parse(source);
  if (candidate.diagram_type !== item.type || candidate.meta?.title !== item.title) {
    fail(`Catalog and Archify source disagree for ${item.slug}`);
  }
  const articlePath = join(root, 'src/content/articles', `${item.slug}.mdx`);
  if (!existsSync(articlePath)) fail(`Missing article: ${item.slug}`);
  const article = readFileSync(articlePath, 'utf8');
  const required = [item.title, item.lesson.summary, item.lesson.problem,
    ...item.lesson.objectives, ...item.lesson.walkthrough.flatMap(step => [step.title, step.detail]),
    ...item.lesson.decisions, ...item.lesson.failureModes, ...item.lesson.takeaways,
    item.lesson.scope, ...item.lesson.references.flatMap(ref => [ref.title, ref.url])];
  for (const text of required) {
    if (!article.includes(text)) fail(`Article ${item.slug} is missing catalog text: ${text.slice(0, 80)}`);
  }
  if (!article.includes(`diagram: "${item.slug}"`)) fail(`Article ${item.slug} has the wrong diagram`);
  for (const original of item.original) {
    if (legacyIds[original.id] !== item.slug || !article.includes(original.id)) {
      fail(`Legacy ID ${original.id} does not lead to ${item.slug}`);
    }
  }
}

for (const [id, slug] of Object.entries(legacyIds)) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) fail(`Invalid legacy UUID: ${id}`);
  const item = catalog.find(row => row.slug === slug);
  if (!item) fail(`Legacy ID ${id} points to missing article ${slug}`);
  if (!readFileSync(join(root, 'src/content/articles', `${slug}.mdx`), 'utf8').includes(id)) {
    fail(`Article ${slug} is missing legacy ID ${id}`);
  }
}

console.log(`Content parity: ${catalog.length} articles and ${Object.keys(legacyIds).length} legacy routes match the catalog.`);
