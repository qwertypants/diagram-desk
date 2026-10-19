/**
 * Wiring: History API routing, the API client, the three panels, and the two
 * dialogs. The document, the window, `fetch` and the renderer all arrive as
 * arguments, so this module holds no browser-only imports and can be driven
 * from a test. The renderer compiles Archify through the local API, keeping native reader
 * scripts isolated from both the application and the test process.
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
  const masthead = doc.querySelector('.masthead');
  const skipLink = doc.querySelector('.skip-link');
  const desk = doc.querySelector('.desk');
  const libraryRoot = doc.getElementById('library');
  const libraryToggle = doc.getElementById('library-toggle');
  const libraryBackdrop = doc.getElementById('library-backdrop');

  let currentPath = win.location.pathname;
  let editorOriginPath = libraryPath();
  let dirty = false;

  const library = createLibraryPanel({
    root: libraryRoot,
    api,
    onOpen: (id) => navigate(diagramPath(id)),
    onCompose: () => navigate(composePath()),
  });

  const libraryClose = el(doc, 'button', {
    type: 'button', class: 'mobile-drawer__close', text: 'Close library',
    'aria-label': 'Close library',
  });
  libraryRoot?.insertBefore(libraryClose, libraryRoot.firstChild);

  const isPhone = () => win.matchMedia
    ? win.matchMedia('(max-width: 62rem)').matches
    : win.innerWidth <= 992;
  let drawerOpen = false;

  function setDrawerOpen(open, { returnFocus = false } = {}) {
    drawerOpen = Boolean(open && isPhone());
    desk?.classList.toggle('mobile-drawer-open', drawerOpen);
    if (libraryToggle) libraryToggle.setAttribute('aria-expanded', String(drawerOpen));
    if (libraryRoot) {
      if (drawerOpen) {
        libraryRoot.setAttribute('role', 'dialog');
        libraryRoot.setAttribute('aria-modal', 'true');
      } else {
        libraryRoot.removeAttribute('role');
        libraryRoot.removeAttribute('aria-modal');
      }
    }
    if (stage) stage.inert = drawerOpen;
    if (masthead) masthead.inert = drawerOpen;
    if (skipLink) skipLink.inert = drawerOpen;
    if (drawerOpen) libraryClose.focus();
    else if (returnFocus) libraryToggle?.focus();
  }

  libraryToggle?.addEventListener('click', () => setDrawerOpen(true));
  libraryClose.addEventListener('click', () => setDrawerOpen(false, { returnFocus: true }));
  libraryBackdrop?.addEventListener('click', () => setDrawerOpen(false, { returnFocus: true }));

  doc.addEventListener('keydown', (event) => {
    if (!drawerOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setDrawerOpen(false, { returnFocus: true });
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(libraryRoot.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((node) => !node.hidden);
    if (focusable.length === 0) {
      event.preventDefault();
      libraryClose.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (doc.activeElement === first || !libraryRoot.contains(doc.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (doc.activeElement === last || !libraryRoot.contains(doc.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  const resizeQuery = win.matchMedia?.('(max-width: 62rem)');
  resizeQuery?.addEventListener?.('change', () => {
    if (!isPhone()) setDrawerOpen(false);
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

  function focusViewerOrStage() {
    const heading = doc.getElementById('viewer-title');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    } else {
      stage.focus();
    }
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
    const route = parsePath(path);
    const moveFocusToViewer = drawerOpen && isPhone() && route.view === VIEW.DIAGRAM;
    dirty = false;
    if (replace) win.history.replaceState({ path }, '', path);
    else win.history.pushState({ path }, '', path);
    currentPath = path;
    setDrawerOpen(false);
    try {
      await applyRoute(route);
    } finally {
      if (moveFocusToViewer && currentPath === path) focusViewerOrStage();
    }
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
    const route = parsePath(path);
    const moveFocusToViewer = drawerOpen && isPhone() && route.view === VIEW.DIAGRAM;
    dirty = false;
    currentPath = path;
    setDrawerOpen(false);
    try {
      await applyRoute(route);
    } finally {
      if (moveFocusToViewer && currentPath === path) focusViewerOrStage();
    }
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

    if (isPhone() && currentPath === libraryPath()) setDrawerOpen(true);

    await applyRoute(initial).catch((error) => {
      viewer.showError(error.message);
    });
  }

  return {
    start,
    navigate,
    refreshTheme() {
      const view = parsePath(currentPath).view;
      if (view === VIEW.DIAGRAM) viewer.refreshTheme?.();
      else if (view === VIEW.EDIT || view === VIEW.COMPOSE) editor.refreshTheme?.();
    },
    get currentPath() {
      return currentPath;
    },
    get isDirty() {
      return dirty;
    },
  };
}
