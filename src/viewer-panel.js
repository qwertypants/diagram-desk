/**
 * The viewer: reopening a saved diagram shows the render first, with no source
 * editor. The render is announced through a `role="status"` line, and failures
 * are shown as text in a `role="alert"` notice — never by colour alone.
 */

import { el, clear } from './dom.js';
import { formatTimestamp } from './draft.js';

function meta(diagram) {
  const parts = [];
  if (diagram.updatedAt) parts.push(`Updated ${formatTimestamp(diagram.updatedAt)}`);
  if (diagram.createdAt) parts.push(`Created ${formatTimestamp(diagram.createdAt)}`);
  return parts.join(' · ');
}

export function createViewerPanel({ doc, render, onEdit, onDelete }) {
  const root = el(doc, 'div', { class: 'viewer' });
  let sequence = 0;

  function notice(message) {
    return el(doc, 'div', { class: 'notice notice--error', role: 'alert' }, [
      el(doc, 'span', { class: 'notice__label', text: 'Error' }),
      el(doc, 'span', { class: 'notice__body', text: message }),
    ]);
  }

  function paint(children) {
    clear(root);
    root.append(...children.filter(Boolean));
  }

  function showMessage(message) {
    sequence += 1;
    paint([el(doc, 'div', { class: 'canvas' }, [el(doc, 'p', { class: 'canvas__note', text: message })])]);
  }

  async function showDiagram(diagram) {
    const mine = (sequence += 1);
    const statusId = 'viewer-status';
    const status = el(doc, 'p', {
      class: 'preview__status',
      id: statusId,
      role: 'status',
      text: 'Rendering the diagram…',
    });
    const canvas = el(doc, 'div', {
      class: 'canvas',
      role: 'img',
      'aria-labelledby': 'viewer-title',
      'aria-describedby': statusId,
    });

    paint([
      el(doc, 'div', {}, [
        el(doc, 'h2', { class: 'viewer__title', id: 'viewer-title', text: diagram.title }),
        el(doc, 'p', { class: 'viewer__meta', text: meta(diagram) }),
      ]),
      status,
      canvas,
      el(doc, 'div', { class: 'viewer__actions' }, [
        el(doc, 'button', { type: 'button', class: 'btn', text: 'Edit', onclick: () => onEdit(diagram.id) }),
        el(doc, 'button', {
          type: 'button',
          class: 'btn btn--danger',
          text: 'Delete',
          onclick: () => onDelete(diagram),
        }),
      ]),
    ]);

    const result = await render(diagram.source, canvas);
    if (mine !== sequence) return;
    if (result.status === 'ok') {
      status.textContent = result.diagramType
        ? `Rendered ${result.diagramType} diagram.`
        : 'Rendered the diagram.';
      canvas.innerHTML = result.svg;
      if (typeof result.bindFunctions === 'function') result.bindFunctions(canvas);
      return;
    }
    status.textContent = 'Could not render this diagram.';
    status.classList.add('is-error');
    canvas.append(el(doc, 'p', { class: 'canvas__note', text: 'Nothing to show — see the error below.' }));
    root.append(notice(result.message));
  }

  return {
    root,
    showEmpty() {
      showMessage('Choose a diagram from the library, or start a new one.');
    },
    showLoading() {
      showMessage('Loading the diagram…');
    },
    showNotFound(message) {
      paint([
        notice(message),
        el(doc, 'div', { class: 'canvas' }, [
          el(doc, 'p', { class: 'canvas__note', text: 'This diagram is not in the library.' }),
        ]),
      ]);
    },
    showError(message) {
      paint([notice(message)]);
    },
    showDiagram,
  };
}
