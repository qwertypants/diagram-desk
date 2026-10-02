import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createEditorPanel } from '../src/editor-panel.js';
import { PREVIEW } from '../src/draft.js';

const VALID = 'flowchart TD\n  A[Start] --> B[End]';
const BROKEN = 'flowchart TD\n  A -- > B';

/** Stands in for Mermaid: it decides from the source, so the gating under test
 *  is driven by real editor behaviour rather than by a recorded script. */
function renderStub() {
  const calls = [];
  const render = async (source) => {
    calls.push(source);
    if (typeof source !== 'string' || source.trim() === '') {
      return { status: PREVIEW.ERROR, message: 'There is no Mermaid source to render yet.' };
    }
    if (source.includes('-- >')) {
      return { status: PREVIEW.ERROR, message: 'Parse error on line 2' };
    }
    return { status: PREVIEW.OK, svg: '<svg id="out"><g/></svg>', diagramType: 'flowchart' };
  };
  return { calls, render };
}

function setup() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { document } = dom.window;
  const stub = renderStub();
  const saves = [];
  const cancels = [];
  const dirtyStates = [];
  const panel = createEditorPanel({
    doc: document,
    render: stub.render,
    onSave: (draft, id) => {
      saves.push({ draft, id });
      return Promise.resolve();
    },
    onCancel: () => cancels.push(true),
    onDirtyChange: (value) => dirtyStates.push(value),
  });
  document.body.append(panel.root);

  const field = (id) => document.getElementById(id);
  return {
    dom,
    document,
    panel,
    stub,
    saves,
    cancels,
    dirtyStates,
    save: () => document.querySelector('button[type="submit"]'),
    status: () => document.querySelector('#preview-status'),
    error: () => document.querySelector('.preview .notice'),
    errorText: () => document.querySelector('.preview .notice__body'),
    saveError: () => document.querySelector('.editor__saveerror'),
    hint: () => document.getElementById('editor-hint'),
    canvas: () => document.querySelector('.canvas'),
    type(id, value) {
      const node = field(id);
      node.value = value;
      node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      return node;
    },
    blur(id) {
      field(id).dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: false }));
    },
    submit() {
      panel.root.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    },
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

test('the editor labels its controls and announces the preview politely', () => {
  const t = setup();
  t.panel.mount();

  assert.ok(t.document.querySelector('label[for="editor-title-field"]'));
  assert.ok(t.document.querySelector('label[for="editor-source-field"]'));
  assert.equal(t.status().getAttribute('role'), 'status');
  assert.equal(t.error().getAttribute('role'), 'alert');
  assert.equal(t.error().hidden, true);
  assert.equal(t.canvas().getAttribute('role'), 'img');
  assert.equal(t.document.querySelector('#editor-title-field').maxLength, 200);
});

test('Save starts disabled on a blank draft', () => {
  const t = setup();
  t.panel.mount();

  assert.equal(t.save().disabled, true);
  assert.match(t.hint().textContent, /Add a title/);
});

test('Save stays disabled until there is a title AND a successful preview', async () => {
  const t = setup();
  t.panel.mount();

  t.type('editor-source-field', VALID);
  t.blur('editor-source-field');
  await t.settle();

  assert.equal(t.stub.calls.length, 1);
  assert.equal(t.panel.previewStatus, PREVIEW.OK);
  assert.equal(t.save().disabled, true, 'a successful preview alone is not enough');
  assert.match(t.hint().textContent, /Add a title/);
  assert.match(t.canvas().innerHTML, /<svg/);

  t.type('editor-title-field', 'Order flow');
  await t.settle();

  assert.equal(t.save().disabled, false);
  assert.equal(t.hint().textContent, 'Ready to save.');
  assert.match(t.status().textContent, /Rendered flowchart diagram\./);
});

test('a failed render keeps Save disabled and shows the error as text', async () => {
  const t = setup();
  t.panel.mount();
  t.type('editor-title-field', 'Order flow');

  t.type('editor-source-field', BROKEN);
  t.blur('editor-source-field');
  await t.settle();

  assert.equal(t.panel.previewStatus, PREVIEW.ERROR);
  assert.equal(t.save().disabled, true);
  assert.equal(t.error().hidden, false);
  assert.equal(t.errorText().textContent, 'Parse error on line 2');
  assert.match(t.status().textContent, /Could not render/);
  assert.match(t.status().className, /is-error/);
  assert.match(t.errorText().textContent, /Parse error/, 'the message must carry the reason, not just a colour');

  t.type('editor-source-field', VALID);
  t.blur('editor-source-field');
  await t.settle();

  assert.equal(t.save().disabled, false);
  assert.equal(t.error().hidden, true);
  assert.equal(t.errorText().textContent, '');
});

test('editing after a successful render disables Save again until the next render', async () => {
  const t = setup();
  t.panel.mount();
  t.type('editor-title-field', 'Order flow');
  t.type('editor-source-field', VALID);
  t.blur('editor-source-field');
  await t.settle();
  assert.equal(t.save().disabled, false);

  t.type('editor-source-field', `${VALID}\n  B --> C`);

  assert.equal(t.save().disabled, true, 'a pending re-render must not leave Save enabled');
  assert.match(t.status().textContent, /Rendering/);

  t.blur('editor-source-field');
  await t.settle();
  assert.equal(t.save().disabled, false);
});

test('a burst of typing renders once, with the final source', async () => {
  const t = setup();
  t.panel.mount();

  t.type('editor-source-field', 'f');
  t.type('editor-source-field', 'fl');
  t.type('editor-source-field', 'flowchart TD');
  t.type('editor-source-field', VALID);

  assert.deepEqual(t.stub.calls, [], 'nothing renders before the debounce elapses');
  await t.delay(320);
  assert.deepEqual(t.stub.calls, [VALID]);
});

test('blur flushes the pending render, so the final keystroke is never dropped', async () => {
  const t = setup();
  t.panel.mount();

  t.type('editor-source-field', VALID);
  assert.deepEqual(t.stub.calls, []);

  t.blur('editor-source-field');
  await t.settle();

  assert.deepEqual(t.stub.calls, [VALID]);
  assert.equal(t.panel.previewStatus, PREVIEW.OK);
});

test('flushRender delivers a pending render without waiting for the debounce', async () => {
  const t = setup();
  t.panel.mount();

  t.type('editor-source-field', VALID);
  t.panel.flushRender();
  await t.settle();

  assert.deepEqual(t.stub.calls, [VALID]);
});

test('opening an existing diagram previews it and is not dirty', async () => {
  const t = setup();
  t.panel.mount({ diagram: { id: 'abc', title: 'Order flow', source: VALID } });
  await t.settle();

  assert.equal(t.panel.diagramId, 'abc');
  assert.equal(t.panel.isDirty, false);
  assert.deepEqual(t.dirtyStates.at(-1), false);
  assert.deepEqual(t.stub.calls, [VALID]);
  assert.equal(t.document.getElementById('editor-title-field').value, 'Order flow');
  assert.equal(t.document.getElementById('editor-source-field').value, VALID);
  assert.equal(t.save().disabled, false, 'an unchanged saved diagram is still saveable');
});

test('typing reports dirty, and re-opening the diagram clears it', async () => {
  const t = setup();
  t.panel.mount({ diagram: { id: 'abc', title: 'Order flow', source: VALID } });
  await t.settle();

  t.type('editor-source-field', `${VALID}\n  B --> C`);
  await t.settle();
  assert.equal(t.panel.isDirty, true);
  assert.equal(t.dirtyStates.at(-1), true);

  t.type('editor-title-field', '   ');
  assert.equal(t.panel.isDirty, true, 'clearing the title is still an edit');

  t.panel.mount({ diagram: { id: 'abc', title: 'Order flow', source: VALID } });
  await t.settle();
  assert.equal(t.panel.isDirty, false);
  assert.equal(t.dirtyStates.at(-1), false);
});

test('a blank draft is not dirty until something is typed', () => {
  const t = setup();
  t.panel.mount();

  assert.equal(t.panel.isDirty, false);
  t.type('editor-title-field', 'x');
  assert.equal(t.panel.isDirty, true);
});

test('submitting saves the draft only when Save is enabled', async () => {
  const t = setup();
  t.panel.mount();
  t.type('editor-title-field', 'Order flow');

  t.submit();
  await t.settle();
  assert.deepEqual(t.saves, [], 'no title-plus-preview means no save');

  t.type('editor-source-field', VALID);
  t.blur('editor-source-field');
  await t.settle();
  t.submit();
  await t.settle();

  assert.deepEqual(t.saves, [{ draft: { title: 'Order flow', source: VALID }, id: null }]);

  t.panel.mount({ diagram: { id: 'abc', title: 'Order flow', source: VALID } });
  await t.settle();
  t.submit();
  await t.settle();
  assert.deepEqual(t.saves.at(-1), { draft: { title: 'Order flow', source: VALID }, id: 'abc' });
});

test('a rejected save leaves the draft intact and shows the server message', async () => {
  const t = setup();
  t.panel.mount();
  t.type('editor-title-field', 'Order flow');
  t.type('editor-source-field', VALID);
  t.blur('editor-source-field');
  await t.settle();

  t.panel.showSaveError('source is required');
  t.submit();
  await t.settle();

  assert.equal(t.saveError().hidden, false);
  assert.equal(t.saveError().textContent, 'source is required');
  assert.equal(t.saveError().getAttribute('role'), 'alert');
  assert.equal(t.document.getElementById('editor-source-field').value, VALID);
  assert.equal(t.document.getElementById('editor-title-field').value, 'Order flow');
  assert.equal(t.panel.isSaving, false, 'the editor returns to a usable state');
});

test('a slow render never overwrites the result of a newer one', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const resolvers = [];
  const panel = createEditorPanel({
    doc: dom.window.document,
    render: (source) =>
      new Promise((resolve) => {
        resolvers.push(() =>
          resolve(
            source.includes('-- >')
              ? { status: PREVIEW.ERROR, message: 'Parse error on line 2' }
              : { status: PREVIEW.OK, svg: `<svg data-source="${source.length}"></svg>` },
          ),
        );
      }),
    onSave: () => Promise.resolve(),
    onCancel: () => {},
    onDirtyChange: () => {},
  });
  dom.window.document.body.append(panel.root);

  const type = (value) => {
    const field = dom.window.document.getElementById('editor-source-field');
    field.value = value;
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    panel.flushRender();
  };

  type(BROKEN);
  type(VALID);
  assert.equal(resolvers.length, 2);

  resolvers[1]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  resolvers[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(panel.previewStatus, PREVIEW.OK);
  assert.equal(dom.window.document.querySelector('.canvas svg').getAttribute('data-source'), String(VALID.length));
});

test('Cancel asks the app to leave without saving', () => {
  const t = setup();
  t.panel.mount();

  t.document.querySelector('.editor__actions .btn').click();

  assert.deepEqual(t.cancels, [true]);
});
