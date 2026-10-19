import { createApp } from './app.js';
import { createRenderer } from './preview.js';

const app = createApp({ doc: document, win: window, render: createRenderer() });
const toggle = document.getElementById('library-toggle');
toggle.addEventListener('click', () => {
  const expanded = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(expanded));
  document.getElementById('library').classList.toggle('is-open', expanded);
});
document.getElementById('library').addEventListener('click', event => {
  if (event.target.closest('.library__item')) {
    toggle.setAttribute('aria-expanded', 'false');
    document.getElementById('library').classList.remove('is-open');
  }
});
await app.start();
