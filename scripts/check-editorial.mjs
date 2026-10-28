import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';

const articleRoot = 'src/content/articles';
const placeholder = /\b(TODO|TBD|Lorem ipsum|\[citation needed\])\b/i;
const externalLink = /\]\((https?:\/\/[^)\s]+)\)/g;

function metadata(source) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  return parse(frontmatter[1]);
}

function dateValue(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function checkEditorial(root) {
  const directory = join(root, articleRoot);
  if (!existsSync(directory)) throw new Error(`Missing article directory: ${directory}`);

  const files = readdirSync(directory).filter(name => name.endsWith('.mdx')).sort();
  const slugs = new Set(files.map(name => name.slice(0, -4)));
  const errors = [];
  const warnings = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const file of files) {
    const slug = file.slice(0, -4);
    const source = readFileSync(join(directory, file), 'utf8');
    const data = metadata(source);
    if (!data) {
      errors.push(`${slug}: missing frontmatter`);
      continue;
    }

    if (placeholder.test(source)) errors.push(`${slug}: placeholder text remains`);

    const headings = [...source.matchAll(/^##\s+(.+?)\s*$/gm)];
    const sourceHeadings = headings.filter(heading => /^sources$/i.test(heading[1]));
    if (!sourceHeadings.length) {
      errors.push(`${slug}: missing "## Sources" section`);
    } else if (sourceHeadings.length > 1) {
      errors.push(`${slug}: duplicate "## Sources" sections`);
    } else {
      const start = sourceHeadings[0].index + sourceHeadings[0][0].length;
      const next = headings.find(heading => heading.index > sourceHeadings[0].index);
      const section = source.slice(start, next ? next.index : undefined);
      const links = [...section.matchAll(externalLink)];
      if (!links.length) errors.push(`${slug}: "## Sources" has no external links`);

      const tags = (data.tags || []).map(tag => String(tag).toLowerCase());
      const needsEvidence = tags.includes('research') || tags.includes('benchmark');
      if (needsEvidence && links.length < 2) {
        errors.push(`${slug}: research or benchmark articles need at least two sources`);
      }
      if (needsEvidence && !/\b20\d{2}\b/.test(section)) {
        errors.push(`${slug}: research or benchmark sources need a publication date`);
      }
    }

    const reviewed = dateValue(data.reviewed);
    const reviewBy = dateValue(data.reviewBy);
    if (data.reviewed && !reviewed) errors.push(`${slug}: reviewed is not a valid date`);
    if (data.reviewBy && !reviewBy) errors.push(`${slug}: reviewBy is not a valid date`);
    if (Boolean(reviewed) !== Boolean(reviewBy)) {
      errors.push(`${slug}: reviewed and reviewBy must be set together`);
    }
    if (reviewed && reviewBy && reviewBy <= reviewed) {
      errors.push(`${slug}: reviewBy must be later than reviewed`);
    }
    if (reviewBy && reviewBy < today) {
      warnings.push(`${slug}: review overdue since ${reviewBy.toISOString().slice(0, 10)}`);
    }

    for (const related of data.related || []) {
      if (related === slug) errors.push(`${slug}: related article points to itself`);
      else if (!slugs.has(related)) errors.push(`${slug}: related article does not exist: ${related}`);
    }
  }

  if (errors.length) {
    throw new Error(`Editorial checks failed:\n- ${errors.join('\n- ')}`);
  }

  return { articles: files.length, warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkEditorial(resolve(import.meta.dirname, '..'));
  console.log(`Editorial standards: ${result.articles} articles have a Sources section and valid review metadata.`);
  for (const warning of result.warnings) console.warn(`Editorial warning: ${warning}`);
}
