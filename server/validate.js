import { parseCandidate } from './archify.js';

const TITLE_MAX_LENGTH = 200;
const SOURCE_MAX_LENGTH = 100000;

export function validateDiagramBody(body) {
  if (!isJsonObject(body)) return { error: 'Request body must be a JSON object' };

  const title = validateField(body.title, 'title', TITLE_MAX_LENGTH);
  if (title.error !== undefined) return title;

  const source = validateField(body.source, 'source', SOURCE_MAX_LENGTH);
  if (source.error !== undefined) return source;

  const diagram = { title: title.value, source: source.value };
  if (body.type !== undefined) {
    try { parseCandidate(source.value, body.type); } catch (error) { return { error: error.message }; }
    diagram.type = body.type;
    diagram.lesson = body.lesson ?? null;
    if (diagram.lesson !== null) {
      const error = validateLesson(diagram.lesson);
      if (error) return { error };
    }
  }
  return { diagram };
}

function validateField(value, name, maxLength) {
  if (value === undefined || value === null) return { error: `${name} is required` };
  if (typeof value !== 'string') return { error: `${name} must be a string` };

  const trimmed = value.trim();
  if (trimmed === '') return { error: `${name} must not be blank` };
  if (trimmed.length > maxLength) return { error: `${name} must be at most ${maxLength} characters` };

  return { value };
}

function isJsonObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateLesson(lesson) {
  if (!isJsonObject(lesson)) return 'Lesson must be a JSON object.';
  const strings = ['summary', 'problem', 'scope'];
  const lists = ['objectives', 'decisions', 'failureModes', 'takeaways'];
  const allowed = [...strings, ...lists, 'walkthrough', 'references'];
  if (Object.keys(lesson).some(key => !allowed.includes(key))) return 'Lesson contains an unknown field.';
  const text = value => typeof value === 'string' && value.length <= 4000;
  for (const key of strings) if (lesson[key] !== undefined && !text(lesson[key])) return `Lesson ${key} must be text.`;
  for (const key of lists) if (lesson[key] !== undefined && (!Array.isArray(lesson[key]) || lesson[key].length > 50 || !lesson[key].every(text))) return `Lesson ${key} must be a list of text.`;
  for (const key of ['walkthrough', 'references']) {
    if (lesson[key] === undefined) continue;
    if (!Array.isArray(lesson[key]) || lesson[key].length > 50) return `Lesson ${key} must be a list.`;
    for (const item of lesson[key]) {
      if (!isJsonObject(item) || !text(item.title)) return `Lesson ${key} needs a title on each item.`;
      if (key === 'walkthrough' && !text(item.detail)) return 'Each reading step needs detail text.';
      if (key === 'references') {
        try { if (!['https:', 'http:'].includes(new URL(item.url).protocol)) throw new Error(); }
        catch { return 'References must use HTTP or HTTPS URLs.'; }
      }
    }
  }
  return null;
}
