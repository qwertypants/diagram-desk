import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { checkContent } from './check-migration.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'diagram-content-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['catalog/diagrams', 'src/content/articles', 'src/content/companions']) mkdirSync(join(root, directory), { recursive: true });
  const ids = Array.from({ length: 18 }, (_, i) => `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const write = (path, data) => writeFileSync(join(root, path), data);
  const mdx = data => `---\n${stringify(data)}---\n\nA freshly written explanation.\n`;
  write('catalog/index.json', JSON.stringify([{ slug: 'example', title: 'Example', type: 'workflow', file: 'diagrams/example.json', original: ids.map(id => ({ id })), lesson: { summary: 'Historical wording that is no longer required.' } }]));
  write('catalog/diagrams/example.json', JSON.stringify({ diagram_type: 'workflow', meta: { title: 'Example' } }));
  write('src/legacy-ids.json', JSON.stringify(Object.fromEntries(ids.map(id => [id, 'example']))));
  write('src/content/articles/example.mdx', mdx({ title: 'Example', diagram: 'example', legacyIds: ids }));
  write('src/content/companions/example.mdx', mdx({ title: 'What happens here?', description: 'An independent short explanation.', diagram: 'example' }));
  return { root, write, mdx };
}

test('accepts fresh editorial wording while preserving chart and legacy relationships', t => {
  const { root } = fixture(t);
  assert.deepEqual(checkContent(root), { articles: 1, companions: 1, legacyRoutes: 18 });
});

test('rejects a companion that points to a different diagram', t => {
  const { root, write, mdx } = fixture(t);
  write('src/content/companions/example.mdx', mdx({ title: 'Question', description: 'Answer', diagram: 'wrong-diagram' }));
  assert.throws(() => checkContent(root), /Companion example has the wrong diagram: wrong-diagram/);
});

test('rejects orphan companions', t => {
  const { root, write, mdx } = fixture(t);
  write('src/content/companions/orphan.mdx', mdx({ title: 'Question', description: 'Answer', diagram: 'orphan' }));
  assert.throws(() => checkContent(root), /Orphan companion: orphan/);
});

test('requires a companion for every catalog topic', t => {
  const { root } = fixture(t);
  rmSync(join(root, 'src/content/companions/example.mdx'));
  assert.throws(() => checkContent(root), /Missing companion coverage: example/);
});

test('rejects catalog/diagram disagreement and broken legacy mapping', t => {
  const { root, write } = fixture(t);
  write('catalog/diagrams/example.json', JSON.stringify({ diagram_type: 'sequence', meta: { title: 'Example' } }));
  assert.throws(() => checkContent(root), /Catalog and Archify source disagree for example/);
  write('catalog/diagrams/example.json', JSON.stringify({ diagram_type: 'workflow', meta: { title: 'Example' } }));
  write('src/legacy-ids.json', '{}');
  assert.throws(() => checkContent(root), /Expected 18 legacy UUID routes/);
});
