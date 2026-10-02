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
    const active = list.contains(doc.activeElement) ? doc.activeElement.closest('.library__item') : null;
    const focusedIndex = itemNodes().indexOf(active);
    clear(list);
    for (const diagram of items) {
      const button = el(
        doc,
        'button',
        { type: 'button', class: 'library__item', onclick: () => onOpen(diagram.id) },
        [
          el(doc, 'span', { class: 'library__item-title', text: diagram.title }),
          el(doc, 'span', { class: 'library__item-time', text: formatTimestamp(diagram.updatedAt) }),
        ],
      );
      list.append(el(doc, 'li', {}, [button]));
    }
    markSelected();
    if (focusedIndex >= 0) itemNodes()[focusedIndex]?.focus();
  }

  /** Selection is a class and aria-current, so marking never rebuilds the list
   *  and never steals keyboard focus from the item the user is on. */
  function markSelected() {
    itemNodes().forEach((button, index) => {
      const selected = items[index]?.id === selectedId;
      button.classList.toggle('is-selected', selected);
      if (selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
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
      markSelected();
    },
  };
}
