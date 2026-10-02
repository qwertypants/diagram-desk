import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { findRepositoryRoot, openStore, resolveDatabasePath } from './db.js';
import { createWorkspace, delay, isTimestamp, isUuid, readStoredDiagram } from './harness.js';

const SOURCE = 'flowchart TD\n  A --> B';

let scratch;

before(() => {
  scratch = mkdtempSync(join(tmpdir(), 'mermaid-library-paths-'));
});

after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function makeDirectories(...paths) {
  for (const path of paths) mkdirSync(join(scratch, path), { recursive: true });
}

function makePackage(directory) {
  writeFileSync(join(scratch, directory, 'package.json'), '{"name":"fixture"}');
}

function byUpdatedAtThenTitle(left, right) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? 1 : -1;
  if (left.title === right.title) return 0;
  return left.title < right.title ? -1 : 1;
}

test('the repository root is the nearest ancestor holding a package.json', () => {
  makeDirectories('outer/inner/deepest');
  makePackage('outer');

  assert.equal(findRepositoryRoot(join(scratch, 'outer/inner/deepest')), join(scratch, 'outer'));
  assert.equal(findRepositoryRoot(join(scratch, 'outer')), join(scratch, 'outer'));
});

test('the walk stops at the first package.json it finds', () => {
  makeDirectories('outer/inner');
  makePackage('outer/inner');

  assert.equal(findRepositoryRoot(join(scratch, 'outer/inner')), join(scratch, 'outer/inner'));
});

test('a directory without any package.json above it is an error', () => {
  assert.throws(() => findRepositoryRoot('/'), /No package.json found/);
});

test('the default database path is data/diagrams.sqlite under the repository root', () => {
  const expected = join('/repo', 'data', 'diagrams.sqlite');

  assert.equal(resolveDatabasePath({ env: {}, repositoryRoot: '/repo' }), expected);
  assert.equal(resolveDatabasePath({ env: { DIAGRAMS_DB: '   ' }, repositoryRoot: '/repo' }), expected);
});

test('DIAGRAMS_DB overrides the default and is resolved against the repository root', () => {
  assert.equal(
    resolveDatabasePath({ env: { DIAGRAMS_DB: '/tmp/fixed.sqlite' }, repositoryRoot: '/repo' }),
    '/tmp/fixed.sqlite',
  );
  assert.equal(
    resolveDatabasePath({ env: { DIAGRAMS_DB: 'tmp/nested.sqlite' }, repositoryRoot: '/repo' }),
    join('/repo', 'tmp', 'nested.sqlite'),
  );
});

test('the store creates its directory, schema and index on first open', () => {
  const workspace = createWorkspace();
  const store = openStore(workspace.databasePath);

  const diagram = store.create({ title: 'Order flow', source: SOURCE });

  assert.ok(isUuid(diagram.id));
  assert.ok(isTimestamp(diagram.createdAt));
  assert.equal(diagram.createdAt, diagram.updatedAt);
  assert.deepEqual(store.list(), [diagram]);
  assert.deepEqual(store.get(diagram.id), diagram);
  assert.equal(readStoredDiagram(workspace, diagram.id).title, 'Order flow');

  const reopened = openStore(workspace.databasePath);
  assert.deepEqual(reopened.list(), [diagram]);

  reopened.close();
  store.close();
  workspace.cleanup();
});

test('the store orders by updatedAt descending then title ascending', async () => {
  const workspace = createWorkspace();
  const store = openStore(workspace.databasePath);

  const oldest = store.create({ title: 'Oldest', source: SOURCE });
  await delay(5);
  const middle = store.create({ title: 'Middle', source: SOURCE });
  await delay(5);
  const newest = store.create({ title: 'Newest', source: SOURCE });
  await delay(5);
  store.update(middle.id, { title: 'Middle', source: 'flowchart LR\n  A --> B' });

  const listed = store.list();

  assert.deepEqual(
    listed.map((diagram) => diagram.id),
    [middle.id, newest.id, oldest.id],
  );
  assert.deepEqual(listed, [...listed].sort(byUpdatedAtThenTitle));
  assert.deepEqual(store.list('nothing matches this'), []);

  store.close();
  workspace.cleanup();
});

test('title search is case-insensitive for non-ascii titles', () => {
  const workspace = createWorkspace();
  const store = openStore(workspace.databasePath);

  const cafe = store.create({ title: 'CAFÉ Menu', source: SOURCE });
  store.create({ title: 'Diagram', source: SOURCE });

  assert.deepEqual(
    store.list('café').map((diagram) => diagram.id),
    [cafe.id],
  );
  assert.deepEqual(
    store.list('  Café  ').map((diagram) => diagram.id),
    [cafe.id],
  );
  assert.deepEqual(store.list(''), store.list());
  assert.equal(store.list(undefined).length, 2);

  store.close();
  workspace.cleanup();
});

test('the store removes diagrams and reports unknown ids', () => {
  const workspace = createWorkspace();
  const store = openStore(workspace.databasePath);

  const diagram = store.create({ title: 'Order flow', source: SOURCE });

  assert.equal(store.remove(diagram.id), true);
  assert.equal(store.remove(diagram.id), false);
  assert.equal(store.get(diagram.id), null);
  assert.deepEqual(store.list(), []);

  store.close();
  workspace.cleanup();
});

test('updating an unknown id returns null and an update keeps createdAt', () => {
  const workspace = createWorkspace();
  const store = openStore(workspace.databasePath);

  const diagram = store.create({ title: 'Order flow', source: SOURCE });
  const updated = store.update(diagram.id, { title: 'Payment flow', source: 'flowchart LR\n  X --> Y' });

  assert.equal(store.update('missing-id', { title: 'x', source: 'y' }), null);
  assert.equal(updated.createdAt, diagram.createdAt);
  assert.notEqual(updated.title, diagram.title);

  store.close();
  workspace.cleanup();
});
