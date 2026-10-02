/**
 * Browser verification for the plan's completion criteria: paste → preview →
 * save → reopen → search → edit → delete, invalid Mermaid, unsaved changes,
 * narrow layouts, and rendering with every external origin blocked.
 *
 * This file is deliberately NOT under `test/`: `node --test` runs every file it
 * finds in a `test/` directory, which would launch a browser during `npm test`.
 *
 *   npm run build && npm start        # in another terminal
 *   npm run test:browser
 *
 * `DIAGRAMS_BASE_URL` overrides the default `http://127.0.0.1:4317`.
 */

import { chromium } from 'playwright';

const base = (process.env.DIAGRAMS_BASE_URL ?? 'http://127.0.0.1:4317').replace(/\/+$/, '');
let fails = 0;
const notes = [];

function check(name, cond, detail = '') {
  if (cond) console.log(`ok   ${name}`);
  else { fails++; console.log(`FAIL ${name} ${detail}`); }
}

async function assertSiteIsRunning() {
  let probe;
  try {
    probe = await fetch(`${base}/api/diagrams`);
  } catch (error) {
    console.error(`FAIL the site is not answering at ${base}`);
    console.error(`     ${error.cause?.code ?? error.message}`);
    console.error('     start it in another terminal with:  npm run build && npm start');
    console.error('     or point DIAGRAMS_BASE_URL at a server that is already running');
    process.exit(1);
  }

  if (!probe.ok) {
    console.error(`FAIL ${base}/api/diagrams answered ${probe.status}`);
    console.error('     the server is up but is not serving the app - run "npm run build" first');
    process.exit(1);
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch (error) {
    console.error('FAIL Playwright could not launch Chrome');
    console.error(`     ${String(error.message).split('\n')[0]}`);
    console.error('     these checks need a Chrome install (the playwright devDependency');
    console.error('     alone does not provide one)');
    process.exit(1);
  }
}

await assertSiteIsRunning();

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
const badResponses = [];
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

const externalRequests = [];
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) externalRequests.push(u);
});

// ---- load ----
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
check('app loads', (await page.title()).includes('Diagram'));
check('library region present', await page.locator('.library, nav, [role="navigation"]').first().isVisible());
const emptyState = await page.locator('body').innerText();
check('empty state invites a first diagram', /choose a diagram|start a new/i.test(emptyState));

await page.getByRole('button', { name: 'New diagram' }).first().click();
await page.waitForURL('**/new', { timeout: 10000 });
check('New diagram routes to /new', page.url().endsWith('/new'), page.url());

// ---- paste + preview ----
const SRC = 'flowchart TD\n  A[Paste] --> B[Preview]\n  B --> C{Saved}';
const editor = page.locator('.composer textarea, textarea').first();
await editor.fill(SRC);
await editor.fill('');          // force input event path
await editor.type(SRC, { delay: 5 });
await page.waitForSelector('.stage svg, [data-testid="preview"] svg, .preview svg', { timeout: 15000 });
check('preview renders an svg', (await page.locator('svg').count()) > 0);

// save gating: title empty -> disabled
const saveBtn = page.getByRole('button', { name: /save/i }).first();
check('save disabled before a title', await saveBtn.isDisabled());

const titleInput = page.locator('.composer input[type="text"], input[type="text"]').first();
await titleInput.fill('Browser flow check');
await page.waitForTimeout(400);
check('save enabled with title + good preview', !(await saveBtn.isDisabled()));

// ---- invalid mermaid blocks save ----
await editor.fill('flowchart TD\n  A[[[broken');
await page.waitForTimeout(700);
const invalidDisabled = await saveBtn.isDisabled();
const invalidText = await page.locator('body').innerText();
check('invalid mermaid disables save', invalidDisabled);
check('invalid mermaid shows a visible error',
  /error|invalid|parse|expect/i.test(invalidText));
await editor.fill(SRC);
await page.waitForTimeout(700);
check('save re-enables after fixing', !(await saveBtn.isDisabled()));

// ---- save ----
await saveBtn.click();
await page.waitForTimeout(1200);
check('no failed request after save', badResponses.length === 0, badResponses.join(' | '));

const savedUrl = page.url();
notes.push(`saved url: ${savedUrl}`);
check('saved url is a deep link', /\/diagrams\/[0-9a-f-]{36}/.test(savedUrl), savedUrl);

// ---- reopen: render first ----
await page.goto(savedUrl, { waitUntil: 'networkidle' });
await page.waitForSelector('svg', { timeout: 15000 });
check('deep link reopens and renders', (await page.locator('svg').count()) > 0);
const textareaVisibleOnOpen = await page.locator('.composer textarea, textarea').first().isVisible().catch(() => false);
check('reopen shows render, not the editor', textareaVisibleOnOpen === false);

// ---- a cold deep link populates the library column ----
const coldLibraryItems = await page.locator('.library__item').allInnerTexts();
check('cold deep link lists the diagram in the library',
  coldLibraryItems.some((text) => /Browser flow check/.test(text)), coldLibraryItems.join(' / '));
const coldLibraryStatus = await page.locator('#library-status').innerText();
check('cold deep link shows a counted library status',
  /1 saved diagram\./.test(coldLibraryStatus), coldLibraryStatus);
const coldSelected = await page.locator('.library__item[aria-current="true"]').allInnerTexts();
check('cold deep link marks the open diagram as selected',
  coldSelected.some((text) => /Browser flow check/.test(text)), coldSelected.join(' / '));

// ---- a cold deep link to the editor populates it too ----
await page.goto(`${savedUrl}/edit`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const editLibraryItems = await page.locator('.library__item').allInnerTexts();
check('cold editor deep link lists the diagram in the library',
  editLibraryItems.some((text) => /Browser flow check/.test(text)), editLibraryItems.join(' / '));

// ---- render error is not color-only ----
const live = await page.locator('[aria-live], [role="status"], [role="alert"]').count();
check('render status is announced via a live region', live > 0, `found ${live}`);
const viewerStatus = page.locator('#viewer-status, .preview__status').first();
check('viewer status line exists', await viewerStatus.count() > 0);
check('viewer status reports the rendered diagram type',
  /render|diagram/i.test(await viewerStatus.innerText()), await viewerStatus.innerText());

// ---- search ----
const searchInput = page.locator('input[type="search"], input[placeholder*="earch" i]').first();
await searchInput.fill('Browser flow');
await page.waitForTimeout(900);
const listed = await page.locator('.library button, .library li, .library a').allInnerTexts();
check('search finds the diagram by title', listed.some((t) => /Browser flow check/.test(t)), listed.join(' / '));

await searchInput.fill('zzzznomatch');
await page.waitForTimeout(800);
const emptyText = await page.locator('body').innerText();
check('no-match search shows an empty state', /no |nothing|empty|0 diagram/i.test(emptyText));
await searchInput.fill('');
await page.waitForTimeout(600);

// ---- keyboard: reach and activate a diagram from the library ----
await page.keyboard.press('Tab');
let reached = false;
for (let i = 0; i < 40; i++) {
  const active = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, text: (el?.textContent || '').trim() };
  });
  if (/Browser flow/.test(active.text)) { reached = true; break; }
  await page.keyboard.press('Tab');
}
check('diagram is reachable by keyboard', reached);

// ---- edit + unsaved-changes warning ----
const editBtn = page.getByRole('button', { name: /edit/i }).first();
if (await editBtn.count()) {
  await editBtn.click();
  await page.waitForTimeout(700);
  check('editor opens for editing', await page.locator('.composer textarea, textarea').first().isVisible());

  await page.locator('.composer textarea, textarea').first().fill(SRC + '\n  C --> D[Changed]');
  await page.waitForTimeout(500);

  page.once('dialog', (d) => d.accept());
  await page.locator('.composer input[type="text"], input[type="text"]').first().fill('Renamed in browser');
  await page.waitForTimeout(300);
  const saveInEditor = page.getByRole('button', { name: /save/i }).first();
  await saveInEditor.click();
  await page.waitForTimeout(1200);
  const afterSaveText = await page.locator('body').innerText();
  check('edit saved without a false discard warning', !/discard|unsaved/i.test(afterSaveText));
}

// ---- narrow layout ----
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(600);
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no horizontal overflow at 390px', overflow <= 1, `overflow ${overflow}px`);
const listVisibleNarrow = await page.locator('.library button, .library li, .library a').first().isVisible();
check('library still visible at 390px', listVisibleNarrow);
await page.setViewportSize({ width: 1440, height: 900 });

// ---- offline rendering: reload the app while blocking every external origin ----
const blocked = await ctx.newPage();
await blocked.route('**/*', (route) => {
  const u = route.request().url();
  if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
  return route.abort();
});
const blockedErrors = [];
blocked.on('pageerror', (e) => blockedErrors.push(e.message));
await blocked.goto(savedUrl, { waitUntil: 'networkidle' });
await blocked.waitForSelector('svg', { timeout: 15000 });
check('renders with all external origins blocked', (await blocked.locator('svg').count()) > 0);
check('no page errors with external origins blocked', blockedErrors.length === 0, blockedErrors.join(' | '));
await blocked.close();

// ---- delete with confirmation ----
await page.goto(savedUrl, { waitUntil: 'networkidle' });
const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).first();
check('delete control present', await deleteBtn.count() > 0);
await deleteBtn.click();
await page.waitForTimeout(500);
const dialogVisible = await page.locator('[role="dialog"][aria-modal="true"]').first().isVisible();
check('delete asks for confirmation', dialogVisible);

let cancelled = true;
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const afterEscape = await fetch(`${base}/api/diagrams/${savedUrl.split('/').pop()}`);
check('escape cancels the delete', afterEscape.status === 200, afterEscape.status);

await deleteBtn.click();
await page.waitForTimeout(500);
await page.locator('[role="dialog"][aria-modal="true"]').getByRole('button', { name: /delete|confirm|yes/i }).first().click();
await page.waitForTimeout(1200);
const afterDelete = await fetch(`${base}/api/diagrams/${savedUrl.split('/').pop()}`);
check('confirmed delete removes it', afterDelete.status === 404, afterDelete.status);
const libraryText = await page.locator('body').innerText();
check('deleted diagram leaves the library', !/Browser flow/.test(libraryText));

// ---- unreachable-id deep link ----
await page.goto(`${base}/diagrams/00000000-0000-4000-8000-000000000000`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const notFoundText = await page.locator('body').innerText();
check('unknown id shows a not-found state', /not found|couldn.t|doesn.t exist|missing/i.test(notFoundText), notFoundText.slice(0, 160));

// ---- no CDN / external requests at any point ----
check('no external network requests during the whole flow', externalRequests.length === 0,
  [...new Set(externalRequests)].join(' | '));

const unexpectedResponses = badResponses.filter((r) => !r.includes('/api/diagrams/'));
check('no failed static or api request across the flow', unexpectedResponses.length === 0,
  unexpectedResponses.slice(0, 4).join(' | '));
check('no uncaught page errors across the flow',
  consoleErrors.filter((e) => !/Failed to load resource/.test(e)).length === 0,
  consoleErrors.slice(0, 3).join(' | '));

for (const n of notes) console.log(`note: ${n}`);
await browser.close();
console.log(fails === 0 ? '\nALL BROWSER CHECKS PASSED' : `\n${fails} BROWSER CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
