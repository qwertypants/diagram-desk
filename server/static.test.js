import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorkspace, request, startTestServer } from './harness.js';

const INDEX_HTML = '<!doctype html><html><body><div id="app"></div></body></html>';
const APP_JS = 'console.log("mermaid-library");';
const STYLE_CSS = 'body { margin: 0; }';

const workspace = createWorkspace();
let server;

before(async () => {
  workspace.writeDistFile('index.html', INDEX_HTML);
  workspace.writeDistFile('assets/app.js', APP_JS);
  workspace.writeDistFile('assets/app.css', STYLE_CSS);
  server = await startTestServer(workspace);
});

after(async () => {
  await server.close();
  workspace.cleanup();
});

test('a file that exists in dist is served with its content type', async () => {
  const response = await fetch(new URL('/assets/app.js', server.origin));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(await response.text(), APP_JS);
});

test('the site index is served at the root', async () => {
  const response = await fetch(new URL('/', server.origin));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await response.text(), INDEX_HTML);
});

test('a stylesheet is served from a nested directory', async () => {
  const response = await fetch(new URL('/assets/app.css', server.origin));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal(await response.text(), STYLE_CSS);
});

test('a deep link falls back to the site index', async () => {
  for (const path of ['/diagrams/2b8a1a6f-0000-4000-8000-000000000000', '/diagrams', '/anything']) {
    const response = await fetch(new URL(path, server.origin));
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8', path);
    assert.equal(await response.text(), INDEX_HTML, path);
  }
});

test('a missing asset returns the JSON error envelope instead of the index', async () => {
  const response = await request(server.origin, 'GET', '/assets/missing.js');

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(response.body, { error: 'Not found' });
});

test('paths cannot escape the dist directory', async () => {
  for (const path of ['/%2e%2e/package.json', '/assets/%2e%2e%2f%2e%2e/package.json']) {
    const response = await request(server.origin, 'GET', path);
    assert.equal(response.status, 404, path);
    assert.deepEqual(response.body, { error: 'Not found' }, path);
  }

  const escaped = await request(server.origin, 'GET', '/%2e%2e%2f%2e%2e%2fetc/passwd');
  assert.equal(escaped.text, INDEX_HTML, 'an escaped path may only resolve to the site index');
});

test('HEAD returns the headers of the index without a body', async () => {
  const response = await fetch(new URL('/', server.origin), { method: 'HEAD' });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('content-length'), String(Buffer.byteLength(INDEX_HTML)));
  assert.equal(await response.text(), '');
});

test('an unsupported method on a static path returns 405', async () => {
  const response = await request(server.origin, 'POST', '/', { body: 'x', headers: { 'content-type': 'text/plain' } });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  assert.deepEqual(response.body, { error: 'Method not allowed' });
});

test('a missing dist directory returns the JSON error envelope', async () => {
  const empty = createWorkspace();
  try {
    const server = await startTestServer(empty);
    const response = await request(server.origin, 'GET', '/');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'Not found' });

    const api = await request(server.origin, 'GET', '/api/diagrams');
    assert.equal(api.status, 200);

    await server.close();
  } finally {
    empty.cleanup();
  }
});
