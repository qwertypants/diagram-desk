import { compileDiagram, readPreview, sendReader } from './archify.js';
import { hasJsonContentType, readJsonBody, sendJson, sendNoContent } from './http.js';
import { validateDiagramBody } from './validate.js';

const COLLECTION_PATH = '/api/diagrams';
const API_PATH_PREFIX = '/api/';
const COLLECTION_METHODS = ['GET', 'POST'];
const ITEM_METHODS = ['GET', 'PUT', 'DELETE'];

export function createApiHandler(store) {
  return async function handleApiRequest(req, res, url) {
    if (!isApiPath(url.pathname)) return false;

    try {
      await route({ req, res, url, store });
    } catch (error) {
      console.error(`API request failed: ${req.method} ${url.pathname}`, error);
      if (res.headersSent) res.destroy();
      else sendJson(res, 500, { error: 'Internal server error' });
    }
    return true;
  };
}

async function route({ req, res, url, store }) {
  const { pathname } = url;

  if (pathname === COLLECTION_PATH) {
    if (req.method === 'GET') return sendDiagramList(res, store.list(url.searchParams.get('q')));
    if (req.method === 'POST') return sendNewDiagram(req, res, store);
    return sendMethodNotAllowed(res, COLLECTION_METHODS);
  }

  if (pathname === '/api/preview') {
    if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST']);
    if (!hasJsonContentType(req)) return sendUnsupportedMediaType(res);
    const input = await readDiagramInput(req);
    if (input.error) return sendJson(res, 400, { error: input.error });
    if (!input.diagram.type) return sendJson(res, 400, { error: 'Native preview requires a diagram type.' });
    const result = await compileDiagram(input.diagram.source, input.diagram.type);
    return sendJson(res, 200, { readerUrl: `/api/previews/${result.digest}`, sourceHash: result.digest });
  }
  const preview = pathname.match(/^\/api\/previews\/([a-f0-9]{64})$/);
  if (preview) {
    if (req.method !== 'GET') return sendMethodNotAllowed(res, ['GET']);
    const html = readPreview(preview[1]);
    return html ? sendReader(res, html) : sendJson(res, 404, { error: 'Preview expired. Render the source again.' });
  }
  const reader = pathname.match(/^\/api\/diagrams\/([^/]+)\/reader$/);
  if (reader) {
    if (req.method !== 'GET') return sendMethodNotAllowed(res, ['GET']);
    const diagram = store.get(decodeURIComponent(reader[1]));
    if (!diagram) return sendDiagramNotFound(res);
    if (!diagram.type) return sendJson(res, 409, { error: 'This archived diagram needs the Archify migration.' });
    const result = await compileDiagram(diagram.source, diagram.type);
    return sendReader(res, result.html);
  }
  const id = diagramIdIn(pathname);
  if (id === null) return sendJson(res, 404, { error: 'Not found' });

  if (req.method === 'GET') {
    const diagram = store.get(id);
    return diagram === null ? sendDiagramNotFound(res) : sendJson(res, 200, diagram);
  }

  if (req.method === 'PUT') return sendUpdatedDiagram(req, res, store, id);

  if (req.method === 'DELETE') {
    return store.remove(id) ? sendNoContent(res) : sendDiagramNotFound(res);
  }

  return sendMethodNotAllowed(res, ITEM_METHODS);
}

async function sendNewDiagram(req, res, store) {
  if (!hasJsonContentType(req)) return sendUnsupportedMediaType(res);
  const input = await readDiagramInput(req);
  if (input.error !== undefined) return sendJson(res, 400, { error: input.error });
  return sendJson(res, 201, store.create(input.diagram));
}

async function sendUpdatedDiagram(req, res, store, id) {
  if (!hasJsonContentType(req)) return sendUnsupportedMediaType(res);
  const input = await readDiagramInput(req);
  if (input.error !== undefined) return sendJson(res, 400, { error: input.error });

  const diagram = store.update(id, input.diagram);
  return diagram === null ? sendDiagramNotFound(res) : sendJson(res, 200, diagram);
}

async function readDiagramInput(req) {
  const body = await readJsonBody(req);
  if (body.error !== undefined) return body;
  const input = validateDiagramBody(body.value);
  if (input.diagram?.type) {
    try { await compileDiagram(input.diagram.source, input.diagram.type); }
    catch (error) { return { error: error.message }; }
  }
  return input;
}

function sendDiagramList(res, diagrams) {
  return sendJson(res, 200, { diagrams });
}

function sendDiagramNotFound(res) {
  return sendJson(res, 404, { error: 'Diagram not found' });
}

function sendUnsupportedMediaType(res) {
  return sendJson(res, 415, { error: 'Request body must be application/json' });
}

function sendMethodNotAllowed(res, allow) {
  return sendJson(res, 405, { error: 'Method not allowed' }, { allow: allow.join(', ') });
}

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith(API_PATH_PREFIX);
}

function diagramIdIn(pathname) {
  if (!pathname.startsWith(`${COLLECTION_PATH}/`)) return null;

  const segment = pathname.slice(COLLECTION_PATH.length + 1);
  if (segment === '' || segment.includes('/')) return null;

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
