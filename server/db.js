import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const COLUMNS = 'id, title, source, created_at, updated_at';
const ORDER = 'ORDER BY updated_at DESC, title ASC';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS diagrams (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  title_lower TEXT NOT NULL,
  source      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS diagrams_recent ON diagrams (updated_at DESC, title ASC);
`;

export function findRepositoryRoot(fromDirectory = import.meta.dirname) {
  let directory = resolve(fromDirectory);
  for (;;) {
    if (existsSync(join(directory, 'package.json'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`No package.json found at or above ${fromDirectory}`);
    }
    directory = parent;
  }
}

export function resolveDatabasePath({ env = process.env, repositoryRoot = findRepositoryRoot() } = {}) {
  const configured = (env.DIAGRAMS_DB ?? '').trim();
  if (configured === '') return join(repositoryRoot, 'data', 'diagrams.sqlite');
  return isAbsolute(configured) ? configured : resolve(repositoryRoot, configured);
}

export function openStore(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(SCHEMA);
  } catch (error) {
    database.close();
    throw new Error(
      `Could not open the diagram library at ${databasePath}: ${error.message}. ` +
        'That file already exists with a different shape, so nothing was changed. ' +
        'Move it aside (or point DIAGRAMS_DB somewhere else) and start again to recreate it.',
      { cause: error },
    );
  }

  const statements = {
    insert: database.prepare(
      `INSERT INTO diagrams (id, title, title_lower, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`,
    ),
    update: database.prepare(
      `UPDATE diagrams SET title = ?, title_lower = ?, source = ?, updated_at = ?
       WHERE id = ? RETURNING ${COLUMNS}`,
    ),
    selectOne: database.prepare(`SELECT ${COLUMNS} FROM diagrams WHERE id = ?`),
    selectAll: database.prepare(`SELECT ${COLUMNS} FROM diagrams ${ORDER}`),
    selectByTitle: database.prepare(
      `SELECT ${COLUMNS} FROM diagrams WHERE instr(title_lower, ?) > 0 ${ORDER}`,
    ),
    remove: database.prepare('DELETE FROM diagrams WHERE id = ? RETURNING id'),
  };

  return {
    create({ title, source }) {
      const now = new Date().toISOString();
      const row = statements.insert.get(randomUUID(), title, title.toLowerCase(), source, now, now);
      return toDiagram(row);
    },

    list(searchTerm) {
      const term = typeof searchTerm === 'string' ? searchTerm.trim().toLowerCase() : '';
      const rows = term === '' ? statements.selectAll.all() : statements.selectByTitle.all(term);
      return rows.map(toDiagram);
    },

    get(id) {
      return toDiagram(statements.selectOne.get(id));
    },

    update(id, { title, source }) {
      const row = statements.update.get(
        title,
        title.toLowerCase(),
        source,
        new Date().toISOString(),
        id,
      );
      return toDiagram(row);
    },

    remove(id) {
      return statements.remove.get(id) !== undefined;
    },

    close() {
      database.close();
    },
  };
}

function toDiagram(row) {
  if (row === undefined) return null;
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
