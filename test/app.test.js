import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createApp } from '../src/app.js';
import { PREVIEW } from '../src/draft.js';

const ORIGIN = 'http://127.0.0.1:4317';

const ORDER = {
  id: 'id-order',
  title: 'Order flow',
  source: 'flowchart TD\n  A --> B',
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
const BROKEN = 'flowchart TD\n  A -- > B';

/** Stands in for Mermaid: it decides from the source, so nothing about routing
 *  or the library depends on a recorded render script. */
async function render(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    return { status: PREVIEW.ERROR, message: 'There is no Mermaid source to render yet.' };
  }
  if (source.includes('-- >')) {
    return { status: PREVIEW.ERROR, message: 'Parse error on line 2' };
  }
  return { status: PREVIEW.OK, svg: '<svg id="out"><g/></svg>', diagramType: 'flowchart' };
}

function reply(payload, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

/** A stand-in for the JSON API, so these tests exercise routing and the
 *  library column against real `fetch` call shapes. */
function createApiStub({ diagrams = [ORDER, SHIP], failures = {} } = {}) {
  const calls = [];
  const state = { diagrams: [...diagrams], calls, failures };

  state.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const path = String(url);
    calls.push(`${method} ${path}`);

    const failure = state.failures[method];
    if (failure !== undefined) return reply({ error: failure.message }, failure.status);

    if (path === '/api/diagrams' || path.startsWith('/api/diagrams?')) {
      if (method === 'POST') {
        const draft = JSON.parse(options.body);
        const created = {
          id: 'id-new',
          title: draft.title,
          source: draft.source,
          createdAt: '2026-10-03T10:00:00.000Z',
          updatedAt: '2026-10-03T10:00:00.000Z',
        };
        state.diagrams = [created, ...state.diagrams];
        return reply(created, 201);
      }
      const term = (new URL(path, ORIGIN).searchParams.get('q') ?? '').toLowerCase();
      const matches = state.diagrams.filter((d) => d.title.toLowerCase().includes(term));
      return reply({ diagrams: matches });
    }

    const id = decodeURIComponent(path.slice('/api/diagrams/'.length));
    const found = state.diagrams.find((diagram) => diagram.id === id);
    if (method === 'DELETE') return found ? reply(null, 204) : reply({ error: 'Diagram not found' }, 404);
    return found ? reply(found) : reply({ error: 'Diagram not found' }, 404);
  };

  return state;
}

function setup({ url = `${ORIGIN}/`, diagrams, failures } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body><aside id="library"></aside><main id="stage" tabindex="-1"></main></body></html>',
    { url, pretendToBeVisual: true },
  );
  const { document } = dom.window;
  const api = createApiStub({ diagrams, failures });
  const app = createApp({ doc: document, win: dom.window, fetch: api.fetch, render });

  const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    dom,
    document,
    app,
    api,
    settle,
    path: () => dom.window.location.pathname,
    stage: () => document.getElementById('stage'),
    items: () => Array.from(document.querySelectorAll('.library__item')),
    titles: () =>
      Array.from(document.querySelectorAll('.library__item-title')).map((node) => node.textContent),
    selected: () => {
      const node = document.querySelector('.library__item[aria-current="true"] .library__item-title');
      return node === null ? null : node.textContent;
    },
    libraryStatus: () => document.getElementById('library-status').textContent,
    saveError: () => document.querySelector('.editor__saveerror'),
    type(id, value) {
      const node = document.getElementById(id);
      node.value = value;
      node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      return node;
    },
    submit() {
      document
        .querySelector('form.editor')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    },
    dialog: () => document.querySelector('[role="dialog"]'),
    dialogButton(label) {
      return Array.from(document.querySelectorAll('[role="dialog"] button')).find(
        (button) => button.textContent === label,
      );
    },
    press(key) {
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    },
    stageButton(label) {
      return Array.from(document.querySelectorAll('#stage button')).find(
        (button) => button.textContent === label,
      );
    },
  };
}

test('a cold load of a diagram deep link fills the library column', async () => {
  const t = setup({ url: `${ORIGIN}/diagrams/id-order` });

  await t.app.start();

  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
  assert.match(t.libraryStatus(), /2 saved diagrams\./);
  assert.equal(t.selected(), 'Order flow', 'the open diagram is marked in the library');
  assert.match(t.stage().textContent, /Order flow/, 'and the diagram itself is shown');
});

test('a cold load of the editor deep link fills the library column', async () => {
  const t = setup({ url: `${ORIGIN}/diagrams/id-order/edit` });

  await t.app.start();

  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
  assert.match(t.libraryStatus(), /2 saved diagrams\./);
  assert.equal(t.selected(), 'Order flow');
  assert.equal(t.document.getElementById('editor-source-field').value, ORDER.source);
});

test('a cold load of the compose route fills the library column', async () => {
  const t = setup({ url: `${ORIGIN}/new` });

  await t.app.start();

  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
  assert.equal(t.selected(), null);
  assert.equal(t.document.getElementById('editor-title-field').value, '');
});

test('an unknown deep link id still fills the library and clears the selection', async () => {
  const t = setup({ url: `${ORIGIN}/diagrams/id-missing` });

  await t.app.start();

  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
  assert.equal(t.selected(), null, 'nothing is selected when the id does not exist');
  assert.match(t.stage().textContent, /not in the library/);
});

test('an unknown path fills the library and offers a way back', async () => {
  const t = setup({ url: `${ORIGIN}/nowhere` });

  await t.app.start();

  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
  assert.match(t.stage().textContent, /Nothing is mapped to \/nowhere\./);
});

test('a deep link with a trailing slash is rewritten to its canonical form', async () => {
  const t = setup({ url: `${ORIGIN}/diagrams/id-order/` });

  await t.app.start();

  assert.equal(t.path(), '/diagrams/id-order');
  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
  assert.equal(t.selected(), 'Order flow');
});

test('a saved diagram becomes a deep link and joins the library', async () => {
  const t = setup({ url: `${ORIGIN}/new` });
  await t.app.start();

  t.type('editor-title-field', 'Browser flow check');
  t.type('editor-source-field', 'flowchart TD\n  A --> B');
  await t.settle(300);
  t.submit();
  await t.settle(50);

  assert.equal(t.path(), '/diagrams/id-new');
  assert.deepEqual(t.titles(), ['Browser flow check', 'Order flow', 'Shipping states']);
  assert.equal(t.selected(), 'Browser flow check');
  assert.equal(t.app.isDirty, false, 'the editor is clean once the write landed');
});

test('a rejected save keeps the draft, the route and the dirty flag', async () => {
  const t = setup({
    url: `${ORIGIN}/new`,
    failures: { POST: { status: 400, message: 'source must not be blank' } },
  });
  await t.app.start();

  t.type('editor-title-field', 'Browser flow check');
  t.type('editor-source-field', 'flowchart TD\n  A --> B');
  await t.settle(300);
  t.submit();
  await t.settle(50);

  assert.equal(t.path(), '/new', 'a failed write must not navigate');
  assert.equal(t.saveError().hidden, false);
  assert.equal(t.saveError().textContent, 'source must not be blank');
  assert.equal(t.document.getElementById('editor-title-field').value, 'Browser flow check');
  assert.equal(t.app.isDirty, true, 'unsaved edits still count as unsaved');
  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
});

test('leaving a dirty editor asks first, and a cancelled confirm stays put', async () => {
  const t = setup({ url: `${ORIGIN}/new` });
  await t.app.start();

  t.type('editor-title-field', 'Half-written');
  t.items()[1].click();
  await t.settle(20);

  const dialog = t.dialog();
  assert.ok(dialog, 'a discard confirmation is required');
  assert.match(dialog.textContent, /Discard unsaved edits\?/);

  t.press('Escape');
  await t.settle(20);

  assert.equal(t.path(), '/new');
  assert.equal(t.app.isDirty, true);
  assert.ok(t.document.querySelector('form.editor'), 'the editor is still on screen');

  t.items()[1].click();
  await t.settle(20);
  t.dialogButton('Discard changes').click();
  await t.settle(20);

  assert.equal(t.path(), '/diagrams/id-ship');
  assert.equal(t.app.isDirty, false);
});

test('a failed delete reports the error and keeps the diagram on screen', async () => {
  const t = setup({
    url: `${ORIGIN}/diagrams/id-order`,
    failures: { DELETE: { status: 500, message: 'Database is locked' } },
  });
  await t.app.start();

  t.stageButton('Delete').click();
  await t.settle(20);
  t.dialogButton('Delete').click();
  await t.settle(20);

  assert.equal(t.path(), '/diagrams/id-order', 'a failed delete must not navigate');
  assert.match(t.stage().textContent, /Database is locked/);
  assert.ok(t.api.calls.includes('DELETE /api/diagrams/id-order'));
});

test('a cancelled delete leaves the diagram alone', async () => {
  const t = setup({ url: `${ORIGIN}/diagrams/id-order` });
  await t.app.start();

  t.stageButton('Delete').click();
  await t.settle(20);
  t.press('Escape');
  await t.settle(20);

  assert.equal(t.path(), '/diagrams/id-order');
  assert.equal(t.api.calls.includes('DELETE /api/diagrams/id-order'), false);
  assert.deepEqual(t.titles(), ['Order flow', 'Shipping states']);
});

test('opening another diagram from the library re-marks the selection', async () => {
  const t = setup({ url: `${ORIGIN}/` });
  await t.app.start();
  assert.equal(t.selected(), null);

  t.items()[1].click();
  await t.settle(20);

  assert.equal(t.path(), '/diagrams/id-ship');
  assert.equal(t.selected(), 'Shipping states');
});
