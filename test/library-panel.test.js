import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createApiClient } from '../src/api.js';
import { createLibraryPanel } from '../src/library-panel.js';

const ORDER = {
  id: 'id-order',
  title: 'Order flow',
  source: 'flowchart TD\n A-->B',
  createdAt: '2026-10-01T09:15:00.000Z',
  updatedAt: '2026-10-02T09:20:00.000Z',
};
const SHIP = {
  id: 'id-ship',
  title: 'Shipping states',
  source: 'stateDiagram-v2\n [*] --> Sent',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return payload === undefined ? '' : JSON.stringify(payload);
    },
  };
}

function setup({ handler } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><aside id="library"></aside></body></html>');
  const { document } = dom.window;
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    return handler ? handler(url) : response(200, { diagrams: [ORDER, SHIP] });
  };
  const opened = [];
  const composed = [];
  const panel = createLibraryPanel({
    root: document.getElementById('library'),
    api: createApiClient({ fetch: fetchImpl }),
    onOpen: (id) => opened.push(id),
    onCompose: () => composed.push(true),
  });
  return {
    dom,
    document,
    panel,
    requests,
    opened,
    composed,
    items: () => Array.from(document.querySelectorAll('.library__item')),
    search: () => document.getElementById('library-search'),
    status: () => document.getElementById('library-status'),
    type(value) {
      const input = document.getElementById('library-search');
      input.value = value;
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    },
    press(key) {
      const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.querySelector('.library__item').dispatchEvent(event);
      return event;
    },
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

test('the library is a real list of buttons, with a label on the search field', async () => {
  const t = setup();
  await t.panel.reload();

  const list = t.document.querySelector('ul.library__list');
  assert.ok(list);
  assert.equal(list.getAttribute('aria-label'), 'Saved diagrams');
  assert.equal(list.querySelectorAll('li').length, 2);
  assert.equal(t.items().length, 2);
  assert.deepEqual(
    t.items().map((item) => item.querySelector('.library__item-title').textContent),
    ['Order flow', 'Shipping states'],
  );
  for (const item of t.items()) {
    assert.equal(item.tagName, 'BUTTON');
    assert.equal(item.getAttribute('type'), 'button');
    assert.match(item.querySelector('.library__item-time').textContent, /\d{4}/);
  }

  const label = t.document.querySelector('label[for="library-search"]');
  assert.ok(label);
  assert.equal(t.search().id, 'library-search');
  assert.match(t.status().textContent, /2 saved diagrams\./);
});

test('the selected item is marked with aria-current and a selected class', async () => {
  const t = setup();
  await t.panel.reload();

  assert.equal(t.items().some((item) => item.getAttribute('aria-current') === 'true'), false);

  t.panel.setSelected('id-ship');

  const [order, ship] = t.items();
  assert.equal(order.getAttribute('aria-current'), null);
  assert.equal(ship.getAttribute('aria-current'), 'true');
  assert.match(ship.className, /is-selected/);

  t.panel.setSelected(null);
  assert.equal(t.items().some((item) => item.getAttribute('aria-current') === 'true'), false);
});

test('choosing an item opens that diagram and New diagram asks for the compose route', async () => {
  const t = setup();
  await t.panel.reload();

  t.items()[1].click();
  assert.deepEqual(t.opened, ['id-ship']);

  t.document.querySelector('.panel__head .btn').click();
  assert.deepEqual(t.composed, [true]);
});

test('arrow keys, Home and End move focus between items', async () => {
  const t = setup();
  await t.panel.reload();
  const items = () => t.items();

  items()[0].focus();
  assert.equal(t.press('ArrowDown').defaultPrevented, true);
  assert.equal(t.document.activeElement, items()[1]);

  t.press('ArrowDown');
  assert.equal(t.document.activeElement, items()[1], 'focus stops at the last item');

  t.press('ArrowUp');
  assert.equal(t.document.activeElement, items()[0]);

  t.press('ArrowDown');
  t.press('Home');
  assert.equal(t.document.activeElement, items()[0]);

  t.press('End');
  assert.equal(t.document.activeElement, items()[1]);
});

test('search queries the API and shows the filtered result', async () => {
  const t = setup({
    handler: (url) =>
      response(200, { diagrams: url.includes('q=order') ? [ORDER] : [ORDER, SHIP] }),
  });
  await t.panel.reload();

  t.type('order');
  await t.delay(260);

  assert.deepEqual(t.requests, ['/api/diagrams', '/api/diagrams?q=order']);
  assert.equal(t.items().length, 1);
  assert.equal(t.items()[0].textContent.includes('Order flow'), true);
});

test('an empty result set explains itself instead of showing a blank column', async () => {
  const t = setup({ handler: () => response(200, { diagrams: [] }) });
  await t.panel.reload();

  assert.equal(t.items().length, 0);
  assert.match(t.status().textContent, /No diagrams saved yet/);

  t.type('zzz');
  await t.delay(260);
  assert.match(t.status().textContent, /No diagrams match that search\./);
});

test('a failed load shows the server message and can be retried', async () => {
  let attempts = 0;
  const t = setup({
    handler: () => {
      attempts += 1;
      return attempts === 1
        ? response(500, { error: 'Database is locked' })
        : response(200, { diagrams: [SHIP] });
    },
  });

  await t.panel.reload();
  assert.match(t.status().textContent, /Could not load the library: Database is locked/);
  assert.equal(t.items().length, 0);

  t.document.querySelector('#library-retry .btn').click();
  await t.delay(20);

  assert.equal(t.items().length, 1);
  assert.match(t.status().textContent, /1 saved diagram\./);
});

test('a slow response for an older query never overwrites a newer one', async () => {
  const pending = [];
  const t = setup({
    handler: () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  });

  const first = t.panel.reload();
  const second = t.panel.reload();
  assert.equal(pending.length, 2);

  pending[1](response(200, { diagrams: [SHIP] }));
  await second;
  pending[0](response(200, { diagrams: [] }));
  await first;

  assert.equal(t.items().length, 1, 'the stale first response must not clear the list');
  assert.equal(t.items()[0].textContent.includes('Shipping states'), true);
  assert.match(t.status().textContent, /1 saved diagram\./);
});
