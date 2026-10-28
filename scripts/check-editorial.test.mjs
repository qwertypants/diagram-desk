import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkEditorial } from './check-editorial.mjs';

function fixture(t, overrides = {}, body = 'An explanation.\n\n## Sources\n\n- [One](https://example.com/one)\n- [Two](https://example.com/two)\n') {
  const root = mkdtempSync(join(tmpdir(), 'diagram-editorial-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src/content/articles'), { recursive: true });
  const data = {
    title: 'Example',
    description: 'An example article.',
    pubDate: '2026-10-28',
    topic: 'AI systems',
    tags: ['agents'],
    difficulty: 'intermediate',
    objectives: ['Explain the example.'],
    takeaways: ['The example is illustrative.'],
    diagram: 'example',
    legacyIds: [],
    ...overrides,
  };
  const frontmatter = Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
  writeFileSync(join(root, 'src/content/articles/example.mdx'), `---\n${frontmatter}\n---\n\n${body}`);
  return root;
}

test('accepts an article with sources and valid review metadata', t => {
  const root = fixture(t, { reviewed: '2026-10-28', reviewBy: '2027-04-28' });
  assert.deepEqual(checkEditorial(root), { articles: 1, warnings: [] });
});

test('rejects an article without a Sources section', t => {
  const root = fixture(t, {}, 'An explanation without a source list.\n');
  assert.throws(() => checkEditorial(root), /missing "## Sources" section/);
});

test('rejects research articles with fewer than two dated sources', t => {
  const root = fixture(t, { tags: ['research'] }, 'An explanation.\n\n## Sources\n\n- [One](https://example.com/one)\n');
  assert.throws(() => checkEditorial(root), /at least two sources/);
  assert.throws(() => checkEditorial(root), /need a publication date/);
});

test('rejects placeholder text and broken related links', t => {
  const root = fixture(t, { related: ['missing-article'] }, 'TODO: finish this.\n\n## Sources\n\n- [One](https://example.com/one)\n');
  assert.throws(() => checkEditorial(root), /placeholder text remains/);
  assert.throws(() => checkEditorial(root), /related article does not exist: missing-article/);
});

test('rejects incomplete review metadata', t => {
  const incomplete = fixture(t, { reviewed: '2026-10-28' });
  assert.throws(() => checkEditorial(incomplete), /reviewed and reviewBy must be set together/);

  const reversed = fixture(t, { reviewed: '2026-10-28', reviewBy: '2026-10-01' });
  assert.throws(() => checkEditorial(reversed), /reviewBy must be later than reviewed/);
});

test('warns but does not fail when a review is overdue', t => {
  const root = fixture(t, { reviewed: '2025-01-01', reviewBy: '2025-07-01' });
  const result = checkEditorial(root);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /review overdue since 2025-07-01/);
});
