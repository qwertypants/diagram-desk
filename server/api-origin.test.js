import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createWorkspace,
  deleteEveryDiagram,
  postDiagram,
  readStoredDiagram,
  request,
  seedDiagram,
  startTestServer,
} from './harness.js';

const SOURCE = 'flowchart TD\n  A --> B';

const workspace = createWorkspace();
let server;
let origin;

before(async () => {
  server = await startTestServer(workspace);
  origin = server.origin;
});

after(async () => {
  await server.close();
  workspace.cleanup();
});

beforeEach(async () => {
  await deleteEveryDiagram(origin);
});

/** A body another page can send without a preflight, with the JSON the API
 *  would otherwise accept. */
function simplePost(body, { origin: originHeader = 'https://evil.example', contentType = 'text/plain' } = {}) {
  const headers = { origin: originHeader };
  if (contentType !== null) headers['content-type'] = contentType;
  return request(origin, 'POST', '/api/diagrams', { body, headers });
}

async function assertRefused(response) {
  assert.equal(response.status, 415);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(response.body, { error: 'Request body must be application/json' });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const list = await request(origin, 'GET', '/api/diagrams');
  assert.deepEqual(list.body.diagrams, [], 'a refused write must not store anything');
}

test('a no-preflight cross-origin POST cannot write to the library', async () => {
  const response = await simplePost(JSON.stringify({ title: 'Injected', source: SOURCE }));

  await assertRefused(response);
});

test('every non-JSON content type a simple request can use is refused', async () => {
  const types = ['text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data'];

  for (const contentType of types) {
    await assertRefused(
      await simplePost(JSON.stringify({ title: 'Injected', source: SOURCE }), { contentType }),
    );
  }
});

test('a POST with no content type at all is refused', async () => {
  await assertRefused(await simplePost(JSON.stringify({ title: 'Injected', source: SOURCE }), { contentType: null }));
});

test('the same-origin POST the app makes is still accepted', async () => {
  const response = await postDiagram(origin, { title: 'Order flow', source: SOURCE });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, 'Order flow');

  const withCharset = await request(origin, 'POST', '/api/diagrams', {
    body: JSON.stringify({ title: 'Charset', source: SOURCE }),
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  assert.equal(withCharset.status, 201);
});

test('a no-preflight cross-origin PUT cannot change a saved diagram', async () => {
  const id = seedDiagram(workspace, {
    title: 'Order flow',
    source: SOURCE,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const response = await request(origin, 'PUT', `/api/diagrams/${id}`, {
    body: JSON.stringify({ title: 'Rewritten', source: 'graph TD\n X --> Y' }),
    headers: { 'content-type': 'text/plain', origin: 'https://evil.example' },
  });

  assert.equal(response.status, 415);
  assert.deepEqual(response.body, { error: 'Request body must be application/json' });
  assert.equal(readStoredDiagram(workspace, id).title, 'Order flow');
  assert.equal(readStoredDiagram(workspace, id).source, SOURCE);
});

test('the media type is checked before the diagram is looked up', async () => {
  const response = await request(origin, 'PUT', '/api/diagrams/2b8a1a6f-0000-4000-8000-000000000000', {
    body: JSON.stringify({ title: 'Rewritten', source: SOURCE }),
    headers: { 'content-type': 'text/plain' },
  });

  assert.equal(response.status, 415);
  assert.deepEqual(response.body, { error: 'Request body must be application/json' });
  assert.deepEqual((await request(origin, 'GET', '/api/diagrams')).body.diagrams, []);
});
