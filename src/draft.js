/**
 * Editor state that has no DOM: the draft, the preview outcome, dirty tracking,
 * and the rule that gates Save.
 *
 * Save is enabled only when the draft has a title AND the preview last
 * succeeded. Anything else keeps Save disabled with a stated reason.
 */

export const PREVIEW = Object.freeze({
  IDLE: 'idle',
  PENDING: 'pending',
  OK: 'ok',
  ERROR: 'error',
});

export function emptyDraft() {
  return { title: '', source: '' };
}

export function draftFromDiagram(diagram) {
  return {
    title: typeof diagram?.title === 'string' ? diagram.title : '',
    source: typeof diagram?.source === 'string' ? diagram.source : '',
  };
}

export function isDirty(draft, baseline) {
  return (
    (draft?.title ?? '') !== (baseline?.title ?? '') || (draft?.source ?? '') !== (baseline?.source ?? '')
  );
}

export function hasTitle(draft) {
  return typeof draft?.title === 'string' && draft.title.trim() !== '';
}

export function canSave({ draft, preview } = {}) {
  return hasTitle(draft) && preview?.status === PREVIEW.OK;
}

/** Why Save is unavailable, or null when it is available. */
export function saveBlockedReason({ draft, preview } = {}) {
  if (!hasTitle(draft)) return 'Add a title to save this diagram.';
  if (preview?.status === PREVIEW.ERROR) return 'The preview has an error. Fix it before saving.';
  if (preview?.status !== PREVIEW.OK) return 'Waiting for a successful preview.';
  return null;
}

const TIMESTAMP = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Human timestamp for the mono meta lines; `—` when the value is unusable. */
export function formatTimestamp(iso) {
  if (typeof iso !== 'string' || iso.trim() === '') return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return TIMESTAMP.format(date);
}
