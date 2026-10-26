import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = new URL(process.argv[2] || 'http://127.0.0.1:4321/');
if (!base.pathname.endsWith('/')) base.pathname += '/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();

try {
  await page.goto(base.href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for service-worker readiness')), 30_000));
    await Promise.race([navigator.serviceWorker.ready, timeout]);
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })),
        timeout,
      ]);
    }
  });

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      manifest: document.querySelector('link[rel="manifest"]')?.href,
      scope: ready.scope,
      worker: ready.active?.scriptURL,
    };
  });
  assert.equal(registration.controlled, true, 'The production page is controlled by a service worker');
  assert.equal(registration.manifest, new URL('manifest.webmanifest', base).href, 'The manifest is discovered under the deployment base');
  assert.equal(registration.scope, base.href, 'The registration scope matches the deployment base');
  assert.equal(registration.worker, new URL('sw.js', base).href, 'The active worker stays under the deployment base');

  await context.setOffline(true);
  const paths = [
    '',
    'topics/ai-systems/',
    'articles/when-a-cyber-test-reached-real-people/',
    'diagrams/when-a-cyber-test-reached-real-people/',
    'diagrams/when-a-cyber-test-reached-real-people/reader.html?hideBreadcrumbs=1&hideHeader=1',
    'diagrams/when-a-cyber-test-reached-real-people/diagram.json',
    'diagrams/1b3b1152-e9e1-4c29-887b-82b32debf9bf/',
    'diagrams/1b3b1152-e9e1-4c29-887b-82b32debf9bf/edit/',
  ];

  for (const path of paths) {
    const offlinePage = await context.newPage();
    const response = await offlinePage.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `Offline navigation succeeds: ${path || '/'}`);
    await offlinePage.close();
  }

  console.log(`Offline browser passed: controlled ${registration.scope}; ${paths.length} cold routes cover home, topic, article, diagram, reader, native JSON, and legacy URLs.`);
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
}
