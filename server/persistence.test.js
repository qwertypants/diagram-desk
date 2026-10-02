import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  createWorkspace,
  postDiagram,
  readStoredDiagram,
  request,
  startTestServer,
} from './harness.js';

const workspace = createWorkspace();
const servers = [];

before(async () => {
  servers.push(await startTestServer(workspace));
});

after(async () => {
  await Promise.all(servers.map((server) => server.close()));
  workspace.cleanup();
});

async function restartServer() {
  await servers.at(-1).close();
  servers.push(await startTestServer(workspace));
  return servers.at(-1);
}

test('a write is committed before the response is sent', async () => {
  const { origin } = servers[0];

  const created = (await postDiagram(origin, { title: 'Order flow' })).body;

  const stored = readStoredDiagram(workspace, created.id);
  assert.deepEqual(stored, {
    id: created.id,
    title: 'Order flow',
    source: created.source,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  });
});

test('a diagram survives a server restart on both read endpoints', async () => {
  const { origin } = servers[0];
  const created = (await postDiagram(origin, { title: 'Payment flow', source: 'flowchart LR\n  X --> Y' })).body;

  const restarted = await restartServer();

  const list = await request(restarted.origin, 'GET', '/api/diagrams');
  assert.equal(list.status, 200);
  assert.ok(
    list.body.diagrams.some((diagram) => diagram.id === created.id),
    'the diagram must still be listed',
  );

  const fetched = await request(restarted.origin, 'GET', `/api/diagrams/${created.id}`);
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body, created);
});

test('search still matches and updates still work after a restart', async () => {
  const { origin } = servers.at(-1);
  const created = (await postDiagram(origin, { title: 'Payment flow' })).body;

  const found = await request(origin, 'GET', '/api/diagrams?q=PAYMENT');
  assert.equal(found.status, 200);
  assert.ok(found.body.diagrams.some((diagram) => diagram.id === created.id));

  const restarted = await restartServer();
  const updated = await request(restarted.origin, 'PUT', `/api/diagrams/${created.id}`, {
    body: JSON.stringify({ title: 'Payment flow v2', source: 'flowchart LR\n  X --> Z' }),
    headers: { 'content-type': 'application/json' },
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'Payment flow v2');
  assert.equal(updated.body.createdAt, created.createdAt);
});

test('a fresh workspace creates its database file and schema on first start', async () => {
  const fresh = createWorkspace();
  try {
    const server = await startTestServer(fresh);
    const created = await postDiagram(server.origin, { title: 'First diagram' });

    assert.equal(created.status, 201);
    assert.deepEqual(readStoredDiagram(fresh, created.body.id), {
      id: created.body.id,
      title: 'First diagram',
      source: created.body.source,
      createdAt: created.body.createdAt,
      updatedAt: created.body.updatedAt,
    });

    await server.close();
  } finally {
    fresh.cleanup();
  }
});
