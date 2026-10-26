import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ORIGIN = 'https://diagram-desk.example';

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

function pngSize(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Install icons must be PNG files');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

// Execute the shipped worker through browser events. No production constants or
// private helper functions are imported by this checker.
function workerRuntime(source, scope, assets, { corrupt } = {}) {
  const handlers = new Map();
  const stores = new Map();
  const requests = [];
  let claimed = false;
  let skipped = false;
  const key = input => new URL(typeof input === 'string' ? input : input.url, scope).href;
  const cacheStorage = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(input, response) { store.set(key(input), response.clone()); },
        async match(input, options = {}) {
          const url = new URL(key(input));
          if (options.ignoreSearch) url.search = '';
          for (const [storedUrl, response] of store) {
            const candidate = new URL(storedUrl);
            if (options.ignoreSearch) candidate.search = '';
            if (candidate.href === url.href) return response.clone();
          }
        },
        async keys() { return [...store.keys()].map(url => new Request(url)); },
        async delete(input) { return store.delete(key(input)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(input, options) {
      for (const name of stores.keys()) {
        const response = await (await cacheStorage.open(name)).match(input, options);
        if (response) return response;
      }
    },
  };
  const network = async input => {
    const url = key(input);
    requests.push(url);
    if (!assets.has(url)) throw new Error(`Unexpected network request: ${url}`);
    return new Response(url === corrupt ? 'corrupt deployment bytes' : assets.get(url), {
      status: 200, headers: { 'content-type': url.endsWith('.json') ? 'application/json' : 'text/html' },
    });
  };
  const self = {
    location: new URL('sw.js', scope), registration: { scope },
    addEventListener(type, listener) { handlers.set(type, listener); },
    clients: { async claim() { claimed = true; }, async matchAll() { return []; } },
    async skipWaiting() { skipped = true; },
  };
  class ScopedRequest extends Request {
    constructor(input, options) { super(typeof input === 'string' ? new URL(input, scope) : input, options); }
  }
  vm.runInNewContext(source, {
    self, caches: cacheStorage, fetch: network, crypto: webcrypto,
    URL, Request: ScopedRequest, Response, Headers, AbortSignal, TextEncoder, TextDecoder, console,
  }, { filename: 'generated-service-worker.js' });
  return {
    stores, requests, get claimed() { return claimed; }, get skipped() { return skipped; },
    async lifecycle(type) {
      assert.ok(handlers.has(type), `Worker registers ${type}`);
      const pending = [];
      handlers.get(type)({ waitUntil(promise) { pending.push(promise); } });
      await Promise.all(pending);
    },
    async request(path, { method = 'GET', mode = 'navigate' } = {}) {
      let response;
      const request = { url: new URL(path, scope).href, method, mode, destination: mode === 'navigate' ? 'document' : '' };
      handlers.get('fetch')?.({ request, respondWith(promise) { response = promise; }, waitUntil() {} });
      return response ? await response : undefined;
    },
    async status() {
      assert.ok(handlers.has('message'), 'Worker supports offline readiness status');
      const pending = [];
      let status;
      handlers.get('message')({
        data: { type: 'PWA_STATUS' }, ports: [{ postMessage(value) { status = value; } }],
        waitUntil(promise) { pending.push(promise); },
      });
      await Promise.all(pending);
      return status;
    },
  };
}

export async function checkPwa({ dist, base = '/', worker = 'sw.js' }) {
  base = `/${base.split('/').filter(Boolean).join('/')}`.replace(/\/$/, '') + '/';
  const scope = new URL(base, ORIGIN).href;
  const assets = new Map();
  for await (const file of files(dist)) {
    const path = relative(dist, file).replaceAll('\\', '/');
    if (path === worker) continue;
    const route = path.replace(/(?:^|\/)index\.html$/, match => match.startsWith('/') ? '/' : '');
    assets.set(new URL(route, scope).href, await readFile(file));
  }
  const source = await readFile(join(dist, worker), 'utf8');
  const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Diagram Desk');
  assert.ok(manifest.short_name?.trim(), 'Manifest needs a short name');
  assert.equal(manifest.display, 'standalone');
  for (const field of ['id', 'scope', 'start_url']) {
    assert.equal(new URL(manifest[field], scope).href, scope, `Manifest ${field} stays at the deployment root`);
  }
  for (const field of ['theme_color', 'background_color']) {
    assert.match(manifest[field], /^#[\da-f]{6}$/i, `Manifest ${field} is a six-digit color`);
  }
  for (const size of ['192x192', '512x512']) {
    assert.ok(manifest.icons?.some(icon => icon.sizes === size && (icon.purpose || 'any').split(/\s+/).includes('any')), `Manifest has an ordinary ${size} icon`);
  }
  assert.ok(manifest.icons?.some(icon => icon.sizes === '512x512' && icon.purpose?.split(/\s+/).includes('maskable')), 'Manifest has a maskable 512px icon');
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, new URL('manifest.webmanifest', scope));
    assert.ok(url.href.startsWith(scope), `Icon stays under ${base}: ${icon.src}`);
    assert.equal(icon.type, 'image/png');
    assert.ok(assets.has(url.href), `Icon exists: ${icon.src}`);
    assert.equal(pngSize(assets.get(url.href)), icon.sizes, `Icon size matches ${icon.src}`);
  }
  for (const [url, bytes] of assets) {
    if (!url.endsWith('/')) continue;
    const html = bytes.toString();
    if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html)) continue;
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]);
    const href = rel => links.find(tag => new RegExp(`\\brel=["']${rel}["']`, 'i').test(tag))?.match(/\bhref=["']([^"']+)/i)?.[1];
    assert.equal(new URL(href('manifest'), url).href, new URL('manifest.webmanifest', scope).href, `Page links the scoped manifest: ${url}`);
    const appleUrl = new URL(href('apple-touch-icon'), url).href;
    assert.ok(assets.has(appleUrl), `Page supplies a local Apple touch icon: ${url}`);
    assert.equal(pngSize(assets.get(appleUrl)), '180x180', `Apple touch icon dimensions: ${url}`);
  }
  const catalog = JSON.parse(await readFile(resolve(import.meta.dirname, '../catalog/index.json'), 'utf8'));
  for (const item of catalog) {
    for (const path of [`articles/${item.slug}/`, `diagrams/${item.slug}/`, `diagrams/${item.slug}/reader.html`, `diagrams/${item.slug}/diagram.json`]) {
      assert.ok(assets.has(new URL(path, scope).href), `Offline library includes ${path}`);
    }
    const native = JSON.parse(assets.get(new URL(`diagrams/${item.slug}/diagram.json`, scope).href));
    assert.equal(native.diagram_type, item.type, `Native diagram type: ${item.slug}`);
    assert.equal(native.meta?.title, item.title, `Native diagram title: ${item.slug}`);
  }

  const runtime = workerRuntime(source, scope, assets);
  const cachePrefix = `diagram-desk:${base}:`;
  runtime.stores.set(`${cachePrefix}obsolete`, new Map());
  runtime.stores.set('unrelated-cache', new Map());
  runtime.stores.set('diagram-desk:/another-app/:keep', new Map());
  await runtime.lifecycle('install');
  const owned = [...runtime.stores.keys()].filter(name => name.startsWith(cachePrefix) && !name.endsWith(':obsolete'));
  assert.equal(owned.length, 1, 'Install creates one versioned library cache');
  assert.match(owned[0].slice(cachePrefix.length), /^[a-f\d]{20,64}$/i, 'Cache version derives from a content digest');
  assert.equal(runtime.skipped, false, 'Install must not replace an active worker mid-read');
  await runtime.lifecycle('activate');
  assert.equal(runtime.claimed, true, 'New worker claims its clients after activation');
  assert.equal(runtime.stores.has(`${cachePrefix}obsolete`), false, 'Activation removes obsolete same-base caches');
  assert.equal(runtime.stores.has('unrelated-cache'), true, 'Activation preserves unrelated caches');
  assert.equal(runtime.stores.has('diagram-desk:/another-app/:keep'), true, 'Activation preserves another deployment base');
  const status = await runtime.status();
  assert.equal(status.type, 'PWA_STATUS');
  assert.equal(status.ready, true, 'Complete cache reports offline readiness');
  assert.equal(status.entryCount, assets.size, 'Readiness counts every built file');
  assert.equal(status.totalBytes, [...assets.values()].reduce((sum, bytes) => sum + bytes.length, 0));
  assert.equal(status.version, owned[0].slice(cachePrefix.length));
  const networkRequests = runtime.requests.length;
  for (const [url, expected] of assets) {
    const response = await runtime.request(url);
    assert.ok(response, `Offline response exists for ${url}`);
    assert.equal(response.status, 200, `Offline status for ${url}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, `Offline bytes match build: ${url}`);
    if (url.endsWith('/')) {
      for (const alias of [`${url}index.html`, url.slice(0, -1)]) {
        const aliased = await runtime.request(alias);
        assert.ok(aliased, `Offline directory alias exists: ${alias}`);
        assert.deepEqual(Buffer.from(await aliased.arrayBuffer()), expected, `Offline alias bytes: ${alias}`);
      }
    }
    if (url.endsWith('/reader.html')) {
      const embedded = await runtime.request(`${url}?hideBreadcrumbs=1&hideHeader=1`);
      assert.ok(embedded, `Offline embedded reader exists: ${url}`);
      assert.deepEqual(Buffer.from(await embedded.arrayBuffer()), expected);
    }
  }
  assert.equal(runtime.requests.length, networkRequests, 'Cached library requests do not need the network');
  const [evictedUrl, evictedBytes] = assets.entries().next().value;
  assert.equal(runtime.stores.get(owned[0]).delete(evictedUrl), true, 'Evict one cached file');
  assert.equal((await runtime.status()).ready, false, 'Incomplete cache stops reporting offline readiness');
  const recovered = await runtime.request(evictedUrl);
  assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), evictedBytes, 'Evicted content recovers only verified build bytes');
  assert.equal((await runtime.status()).ready, true, 'Recovered complete cache reports readiness again');
  assert.equal(await runtime.request('https://outside.example/'), undefined, 'Cross-origin requests remain outside the worker');
  if (base !== '/') {
    assert.equal(await runtime.request(`${ORIGIN}/another-app/`), undefined, 'Other deployment paths remain outside the worker');
    assert.equal(await runtime.request(`${ORIGIN}${base.slice(0, -1)}-other/`), undefined, 'A similar path prefix remains outside the worker');
  }
  assert.equal(await runtime.request(scope, { method: 'POST' }), undefined, 'Non-GET requests remain outside the worker');

  const corrupt = assets.keys().next().value;
  const damaged = workerRuntime(source, scope, assets, { corrupt });
  damaged.stores.set('unrelated-cache', new Map());
  damaged.stores.set(`${cachePrefix}previous`, new Map());
  await assert.rejects(damaged.lifecycle('install'), undefined, 'Mismatched deployment bytes reject installation');
  assert.deepEqual([...damaged.stores.keys()], ['unrelated-cache', `${cachePrefix}previous`], 'Failed installation removes its partial candidate and preserves the old release');
  return { base, assets: assets.size, bytes: [...assets.values()].reduce((sum, bytes) => sum + bytes.length, 0), version: owned[0].slice(cachePrefix.length) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkPwa({ dist: resolve(import.meta.dirname, '../dist'), base: process.env.BASE_PATH || '/', worker: process.argv[2] || 'sw.js' });
  console.log(`PWA at ${result.base}: manifest/icons, ${result.assets} offline assets (${result.bytes} bytes), route aliases, embedded readers, integrity rejection, and scoped cache cleanup verified. Version ${result.version}.`);
}
