import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { installReaderTouch } from './reader-touch.js';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(join(root, 'catalog/index.json'), 'utf8'));
const cli = join(root, 'vendor/archify/bin/archify.mjs');
const outputRoot = join(root, 'public/diagrams');
const basePath = `/${(process.env.BASE_PATH || '/').split('/').filter(Boolean).join('/')}`.replace(/\/$/, '');
const allowedTypes = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle', 'erd', 'class', 'tree', 'timeline', 'waterfall']);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const item of catalog) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || !allowedTypes.has(item.type)) {
    throw new Error(`Invalid catalog diagram: ${item.slug}`);
  }
  const source = await readFile(join(root, 'catalog', item.file), 'utf8');
  const candidate = JSON.parse(source);
  if (candidate.diagram_type !== item.type || candidate.meta?.title !== item.title) {
    throw new Error(`Catalog and Archify source disagree for ${item.slug}`);
  }
  const digest = createHash('sha256').update(source).digest('hex');
  const temp = await mkdtemp(join(tmpdir(), 'diagram-desk-static-'));
  try {
    const input = join(temp, 'candidate.json');
    const output = join(temp, 'reader.html');
    candidate.meta.output = 'reader.html';
    candidate.meta.visual_preset = 'editorial';
    await writeFile(input, JSON.stringify(candidate));
    await exec(process.execPath, [cli, 'render', item.type, 'candidate.json', 'reader.html'], {
      cwd: temp,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    let html = await readFile(output, 'utf8');
    if (!html.includes('</head>') || !html.includes('</body>') || !html.includes('Archify')) {
      throw new Error(`Archify did not produce a complete reader for ${item.slug}`);
    }
    const breadcrumbItems = `<ol><li><a href="${basePath || ''}/">Diagram Desk</a></li><li><a href="${basePath || ''}/articles/">Articles</a></li><li><a href="${basePath || ''}/articles/${encodeURIComponent(item.slug)}/">${escapeHtml(item.title)}</a></li><li aria-current="page">Diagram reader</li></ol>`;
    const breadcrumbStyles = `
      .diagram-desk-breadcrumbs { width: min(100% - 2rem, 1440px); margin: 0 auto 1.15rem; padding: .85rem 0 .7rem; border-bottom: 1px solid var(--toolbar-border, currentColor); color: var(--text, inherit); font: 500 12px/1.5 system-ui, sans-serif; }
      .diagram-desk-breadcrumbs ol { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .55rem; margin: 0; padding: 0; list-style: none; }
      .diagram-desk-breadcrumbs li { min-width: 0; }
      .diagram-desk-breadcrumbs li + li::before { content: "/"; margin-right: .55rem; color: var(--toolbar-border, currentColor); }
      .diagram-desk-breadcrumbs a { color: inherit; text-decoration-color: var(--toolbar-border, currentColor); text-underline-offset: .18em; }
      .diagram-desk-breadcrumbs a:hover { text-decoration-color: currentColor; }
      .diagram-desk-breadcrumbs a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 2px; }
      .diagram-desk-breadcrumbs [aria-current="page"] { opacity: .68; }
      html[data-present="true"] .diagram-desk-breadcrumbs { display: none !important; }
      @media (max-width: 600px) { .diagram-desk-breadcrumbs { width: calc(100% - 1.5rem); margin-bottom: .8rem; } }
    `;
    const breadcrumbBootstrap = `(()=>{try{const params=new URLSearchParams(window.location.search);if(params.get('hideHeader')==='1')document.documentElement.setAttribute('data-reader-header','hidden');if(params.get('hideBreadcrumbs')==='1')return;const container=document.querySelector('.container');if(!container)return;const style=document.createElement('style');style.textContent=${JSON.stringify(breadcrumbStyles)};document.head.append(style);const nav=document.createElement('nav');nav.className='diagram-desk-breadcrumbs';nav.setAttribute('aria-label','Breadcrumb');nav.innerHTML=${JSON.stringify(breadcrumbItems)};container.prepend(nav)}catch(_){}})()`;
    html = html.replace('</head>', `<meta name="diagram-source-sha256" content="${digest}">\n<style>html[data-reader-header="hidden"] .header { display: none !important; } html[data-reader-header="hidden"][data-preset="editorial"] .diagram-container::after { display: none !important; } @media (pointer: coarse) { .diagram-container.is-pannable { touch-action: none; } }</style>\n</head>`);
    html = html.replace('<div class="container">', `<div class="container">\n    <script>${breadcrumbBootstrap}</script>`);
    html = html.replace('</body>', `<script>(${installReaderTouch.toString()})();</script>\n</body>`);
    const target = join(outputRoot, item.slug);
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'reader.html'), html);
    console.log(`Rendered /diagrams/${item.slug}/reader.html`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
