import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { buildPwa, normalizeBase } from './build-pwa.mjs';

async function fixture(t, base = '/') {
  const root = await mkdtemp(join(tmpdir(), 'diagram-desk-pwa-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['dist/articles/guide', 'dist/diagrams/guide', 'dist/diagrams/legacy/edit', 'dist/_astro', 'catalog/diagrams', 'scripts']) await mkdir(join(root, path), { recursive: true });
  await copyFile(new URL('./pwa-worker.js', import.meta.url), join(root, 'scripts/pwa-worker.js'));
  const sources = {
    'dist/index.html': '<h1>Library</h1>',
    'dist/articles/guide/index.html': '<h1>Article</h1>',
    'dist/diagrams/guide/reader.html': '<h1>Reader</h1>',
    'dist/diagrams/legacy/edit/index.html': '<meta http-equiv="refresh" content="0;url=/articles/guide/">',
    'dist/_astro/app.js': 'console.log("offline")',
    'catalog/diagrams/guide.json': '{"diagram_type":"workflow"}',
    'catalog/index.json': '[{"slug":"guide","file":"diagrams/guide.json"}]',
  };
  await Promise.all(Object.entries(sources).map(([path, source]) => writeFile(join(root, path), source)));
  const build = await buildPwa({ root, base });
  return { root, build };
}

async function worker(root, build, { corrupt = false } = {}) {
  const origin = 'https://example.test';
  const listeners = new Map();
  const storage = new Map();
  let claims = 0;
  class LocalRequest extends Request {
    constructor(input, options) { super(new URL(input instanceof Request ? input.url : input, origin), options); }
  }
  const absolute = input => new URL(input instanceof Request ? input.url : input, origin).href;
  const caches = {
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
    open: async name => {
      if (!storage.has(name)) storage.set(name, new Map());
      const rows = storage.get(name);
      return {
        put: async (url, response) => rows.set(absolute(url), response.clone()),
        match: async url => rows.get(absolute(url))?.clone(),
        keys: async () => [...rows.keys()].map(url => new Request(url)),
      };
    },
  };
  const fetch = async request => {
    const path = new URL(absolute(request)).pathname.slice(build.base.length);
    const file = path.endsWith('/') || !path ? `${path}index.html` : path;
    const source = await readFile(join(root, 'dist', file));
    return new Response(corrupt && file.endsWith('reader.html') ? 'mixed release' : source);
  };
  runInNewContext(await readFile(join(root, 'dist/sw.js'), 'utf8'), {
    self: { addEventListener: (type, listener) => listeners.set(type, listener), location: { origin }, clients: { claim: async () => claims++ } },
    caches, fetch, Request: LocalRequest, Response, URL, crypto: globalThis.crypto, AbortSignal,
  });
  async function dispatch(type, extra = {}) {
    let result;
    listeners.get(type)({ waitUntil: promise => { result = promise; }, respondWith: promise => { result = promise; }, ...extra });
    return result;
  }
  async function request(path, mode = 'navigate') {
    return dispatch('fetch', { request: { url: absolute(path), method: 'GET', mode } });
  }
  return { caches, storage, dispatch, request, claims: () => claims };
}

test('build precaches the full final output and native data at either base', async t => {
  for (const base of ['/', '/diagram-desk/']) {
    const { root, build } = await fixture(t, base);
    assert.deepEqual(build.entries.map(entry => entry.url).sort(), [
      `${base}_astro/app.js`, `${base}articles/guide/`, `${base}diagrams/guide/diagram.json`,
      `${base}diagrams/guide/reader.html`, `${base}diagrams/legacy/edit/`, base,
    ].sort());
    assert.equal(await readFile(join(root, 'dist/diagrams/guide/diagram.json'), 'utf8'), '{"diagram_type":"workflow"}');
    assert.equal((await buildPwa({ root, base })).version, build.version, 'generated worker must not hash itself');
    await writeFile(join(root, 'dist/articles/guide/index.html'), '<h1>Updated article</h1>');
    assert.notEqual((await buildPwa({ root, base })).version, build.version);
    await assert.rejects(buildPwa({ root, base, maxBytes: 1 }), /exceeds cache budget/);
  }
  assert.equal(normalizeBase('diagram-desk'), '/diagram-desk/');
  assert.throws(() => normalizeBase('/../other/'), /Invalid PWA deployment base/);
});

test('installed snapshot serves unseen routes, reader queries, native data, and legacy pages', async t => {
  const { root, build } = await fixture(t, '/diagram-desk/');
  const runtime = await worker(root, build);
  await runtime.dispatch('install');
  assert.equal(runtime.claims(), 0, 'installation must not replace the current release');
  for (const path of ['/diagram-desk/articles/guide', '/diagram-desk/articles/guide/', '/diagram-desk/articles/guide/index.html']) {
    assert.equal(await (await runtime.request(path)).text(), '<h1>Article</h1>');
  }
  assert.equal(await (await runtime.request('/diagram-desk/diagrams/guide/reader.html?hideBreadcrumbs=1&hideHeader=1')).text(), '<h1>Reader</h1>');
  assert.equal(await (await runtime.request('/diagram-desk/diagrams/guide/diagram.json', 'cors')).text(), '{"diagram_type":"workflow"}');
  assert.match(await (await runtime.request('/diagram-desk/diagrams/legacy/edit/')).text(), /http-equiv="refresh"/);
  assert.equal(await runtime.request('/outside/'), undefined);
  assert.equal(await runtime.request('https://other.test/diagram-desk/'), undefined);
  assert.equal((await runtime.request('/diagram-desk/not-a-route/')).status, 404);
  let status;
  await runtime.dispatch('message', { data: { type: 'PWA_STATUS' }, ports: [{ postMessage: value => { status = value; } }] });
  assert.equal(status.ready, true);
  assert.equal(status.entryCount, 6);
});

test('failed or mixed-release installs remove their partial cache and preserve old versions', async t => {
  const { root, build } = await fixture(t);
  const runtime = await worker(root, build, { corrupt: true });
  await runtime.caches.open('diagram-desk:/:previous');
  await assert.rejects(runtime.dispatch('install'), /Build changed while caching/);
  assert.deepEqual(await runtime.caches.keys(), ['diagram-desk:/:previous']);
  assert.equal(runtime.claims(), 0);
});

test('activation cleans only this deployment and eviction status reports incomplete storage', async t => {
  const { root, build } = await fixture(t);
  const runtime = await worker(root, build);
  await runtime.caches.open('another-app');
  await runtime.caches.open('diagram-desk:/other/:previous');
  await runtime.caches.open('diagram-desk:/:previous');
  await runtime.dispatch('install');
  await runtime.dispatch('activate');
  assert.equal(runtime.claims(), 1);
  assert.deepEqual((await runtime.caches.keys()).sort(), ['another-app', 'diagram-desk:/other/:previous', `diagram-desk:/:${build.version}`].sort());
  runtime.storage.get(`diagram-desk:/:${build.version}`).delete('https://example.test/articles/guide/');
  let status;
  await runtime.dispatch('message', { data: { type: 'PWA_STATUS' }, ports: [{ postMessage: value => { status = value; } }] });
  assert.equal(status.ready, false);
  await writeFile(join(root, 'dist/articles/guide/index.html'), 'new release');
  assert.equal((await runtime.request('/articles/guide/')).status, 503, 'an evicted old page must not mix with new deployment bytes');
});
