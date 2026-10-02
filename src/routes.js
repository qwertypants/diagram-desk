/**
 * URL <-> view mapping. Pure functions, no DOM, so the routing contract is
 * testable on its own. Uses the History API with path routes:
 *
 *   /                     the library, nothing open
 *   /new                  compose a new diagram
 *   /diagrams/<id>        reopen a saved diagram (render first)
 *   /diagrams/<id>/edit   edit a saved diagram (source and preview together)
 */

export const VIEW = Object.freeze({
  LIBRARY: 'library',
  COMPOSE: 'compose',
  DIAGRAM: 'diagram',
  EDIT: 'edit',
  NOT_FOUND: 'notFound',
});

function normalize(pathname) {
  if (typeof pathname !== 'string' || pathname === '') return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const trimmed = withSlash.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Map a pathname onto a view. An unknown path is NOT_FOUND, never a throw. */
export function parsePath(pathname) {
  const path = normalize(pathname);
  if (path === '/') return { view: VIEW.LIBRARY };
  if (path === '/new') return { view: VIEW.COMPOSE };

  const match = /^\/diagrams\/([^/]+)(\/edit)?$/.exec(path);
  if (!match) return { view: VIEW.NOT_FOUND };

  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return { view: VIEW.NOT_FOUND };
  }
  if (id === '') return { view: VIEW.NOT_FOUND };
  return match[2] ? { view: VIEW.EDIT, id } : { view: VIEW.DIAGRAM, id };
}

export function libraryPath() {
  return '/';
}

export function composePath() {
  return '/new';
}

export function diagramPath(id) {
  return `/diagrams/${encodeURIComponent(id)}`;
}

export function editPath(id) {
  return `/diagrams/${encodeURIComponent(id)}/edit`;
}
