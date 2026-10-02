/**
 * Modal confirmations: `role="dialog"` + `aria-modal="true"`, labelled,
 * focus trapped while open, focus restored to the invoking control on close,
 * and `Esc` cancels. One dialog at a time; a request made while another is open
 * is queued behind it.
 */

import { el } from './dom.js';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let sequence = 0;

function isReachable(node) {
  return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && node.closest('[hidden]') === null;
}

export function createDialogHost(doc) {
  let active = null;

  /** Everything beside an open dialog is inert, so pointer, focus and assistive
   *  technology cannot reach behind it while `aria-modal` says they should not. */
  function claimBackground(scrim) {
    for (const node of doc.body.children) {
      if (node !== scrim) node.setAttribute('inert', '');
    }
  }

  function releaseBackground(scrim) {
    for (const node of doc.body.children) {
      if (node !== scrim) node.removeAttribute('inert');
    }
  }

  function focusableNodes() {
    if (!active) return [];
    return Array.from(active.panel.querySelectorAll(FOCUSABLE)).filter(isReachable);
  }

  function onKeyDown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      active.close(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const nodes = focusableNodes();
    if (nodes.length === 0) {
      event.preventDefault();
      active.panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const current = doc.activeElement;
    if (event.shiftKey && (current === first || !nodes.includes(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !nodes.includes(current))) {
      event.preventDefault();
      first.focus();
    }
  }

  function close(value) {
    const current = active;
    if (!current) return;
    active = null;
    doc.removeEventListener('keydown', onKeyDown, true);
    current.scrim.remove();
    releaseBackground(current.scrim);
    const restore = current.restore;
    if (restore && typeof restore.focus === 'function' && restore.isConnected) restore.focus();
    current.resolve(value);
  }

  function confirm(options = {}) {
    if (active) return active.promise.then(() => confirm(options));

    const {
      title = 'Are you sure?',
      message = '',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      destructive = false,
    } = options;

    let resolve;
    const promise = new Promise((settle) => {
      resolve = settle;
    });
    const restore = doc.activeElement;
    const id = `dialog-${(sequence += 1)}`;

    const confirmButton = el(doc, 'button', {
      type: 'button',
      class: 'btn btn--primary',
      text: confirmLabel,
      onclick: () => close(true),
    });
    const cancelButton = el(doc, 'button', {
      type: 'button',
      class: 'btn',
      text: cancelLabel,
      onclick: () => close(false),
    });

    const panel = el(
      doc,
      'div',
      {
        class: destructive ? 'dialog dialog--destructive' : 'dialog',
        role: 'dialog',
        'aria-modal': 'true',
        tabindex: '-1',
        'aria-labelledby': `${id}-title`,
        'aria-describedby': `${id}-message`,
      },
      [
        el(doc, 'h2', { class: 'dialog__title', id: `${id}-title`, text: title }),
        el(doc, 'p', { class: 'dialog__message', id: `${id}-message`, text: message }),
        el(doc, 'div', { class: 'dialog__actions' }, [cancelButton, confirmButton]),
      ],
    );
    const scrim = el(doc, 'div', { class: 'scrim' }, [panel]);
    scrim.addEventListener('mousedown', (event) => {
      if (event.target === scrim) close(false);
    });

    active = { panel, scrim, resolve, promise, restore, close };
    doc.body.append(scrim);
    claimBackground(scrim);
    doc.addEventListener('keydown', onKeyDown, true);
    cancelButton.focus();
    return promise;
  }

  return {
    confirm,
    get isOpen() {
      return active !== null;
    },
  };
}
