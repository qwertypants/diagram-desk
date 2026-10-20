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
      assert.equal(await iframe.getAttribute('sandbox'), 'allow-scripts allow-downloads');
      const frame = await (await iframe.elementHandle()).contentFrame();
      await zoom(frame);
      await checkWidth();
      const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
      assert.equal(new URL(canonical).pathname, new URL(`articles/${item.slug}/`, base).pathname);
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
    await zoom(page);
    for (const [id, slug] of Object.entries(legacy)) {
      for (const suffix of ['', 'edit/']) {
        await visit(`diagrams/${id}/${suffix}`);
        await page.waitForURL(new URL(`articles/${slug}/`, base).href);
      }
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}px`);
    console.log(`${width}px: home/navigation, ${catalog.length} embedded readers with zoom, standalone zoom, dark mode, and ${Object.keys(legacy).length * 2} legacy redirects passed.`);
    await context.close();
  }
} finally {
  await browser.close();
}
