/**
 * Wiring: History API routing, the API client, the three panels, and the two
 * dialogs. The document, the window, `fetch` and the renderer all arrive as
 * arguments, so this module holds no browser-only imports and can be driven
 * from a test. `main.js` is the only module that imports Mermaid, which keeps
 * Mermaid (and its browser-only dependencies) out of the test process.
 */

import { createApiClient } from './api.js';
import { createDialogHost } from './dialog.js';
import { el } from './dom.js';
import { createEditorPanel } from './editor-panel.js';
import { createLibraryPanel } from './library-panel.js';
import { createViewerPanel } from './viewer-panel.js';
import { VIEW, composePath, diagramPath, editPath, libraryPath, parsePath } from './routes.js';

export function createApp({ doc, win, fetch = globalThis.fetch, render }) {
  const api = createApiClient({ fetch });
  const dialogs = createDialogHost(doc);
  const stage = doc.getElementById('stage');

  let currentPath = win.location.pathname;
  let editorOriginPath = libraryPath();
  let dirty = false;

  const library = createLibraryPanel({
    root: doc.getElementById('library'),
    api,
    onOpen: (id) => navigate(diagramPath(id)),
    onCompose: () => navigate(composePath()),
  });

  const viewer = createViewerPanel({
    doc,
    render,
    onEdit: (id) => navigate(editPath(id)),
    onDelete: (diagram) => deleteDiagram(diagram),
  });

  const editor = createEditorPanel({
    doc,
    render,
    onSave: (draft, id) => save(draft, id),
    onCancel: () => navigate(editorOriginPath),
    onDirtyChange: (next) => {
      dirty = next;
    },
  });

  function mount(panelRoot) {
    stage.replaceChildren(panelRoot);
  }

  function notFoundPanel(path) {
    const back = el(doc, 'a', {
      class: 'btn',
      href: libraryPath(),
      text: 'Back to the library',
      onclick: (event) => {
        event.preventDefault();
        navigate(libraryPath());
      },
    });
    return el(doc, 'div', { class: 'viewer' }, [
      el(doc, 'h2', { class: 'viewer__title', text: 'No page here' }),
      el(doc, 'div', { class: 'notice notice--quiet', role: 'status' }, [
        el(doc, 'p', { class: 'canvas__note', text: `Nothing is mapped to ${path}.` }),
        back,
      ]),
    ]);
  }

  async function confirmDiscard() {
    if (!dirty) return true;
    return dialogs.confirm({
      title: 'Discard unsaved edits?',
      message: 'This diagram has changes that have not been saved. Leaving now discards them.',
      confirmLabel: 'Discard changes',
      destructive: true,
    });
  }

  async function navigate(path, { replace = false, force = false } = {}) {
    if (!force && !(await confirmDiscard())) return false;
    dirty = false;
    if (replace) win.history.replaceState({ path }, '', path);
    else win.history.pushState({ path }, '', path);
    currentPath = path;
    await applyRoute(parsePath(path));
    return true;
  }

  /** The library column is chrome for every view, so every route fills it: a
   *  cold load of a deep link shows the same library as a cold load of `/`. */
  async function applyRoute(route) {
    switch (route.view) {
      case VIEW.LIBRARY:
        library.setSelected(null);
        mount(viewer.root);
        viewer.showEmpty();
        await library.reload();
        return;

      case VIEW.COMPOSE:
        library.setSelected(null);
        await library.reload();
        editorOriginPath = libraryPath();
        mount(editor.root);
        editor.mount({ diagram: null });
        return;

      case VIEW.DIAGRAM: {
        library.setSelected(route.id);
        mount(viewer.root);
        viewer.showLoading();
        await library.reload();
        try {
          const diagram = await api.getDiagram(route.id);
          if (currentPath !== diagramPath(route.id)) return;
          await viewer.showDiagram(diagram);
        } catch (error) {
          if (currentPath !== diagramPath(route.id)) return;
          if (error.kind === 'notFound') {
            library.setSelected(null);
            viewer.showNotFound(error.message);
          } else {
            viewer.showError(error.message);
          }
        }
        return;
      }

      case VIEW.EDIT: {
        mount(viewer.root);
        viewer.showLoading();
        await library.reload();
        try {
          const diagram = await api.getDiagram(route.id);
          if (currentPath !== editPath(route.id)) return;
          library.setSelected(diagram.id);
          editorOriginPath = diagramPath(diagram.id);
          mount(editor.root);
          editor.mount({ diagram });
        } catch (error) {
          if (currentPath !== editPath(route.id)) return;
          library.setSelected(null);
          mount(viewer.root);
          if (error.kind === 'notFound') viewer.showNotFound(error.message);
          else viewer.showError(error.message);
        }
        return;
      }

      default:
        library.setSelected(null);
        mount(notFoundPanel(currentPath));
        await library.reload();
    }
  }

  async function save(draft, id) {
    let saved;
    try {
      saved = id === null ? await api.createDiagram(draft) : await api.updateDiagram(id, draft);
    } catch (error) {
      editor.showSaveError(error.message);
      throw error;
    }

    // Navigating reloads the library and clears `dirty`; clearing it first would
    // leave the editor reporting itself clean while the URL still says /new.
    await navigate(diagramPath(saved.id), { replace: id !== null, force: true });
    return saved;
  }

  async function deleteDiagram(diagram) {
    const confirmed = await dialogs.confirm({
      title: 'Delete this diagram?',
      message: `"${diagram.title}" will be permanently deleted. There is no undo.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return false;

    try {
      await api.deleteDiagram(diagram.id);
      await library.reload();
      await navigate(libraryPath(), { replace: true, force: true });
      return true;
    } catch (error) {
      viewer.showError(error.message);
      return false;
    }
  }

  function canonicalPath(route) {
    switch (route.view) {
      case VIEW.LIBRARY:
        return libraryPath();
      case VIEW.COMPOSE:
        return composePath();
      case VIEW.DIAGRAM:
        return diagramPath(route.id);
      case VIEW.EDIT:
        return editPath(route.id);
      default:
        return currentPath;
    }
  }

  async function onPopState() {
    const path = win.location.pathname;
    if (!(await confirmDiscard())) {
      win.history.replaceState({ path: currentPath }, '', currentPath);
      return;
    }
    dirty = false;
    currentPath = path;
    await applyRoute(parsePath(path));
  }

  function onBeforeUnload(event) {
    editor.flushRender();
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async function start() {
    win.addEventListener('popstate', onPopState);
    win.addEventListener('beforeunload', onBeforeUnload);

    const initial = parsePath(currentPath);
    const canonical = canonicalPath(initial);
    if (canonical !== currentPath) {
      win.history.replaceState({ path: canonical }, '', canonical);
      currentPath = canonical;
    }

    await applyRoute(initial).catch((error) => {
      viewer.showError(error.message);
    });
  }

  return {
    start,
    navigate,
    get currentPath() {
      return currentPath;
    },
    get isDirty() {
      return dirty;
    },
  };
}
