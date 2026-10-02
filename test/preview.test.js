import test from 'node:test';
import assert from 'node:assert/strict';

import { PREVIEW } from '../src/draft.js';
import { describeMermaidError, nextRenderId, renderPreview } from '../src/preview.js';

const SVG = '<svg id="graph"><g/></svg>';

function mermaidStub({ parse, render } = {}) {
  const calls = { parse: [], render: [] };
  return {
    calls,
    api: {
      async parse(text) {
        calls.parse.push(text);
        return parse ? parse(text) : { diagramType: 'flowchart' };
      },
      async render(id, text, container) {
        calls.render.push({ id, text, container });
        return render ? render(id, text, container) : { svg: SVG, diagramType: 'flowchart', bindFunctions: () => {} };
      },
    },
  };
}

test('a valid source parses and renders to SVG', async () => {
  const { calls, api } = mermaidStub();
  const result = await renderPreview({ mermaidApi: api, source: 'flowchart TD\n A-->B', id: 'r-1' });

  assert.equal(result.status, PREVIEW.OK);
  assert.equal(result.svg, SVG);
  assert.equal(result.diagramType, 'flowchart');
  assert.equal(typeof result.bindFunctions, 'function');
  assert.deepEqual(calls.parse, ['flowchart TD\n A-->B']);
  assert.equal(calls.render[0].id, 'r-1');
});

test('the container is handed to mermaid so nothing is rendered into the page body', async () => {
  const { calls, api } = mermaidStub();
  const container = { nodeType: 1 };

  await renderPreview({ mermaidApi: api, source: 'graph TD; A-->B', id: 'r-1', container });

  assert.equal(calls.render[0].container, container);
});

test('an invalid source is reported from parse and is never sent to render', async () => {
  const { calls, api } = mermaidStub({
    parse() {
      throw Object.assign(new Error('inner'), { str: 'Parse error on line 2:\n  graph TD\n  A -- > B' });
    },
  });

  const result = await renderPreview({ mermaidApi: api, source: 'graph TD\n A -- > B', id: 'r-1' });

  assert.equal(result.status, PREVIEW.ERROR);
  assert.match(result.message, /Parse error on line 2/);
  assert.equal(result.svg, undefined);
  assert.equal(calls.render.length, 0, 'render must not run after a failed parse');
});

test('a render failure after a good parse is still an error, with its own text', async () => {
  const { api } = mermaidStub({
    render() {
      throw new Error('Cannot read properties of null');
    },
  });

  const result = await renderPreview({ mermaidApi: api, source: 'graph TD; A-->B', id: 'r-1' });

  assert.equal(result.status, PREVIEW.ERROR);
  assert.equal(result.message, 'Cannot read properties of null');
});

test('empty source is an error and never reaches mermaid', async () => {
  const { calls, api } = mermaidStub();

  for (const source of ['', '   \n\t ', undefined, null]) {
    const result = await renderPreview({ mermaidApi: api, source, id: 'r-1' });
    assert.equal(result.status, PREVIEW.ERROR);
    assert.match(result.message, /no Mermaid source/i);
  }
  assert.equal(calls.parse.length, 0);
  assert.equal(calls.render.length, 0);
});

test('a render that returns no SVG is treated as a failure rather than a blank canvas', async () => {
  const { api } = mermaidStub({ render: () => ({ svg: '   ' }) });

  const result = await renderPreview({ mermaidApi: api, source: 'graph TD; A-->B', id: 'r-1' });

  assert.equal(result.status, PREVIEW.ERROR);
  assert.match(result.message, /no drawing/i);
});

test('describeMermaidError prefers str, strips ANSI, and caps runaway output', () => {
  assert.equal(
    describeMermaidError({ str: '\u001b[31mParse error\u001b[0m on line 1', message: 'ignored' }),
    'Parse error on line 1',
  );
  assert.equal(describeMermaidError(new Error('plain message')), 'plain message');
  assert.equal(describeMermaidError(null), 'Mermaid could not explain this error.');
  assert.equal(describeMermaidError({ str: '   ' }), 'Mermaid could not explain this error.');

  const long = describeMermaidError({ str: 'x'.repeat(5000) });
  assert.equal(long.length, 400);
  assert.ok(long.endsWith('…'));
});

test('nextRenderId hands out a fresh id for every render', () => {
  const first = nextRenderId();
  const second = nextRenderId();
  assert.notEqual(first, second);
  assert.match(first, /^diagram-render-\d+$/);
  assert.match(nextRenderId('viewer'), /^viewer-\d+$/);
});
