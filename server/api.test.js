import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createWorkspace,
  delay,
  deleteEveryDiagram,
  isTimestamp,
  isUuid,
  listDiagrams,
  postDiagram,
  request,
  seedDiagram,
  startTestServer,
} from './harness.js';

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

test('POST /api/diagrams returns 201 with a server generated id and equal timestamps', async () => {
  const response = await postDiagram(origin, { title: 'Order flow', source: 'flowchart TD\n  A --> B' });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(Object.keys(response.body).sort(), [
    'createdAt',
    'id',
    'source',
    'title',
    'updatedAt',
  ]);
  assert.equal(response.body.title, 'Order flow');
  assert.equal(response.body.source, 'flowchart TD\n  A --> B');
  assert.ok(isUuid(response.body.id), `expected a UUID id, got ${response.body.id}`);
  assert.ok(isTimestamp(response.body.createdAt), `bad createdAt ${response.body.createdAt}`);
  assert.ok(isTimestamp(response.body.updatedAt), `bad updatedAt ${response.body.updatedAt}`);
  assert.equal(response.body.createdAt, response.body.updatedAt);
});

test('GET /api/diagrams wraps the stored diagrams in a diagrams key', async () => {
  const created = (await postDiagram(origin, { title: 'Alpha' })).body;

  const response = await request(origin, 'GET', '/api/diagrams');

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body), ['diagrams']);
  assert.deepEqual(response.body.diagrams, [created]);
});

test('q matches titles case-insensitively', async () => {
  await postDiagram(origin, { title: 'Order flow', source: 'sequenceDiagram\n  Bob -> Alice' });
  await postDiagram(origin, { title: 'Class layout', source: 'flowchart TD\n  A --> B' });

  const expectations = [
    ['order', ['Order flow']],
    ['ORDER', ['Order flow']],
    ['Order', ['Order flow']],
    ['Flow', ['Order flow']],
    ['class', ['Class layout']],
  ];

  for (const [term, expectedTitles] of expectations) {
    const response = await request(origin, 'GET', `/api/diagrams?q=${term}`);
    assert.equal(response.status, 200, `q=${term}`);
    assert.deepEqual(
      response.body.diagrams.map((diagram) => diagram.title),
      expectedTitles,
      `q=${term}`,
    );
  }

  const padded = await request(origin, 'GET', '/api/diagrams?q=%20Order%20');
  assert.deepEqual(
    padded.body.diagrams.map((diagram) => diagram.title),
    ['Order flow'],
    'q is trimmed',
  );
});

test('q does not match on source', async () => {
  await postDiagram(origin, { title: 'Alpha', source: 'sequenceDiagram\n  Bob -> Alice' });

  const response = await request(origin, 'GET', '/api/diagrams?q=bob');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.diagrams, []);
});

test('blank or absent q returns every diagram', async () => {
  await postDiagram(origin, { title: 'Alpha' });
  await postDiagram(origin, { title: 'Beta' });

  for (const path of ['/api/diagrams', '/api/diagrams?q=', '/api/diagrams?q=%20%20']) {
    const response = await request(origin, 'GET', path);
    assert.equal(response.status, 200, path);
    assert.deepEqual(
      response.body.diagrams.map((diagram) => diagram.title).sort(),
      ['Alpha', 'Beta'],
      path,
    );
  }
});

test('diagrams are ordered by updatedAt descending with title ascending as tiebreak', async () => {
  seedDiagram(workspace, {
    title: 'Beta',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  seedDiagram(workspace, {
    title: 'Alpha',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  seedDiagram(workspace, {
    title: 'Gamma',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  });

  const response = await request(origin, 'GET', '/api/diagrams');

  assert.deepEqual(
    response.body.diagrams.map((diagram) => diagram.title),
    ['Gamma', 'Alpha', 'Beta'],
  );
});

test('ordering also applies to search results', async () => {
  seedDiagram(workspace, {
    title: 'Report Beta',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  seedDiagram(workspace, {
    title: 'Report Alpha',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  });
  seedDiagram(workspace, {
    title: 'Unrelated',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  });

  const response = await request(origin, 'GET', '/api/diagrams?q=report');

  assert.deepEqual(
    response.body.diagrams.map((diagram) => diagram.title),
    ['Report Alpha', 'Report Beta'],
  );
});

test('newly created diagrams sort before older ones by updatedAt', async () => {
  await postDiagram(origin, { title: 'First' });
  await delay(5);
  await postDiagram(origin, { title: 'Second' });

  const diagrams = await listDiagrams(origin);

  assert.deepEqual(
    diagrams.map((diagram) => diagram.title),
    ['Second', 'First'],
  );
});

test('GET /api/diagrams/:id returns the diagram', async () => {
  const created = (await postDiagram(origin, { title: 'Order flow' })).body;

  const response = await request(origin, 'GET', `/api/diagrams/${created.id}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, created);
});

test('GET /api/diagrams/:id returns 404 for an unknown id', async () => {
  const response = await request(origin, 'GET', '/api/diagrams/2b8a1a6f-0000-4000-8000-000000000000');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Diagram not found' });
});

test('GET /api/diagrams/:id returns 404 for a malformed id', async () => {
  for (const id of ['not-a-uuid', '%zz', '12345']) {
    const response = await request(origin, 'GET', `/api/diagrams/${id}`);
    assert.equal(response.status, 404, id);
    assert.deepEqual(response.body, { error: 'Diagram not found' }, id);
  }
});

test('PUT /api/diagrams/:id updates title and source but keeps id and createdAt', async () => {
  const created = (await postDiagram(origin, { title: 'Order flow', source: 'flowchart TD\n  A --> B' })).body;
  await delay(5);

  const response = await request(origin, 'PUT', `/api/diagrams/${created.id}`, {
    body: JSON.stringify({ title: 'Payment flow', source: 'flowchart LR\n  X --> Y' }),
    headers: { 'content-type': 'application/json' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, created.id);
  assert.equal(response.body.title, 'Payment flow');
  assert.equal(response.body.source, 'flowchart LR\n  X --> Y');
  assert.equal(response.body.createdAt, created.createdAt);
  assert.notEqual(response.body.updatedAt, created.updatedAt);
  assert.ok(Date.parse(response.body.updatedAt) > Date.parse(created.updatedAt));

  const fetched = await request(origin, 'GET', `/api/diagrams/${created.id}`);
  assert.deepEqual(fetched.body, response.body);
});

test('PUT /api/diagrams/:id returns 404 for an unknown id', async () => {
  const response = await request(origin, 'PUT', '/api/diagrams/2b8a1a6f-0000-4000-8000-000000000000', {
    body: JSON.stringify({ title: 'Anything', source: 'flowchart TD\n  A --> B' }),
    headers: { 'content-type': 'application/json' },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Diagram not found' });
});

test('PUT /api/diagrams/:id requires both title and source', async () => {
  const created = (await postDiagram(origin, { title: 'Order flow' })).body;

  const response = await request(origin, 'PUT', `/api/diagrams/${created.id}`, {
    body: JSON.stringify({ title: 'Only a title' }),
    headers: { 'content-type': 'application/json' },
  });

  assert.equal(response.status, 400);
  assert.equal(typeof response.body.error, 'string');

  const unchanged = await request(origin, 'GET', `/api/diagrams/${created.id}`);
  assert.deepEqual(unchanged.body, created);
});

test('DELETE /api/diagrams/:id returns 204 with no body and removes the diagram', async () => {
  const kept = (await postDiagram(origin, { title: 'Kept' })).body;
  const removed = (await postDiagram(origin, { title: 'Removed' })).body;

  const response = await request(origin, 'DELETE', `/api/diagrams/${removed.id}`);

  assert.equal(response.status, 204);
  assert.equal(response.text, '');
  assert.equal(response.body, null);

  const diagrams = await listDiagrams(origin);
  assert.deepEqual(
    diagrams.map((diagram) => diagram.id),
    [kept.id],
  );
  assert.equal((await request(origin, 'GET', `/api/diagrams/${removed.id}`)).status, 404);
});

test('deleting the same diagram twice returns 404 the second time', async () => {
  const created = (await postDiagram(origin, { title: 'Order flow' })).body;

  assert.equal((await request(origin, 'DELETE', `/api/diagrams/${created.id}`)).status, 204);
  assert.equal((await request(origin, 'DELETE', `/api/diagrams/${created.id}`)).status, 404);
});

test('DELETE /api/diagrams/:id returns 404 for an unknown id', async () => {
  const response = await request(origin, 'DELETE', '/api/diagrams/2b8a1a6f-0000-4000-8000-000000000000');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Diagram not found' });
});

test('unsupported methods on /api/diagrams return 405', async () => {
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const response = await request(origin, method, '/api/diagrams');
    assert.equal(response.status, 405, method);
    assert.deepEqual(response.body, { error: 'Method not allowed' }, method);
    assert.equal(response.headers.get('allow'), 'GET, POST', method);
  }
});

test('unsupported methods on /api/diagrams/:id return 405', async () => {
  const created = (await postDiagram(origin, { title: 'Order flow' })).body;

  for (const method of ['POST', 'PATCH']) {
    const response = await request(origin, method, `/api/diagrams/${created.id}`, {
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(response.status, 405, method);
    assert.deepEqual(response.body, { error: 'Method not allowed' }, method);
    assert.equal(response.headers.get('allow'), 'GET, PUT, DELETE', method);
  }

  assert.equal((await request(origin, 'GET', `/api/diagrams/${created.id}`)).status, 200);
});

test('unknown /api paths return 404 with the documented body', async () => {
  for (const path of ['/api', '/api/', '/api/nope', '/api/diagrams/extra/segments', '/api/diagrams/']) {
    const response = await request(origin, 'GET', path);
    assert.equal(response.status, 404, path);
    assert.deepEqual(response.body, { error: 'Not found' }, path);
  }
});
