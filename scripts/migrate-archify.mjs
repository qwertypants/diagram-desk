import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogRows, catalog } from '../server/catalog.js';
import { resolveDatabasePath } from '../server/db.js';

const sha = source => createHash('sha256').update(source).digest('hex');
export async function migrate(databasePath, { apply = false } = {}) {
  const db = new DatabaseSync(databasePath);
  let transaction = false;
  try {
    const rows = db.prepare('SELECT * FROM diagrams').all();
    const expected = new Map(catalog.flatMap(item => item.original.map(row => [row.id, row.sourceSha256])));
    const converted = new Set();
    const hasDetails = db.prepare("SELECT 1 FROM sqlite_master WHERE name='diagram_details'").get();
    if (hasDetails) for (const row of db.prepare('SELECT id FROM diagram_details').all()) converted.add(row.id);
    const changes = rows.filter(row => !converted.has(row.id));
    for (const row of changes) {
      if (expected.get(row.id) !== sha(row.source)) throw new Error(`Unexpected legacy source for ${row.id} (${row.title}). No changes applied.`);
    }
    const complete = db.prepare("SELECT 1 FROM sqlite_master WHERE name='library_meta'").get() && db.prepare("SELECT 1 FROM library_meta WHERE key='catalog-v1'").get();
    if (complete && changes.length === 0) return { changed: 0, added: 0, alreadyMigrated: true };
    const seeds = catalogRows();
    const existing = new Set(rows.map(row => row.id));
    // Only the five additions are inserted into an existing library; absent originals stay absent.
    const additions = seeds.filter(row => !expected.has(row.id) && !existing.has(row.id));
    const result = { changed: changes.length, added: additions.length, dryRun: !apply };
    if (!apply) return result;
    const acceptance = JSON.parse(readFileSync('catalog/acceptance.json'));
    for (const item of catalog) {
      const receipt = acceptance.find(row => row.slug === item.slug);
      if (!receipt || receipt.sourceSha256 !== sha(readFileSync(`catalog/${item.file}`)) || !['validate','deliver','check','browser-check'].every(gate => receipt.gates[gate] === 'pass')) throw new Error(`Catalog acceptance is not current for ${item.slug}.`);
    }
    const backupPath = join(dirname(databasePath), `diagrams-before-archify-${Date.now()}.sqlite`);
    await backup(db, backupPath);
    db.exec('BEGIN IMMEDIATE'); transaction = true;
    // Recheck after acquiring the write lock, so stale planning never overwrites an edit.
    for (const row of changes) {
      if (db.prepare('SELECT source FROM diagrams WHERE id=?').get(row.id)?.source !== row.source) throw new Error('Library changed during migration. Retry from a fresh dry run.');
    }
    db.exec(`CREATE TABLE IF NOT EXISTS diagram_details (id TEXT PRIMARY KEY, type TEXT NOT NULL, lesson TEXT);
      CREATE TABLE IF NOT EXISTS library_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    const details = db.prepare('INSERT INTO diagram_details VALUES (?,?,?)');
    const mapped = new Map(seeds.map(row => [row.id, row]));
    for (const row of changes) {
      const item = mapped.get(row.id);
      db.prepare('UPDATE diagrams SET source=? WHERE id=?').run(item.source, row.id);
      details.run(row.id,item.type,JSON.stringify(item.lesson));
    }
    const now = new Date().toISOString();
    for (const item of additions) {
      db.prepare('INSERT INTO diagrams VALUES (?,?,?,?,?,?)').run(item.id,item.title,item.title.toLowerCase(),item.source,now,now);
      details.run(item.id,item.type,JSON.stringify(item.lesson));
    }
    db.prepare("INSERT OR REPLACE INTO library_meta VALUES ('catalog-v1','1')").run();
    db.exec('COMMIT'); transaction = false;
    return {...result, backupPath};
  } finally { if (transaction) db.exec('ROLLBACK'); db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await migrate(resolveDatabasePath(), { apply: process.argv.includes('--apply') }),null,2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
