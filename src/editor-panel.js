/**
 * The editor: title, Archify JSON source, and a live preview. Save stays disabled
 * until there is a title AND a successful preview; a failed render keeps it
 * disabled and shows the error as text.
 *
 * The preview re-renders on a debounce whose trailing call always carries the
 * newest source, and `flushRender()` is wired to blur and page unload so the
 * final keystroke is never the one that gets dropped.
 */

import { createReaderFrame } from './preview.js';
import { el, clear, setMessage } from './dom.js';
import { createDebounced } from './debounce.js';
import { PREVIEW, draftFromDiagram, emptyDraft, canSave, isDirty, saveBlockedReason } from './draft.js';

const RENDER_DEBOUNCE_MS = 220;

export function createEditorPanel({ doc, render, onSave, onCancel, onDirtyChange }) {
  const root = el(doc, 'form', { class: 'editor', novalidate: true });
  let baseline = emptyDraft();
  let diagramId = null;
  let preview = { status: PREVIEW.IDLE, message: '' };
  let sequence = 0;
  let saving = false;

  const heading = el(doc, 'h2', { class: 'editor__title', id: 'editor-title' });
  const saveButton = el(doc, 'button', { type: 'submit', class: 'btn btn--primary', text: 'Save' });
  const cancelButton = el(doc, 'button', {
    type: 'button',
    class: 'btn',
    text: 'Cancel',
    onclick: () => onCancel(),
  });

  const title = el(doc, 'input', {
    id: 'editor-title-field',
    class: 'input',
    type: 'text',
    name: 'title',
    maxlength: '200',
    autocomplete: 'off',
    'aria-describedby': 'editor-hint',
  });

  const source = el(doc, 'textarea', {
    id: 'editor-source-field',
    class: 'textarea',
    name: 'source',
    rows: '18',
    spellcheck: 'false',
    autocomplete: 'off',
    autocapitalize: 'off',
    'aria-describedby': 'editor-hint',
  });

  const type = el(doc, 'select', { class: 'input', id: 'diagram-type', 'aria-label': 'Diagram type' });
  for (const name of ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle', 'erd', 'class', 'tree', 'timeline', 'waterfall']) type.append(el(doc, 'option', { value: name, text: name }));
  const notes = el(doc, 'textarea', { class: 'textarea', id: 'lesson-json', rows: '10', spellcheck: 'false', 'aria-label': 'Lesson notes JSON' });
  const starter = el(doc, 'button', { class: 'btn', type: 'button', text: 'Load starter', onclick: async () => {
    const response = await fetch(`/starters/${type.value}.json`);
    if (!response.ok) { hint.textContent = 'Could not load the starter. Your draft is still here.'; return; }
    source.value = JSON.stringify(await response.json(), null, 2);
    onSourceChanged();
  } });
  const status = el(doc, 'p', { class: 'preview__status', id: 'preview-status', role: 'status' });
  const canvas = el(doc, 'div', {
    class: 'canvas',
    role: 'group',
    'aria-labelledby': 'preview-title',
    'aria-describedby': 'preview-status',
  });
  const error = el(doc, 'div', { class: 'notice notice--error', role: 'alert', hidden: true }, [
    el(doc, 'span', { class: 'notice__label', text: 'Error' }),
    el(doc, 'span', { class: 'notice__body' }),
  ]);
  const errorBody = error.querySelector('.notice__body');
  const hint = el(doc, 'p', { class: 'editor__hint', id: 'editor-hint' });
  const saveError = el(doc, 'div', {
    class: 'notice notice--error editor__saveerror',
    role: 'alert',
    hidden: true,
  });

  root.append(
    el(doc, 'div', { class: 'editor__head' }, [
      heading,
      el(doc, 'div', { class: 'editor__actions' }, [cancelButton, saveButton]),
    ]),
    el(doc, 'div', { class: 'field' }, [
      el(doc, 'label', { class: 'field__label', for: 'editor-title-field', text: 'Title' }),
      title,
    ]),
    el(doc, 'div', { class: 'editor__split' }, [
      el(doc, 'div', { class: 'field' }, [
        el(doc, 'label', { class: 'field__label', for: 'editor-source-field', text: 'Archify JSON' }),
        source,
      ]),
      el(doc, 'div', { class: 'preview' }, [
        el(doc, 'div', { class: 'preview__bar' }, [
          el(doc, 'h3', { class: 'preview__title', id: 'preview-title', text: 'Preview' }),
          status,
        ]),
        canvas,
        error,
      ]),
    ]),
    el(doc, 'div', { class: 'editor-tools' }, [type, starter]),
    el(doc, 'details', { class: 'lesson-editor' }, [
      el(doc, 'summary', { text: 'Edit the learning notes' }),
      el(doc, 'p', { text: 'Optional JSON: summary, problem, objectives, walkthrough (title and detail), decisions, failureModes, takeaways, scope, references (title and url).' }), notes,
    ]),
    hint,
    saveError,
  );

  function getDraft() {
    const draft = { title: title.value, source: source.value };
    if (source.value.trim().startsWith('{')) {
      draft.type = type.value;
      try { draft.lesson = notes.value.trim() ? JSON.parse(notes.value) : null; }
      catch { draft.lesson = notes.value; }
    }
    return draft;
  }

  function reportDirty() {
    onDirtyChange(isDirty(getDraft(), baseline));
  }

  function syncSaveState() {
    const draft = getDraft();
    const invalidNotes = draft.lesson !== undefined && draft.lesson !== null && (typeof draft.lesson !== 'object' || Array.isArray(draft.lesson));
    saveButton.disabled = saving || invalidNotes || !canSave({ draft, preview });
    hint.textContent = invalidNotes ? 'Learning notes must be a JSON object.' : saving ? 'Saving…' : (saveBlockedReason({ draft, preview }) ?? 'Ready to save.');
  }

  /** The status line is a live region, so it is only written when the words
   *  change: re-announcing "Rendering…" on every keystroke talks over typing. */
  function showStatus(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function showPreviewState() {
    status.classList.toggle('is-error', preview.status === PREVIEW.ERROR);
    const isError = preview.status === PREVIEW.ERROR;
    const isPending = preview.status === PREVIEW.PENDING;
    const isOk = preview.status === PREVIEW.OK;

    if (isPending) showStatus('Rendering…');
    else if (isError) showStatus('Could not render the preview.');
    else if (isOk) {
      showStatus(
        preview.diagramType
          ? `Rendered ${preview.diagramType} diagram.`
          : 'Rendered the diagram.',
      );
    } else showStatus('');

    setMessage(errorBody, isError ? preview.message : '');
    error.hidden = !isError;
  }

  async function applyRender(text) {
    const mine = (sequence += 1);
    let result;
    try {
      if (text.trim().startsWith('{') && JSON.parse(text).diagram_type !== type.value) throw new Error('The selected type must match diagram_type in the JSON.');
      result = await render(text, canvas);
    } catch (error) { result = { status: PREVIEW.ERROR, message: error.message }; }
    if (mine !== sequence) return;
    preview = result.status === PREVIEW.OK ? { ...result } : { status: PREVIEW.ERROR, message: result.message };
    if (preview.status === PREVIEW.OK) {
      clear(canvas);
      if (preview.readerUrl) canvas.append(createReaderFrame(doc, preview.readerUrl, 'Diagram preview'));
      else canvas.innerHTML = preview.svg;
      if (typeof preview.bindFunctions === 'function') preview.bindFunctions(canvas);
    } else {
      clear(canvas);
      canvas.append(
        el(doc, 'p', { class: 'canvas__note', text: 'The preview is empty because the source has an error.' }),
      );
    }
    showPreviewState();
    syncSaveState();
  }

  const renderDebounced = createDebounced((text) => {
    applyRender(text);
  }, RENDER_DEBOUNCE_MS);

  function onSourceChanged() {
    sequence += 1;
    preview = { status: PREVIEW.PENDING, message: '' };
    showPreviewState();
    syncSaveState();
    reportDirty();
    renderDebounced.call(source.value);
  }

  title.addEventListener('input', () => {
    reportDirty();
    syncSaveState();
  });
  source.addEventListener('input', onSourceChanged);
  type.addEventListener('change', onSourceChanged);
  notes.addEventListener('input', () => { reportDirty(); syncSaveState(); });
  source.addEventListener('blur', () => {
    renderDebounced.flush();
  });

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = getDraft();
    if (saveButton.disabled || !canSave({ draft, preview })) return;
    saving = true;
    syncSaveState();
    Promise.resolve()
      .then(() => onSave(draft, diagramId))
      .catch(() => {
        // A rejected write already put the server's message in the save-error
        // region; anything that escapes after it must not vanish silently.
        if (saveError.hidden) {
          setMessage(saveError, 'Something went wrong while saving. Your draft is still here — try again.');
        }
      })
      .then(() => {
        saving = false;
        syncSaveState();
      });
  });

  function mount({ diagram = null } = {}) {
    diagramId = diagram ? diagram.id : null;
    baseline = diagram ? draftFromDiagram(diagram) : emptyDraft();
    heading.textContent = diagram ? 'Edit diagram' : 'New diagram';
    title.value = baseline.title;
    source.value = baseline.source;
    type.value = baseline.type ?? 'architecture';
    notes.value = baseline.lesson ? JSON.stringify(baseline.lesson, null, 2) : '';
    renderDebounced.cancel();
    sequence += 1;
    clear(canvas);
    setMessage(errorBody, '');
    error.hidden = true;
    setMessage(saveError, '');
    saving = false;
    preview =
      baseline.source.trim() === ''
        ? { status: PREVIEW.IDLE, message: '' }
        : { status: PREVIEW.PENDING, message: '' };
    showPreviewState();
    syncSaveState();
    onDirtyChange(false);
    title.focus();
    if (preview.status === PREVIEW.PENDING) applyRender(baseline.source);
  }

  function flushRender() {
    renderDebounced.flush();
  }

  function refreshTheme() {
    const currentSource = source.value;
    if (currentSource.trim() === '') return;
    renderDebounced.cancel();
    applyRender(currentSource);
  }

  return {
    root,
    mount,
    flushRender,
    refreshTheme,
    get isDirty() {
      return isDirty(getDraft(), baseline);
    },
    get diagramId() {
      return diagramId;
    },
    get previewStatus() {
      return preview.status;
    },
    get isSaving() {
      return saving;
    },
    showSaveError(message) {
      setMessage(saveError, message);
    },
  };
}
