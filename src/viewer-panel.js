import { el, clear } from './dom.js';
import { formatTimestamp } from './draft.js';
import { createReaderFrame } from './preview.js';

function list(doc, items, ordered = false) {
  return el(doc, ordered ? 'ol' : 'ul', {}, items.map(text => el(doc, 'li', { text })));
}

export function createViewerPanel({ doc, render, onEdit, onDelete }) {
  const root = el(doc, 'div', { class: 'viewer' });
  let sequence = 0;
  const message = (title, text = '') => {
    sequence++;
    root.replaceChildren(el(doc, 'div', { class: 'welcome' }, [
      el(doc, 'p', { class: 'eyebrow', text: 'THE ENGINEERING FIELD GUIDE' }),
      el(doc, 'h2', { text: title }),
      el(doc, 'p', { text }),
    ]));
  };
  async function showDiagram(diagram) {
    const mine = ++sequence;
    clear(root);
    const lesson = diagram.lesson;
    const status = el(doc, 'p', { role: 'status', class: 'preview__status', text: 'Rendering the diagram…' });
    const canvas = el(doc, 'div', { class: 'reader-host' });
    root.append(el(doc, 'header', { class: 'lesson-header' }, [
      el(doc, 'p', { class: 'eyebrow', text: `${diagram.type ?? 'ARCHIVE'} / SYSTEMS IN PRACTICE` }),
      el(doc, 'h2', { class: 'viewer__title', text: diagram.title }),
      el(doc, 'p', { class: 'lesson-deck', text: lesson?.summary ?? 'Explore the components, relationships, and decisions in this diagram.' }),
      el(doc, 'div', { class: 'viewer__actions' }, [
        el(doc, 'button', { class: 'btn', text: 'Edit', onclick: () => onEdit(diagram.id) }),
        el(doc, 'a', { class: 'btn', text: 'Open full reader', href: `/api/diagrams/${encodeURIComponent(diagram.id)}/reader`, target: '_blank', rel: 'noopener' }),
        el(doc, 'button', { class: 'btn btn--danger', text: 'Delete', onclick: () => onDelete(diagram) }),
        el(doc, 'span', { class: 'lesson-date', text: `Updated ${formatTimestamp(diagram.updatedAt)}` }),
      ]),
    ]));
    if (lesson?.objectives?.length) root.append(el(doc, 'section', { class: 'learning-goals', 'aria-label': 'Learning objectives' }, [
      el(doc, 'span', { class: 'eyebrow', text: 'WHAT YOU WILL UNDERSTAND' }), list(doc, lesson.objectives),
    ]));
    root.append(status, canvas);
    if (lesson) {
      const notes = el(doc, 'div', { class: 'lesson-notes' });
      if (lesson.problem) notes.append(el(doc, 'section', { class: 'lesson-problem' }, [el(doc, 'h3', { text: 'The engineering problem' }), el(doc, 'p', { text: lesson.problem })]));
      if (lesson.walkthrough?.length) notes.append(el(doc, 'section', { class: 'reading-path' }, [
        el(doc, 'p', { class: 'eyebrow', text: 'READ THE SYSTEM' }), el(doc, 'h3', { text: 'Follow the decisions' }),
        el(doc, 'ol', {}, lesson.walkthrough.map(step => el(doc, 'li', {}, [el(doc, 'h4', { text: step.title }), el(doc, 'p', { text: step.detail })]))),
      ]));
      for (const [key, title] of [['decisions', 'Why this design'], ['failureModes', 'Where it can fail'], ['takeaways', 'What to remember']]) {
        if (lesson[key]?.length) notes.append(el(doc, 'section', { class: `lesson-${key}` }, [el(doc, 'h3', { text: title }), list(doc, lesson[key])]));
      }
      if (lesson.scope) notes.append(el(doc, 'p', { class: 'lesson-scope', text: lesson.scope }));
      if (lesson.references?.length) notes.append(el(doc, 'section', { class: 'lesson-references' }, [el(doc, 'h3', { text: 'Read the sources' }),
        el(doc, 'ul', {}, lesson.references.map(ref => el(doc, 'li', {}, [el(doc, 'a', { text: ref.title, href: ref.url, target: '_blank', rel: 'noopener noreferrer' })]))),
      ]));
      root.append(notes);
    }
    let result;
    try { result = await render(diagram.source, canvas); }
    catch (error) { result = { status: 'error', message: error.message }; }
    if (mine !== sequence) return;
    if (result.status === 'ok' && result.readerUrl) {
      canvas.replaceChildren(createReaderFrame(doc, result.readerUrl, `Interactive diagram: ${diagram.title}`));
      status.textContent = 'Explore a node or search the diagram. On phones, zoom in then drag the background.';
    } else {
      status.textContent = result.message ?? 'This diagram could not be rendered.';
      status.setAttribute('role', 'alert');
      status.classList.add('is-error');
    }
  }
  return { root, showDiagram,
    showEmpty: () => message('Understand the system. Then explain it.', 'Explore worked examples of software and AI engineering. Choose a lesson from the library, trace its flow, and examine the decisions behind it.'),
    showLoading: () => message('Opening the lesson…'),
    showError: text => message('Could not open the lesson', text),
    showNotFound: text => message('This diagram is not in the library', text),
    refreshTheme() { /* Each native reader owns its light/dark theme and camera. */ },
  };
}
