import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createApp } from '../src/app.js';
import { PREVIEW } from '../src/draft.js';

const DIAGRAM = {
  id: 'phone-flow',
  title: 'Phone flow',
  source: 'flowchart TD\n A --> B',
  createdAt: '2026-10-01T09:15:00.000Z',
  updatedAt: '2026-10-02T09:20:00.000Z',
};

function setup(path = '/', { diagramStatus = 200 } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body><div class="desk"><header class="masthead"><button id="library-toggle" aria-controls="library" aria-expanded="false">Library</button></header><div class="desk__body"><aside id="library"></aside><button id="library-backdrop" type="button"></button><main id="stage" tabindex="-1"></main></div></div></body></html>',
    { url: `http://localhost${path}`, pretendToBeVisual: true },
  );
  dom.window.matchMedia = (query) => ({
    media: query,
    matches: query.includes('62rem'),
    addEventListener() {},
  });
  const fetch = async (url) => {
    const pathname = String(url);
    const isList = pathname === '/api/diagrams';
    const status = isList ? 200 : diagramStatus;
    const payload = isList
      ? { diagrams: [DIAGRAM] }
      : status >= 400 ? { error: 'Diagram service unavailable' } : DIAGRAM;
    return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(payload); } };
  };
  const render = async () => ({ status: PREVIEW.OK, svg: '<svg><g/></svg>' });
  const app = createApp({ doc: dom.window.document, win: dom.window, fetch, render });
  return { dom, app, document: dom.window.document };
}

test('phone library opens on the empty route and closes with Escape, returning focus', async () => {
  const t = setup();
  await t.app.start();

  const desk = t.document.querySelector('.desk');
  const toggle = t.document.getElementById('library-toggle');
  const close = t.document.querySelector('.mobile-drawer__close');
  assert.equal(desk.classList.contains('mobile-drawer-open'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(t.document.getElementById('stage').inert, true);
  assert.equal(t.document.activeElement, close);

  t.document.dispatchEvent(new t.dom.window.KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, cancelable: true,
  }));
  assert.equal(desk.classList.contains('mobile-drawer-open'), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(t.document.getElementById('stage').inert, false);
  assert.equal(t.document.activeElement, toggle);
});

test('phone drawer traps focus and closes after a successful library route navigation', async () => {
  const t = setup();
  await t.app.start();
  const close = t.document.querySelector('.mobile-drawer__close');
  const last = t.document.querySelector('.library__item');

  last.focus();
  t.document.dispatchEvent(new t.dom.window.KeyboardEvent('keydown', {
    key: 'Tab', bubbles: true, cancelable: true,
  }));
  assert.equal(t.document.activeElement, close);

  last.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(t.app.currentPath, '/diagrams/phone-flow');
  assert.equal(t.document.querySelector('.desk').classList.contains('mobile-drawer-open'), false);
  assert.equal(t.document.getElementById('stage').inert, false);
});

test('phone drawer closes from its backdrop', async () => {
  const t = setup();
  await t.app.start();
  t.document.getElementById('library-backdrop').click();
  assert.equal(t.document.querySelector('.desk').classList.contains('mobile-drawer-open'), false);
  assert.equal(t.document.activeElement, t.document.getElementById('library-toggle'));
});

test('opening New diagram closes the drawer before focusing the editor title', async () => {
  const t = setup();
  await t.app.start();

  t.document.querySelector('.panel__head .btn--primary').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(t.app.currentPath, '/new');
  assert.equal(t.document.querySelector('.desk').classList.contains('mobile-drawer-open'), false);
  assert.equal(t.document.getElementById('stage').inert, false);
  assert.equal(t.document.activeElement, t.document.getElementById('editor-title-field'));
});

test('opening a saved diagram from the phone drawer moves focus to its heading', async () => {
  const t = setup();
  await t.app.start();

  t.document.querySelector('.library__item').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const heading = t.document.getElementById('viewer-title');
  assert.equal(t.app.currentPath, '/diagrams/phone-flow');
  assert.equal(heading.getAttribute('tabindex'), '-1');
  assert.equal(t.document.activeElement, heading);
});

test('saved diagram load errors move focus to the stage', async () => {
  const t = setup('/', { diagramStatus: 500 });
  await t.app.start();

  t.document.querySelector('.library__item').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.match(t.document.querySelector('#stage').textContent, /Diagram service unavailable/);
  assert.equal(t.document.activeElement, t.document.getElementById('stage'));
});
