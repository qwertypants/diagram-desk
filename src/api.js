/**
 * The only module that talks to the network. Every call site goes through a
 * client so that one error convention (`ApiError`) is shared, and so the whole
 * surface can be exercised against a stub `fetch`.
 *
 * Shapes and status codes follow docs/api-contract.md exactly.
 */

const JSON_TYPE = 'application/json; charset=utf-8';

export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'server' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

function kindForStatus(status) {
  if (status === 400) return 'invalid';
  if (status === 404) return 'notFound';
  if (status === 405) return 'methodNotAllowed';
  if (status >= 500) return 'server';
  return 'http';
}

function isUsableString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Normalize one `<diagram>` from the wire, or reject it as malformed. */
export function mapDiagram(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !isUsableString(raw.id)) {
    throw new ApiError('The server returned a diagram we could not read.', { kind: 'malformed' });
  }
  if (typeof raw.title !== 'string' || typeof raw.source !== 'string') {
    throw new ApiError('The server returned a diagram we could not read.', { kind: 'malformed' });
  }
  return {
    id: raw.id,
    title: raw.title,
    source: raw.source,
    createdAt: isUsableString(raw.createdAt) ? raw.createdAt : '',
    updatedAt: isUsableString(raw.updatedAt) ? raw.updatedAt : '',
  };
}

async function readBody(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(resolveFetch, baseUrl, path, { method = 'GET', query, body } = {}) {
  const search = query && query.q ? `?${new URLSearchParams({ q: query.q })}` : '';
  const fetchImpl = resolveFetch();
  if (typeof fetchImpl !== 'function') {
    throw new ApiError('This browser has no fetch, so the library is unavailable.', { kind: 'network' });
  }

  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}${search}`, {
      method,
      headers: body === undefined ? { accept: JSON_TYPE } : { accept: JSON_TYPE, 'content-type': JSON_TYPE },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server.', { kind: 'network' });
  }

  if (response.status === 204) return null;

  const payload = await readBody(response);
  if (!response.ok) {
    const message = isUsableString(payload?.error)
      ? payload.error.trim()
      : `The server responded with ${response.status}.`;
    throw new ApiError(message, { status: response.status, kind: kindForStatus(response.status) });
  }
  if (payload === null || typeof payload !== 'object') {
    throw new ApiError('The server returned a response we could not read.', {
      status: response.status,
      kind: 'malformed',
    });
  }
  return payload;
}

export function createApiClient({ fetch: fetchImpl, baseUrl = '/api' } = {}) {
  // `globalThis.fetch` must keep its realm as the receiver, or browsers reject
  // the call as an illegal invocation.
  const resolveFetch = () => {
    const impl = fetchImpl ?? globalThis.fetch;
    return typeof impl === 'function' ? impl.bind(globalThis) : impl;
  };

  return {
    async listDiagrams({ q = '' } = {}) {
      const term = typeof q === 'string' ? q.trim() : '';
      const payload = await request(resolveFetch, baseUrl, '/diagrams', {
        query: term === '' ? undefined : { q: term },
      });
      if (!Array.isArray(payload.diagrams)) {
        throw new ApiError('The server returned a library we could not read.', { kind: 'malformed' });
      }
      return payload.diagrams.map(mapDiagram);
    },

    async getDiagram(id) {
      return mapDiagram(await request(resolveFetch, baseUrl, `/diagrams/${encodeURIComponent(id)}`));
    },

    async createDiagram({ title, source }) {
      const payload = await request(resolveFetch, baseUrl, '/diagrams', {
        method: 'POST',
        body: { title, source },
      });
      return mapDiagram(payload);
    },

    async updateDiagram(id, { title, source }) {
      const payload = await request(resolveFetch, baseUrl, `/diagrams/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { title, source },
      });
      return mapDiagram(payload);
    },

    async deleteDiagram(id) {
      await request(resolveFetch, baseUrl, `/diagrams/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return true;
    },
  };
}
