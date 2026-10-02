/**
 * The library column: search, a real list of saved diagrams, and keyboard
 * navigation between items. All data comes from the injected API client.
 */

import { el, clear } from './dom.js';
import { formatTimestamp } from './draft.js';
import { createDebounced } from './debounce.js';

const SEARCH_DEBOUNCE_MS = 180;

export function createLibraryPanel({ root, api, onOpen, onCompose }) {
  const doc = root.ownerDocument;
  let items = [];
  let selectedId = null;
  let sequence = 0;

  const list = el(doc, 'ul', { class: 'library__list', 'aria-label': 'Saved diagrams' });
  const status = el(doc, 'p', { class: 'panel__status', id: 'library-status', role: 'status' });
  const retry = el(doc, 'p', { class: 'panel__retry', id: 'library-retry' });

  const search = el(doc, 'input', {
    id: 'library-search',
    class: 'input',
    type: 'search',
    placeholder: 'Search titles',
    autocomplete: 'off',
    'aria-describedby': 'library-status',
  });

  root.append(
    el(doc, 'div', { class: 'panel__head' }, [
      el(doc, 'h2', { class: 'panel__title', id: 'library-heading', text: 'Library' }),
      el(doc, 'button', {
        type: 'button',
        class: 'btn btn--primary',
        text: 'New diagram',
        onclick: () => onCompose(),
      }),
    ]),
    el(doc, 'div', { class: 'panel__search' }, [
      el(doc, 'label', { class: 'field__label', for: 'library-search', text: 'Search diagrams' }),
      search,
    ]),
    status,
    retry,
    list,
  );

  function itemNodes() {
    return Array.from(list.querySelectorAll('.library__item'));
  }

  list.addEventListener('keydown', (event) => {
    const steps = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key === 'Home' || event.key === 'End') {
      const buttons = itemNodes();
      event.preventDefault();
      (event.key === 'Home' ? buttons[0] : buttons[buttons.length - 1])?.focus();
      return;
    }
    if (steps[event.key] === undefined) return;
    event.preventDefault();
    const buttons = itemNodes();
    if (buttons.length === 0) return;
    const index = buttons.indexOf(event.target.closest('.library__item'));
    const next = index === -1 ? 0 : Math.min(buttons.length - 1, Math.max(0, index + steps[event.key]));
    buttons[next].focus();
  });

  function renderList() {
    clear(list);
    for (const diagram of items) {
      const selected = diagram.id === selectedId;
      const button = el(
        doc,
        'button',
        {
          type: 'button',
          class: selected ? 'library__item is-selected' : 'library__item',
          'aria-current': selected ? 'true' : null,
          onclick: () => onOpen(diagram.id),
        },
        [
          el(doc, 'span', { class: 'library__item-title', text: diagram.title }),
          el(doc, 'span', { class: 'library__item-time', text: formatTimestamp(diagram.updatedAt) }),
        ],
      );
      list.append(el(doc, 'li', {}, [button]));
    }
  }

  function renderStatus(message, withRetry = false) {
    clear(status);
    clear(retry);
    if (message !== '') status.append(doc.createTextNode(message));
    if (withRetry) {
      retry.append(
        el(doc, 'button', { type: 'button', class: 'btn', text: 'Try again', onclick: () => reload() }),
      );
    }
  }

  function describeResult(count) {
    if (count === 0) {
      return search.value.trim() === ''
        ? 'No diagrams saved yet — create your first one.'
        : 'No diagrams match that search.';
    }
    return `${count} saved ${count === 1 ? 'diagram' : 'diagrams'}.`;
  }

  async function reload() {
    const mine = (sequence += 1);
    renderStatus('Loading the library…');
    try {
      const diagrams = await api.listDiagrams({ q: search.value });
      if (mine !== sequence) return;
      items = diagrams;
      renderList();
      renderStatus(describeResult(items.length));
    } catch (error) {
      if (mine !== sequence) return;
      items = [];
      renderList();
      renderStatus(`Could not load the library: ${error.message}`, true);
    }
  }

  const reloadSearch = createDebounced(() => {
    reload();
  }, SEARCH_DEBOUNCE_MS);
  search.addEventListener('input', reloadSearch.call);

  return {
    reload,
    setSelected(id) {
      selectedId = id;
      renderList();
    },
  };
}
