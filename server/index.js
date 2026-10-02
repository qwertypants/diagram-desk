import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApiHandler } from './api.js';
import { createStaticHandler } from './static.js';
import { findRepositoryRoot, openStore, resolveDatabasePath } from './db.js';
import { sendJson } from './http.js';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4317;

export function resolvePort(env = process.env) {
  const parsed = Number.parseInt(env.PORT ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}

export function createApp({ store, distDirectory }) {
  const handleApiRequest = createApiHandler(store);
  const handleStaticRequest = createStaticHandler(distDirectory);

  return async function handleRequest(req, res) {
    const url = parseRequestUrl(req.url);
    if (url === null) return sendJson(res, 400, { error: 'Malformed request URL' });

    try {
      if (await handleApiRequest(req, res, url)) return;
      await handleStaticRequest(req, res, url);
    } catch (error) {
      console.error(`Request failed: ${req.method} ${req.url}`, error);
      if (res.headersSent) res.destroy();
      else sendJson(res, 500, { error: 'Internal server error' });
    }
  };
}

export async function startServer({
  port = resolvePort(),
  repositoryRoot = findRepositoryRoot(),
  databasePath = resolveDatabasePath({ repositoryRoot }),
  distDirectory = join(repositoryRoot, 'dist'),
} = {}) {
  const store = openStore(databasePath);
  const server = createServer(createApp({ store, distDirectory }));

  server.on('close', () => store.close());
  server.listen(port, HOST);
  await once(server, 'listening');

  return {
    origin: `http://${HOST}:${server.address().port}`,
    databasePath,
    distDirectory,
    async close() {
      if (!server.listening) return;
      await new Promise((resolveClosed, rejectClosed) => {
        server.close((error) => (error === undefined ? resolveClosed() : rejectClosed(error)));
        server.closeIdleConnections();
      });
    },
  };
}

function parseRequestUrl(requestUrl) {
  try {
    return new URL(requestUrl, `http://${HOST}`);
  } catch {
    return null;
  }
}

function isEntryPoint() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isEntryPoint()) {
  const server = await startServer();
  console.log(`diagram-desk listening on ${server.origin}`);
  console.log(`database: ${server.databasePath}`);
  if (!existsSync(server.distDirectory)) {
    console.warn(`no built site at ${server.distDirectory} - run "npm run build" first`);
  }
}
