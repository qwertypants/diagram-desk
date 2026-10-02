import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createWorkspace,
  deleteEveryDiagram,
  isUuid,
  postDiagram,
  request,
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

function json(body) {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  };
}

async function listTitles() {
  const response = await request(origin, 'GET', '/api/diagrams');
  return response.body.diagrams.map((diagram) => diagram.title);
}

async function assertBadRequest(response, expectedError, expectedTitles = []) {
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(Object.keys(response.body), ['error']);
  assert.equal(response.body.error, expectedError);
  assert.deepEqual(await listTitles(), expectedTitles, 'a rejected body must not be stored');
}

test('malformed and empty JSON bodies are rejected', async () => {
  for (const body of ['{ "title": "Broken"', '', 'not json at all']) {
    await assertBadRequest(
      await request(origin, 'POST', '/api/diagrams', json(body)),
      'Request body must be valid JSON',
    );
  }
});

test('a body that is not a JSON object is rejected', async () => {
  for (const body of ['[]', '["Order flow"]', '"Order flow"', '42', 'null', 'true']) {
    await assertBadRequest(
      await request(origin, 'POST', '/api/diagrams', json(body)),
      'Request body must be a JSON object',
    );
  }
});

test('an invalid title is rejected', async () => {
  const cases = [
    [{ source: SOURCE }, 'title is required'],
    [{ title: null, source: SOURCE }, 'title is required'],
    [{ title: '', source: SOURCE }, 'title must not be blank'],
    [{ title: '   \n\t ', source: SOURCE }, 'title must not be blank'],
    [{ title: 42, source: SOURCE }, 'title must be a string'],
    [{ title: ['Order flow'], source: SOURCE }, 'title must be a string'],
    [{ title: { name: 'Order flow' }, source: SOURCE }, 'title must be a string'],
    [{ title: 'x'.repeat(201), source: SOURCE }, 'title must be at most 200 characters'],
  ];

  for (const [body, expectedError] of cases) {
    await assertBadRequest(await request(origin, 'POST', '/api/diagrams', json(body)), expectedError);
  }
});

test('an invalid source is rejected', async () => {
  const cases = [
    [{ title: 'Order flow' }, 'source is required'],
    [{ title: 'Order flow', source: null }, 'source is required'],
    [{ title: 'Order flow', source: '' }, 'source must not be blank'],
    [{ title: 'Order flow', source: '\n \t ' }, 'source must not be blank'],
    [{ title: 'Order flow', source: 7 }, 'source must be a string'],
    [{ title: 'Order flow', source: ['flowchart'] }, 'source must be a string'],
    [
      { title: 'Order flow', source: 'x'.repeat(100001) },
      'source must be at most 100000 characters',
    ],
  ];

  for (const [body, expectedError] of cases) {
    await assertBadRequest(await request(origin, 'POST', '/api/diagrams', json(body)), expectedError);
  }
});

test('boundary lengths are accepted and measured after trimming', async () => {
  const title = 't'.repeat(200);
  const source = 's'.repeat(100000);

  const response = await postDiagram(origin, { title: `${title}\n`, source });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, `${title}\n`);
  assert.equal(response.body.source, source);
});

test('unknown extra fields are ignored', async () => {
  const response = await postDiagram(origin, {
    title: 'Order flow',
    source: SOURCE,
    extra: { id: 'not-my-id', createdAt: '2000-01-01T00:00:00.000Z', nested: { a: 1 } },
  });

  assert.equal(response.status, 201);
  assert.ok(isUuid(response.body.id));
  assert.notEqual(response.body.createdAt, '2000-01-01T00:00:00.000Z');
  assert.deepEqual(Object.keys(response.body).sort(), [
    'createdAt',
    'id',
    'source',
    'title',
    'updatedAt',
  ]);
});

test('PUT validates its body the same way as POST', async () => {
  const created = (await postDiagram(origin, { title: 'Order flow', source: SOURCE })).body;
  const path = `/api/diagrams/${created.id}`;
  const cases = [
    ['{oops', 'Request body must be valid JSON'],
    [JSON.stringify({ title: 'New title' }), 'source is required'],
    [JSON.stringify({ title: '', source: SOURCE }), 'title must not be blank'],
    [JSON.stringify({ title: 'New title', source: 'x'.repeat(100001) }), 'source must be at most 100000 characters'],
  ];

  for (const [body, expectedError] of cases) {
    await assertBadRequest(
      await request(origin, 'PUT', path, json(body)),
      expectedError,
      ['Order flow'],
    );
  }
});

test('an oversized body is rejected', async () => {
  const response = await request(
    origin,
    'POST',
    '/api/diagrams',
    json(JSON.stringify({ title: 'Order flow', source: 'x'.repeat(5 * 1024 * 1024) })),
  );

  await assertBadRequest(response, 'Request body is too large');
});

test('source and title are stored exactly as submitted', async () => {
  const source = '  flowchart TD\n\n    A[Start]   -->   B[End]\n\n  %% trailing comment\n';

  const created = await postDiagram(origin, { title: '  Order flow  ', source });

  assert.equal(created.status, 201);
  assert.equal(created.body.title, '  Order flow  ');
  assert.equal(created.body.source, source);
  assert.equal((await request(origin, 'GET', `/api/diagrams/${created.body.id}`)).body.source, source);
  assert.deepEqual(await listTitles(), ['  Order flow  ']);
});
