import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePort } from './index.js';

test('the port defaults to 4317', () => {
  assert.equal(resolvePort({}), 4317);
  assert.equal(resolvePort({ PORT: '' }), 4317);
  assert.equal(resolvePort({ PORT: 'not a port' }), 4317);
  assert.equal(resolvePort({ PORT: '70000' }), 4317);
  assert.equal(resolvePort({ PORT: '-1' }), 4317);
});

test('PORT overrides the default port', () => {
  assert.equal(resolvePort({ PORT: '8080' }), 8080);
  assert.equal(resolvePort({ PORT: '0' }), 0);
  assert.equal(resolvePort({ PORT: ' 3000 ' }), 3000);
});
