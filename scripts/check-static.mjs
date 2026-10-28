import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { inspectExternalLinks } from './external-links.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const catalog = JSON.parse(readFileSync(join(root, 'catalog/index.json'), 'utf8'));
const legacyIds = JSON.parse(readFileSync(join(root, 'src/legacy-ids.json'), 'utf8'));
const base = `/${(process.env.BASE_PATH || '/').split('/').filter(Boolean).join('/')}`.replace(/\/$/, '');
const origin = new URL(process.env.SITE_URL || 'http://localhost:4321').origin;
const companionNames = readdirSync(join(root, 'src/content/companions')).filter(name => name.endsWith('.mdx')).map(name => name.slice(0, -4));

function checkFile(path) {
  if (!existsSync(path)) throw new Error(`Missing static output: ${path}`);
  return readFileSync(path, 'utf8');
}

checkFile(join(dist, 'index.html'));
checkFile(join(dist, 'articles/index.html'));
checkFile(join(dist, 'topics/index.html'));

function assertNewestFirst(path) {
  const html = checkFile(path);
  const dates = [...html.matchAll(/<time class="card-date" datetime="([^"]+)"/g)].map(match => Date.parse(match[1]));
  if (!dates.length) throw new Error(`Listing has no dated article cards: ${path}`);
  for (let index = 1; index < dates.length; index++) {
    if (dates[index] > dates[index - 1]) throw new Error(`Listing is not newest first: ${path}`);
  }
  return dates;
}

const homeDates = assertNewestFirst(join(dist, 'index.html'));
const libraryDates = assertNewestFirst(join(dist, 'articles/index.html'));
if (homeDates[0] !== libraryDates[0]) throw new Error('Home and article library disagree on the latest article.');

for (const article of catalog) {
  const page = checkFile(join(dist, 'articles', article.slug, 'index.html'));
  const reader = checkFile(join(dist, 'diagrams', article.slug, 'reader.html'));
  if (!page.includes(`${base}/diagrams/${article.slug}/reader.html?hideBreadcrumbs=1&amp;hideHeader=1`)) {
    throw new Error(`Article reader does not suppress its header and breadcrumbs when embedded: ${article.slug}`);
  }
  if (!page.includes(`href="${base}/diagrams/${article.slug}/">Return to the diagram →</a>`)) {
    throw new Error(`Article lacks its diagram next step: ${article.slug}`);
  }
  if (!reader.includes('diagram-source-sha256')) {
    throw new Error(`Reader lacks source identity: ${article.slug}`);
  }
  for (const target of [`${base || ''}/articles/`, `${base || ''}/articles/${article.slug}/`]) {
    const escapedHref = JSON.stringify(`href="${target}"`).slice(1, -1);
    if (!reader.includes(escapedHref)) throw new Error(`Reader breadcrumb lacks ${target}: ${article.slug}`);
  }
  if (!reader.includes("get('hideHeader')==='1'") ||
      !reader.includes('data-reader-header') ||
      !reader.includes('display: none !important') ||
      !reader.includes("get('hideBreadcrumbs')==='1'") ||
      !reader.includes("setAttribute('aria-label','Breadcrumb')") ||
      !reader.includes(JSON.stringify('aria-current="page">Diagram reader').slice(1, -1))) {
    throw new Error(`Reader lacks accessible breadcrumbs: ${article.slug}`);
  }
  if (companionNames.includes(article.slug)) {
    const companion = checkFile(join(dist, 'diagrams', article.slug, 'index.html'));
    if (!companion.includes(`src="${base}/diagrams/${article.slug}/reader.html?hideBreadcrumbs=1&amp;hideHeader=1"`)) {
      throw new Error(`Companion reader does not suppress its header and breadcrumbs when embedded: ${article.slug}`);
    }
    for (const target of [`${base}/articles/${article.slug}/`, `${base}/diagrams/${article.slug}/reader.html`]) {
      if (!companion.includes(target)) throw new Error(`Companion ${article.slug} lacks ${target}`);
    }
    if (!page.includes(`${base}/diagrams/${article.slug}/`)) throw new Error(`Article lacks companion link: ${article.slug}`);
    const canonical = companion.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']+)/i)?.[1];
    if (canonical !== `${origin}${base}/diagrams/${article.slug}/`) throw new Error(`Wrong companion canonical: ${article.slug}: ${canonical}`);
  }
}

for (const [id, slug] of Object.entries(legacyIds)) {
  for (const suffix of ['', 'edit/']) {
    const page = checkFile(join(dist, 'diagrams', id, suffix, 'index.html'));
    if (!page.includes(`${base}/articles/${slug}/`)) {
      throw new Error(`Legacy route points to the wrong article: ${id}/${suffix}`);
    }
  }
}

function* htmlFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

let checkedLinks = 0;
for (const file of htmlFiles(dist)) {
  const route = relative(dist, file).replaceAll('\\', '/').replace(/index\.html$/, '');
  const pageUrl = new URL(`${base}/${route}`, origin);
  const source = readFileSync(file, 'utf8');
  const violations = inspectExternalLinks(source, pageUrl.href);
  if (violations.length) throw new Error(`External link contract in ${relative(dist, file)}: ${JSON.stringify(violations)}`);
  const html = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const destinations = [...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']*)["']/gi)].map(match => match[1]);
  for (const tag of html.matchAll(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/gi)) {
    const redirect = tag[0].match(/\bcontent=["'][^"']*?url=([^"']*)["']/i);
    if (redirect) destinations.push(redirect[1]);
  }
  for (const raw of destinations) {
    if (!raw || raw.startsWith('#')) continue;
    const url = new URL(raw.replaceAll('&amp;', '&'), pageUrl);
    if (url.origin !== origin) continue;
    if (!url.pathname.startsWith(`${base}/`)) {
      throw new Error(`URL escapes deployment base in ${relative(dist, file)}: ${raw}`);
    }
    const path = resolve(dist, decodeURIComponent(url.pathname.slice(base.length + 1)));
    if (path !== dist && !path.startsWith(`${dist}/`)) throw new Error(`URL escapes dist: ${raw}`);
    const target = existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : path;
    if (!existsSync(target)) throw new Error(`Missing URL target in ${relative(dist, file)}: ${raw}`);
    checkedLinks++;
  }
}

console.log(`Static output at ${base || '/'}: ${catalog.length} articles, ${companionNames.length} companions, ${catalog.length} Archify readers, ${Object.keys(legacyIds).length * 2} legacy routes; ${checkedLinks} internal URLs and all external link notices verified.`);
