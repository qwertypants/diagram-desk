import test from 'node:test';
import assert from 'node:assert/strict';
import { decorateExternalLinks, inspectExternalLinks, isExternalLink } from './external-links.mjs';

const site = 'https://example.test/diagram-desk/';

test('classifies only HTTP(S) URLs on a different origin as external', () => {
  for (const href of ['/articles/a', '../b', '#section', 'https://example.test/elsewhere', 'mailto:a@example.test', 'tel:123']) {
    assert.equal(isExternalLink(href, site), false, href);
  }
  assert.equal(isExternalLink('https://other.test/path', site), true);
  assert.equal(isExternalLink('//other.test/path', site), true);
});

test('decorates external anchors with one visible arrow and screen-reader notice', () => {
  const html = '<!doctype html><html><head></head><body><a href="https://outside.test">Outside</a></body></html>';
  const result = decorateExternalLinks(html, site);
  assert.match(result, /target="_blank"/);
  assert.match(result, /rel="noopener noreferrer"/);
  assert.match(result, /aria-hidden="true"[^>]*> ↗|aria-hidden="true"[^>]*>↗/);
  assert.match(result, /\(opens in a new window\)/);
  assert.match(result, /\.external-link-sr-only\{/);
  assert.deepEqual(inspectExternalLinks(result, site), []);
});

test('preserves labels, existing rel tokens, text, and stable repeated output', () => {
  const html = '<html><head></head><body><a href="//outside.test" rel="nofollow" aria-label="Official docs">Docs</a><a href="https://outside.test">Existing ↗</a></body></html>';
  const once = decorateExternalLinks(html, site);
  const twice = decorateExternalLinks(once, site);
  assert.equal(twice, once);
  assert.match(once, /rel="nofollow noopener noreferrer"/);
  assert.match(once, /aria-label="Official docs \(opens in a new window\)"/);
  assert.equal((once.match(/↗/g) ?? []).length, 2);
  assert.match(once, />Existing<span/);
});

test('leaves internal, fragment, email, and download links untouched', () => {
  const html = '<html><head></head><body><a href="/internal">Internal</a><a href="#here">Here</a><a href="mailto:a@example.test">Email</a><a href="https://outside.test/file" download>File</a></body></html>';
  assert.equal(decorateExternalLinks(html, site), html);
});
