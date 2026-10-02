import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer } from './index.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function createWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'mermaid-library-test-'));

  return {
    root,
    databasePath: join(root, 'data', 'diagrams.sqlite'),
    distDirectory: join(root, 'dist'),

    writeDistFile(relativePath, contents) {
      const filePath = join(root, 'dist', relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, contents);
      return filePath;
    },

    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function startTestServer(workspace) {
  return startServer({
    port: 0,
    databasePath: workspace.databasePath,
    distDirectory: workspace.distDirectory,
  });
}

export async function request(origin, method, path, { body, headers = {} } = {}) {
  const response = await fetch(new URL(path, origin), { method, headers, body });
  const text = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    text,
    body: parseJson(text),
  };
}

export function postDiagram(origin, { title, source = 'flowchart TD\n  A --> B', extra } = {}) {
  return request(origin, 'POST', '/api/diagrams', {
    body: JSON.stringify({ title, source, ...extra }),
    headers: { 'content-type': 'application/json' },
  });
}

export async function listDiagrams(origin) {
  const response = await request(origin, 'GET', '/api/diagrams');
  return response.body.diagrams;
}

export async function deleteEveryDiagram(origin) {
  for (const diagram of await listDiagrams(origin)) {
    await request(origin, 'DELETE', `/api/diagrams/${diagram.id}`);
  }
}

export function seedDiagram(
  workspace,
  { id = randomUUID(), title, source = 'flowchart TD\n  A --> B', createdAt, updatedAt },
) {
  const database = new DatabaseSync(workspace.databasePath);
  try {
    database
      .prepare(
        'INSERT INTO diagrams (id, title, title_lower, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, title, title.toLowerCase(), source, createdAt, updatedAt);
  } finally {
    database.close();
  }
  return id;
}

export function readStoredDiagram(workspace, id) {
  const database = new DatabaseSync(workspace.databasePath);
  try {
    const row = database
      .prepare('SELECT id, title, source, created_at, updated_at FROM diagrams WHERE id = ?')
      .get(id);
    if (row === undefined) return null;
    return {
      id: row.id,
      title: row.title,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } finally {
    database.close();
  }
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isTimestamp(value) {
  return typeof value === 'string' && TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function delay(milliseconds) {
  return new Promise((resolveDelayed) => setTimeout(resolveDelayed, milliseconds));
}

function parseJson(text) {
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
