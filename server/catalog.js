import { readFileSync } from 'node:fs';

const directory = new URL('../catalog/', import.meta.url);
export const catalog = JSON.parse(readFileSync(new URL('index.json', directory)));
export function catalogRows() {
  return catalog.flatMap((item, index) => {
    const source = readFileSync(new URL(item.file, directory), 'utf8');
    const ids = item.original.length ? item.original.map(row => row.id) : [`a1c00000-0000-4000-8000-${String(index).padStart(12, '0')}`];
    return ids.map(id => ({ id, title: item.title, source, type: item.type, lesson: item.lesson }));
  });
}

export function seedCatalog(store) {
  // A durable marker prevents subsequent startups from resurrecting deleted lessons.
  if (store.isCatalogInitialized()) return;
  if (store.list().length !== 0) return;
  store.importCatalog(catalogRows());
}
