import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const base = new URL(process.argv[2] || 'http://localhost:4321/');
assert.ok(base.pathname.endsWith('/'), 'Pass a site URL ending in /');
const catalog = JSON.parse(await readFile(join(root, 'catalog/index.json'), 'utf8'));
const legacy = JSON.parse(await readFile(join(root, 'src/legacy-ids.json'), 'utf8'));
const evidence = join(root, '.archify/pages-check');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
    });
    page.on('response', response => {
      if (new URL(response.url()).origin === base.origin && response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    const visit = async path => {
      const response = await page.goto(new URL(path, base).href);
      assert.equal(response?.status(), 200, path);
    };
    const checkWidth = async () => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflows at ${width}px: ${page.url()}`);
    };
    const zoom = async frame => {
      await frame.getByRole('button', { name: 'Zoom in', exact: true }).waitFor();
      const before = await frame.evaluate(() => globalThis.Archify.view.state().scale);
      await frame.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await frame.waitForFunction(scale => globalThis.Archify.view.state().scale > scale, before);
    };
    const externalPopup = async (scope = page) => {
      const link = scope.locator('a:has(.external-link-indicator)').first();
      assert.ok(await link.locator('.external-link-indicator').isVisible(), 'External arrow is visible without hover');
      assert.match(await link.ariaSnapshot(), /opens in a new window/);
      const destination = await link.getAttribute('href');
      const expected = new URL(destination, page.url()).href;
      const original = page.url();
      await context.route(expected, route => route.fulfill({ contentType: 'text/html', body: '<title>External destination fixture</title>' }));
      const popupPromise = page.waitForEvent('popup');
      await link.click();
      const popup = await popupPromise;
      await popup.waitForURL(expected);
      assert.equal(page.url(), original, 'External link leaves the reading page open');
      await popup.close();
      await context.unroute(expected);
    };

    await visit('');
    await checkWidth();
    await page.screenshot({ path: join(evidence, `home-${width}.png`), fullPage: true });
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Articles', exact: true }).click();
    assert.equal(page.url(), new URL('articles/', base).href);
    assert.equal(await page.locator('.article-card').count(), catalog.length);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Topics', exact: true }).click();
    await page.locator('.topic-row').first().click();
    assert.ok(page.url().startsWith(new URL('topics/', base).href));

    for (const item of catalog) {
      await visit(`articles/${item.slug}/`);
      assert.equal(await page.locator('h1').innerText(), item.title);
      const iframe = page.locator('iframe').first();
      await iframe.scrollIntoViewIfNeeded();
      assert.equal(await iframe.getAttribute('src'), new URL(`diagrams/${item.slug}/reader.html`, base).pathname);
      assert.equal(await iframe.getAttribute('sandbox'), 'allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox');
      const frame = await (await iframe.elementHandle()).contentFrame();
      await zoom(frame);
      await checkWidth();
      const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
      assert.equal(new URL(canonical).pathname, new URL(`articles/${item.slug}/`, base).pathname);
      await page.screenshot({ path: join(evidence, `article-${item.slug}-${width}.png`), fullPage: true });
      const full = await page.getByRole('link', { name: 'Open full view' }).getAttribute('href');
      assert.equal(full, new URL(`diagrams/${item.slug}/`, base).pathname);
      if (item.slug === 'agent-tool-loop') {
        await externalPopup();
        const reader = frame;
        await reader.locator('#btn-diagram-guide').click();
        await externalPopup(reader);
        await reader.locator('#diagram-guide-close').click();
      }
      await page.goto(new URL(full, base).href);
      assert.ok((await page.locator('h1').innerText()).trim(), 'Companion has a title');
      assert.equal(new URL(await page.locator('link[rel=canonical]').getAttribute('href')).pathname, new URL(`diagrams/${item.slug}/`, base).pathname);
      const companionIframe = page.locator('iframe');
      assert.equal(await companionIframe.count(), 1);
      assert.equal(await companionIframe.getAttribute('src'), new URL(`diagrams/${item.slug}/reader.html`, base).pathname);
      await companionIframe.scrollIntoViewIfNeeded();
      await zoom(await (await companionIframe.elementHandle()).contentFrame());
      await checkWidth();
      await page.screenshot({ path: join(evidence, `companion-${item.slug}-${width}.png`), fullPage: true });
      if (item.slug === 'agent-tool-loop') await externalPopup();
      const articleLink = page.locator(`a[href="${new URL(`articles/${item.slug}/`, base).pathname}"]`).first();
      await articleLink.click();
      assert.equal(page.url(), new URL(`articles/${item.slug}/`, base).href);
    }

    await visit('articles/ai-evaluation/');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.locator('iframe').scrollIntoViewIfNeeded();
    await page.frameLocator('iframe').getByRole('button', { name: 'Zoom in', exact: true }).waitFor();
    await page.screenshot({ path: join(evidence, `article-dark-${width}.png`), fullPage: true });
    await page.locator('.diagram-section').screenshot({ path: join(evidence, `diagram-${width}.png`) });
    await checkWidth();
    const full = await page.getByRole('link', { name: 'Open full view' }).getAttribute('href');
    await page.goto(new URL(full, base).href);
    await checkWidth();
    await page.screenshot({ path: join(evidence, `companion-dark-${width}.png`), fullPage: true });
    const canvas = await page.getByRole('link', { name: /Open canvas only/ }).getAttribute('href');
    await page.goto(new URL(canvas, base).href);
    await zoom(page);
    for (const [id, slug] of Object.entries(legacy)) {
      for (const suffix of ['', 'edit/']) {
        await visit(`diagrams/${id}/${suffix}`);
        await page.waitForURL(new URL(`articles/${slug}/`, base).href);
      }
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}px`);
    console.log(`${width}px: navigation, ${catalog.length} article/companion round trips and embedded readers, external popups, standalone zoom, dark mode, and ${Object.keys(legacy).length * 2} legacy redirects passed.`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 320, height: 800 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const touch = await context.newCDPSession(page);
  for (const route of ['articles/agent-tool-loop/', 'diagrams/agent-tool-loop/']) {
    await page.goto(new URL(route, base).href);
    await page.locator('iframe').scrollIntoViewIfNeeded();
    const frame = await (await page.locator('iframe').elementHandle()).contentFrame();
    await frame.getByRole('button', { name: 'Zoom in', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `320px overflow: ${route}`);
    await page.screenshot({ path: join(evidence, `pilot-${route.startsWith('articles') ? 'article' : 'companion'}-320.png`), fullPage: true });
    const bounds = await frame.locator('.diagram-container').boundingBox();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + Math.min(bounds.height / 2, 200);
    const before = await frame.evaluate(() => globalThis.Archify.view.state());
    for (const [distance, type] of [[25, 'touchStart'], [40, 'touchMove'], [60, 'touchMove']]) {
      await touch.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frame.waitForFunction(scale => globalThis.Archify.view.state().scale > scale, before.scale);
    const zoomed = await frame.evaluate(() => globalThis.Archify.view.state());
    const panBounds = await frame.locator('.diagram-container').boundingBox();
    // Pan from the empty container margin; node drags intentionally do not pan.
    const panX = panBounds.x + 10;
    const panY = panBounds.y + 100;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: panX, y: panY, id: 3 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: panX + 40, y: panY + 20, id: 3 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frame.waitForFunction(previous => {
      const state = globalThis.Archify.view.state();
      return state.x !== previous.x || state.y !== previous.y;
    }, zoomed);
  }
  await context.close();
  console.log('320px: pilot article and companion fit; native touch pinch zoom and pan passed.');
} finally {
  await browser.close();
}
