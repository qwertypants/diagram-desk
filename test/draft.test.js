import test from 'node:test';
import assert from 'node:assert/strict';

import { canSave, draftFromDiagram, emptyDraft, formatTimestamp, isDirty, saveBlockedReason, PREVIEW } from '../src/draft.js';

const ok = { status: PREVIEW.OK };
const failed = { status: PREVIEW.ERROR, message: 'Parse error on line 2' };

test('emptyDraft and draftFromDiagram build a title/source pair', () => {
  assert.deepEqual(emptyDraft(), { title: '', source: '' });
  assert.deepEqual(draftFromDiagram({ title: 'Order flow', source: 'graph TD; A-->B' }), {
    title: 'Order flow',
    source: 'graph TD; A-->B',
  });
  assert.deepEqual(draftFromDiagram(undefined), { title: '', source: '' });
});

test('Save needs a title AND a successful preview', () => {
  assert.equal(canSave({ draft: { title: '', source: 'graph TD; A-->B' }, preview: ok }), false);
  assert.equal(canSave({ draft: { title: 'Flow', source: '' }, preview: ok }), true);
  assert.equal(canSave({ draft: { title: 'Flow', source: '' }, preview: failed }), false);
  assert.equal(canSave({ draft: { title: 'Flow', source: '' }, preview: { status: PREVIEW.PENDING } }), false);
  assert.equal(canSave({ draft: { title: 'Flow', source: '' }, preview: { status: PREVIEW.IDLE } }), false);
  assert.equal(canSave(), false);
});

test('a title of only whitespace does not enable Save', () => {
  assert.equal(canSave({ draft: { title: '   ', source: '' }, preview: ok }), false);
  assert.equal(saveBlockedReason({ draft: { title: '  ', source: '' }, preview: ok }), 'Add a title to save this diagram.');
});

test('saveBlockedReason explains each disabled state and nothing when enabled', () => {
  assert.equal(saveBlockedReason({ draft: { title: 'Flow', source: '' }, preview: failed }), 'The preview has an error. Fix it before saving.');
  assert.equal(saveBlockedReason({ draft: { title: 'Flow', source: '' }, preview: { status: PREVIEW.PENDING } }), 'Waiting for a successful preview.');
  assert.equal(saveBlockedReason({ draft: { title: 'Flow', source: '' }, preview: { status: PREVIEW.IDLE } }), 'Waiting for a successful preview.');
  assert.equal(saveBlockedReason({ draft: { title: 'Flow', source: '' }, preview: ok }), null);
});

test('isDirty compares the draft against the last saved baseline', () => {
  const baseline = { title: 'Flow', source: 'graph TD; A-->B' };
  assert.equal(isDirty({ ...baseline }, baseline), false);
  assert.equal(isDirty({ ...baseline, title: 'Flow 2' }, baseline), true);
  assert.equal(isDirty({ ...baseline, source: 'graph TD; A-->C' }, baseline), true);
  assert.equal(isDirty({ title: '', source: '' }, emptyDraft()), false);
  assert.equal(isDirty({ title: 'x', source: '' }, emptyDraft()), true);
});

test('formatTimestamp renders an em dash for values it cannot read', () => {
  assert.equal(formatTimestamp(''), '—');
  assert.equal(formatTimestamp('   '), '—');
  assert.equal(formatTimestamp(undefined), '—');
  assert.equal(formatTimestamp('not a date'), '—');
  assert.notEqual(formatTimestamp('2026-10-02T09:15:00.000Z'), '—');
});
