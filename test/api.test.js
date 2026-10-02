import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError, createApiClient, mapDiagram } from '../src/api.js';

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return payload === undefined ? '' : JSON.stringify(payload);
    },
  };
}

function stub(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, fetch: fetchImpl };
}

const DIAGRAM = {
  id: '0f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
  title: 'Order flow',
  source: 'flowchart TD\n  A[Start] --> B[End]',
  createdAt: '2026-10-02T09:15:00.000Z',
  updatedAt: '2026-10-02T09:20:00.000Z',
};

test('listDiagrams requests the collection and maps every diagram', async () => {
  const { calls, fetch: fetchImpl } = stub(() => response(200, { diagrams: [DIAGRAM] }));
  const api = createApiClient({ fetch: fetchImpl });

  const diagrams = await api.listDiagrams();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/diagrams');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.body, undefined);
  assert.deepEqual(diagrams, [DIAGRAM]);
});

test('listDiagrams sends a trimmed q only when there is a term', async () => {
  const { calls, fetch: fetchImpl } = stub(() => response(200, { diagrams: [] }));
  const api = createApiClient({ fetch: fetchImpl });

  await api.listDiagrams({ q: '   ' });
  await api.listDiagrams({ q: '  order flow  ' });

  assert.equal(calls[0].url, '/api/diagrams');
  assert.equal(calls[1].url, '/api/diagrams?q=order+flow');
});

test('listDiagrams rejects a payload without the diagrams wrapper', async () => {
  const api = createApiClient({ fetch: stub(() => response(200, [DIAGRAM])).fetch });

  await assert.rejects(api.listDiagrams(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.kind, 'malformed');
    return true;
  });
});

test('getDiagram maps the object and percent-encodes the id', async () => {
  const { calls, fetch: fetchImpl } = stub(() => response(200, DIAGRAM));
  const api = createApiClient({ fetch: fetchImpl });

  const diagram = await api.getDiagram('a b/c');

  assert.equal(calls[0].url, '/api/diagrams/a%20b%2Fc');
  assert.deepEqual(diagram, DIAGRAM);
});

test('getDiagram surfaces a 404 with the server message and a notFound kind', async () => {
  const api = createApiClient({
    fetch: stub(() => response(404, { error: 'Diagram not found' })).fetch,
  });

  await assert.rejects(api.getDiagram('nope'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.kind, 'notFound');
    assert.equal(error.status, 404);
    assert.equal(error.message, 'Diagram not found');
    return true;
  });
});

test('createDiagram posts title and source as JSON and accepts 201', async () => {
  const created = { ...DIAGRAM, title: 'Order flow' };
  const { calls, fetch: fetchImpl } = stub(() => response(201, created));
  const api = createApiClient({ fetch: fetchImpl });

  const diagram = await api.createDiagram({ title: 'Order flow', source: DIAGRAM.source });

  assert.equal(calls[0].url, '/api/diagrams');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(calls[0].init.body), { title: 'Order flow', source: DIAGRAM.source });
  assert.deepEqual(diagram, created);
});

test('createDiagram maps a 400 to kind invalid and keeps the server text', async () => {
  const api = createApiClient({
    fetch: stub(() => response(400, { error: 'title is required' })).fetch,
  });

  await assert.rejects(api.createDiagram({ title: ' ', source: 'x' }), (error) => {
    assert.equal(error.kind, 'invalid');
    assert.equal(error.status, 400);
    assert.equal(error.message, 'title is required');
    return true;
  });
});

test('updateDiagram puts to the diagram path and keeps a 400 distinct from a 404', async () => {
  const { calls, fetch: fetchImpl } = stub((url) =>
    url.endsWith('/missing') ? response(404, { error: 'Diagram not found' }) : response(400, { error: 'source is required' }),
  );
  const api = createApiClient({ fetch: fetchImpl });

  assert.equal(calls.length, 0);
  await assert.rejects(api.updateDiagram('missing', { title: 'a', source: 'b' }), (error) => {
    assert.equal(error.kind, 'notFound');
    return true;
  });
  await assert.rejects(api.updateDiagram('present', { title: 'a', source: 'b' }), (error) => {
    assert.equal(error.kind, 'invalid');
    return true;
  });
  assert.equal(calls[0].url, '/api/diagrams/missing');
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[1].url, '/api/diagrams/present');
});

test('deleteDiagram accepts an empty 204 body and reports 404 separately', async () => {
  const noContent = {
    status: 204,
    ok: true,
    async text() {
      throw new Error('a 204 must not be read');
    },
  };
  const okApi = createApiClient({ fetch: stub(() => noContent).fetch });
  assert.equal(await okApi.deleteDiagram('gone'), true);

  const missingApi = createApiClient({
    fetch: stub(() => response(404, { error: 'Diagram not found' })).fetch,
  });
  await assert.rejects(missingApi.deleteDiagram('gone'), (error) => {
    assert.equal(error.kind, 'notFound');
    return true;
  });
});

test('a transport failure becomes a network ApiError, never a raw TypeError', async () => {
  const api = createApiClient({
    fetch: async () => {
      throw new TypeError('Failed to fetch');
    },
  });

  await assert.rejects(api.listDiagrams(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.kind, 'network');
    assert.equal(error.status, 0);
    assert.equal(error.message, 'Could not reach the server.');
    return true;
  });
});

test('an unreadable or unparseable body becomes a malformed ApiError', async () => {
  const html = { status: 200, ok: true, async text() { return '<html>proxy error</html>'; } };
  const api = createApiClient({ fetch: stub(() => html).fetch });

  await assert.rejects(api.getDiagram('x'), (error) => {
    assert.equal(error.kind, 'malformed');
    return true;
  });
});

test('an error status without a usable {error} body still produces a readable message', async () => {
  const api = createApiClient({ fetch: stub(() => response(500, undefined)).fetch });

  await assert.rejects(api.getDiagram('x'), (error) => {
    assert.equal(error.kind, 'server');
    assert.equal(error.message, 'The server responded with 500.');
    return true;
  });
});

test('mapDiagram normalises missing timestamps and rejects unusable payloads', () => {
  assert.deepEqual(mapDiagram({ id: 'a', title: 't', source: 's' }), {
    id: 'a',
    title: 't',
    source: 's',
    createdAt: '',
    updatedAt: '',
  });
  for (const bad of [null, 'nope', [], { title: 't', source: 's' }, { id: 'a', title: 't' }]) {
    assert.throws(() => mapDiagram(bad), (error) => error instanceof ApiError && error.kind === 'malformed');
  }
});

test('the default fetch keeps its realm, so browsers do not reject it as an illegal invocation', async () => {
  const original = globalThis.fetch;
  let receiver = 'unset';
  globalThis.fetch = function stubFetch() {
    receiver = this;
    return response(200, { diagrams: [] });
  };
  try {
    const api = createApiClient();
    assert.deepEqual(await api.listDiagrams(), []);
    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = original;
  }
});

test('a missing fetch is reported as a network problem, not a TypeError', async () => {
  const original = globalThis.fetch;
  delete globalThis.fetch;
  try {
    await assert.rejects(createApiClient().listDiagrams(), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'network');
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});
