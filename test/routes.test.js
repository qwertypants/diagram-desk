import test from 'node:test';
import assert from 'node:assert/strict';

import { VIEW, composePath, diagramPath, editPath, libraryPath, parsePath } from '../src/routes.js';

test('parsePath maps the library and compose routes', () => {
  assert.deepEqual(parsePath('/'), { view: VIEW.LIBRARY });
  assert.deepEqual(parsePath(''), { view: VIEW.LIBRARY });
  assert.deepEqual(parsePath(null), { view: VIEW.LIBRARY });
  assert.deepEqual(parsePath('/new'), { view: VIEW.COMPOSE });
  assert.deepEqual(parsePath('new'), { view: VIEW.COMPOSE });
});

test('parsePath maps a diagram and its editor, tolerating a trailing slash', () => {
  assert.deepEqual(parsePath('/diagrams/abc'), { view: VIEW.DIAGRAM, id: 'abc' });
  assert.deepEqual(parsePath('/diagrams/abc/'), { view: VIEW.DIAGRAM, id: 'abc' });
  assert.deepEqual(parsePath('/diagrams/abc/edit'), { view: VIEW.EDIT, id: 'abc' });
  assert.deepEqual(parsePath('/diagrams/abc/edit/'), { view: VIEW.EDIT, id: 'abc' });
});

test('parsePath decodes the id and survives odd characters', () => {
  assert.deepEqual(parsePath('/diagrams/a%2Fb'), { view: VIEW.DIAGRAM, id: 'a/b' });
  assert.deepEqual(parsePath('/diagrams/%E2%9C%93'), { view: VIEW.DIAGRAM, id: '✓' });
  assert.deepEqual(parsePath('/diagrams/%'), { view: VIEW.NOT_FOUND });
});

test('parsePath reports unknown paths instead of guessing a diagram', () => {
  for (const path of ['/diagrams', '/diagrams/', '/diagrams//', '/diagrams/a/b/c', '/nope', '/new/edit']) {
    assert.deepEqual(parsePath(path), { view: VIEW.NOT_FOUND }, path);
  }
});

test('path builders round-trip through parsePath', () => {
  for (const id of ['0f1c2d3e-4a5b', 'a b', 'a/b', '✓', 'x#y']) {
    assert.deepEqual(parsePath(diagramPath(id)), { view: VIEW.DIAGRAM, id });
    assert.deepEqual(parsePath(editPath(id)), { view: VIEW.EDIT, id });
  }
  assert.deepEqual(parsePath(libraryPath()), { view: VIEW.LIBRARY });
  assert.deepEqual(parsePath(composePath()), { view: VIEW.COMPOSE });
});

test('path builders keep ids inside a single path segment', () => {
  assert.equal(diagramPath('a/b'), '/diagrams/a%2Fb');
  assert.equal(editPath('a/b'), '/diagrams/a%2Fb/edit');
});
