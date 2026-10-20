import { parse, serialize } from 'parse5';

const HIDDEN_CLASS = 'external-link-sr-only';
const INDICATOR_CLASS = 'external-link-indicator';
const NOTICE = '(opens in a new window)';

export function isExternalLink(href, siteUrl) {
  if (!href || typeof href !== 'string') return false;
  try {
    const destination = new URL(href, siteUrl);
    const site = new URL(siteUrl);
    return ['http:', 'https:'].includes(destination.protocol) && destination.origin !== site.origin;
  } catch {
    return false;
  }
}

function attr(node, name) { return node.attrs.find(item => item.name === name); }
function setAttr(node, name, value) {
  const existing = attr(node, name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}
function hasClass(node, className) { return (attr(node, 'class')?.value ?? '').split(/\s+/).includes(className); }
function element(name, attrs = [], child = null) {
  return { nodeName: name, tagName: name, attrs, namespaceURI: 'http://www.w3.org/1999/xhtml', childNodes: child ? [child] : [], parentNode: null };
}
function text(value) { return { nodeName: '#text', value, parentNode: null }; }
function walk(node, visit) {
  if (node.tagName === 'a') visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}
function hasNotice(node) {
  return (node.childNodes ?? []).some(child => child.tagName === 'span' && hasClass(child, HIDDEN_CLASS) && textContent(child).includes(NOTICE));
}
function textContent(node) { return (node.childNodes ?? []).map(child => child.nodeName === '#text' ? child.value : textContent(child)).join(''); }
function containsExternal(node, siteUrl) {
  if (node.tagName === 'a' && isExternalLink(attr(node, 'href')?.value, siteUrl) && !attr(node, 'download')) return true;
  return (node.childNodes ?? []).some(child => containsExternal(child, siteUrl));
}
function removeDecorations(anchor) {
  anchor.childNodes = anchor.childNodes.filter(child => !(child.tagName === 'span' && (hasClass(child, HIDDEN_CLASS) || hasClass(child, INDICATOR_CLASS))));
  const last = anchor.childNodes.at(-1);
  if (last?.nodeName === '#text') last.value = last.value.replace(/\s*↗\s*$/, '');
}
function decorate(anchor) {
  const label = attr(anchor, 'aria-label');
  const tokens = new Set((attr(anchor, 'rel')?.value ?? '').split(/\s+/).filter(Boolean));
  tokens.add('noopener'); tokens.add('noreferrer');
  setAttr(anchor, 'target', '_blank');
  setAttr(anchor, 'rel', [...tokens].join(' '));
  removeDecorations(anchor);

  const indicator = element('span', [{ name: 'class', value: INDICATOR_CLASS }, { name: 'aria-hidden', value: 'true' }], text(' ↗'));
  const hidden = element('span', [{ name: 'class', value: HIDDEN_CLASS }], text(` ${NOTICE}`));
  anchor.childNodes.push(indicator, hidden);
  if (label) setAttr(anchor, 'aria-label', label.value.replace(/\s*\(opens in a new window\)\s*$/, '') + ` ${NOTICE}`);
}

export function decorateExternalLinks(html, siteUrl) {
  const document = parse(html);
  if (!containsExternal(document, siteUrl)) return html;
  walk(document, anchor => {
    const href = attr(anchor, 'href')?.value;
    if (!isExternalLink(href, siteUrl) || attr(anchor, 'download')) return;
    decorate(anchor);
  });
  const hasExternal = containsExternal(document, siteUrl);
  if (hasExternal) {
    const head = document.childNodes.find(child => child.tagName === 'html')?.childNodes.find(child => child.tagName === 'head');
    if (head && !head.childNodes.some(child => child.tagName === 'style' && textContent(child).includes(`.${HIDDEN_CLASS}`))) {
      const style = element('style', [], text(`.${HIDDEN_CLASS}{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`));
      style.parentNode = head; head.childNodes.push(style);
    }
  }
  return serialize(document);
}

export function inspectExternalLinks(html, siteUrl) {
  const document = parse(html);
  const problems = [];
  walk(document, anchor => {
    const href = attr(anchor, 'href')?.value;
    if (!isExternalLink(href, siteUrl) || attr(anchor, 'download')) return;
    const rel = new Set((attr(anchor, 'rel')?.value ?? '').split(/\s+/));
    if (attr(anchor, 'target')?.value !== '_blank') problems.push({ href, issue: 'target' });
    if (!rel.has('noopener') || !rel.has('noreferrer')) problems.push({ href, issue: 'rel' });
    if (!anchor.childNodes.some(child => child.tagName === 'span' && hasClass(child, INDICATOR_CLASS) && attr(child, 'aria-hidden')?.value === 'true')) problems.push({ href, issue: 'indicator' });
    if (!hasNotice(anchor)) problems.push({ href, issue: 'screen-reader notice' });
    if (attr(anchor, 'aria-label') && !attr(anchor, 'aria-label').value.includes(NOTICE)) problems.push({ href, issue: 'aria-label notice' });
  });
  const hasExternal = containsExternal(document, siteUrl);
  if (hasExternal) {
    const head = document.childNodes.find(child => child.tagName === 'html')?.childNodes.find(child => child.tagName === 'head');
    if (!head?.childNodes.some(child => child.tagName === 'style' && textContent(child).includes(`.${HIDDEN_CLASS}`))) problems.push({ issue: 'hidden-text style' });
  }
  return problems;
}
