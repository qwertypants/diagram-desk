import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = new URL(process.argv[2] || 'http://localhost:4321/');
assert.ok(base.pathname.endsWith('/'), 'Pass a site URL ending in /');
const evidence = new URL('../.archify/install-check/', import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch();
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function open(options = {}, setup) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  if (setup) await context.addInitScript(setup);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base.href);
  await page.waitForLoadState('networkidle');
  return { context, page, errors };
}
async function offer(page, fail = false) {
  await page.evaluate(fail => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => {
      window.installTest = { calls: (window.installTest?.calls || 0) + 1, activated: navigator.userActivation.isActive };
      if (fail) throw new Error('Prompt no longer available');
      return { outcome: 'dismissed' };
    };
    window.dispatchEvent(event);
  }, fail);
}

try {
  for (const width of [320, 390, 768, 1440]) {
    for (const colorScheme of ['light', 'dark']) {
      const { context, page, errors } = await open({ viewport: { width, height: 900 }, colorScheme });
      const prompt = page.locator('[data-install-prompt]');
      assert.equal(await prompt.isVisible(), false, 'Unsupported browsers receive no install banner');
      const manifestLink = await page.locator('link[rel=manifest]').getAttribute('href');
      assert.equal(manifestLink, `${base.pathname}manifest.webmanifest`);
      const manifest = await (await context.request.get(new URL(manifestLink, base).href)).json();
      for (const field of ['id', 'scope', 'start_url']) assert.equal(manifest[field], base.pathname, field);
      assert.ok(manifest.icons.every(icon => icon.src.startsWith(`${base.pathname}icons/`)));
      await offer(page);
      assert.equal(await prompt.isVisible(), true);
      assert.match(await prompt.ariaSnapshot(), /Install Diagram Desk/);
      assert.equal(await page.locator('[data-install-ios]').isVisible(), false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
      await page.screenshot({ path: new URL(`native-${width}-${colorScheme}.png`, evidence).pathname });
      await page.getByRole('button', { name: 'Install app' }).focus();
      await page.keyboard.press('Enter');
      await prompt.waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => window.installTest), { calls: 1, activated: true }, 'The browser prompt runs once during user activation');
      assert.equal(await page.locator('.brand').evaluate(element => element === document.activeElement), true, 'Focus returns to a visible control');
      await page.reload();
      await offer(page);
      assert.equal(await prompt.isVisible(), false, 'Dismissal survives navigation');
      assert.deepEqual(errors, []);
      await context.close();
    }
  }

  for (const width of [320, 390, 768]) {
    const { context, page, errors } = await open({ userAgent: iphone, viewport: { width, height: 900 } });
    assert.equal(await page.locator('[data-install-prompt]').isVisible(), true);
    assert.equal(await page.getByRole('button', { name: 'Install app' }).isVisible(), false);
    await page.getByText('Add to Home Screen', { exact: true }).first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('details[open]').count(), 1);
    assert.match(await page.locator('[data-install-ios]').innerText(), /Share menu/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: new URL(`iphone-${width}.png`, evidence).pathname });
    await page.getByRole('button', { name: 'Dismiss install suggestion' }).click();
    await page.reload();
    assert.equal(await page.locator('[data-install-prompt]').isVisible(), false);
    assert.deepEqual(errors, []);
    await context.close();
  }

  for (const userAgent of [iphone.replace('Version/18.0', 'CriOS/130.0'), iphone.replace('iPhone; CPU iPhone OS', 'iPad; CPU OS')]) {
    const { context, page } = await open({ userAgent });
    assert.equal(await page.locator('[data-install-prompt]').isVisible(), false, 'iPhone instructions remain specific to iPhone Safari');
    await context.close();
  }

  {
    const { context, page, errors } = await open({}, () => {
      navigator.serviceWorker.register = (url, options) => {
        /** @type {any} */ (window).serviceWorkerTest = { url, scope: options.scope };
        return Promise.reject(new Error('Registration unavailable fixture'));
      };
    });
    assert.deepEqual(await page.evaluate(() => /** @type {any} */ (window).serviceWorkerTest), { url: `${base.pathname}sw.js`, scope: base.pathname }, 'Registration keeps the worker and scope under the configured deployment path');
    assert.deepEqual(errors, [], 'A failed optional registration leaves reading intact');
    await context.close();
  }

  for (const mode of ['standalone', 'ios-standalone', 'blocked-storage', 'expired-dismissal', 'prompt-error', 'appinstalled']) {
    const { context, page, errors } = await open({ userAgent: iphone }, mode === 'standalone' ? () => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const media = original(query);
        if (query === '(display-mode: standalone)') Object.defineProperty(media, 'matches', { value: true });
        return media;
      };
    } : mode === 'ios-standalone' ? () => {
      Object.defineProperty(navigator, 'standalone', { value: true });
    } : mode === 'blocked-storage' ? () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    } : mode === 'expired-dismissal' ? () => {
      localStorage.setItem('diagram-desk:install-dismissed-until', '1');
    } : undefined);
    const prompt = page.locator('[data-install-prompt]');
    await offer(page, mode === 'prompt-error');
    if (mode.includes('standalone')) assert.equal(await prompt.isVisible(), false, mode);
    else {
      assert.equal(await prompt.isVisible(), true, mode);
      if (mode === 'prompt-error') await page.getByRole('button', { name: 'Install app' }).click();
      else if (mode === 'appinstalled') await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      else await page.getByRole('button', { name: 'Dismiss install suggestion' }).click();
      await prompt.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, [], mode);
    await context.close();
  }
  console.log('Install UX passed: responsive light/dark layouts, keyboard prompt activation, iPhone guidance, 30-day dismissal, storage denial, prompt failure, installed/standalone suppression, and manifest base paths.');
} finally { await browser.close(); }
