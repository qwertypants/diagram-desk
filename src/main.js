/**
 * Wiring: History API routing, the API client, the three panels, and the two
 * dialogs. This is the only module that imports Mermaid, which keeps Mermaid
 * (and its browser-only dependencies) out of the test process.
 */

import mermaid from 'mermaid';

import { createApiClient } from './api.js';
import { createDialogHost } from './dialog.js';
import { el } from './dom.js';
import { createEditorPanel } from './editor-panel.js';
import { createLibraryPanel } from './library-panel.js';
import { createViewerPanel } from './viewer-panel.js';
import { nextRenderId, renderPreview } from './preview.js';
import { VIEW, composePath, diagramPath, editPath, libraryPath, parsePath } from './routes.js';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  suppressErrorRendering: true,
  theme: 'base',
  themeVariables: {
    background: '#fbf7ee',
    primaryColor: '#f0e5d5',
    primaryBorderColor: '#9c3d1c',
    primaryTextColor: '#26211c',
    secondaryColor: '#e7dac6',
    tertiaryColor: '#f5f0e4',
    lineColor: '#5c5349',
    textColor: '#26211c',
    mainBkg: '#f0e5d5',
    nodeBorder: '#9c3d1c',
    clusterBkg: '#f5f0e4',
    clusterBorder: '#c2b498',
    edgeLabelBackground: '#fbf7ee',
    fontFamily: 'Georgia, "Iowan Old Style", Palatino, "Times New Roman", serif',
    fontSize: '15px',
  },
});

const api = createApiClient();
const dialogs = createDialogHost(document);
const libraryHost = document.getElementById('library');
const stage = document.getElementById('stage');

let currentPath = location.pathname;
let editorOriginPath = libraryPath();
let dirty = false;

function renderDiagram(source, container) {
  return renderPreview({ mermaidApi: mermaid, source, id: nextRenderId(), container });
}

const library = createLibraryPanel({
  root: libraryHost,
  api,
  onOpen: (id) => navigate(diagramPath(id)),
  onCompose: () => navigate(composePath()),
});

const viewer = createViewerPanel({
  doc: document,
  render: renderDiagram,
  onEdit: (id) => navigate(editPath(id)),
  onDelete: (diagram) => deleteDiagram(diagram),
});

const editor = createEditorPanel({
  doc: document,
  render: renderDiagram,
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
  const back = el(document, 'a', {
    class: 'btn',
    href: libraryPath(),
    text: 'Back to the library',
    onclick: (event) => {
      event.preventDefault();
      navigate(libraryPath());
    },
  });
  return el(document, 'div', { class: 'viewer' }, [
    el(document, 'h2', { class: 'viewer__title', text: 'No page here' }),
    el(document, 'div', { class: 'notice notice--quiet', role: 'status' }, [
      el(document, 'p', { class: 'canvas__note', text: `Nothing is mapped to ${path}.` }),
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
  if (replace) history.replaceState({ path }, '', path);
  else history.pushState({ path }, '', path);
  currentPath = path;
  await applyRoute(parsePath(path));
  return true;
}

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
      editorOriginPath = libraryPath();
      mount(editor.root);
      editor.mount({ diagram: null });
      return;

    case VIEW.DIAGRAM: {
      library.setSelected(route.id);
      mount(viewer.root);
      viewer.showLoading();
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

  dirty = false;
  await library.reload();
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

window.addEventListener('popstate', async () => {
  const path = location.pathname;
  if (!(await confirmDiscard())) {
    history.replaceState({ path: currentPath }, '', currentPath);
    return;
  }
  dirty = false;
  currentPath = path;
  await applyRoute(parsePath(path));
});

window.addEventListener('beforeunload', (event) => {
  editor.flushRender();
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

const initial = parsePath(currentPath);
const canonical = canonicalPath(initial);
if (canonical !== currentPath) {
  history.replaceState({ path: canonical }, '', canonical);
  currentPath = canonical;
}

applyRoute(initial).catch((error) => {
  viewer.showError(error.message);
});
