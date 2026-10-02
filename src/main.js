/**
 * The browser entry point: the only module that imports Mermaid, which keeps
 * Mermaid (and its browser-only dependencies) out of the test process. Every
 * other module is wired up in `app.js`.
 */

import mermaid from 'mermaid';

import { createApp } from './app.js';
import { renderPreview, nextRenderId } from './preview.js';

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

function renderDiagram(source, container) {
  return renderPreview({ mermaidApi: mermaid, source, id: nextRenderId(), container });
}

const app = createApp({ doc: document, win: window, render: renderDiagram });
await app.start();
