import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createDialogHost } from '../src/dialog.js';

function setup() {
  const dom = new JSDOM('<!doctype html><html><body><button id="trigger">open</button></body></html>', {
    pretendToBeVisual: true,
  });
  const { document } = dom.window;
  const host = createDialogHost(document);
  const trigger = document.getElementById('trigger');
  trigger.focus();
  return {
    dom,
    document,
    host,
    trigger,
    panel: () => document.querySelector('[role="dialog"]'),
    press(key, { shiftKey = false } = {}) {
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
      );
    },
    button(label) {
      return Array.from(document.querySelectorAll('.dialog button')).find((b) => b.textContent === label);
    },
  };
}

test('a confirm is a labelled modal dialog in the document', async () => {
  const t = setup();
  const pending = t.host.confirm({ title: 'Delete this diagram?', message: 'There is no undo.' });

  const panel = t.panel();
  assert.ok(panel);
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.equal(document_hasId(t, panel.getAttribute('aria-labelledby')), true);
  assert.equal(document_hasId(t, panel.getAttribute('aria-describedby')), true);
  assert.equal(t.panel().querySelector('h2').textContent, 'Delete this diagram?');
  assert.match(t.panel().textContent, /There is no undo\./);

  t.press('Escape');
  assert.equal(await pending, false);
});

function document_hasId(t, id) {
  return Boolean(id) && t.document.getElementById(id) !== null;
}

test('focus moves into the dialog and is restored to the invoking control', async () => {
  const t = setup();
  const pending = t.host.confirm({
    title: 'Discard unsaved edits?',
    message: 'Leaving discards them.',
    confirmLabel: 'Discard changes',
    destructive: true,
  });

  assert.equal(t.document.activeElement.textContent, 'Cancel');
  assert.ok(t.panel().contains(t.document.activeElement));

  t.button('Discard changes').click();
  assert.equal(await pending, true);
  assert.equal(t.document.activeElement, t.trigger);
  assert.equal(t.panel(), null, 'the dialog must leave the document');
  assert.equal(t.host.isOpen, false);
});

test('Tab and Shift+Tab wrap inside the dialog', async () => {
  const t = setup();
  const pending = t.host.confirm({ title: 'Delete?', message: 'Gone for good.', confirmLabel: 'Delete' });

  const cancel = t.button('Cancel');
  const confirm = t.button('Delete');

  confirm.focus();
  t.press('Tab');
  assert.equal(t.document.activeElement, cancel, 'Tab from the last control wraps to the first');

  t.press('Tab', { shiftKey: true });
  assert.equal(t.document.activeElement, confirm, 'Shift+Tab from the first control wraps to the last');

  t.press('Escape');
  await pending;
});

test('clicking the backdrop cancels, clicking Cancel cancels, confirming resolves true', async () => {
  const t = setup();
  const first = t.host.confirm({ title: 'Delete?', message: 'x' });
  t.panel().parentElement.dispatchEvent(
    new t.dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }),
  );
  assert.equal(await first, false);

  const second = t.host.confirm({ title: 'Delete?', message: 'x' });
  t.button('Cancel').click();
  assert.equal(await second, false);

  const third = t.host.confirm({ title: 'Delete?', message: 'x' });
  t.button('Confirm').click();
  assert.equal(await third, true);
});

test('a destructive confirmation is marked as such in the DOM', async () => {
  const t = setup();
  const pending = t.host.confirm({ title: 'Discard unsaved edits?', message: 'x', destructive: true });

  assert.match(t.panel().className, /dialog--destructive/);
  t.press('Escape');
  await pending;
});

test('a second confirmation is queued behind the open one', async () => {
  const t = setup();
  const first = t.host.confirm({ title: 'First', message: 'x' });
  const second = t.host.confirm({ title: 'Second', message: 'y' });

  assert.equal(t.document.querySelectorAll('[role="dialog"]').length, 1);
  assert.match(t.panel().textContent, /First/);

  t.button('Confirm').click();
  assert.equal(await first, true);
  assert.equal(t.document.querySelectorAll('[role="dialog"]').length, 1);
  assert.match(t.panel().textContent, /Second/);

  t.button('Confirm').click();
  assert.equal(await second, true);
  assert.equal(t.panel(), null);
});

test('everything behind an open dialog is inert, and released on close', async () => {
  const t = setup();
  const pending = t.host.confirm({ title: 'Delete this diagram?', message: 'There is no undo.' });

  assert.equal(t.trigger.hasAttribute('inert'), true, 'the invoking control cannot be reached');
  assert.equal(t.document.querySelector('[role="dialog"]').hasAttribute('inert'), false);

  t.press('Escape');
  await pending;

  assert.equal(t.trigger.hasAttribute('inert'), false);
  assert.equal(t.document.querySelectorAll('[inert]').length, 0);
  assert.equal(t.document.activeElement, t.trigger, 'focus is restored once the page is live again');
});

test('confirming a dialog releases the background too', async () => {
  const t = setup();
  const pending = t.host.confirm({ title: 'Delete?', message: 'x', confirmLabel: 'Delete' });

  assert.equal(t.trigger.hasAttribute('inert'), true);

  t.button('Delete').click();
  assert.equal(await pending, true);
  assert.equal(t.document.querySelectorAll('[inert]').length, 0);
});
