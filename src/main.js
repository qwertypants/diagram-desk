import { createApp } from './app.js';
import { createRenderer } from './preview.js';

const app = createApp({ doc: document, win: window, render: createRenderer() });
await app.start();
