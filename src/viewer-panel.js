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
    const minZoom = 0.5;
    const maxZoom = 4;
    const zoomStep = 1.2;
    const statusId = 'viewer-status';
    const status = el(doc, 'p', {
      class: 'preview__status',
      id: statusId,
      role: 'status',
      text: 'Rendering the diagram…',
    });
    const canvas = el(doc, 'div', {
      class: 'canvas diagram-explorer__viewport',
      role: 'group',
      'aria-describedby': statusId,
      tabindex: '0',
      'aria-label': `Diagram viewport for ${diagram.title}. Use arrow keys to pan.`,
    });
    const zoomOut = el(doc, 'button', {
      type: 'button',
      class: 'diagram-explorer__control',
      text: '−',
      'aria-label': 'Zoom out',
      title: 'Zoom out',
      disabled: true,
    });
    const zoomIn = el(doc, 'button', {
      type: 'button',
      class: 'diagram-explorer__control',
      text: '+',
      'aria-label': 'Zoom in',
      title: 'Zoom in',
      disabled: true,
    });
    const controls = el(doc, 'div', {
      class: 'diagram-explorer__controls',
      role: 'group',
      'aria-label': 'Diagram zoom controls',
      hidden: true,
    }, [zoomIn, zoomOut]);
    const explorer = el(doc, 'div', { class: 'diagram-explorer' }, [canvas, controls]);

    const art = el(doc, 'div', { class: 'diagram-explorer__art' });
    let svg = null;
    let zoom = 1;
    let offsetX = 0;
    let offsetY = 0;
    let drag = null;
    let movedDuringDrag = false;
    let suppressClick = false;

    function updateView() {
      art.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
      zoomIn.disabled = zoom >= maxZoom;
      zoomOut.disabled = zoom <= minZoom;
    }

    function zoomTo(nextZoom, point) {
      if (!svg) return;
      const boundedZoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
      if (boundedZoom === zoom) return;
      const ratio = boundedZoom / zoom;
      if (point) {
        offsetX = point.x - (point.x - offsetX) * ratio;
        offsetY = point.y - (point.y - offsetY) * ratio;
      }
      zoom = boundedZoom;
      updateView();
    }

    function zoomAtCenter(direction) {
      zoomTo(zoom * direction, { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
    }

    zoomOut.addEventListener('click', () => zoomAtCenter(1 / zoomStep));
    zoomIn.addEventListener('click', () => zoomAtCenter(zoomStep));

    canvas.addEventListener('wheel', (event) => {
      if (!svg) return;
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const wheelDelta = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * canvas.clientHeight
          : event.deltaY;
      zoomTo(zoom * Math.exp(-wheelDelta * 0.001), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    }, { passive: false });

    canvas.addEventListener('pointerdown', (event) => {
      if (!svg || event.button !== 0 || event.isPrimary === false) return;
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offsetX,
        offsetY,
      };
      movedDuringDrag = false;
      canvas.classList.add('is-panning');
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedDuringDrag = true;
      offsetX = drag.offsetX + dx;
      offsetY = drag.offsetY + dy;
      updateView();
    });

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      canvas.classList.remove('is-panning');
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      if (movedDuringDrag) {
        suppressClick = true;
        globalThis.setTimeout(() => { suppressClick = false; }, 0);
      }
    }

    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('click', (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    canvas.addEventListener('keydown', (event) => {
      if (!svg) return;
      const pan = {
        ArrowLeft: [40, 0],
        ArrowRight: [-40, 0],
        ArrowUp: [0, 40],
        ArrowDown: [0, -40],
      }[event.key];
      if (!pan) return;
      event.preventDefault();
      offsetX += pan[0];
      offsetY += pan[1];
      updateView();
    });

    paint([
      el(doc, 'div', {}, [
        el(doc, 'h2', { class: 'viewer__title', id: 'viewer-title', text: diagram.title }),
        el(doc, 'p', { class: 'viewer__meta', text: meta(diagram) }),
      ]),
      status,
      explorer,
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
      svg = canvas.querySelector('svg');
      if (svg) {
        canvas.classList.add('diagram-explorer__viewport');
        art.append(svg);
        canvas.append(art);
        controls.hidden = false;
        updateView();
      }
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
