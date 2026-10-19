import { PREVIEW } from './draft.js';

export function createRenderer(fetchImpl = (...args) => globalThis.fetch(...args)) {
  return async function render(source) {
    let candidate;
    try { candidate = JSON.parse(source); }
    catch { return { status: PREVIEW.ERROR, message: 'Archify source must be valid JSON.' }; }
    try {
      const response = await fetchImpl('/api/preview', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: candidate.meta?.title ?? 'Preview', type: candidate.diagram_type, source }),
      });
      const body = await response.json();
      if (!response.ok) return { status: PREVIEW.ERROR, message: body.error ?? 'Could not render the diagram.' };
      return { status: PREVIEW.OK, readerUrl: body.readerUrl, diagramType: candidate.diagram_type };
    } catch { return { status: PREVIEW.ERROR, message: 'Could not reach the local renderer. Your source is still here.' }; }
  };
}

export function createReaderFrame(doc, url, title) {
  const frame = doc.createElement('iframe');
  frame.className = 'archify-reader';
  frame.title = title;
  frame.setAttribute('sandbox', 'allow-scripts allow-downloads');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.src = url;
  return frame;
}
