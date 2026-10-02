const TITLE_MAX_LENGTH = 200;
const SOURCE_MAX_LENGTH = 100000;

export function validateDiagramBody(body) {
  if (!isJsonObject(body)) return { error: 'Request body must be a JSON object' };

  const title = validateField(body.title, 'title', TITLE_MAX_LENGTH);
  if (title.error !== undefined) return title;

  const source = validateField(body.source, 'source', SOURCE_MAX_LENGTH);
  if (source.error !== undefined) return source;

  return { diagram: { title: title.value, source: source.value } };
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
