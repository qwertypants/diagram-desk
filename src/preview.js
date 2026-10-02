/**
 * Thin wrapper over Mermaid's own browser APIs: `parse` to validate, `render`
 * to produce the SVG. Mermaid itself is injected so this file never imports it
 * (only `main.js` does, which keeps Mermaid out of the test process).
 *
 * Nothing here touches the DOM; callers inject the SVG they are handed.
 */

import { PREVIEW } from './draft.js';

const ANSI = /\u001b\[[0-9;]*m/g;
const MAX_MESSAGE = 400;

let sequence = 0;

/** Unique DOM id for `mermaid.render`, which requires one per render. */
export function nextRenderId(prefix = 'diagram-render') {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** Mermaid errors arrive as a decorated `str`, a `message`, or neither. */
export function describeMermaidError(error) {
  const candidates = [error?.str, error?.message, typeof error === 'string' ? error : ''];
  const raw = candidates.find((value) => typeof value === 'string' && value.trim() !== '') ?? '';
  const cleaned = raw
    .replace(ANSI, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cleaned === '') return 'Mermaid could not explain this error.';
  return cleaned.length > MAX_MESSAGE ? `${cleaned.slice(0, MAX_MESSAGE - 1).trimEnd()}…` : cleaned;
}

export async function renderPreview({ mermaidApi, source, id, container = undefined }) {
  const text = typeof source === 'string' ? source : '';
  if (text.trim() === '') {
    return { status: PREVIEW.ERROR, message: 'There is no Mermaid source to render yet.' };
  }

  try {
    await mermaidApi.parse(text);
  } catch (error) {
    return { status: PREVIEW.ERROR, message: describeMermaidError(error) };
  }

  try {
    const result = await mermaidApi.render(id, text, container);
    if (!result || typeof result.svg !== 'string' || result.svg.trim() === '') {
      return { status: PREVIEW.ERROR, message: 'Mermaid produced no drawing for this source.' };
    }
    return {
      status: PREVIEW.OK,
      svg: result.svg,
      diagramType: typeof result.diagramType === 'string' ? result.diagramType : '',
      bindFunctions: typeof result.bindFunctions === 'function' ? result.bindFunctions : null,
    };
  } catch (error) {
    return { status: PREVIEW.ERROR, message: describeMermaidError(error) };
  }
}
