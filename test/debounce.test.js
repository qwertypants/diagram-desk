import test from 'node:test';
import assert from 'node:assert/strict';

import { createDebounced } from '../src/debounce.js';

/** Deterministic stand-in for setTimeout/clearTimeout. */
function fakeTimers() {
  let now = 0;
  let sequence = 0;
  const pending = new Map();
  return {
    setTimeout(fn, ms) {
      sequence += 1;
      pending.set(sequence, { at: now + ms, fn });
      return sequence;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, task] of [...pending]) {
        if (task.at <= now) {
          pending.delete(id);
          task.fn();
        }
      }
    },
    get scheduled() {
      return pending.size;
    },
  };
}

test('a burst of calls collapses into one call carrying the newest arguments', () => {
  const timers = fakeTimers();
  const calls = [];
  const debounced = createDebounced((value) => calls.push(value), 200, timers);

  debounced.call('flowchart TD');
  debounced.call('flowchart TD\n  A');
  debounced.call('flowchart TD\n  A --> B');

  assert.deepEqual(calls, []);
  timers.advance(199);
  assert.deepEqual(calls, []);
  timers.advance(1);
  assert.deepEqual(calls, ['flowchart TD\n  A --> B']);
  assert.equal(timers.scheduled, 0);
});

test('the final keystroke is rendered: the trailing call fires with the last source', () => {
  const timers = fakeTimers();
  const calls = [];
  const debounced = createDebounced((value) => calls.push(value), 200, timers);

  debounced.call('a');
  timers.advance(150);
  debounced.call('ab');
  timers.advance(150);
  debounced.call('abc');
  timers.advance(200);

  assert.deepEqual(calls, ['abc']);
});

test('flush runs the pending call immediately with the newest arguments', () => {
  const timers = fakeTimers();
  const calls = [];
  const debounced = createDebounced((value) => calls.push(value), 200, timers);

  debounced.call('first');
  debounced.call('last');
  assert.equal(debounced.pending, true);
  assert.equal(debounced.flush(), true);
  assert.deepEqual(calls, ['last']);
  assert.equal(debounced.pending, false);

  timers.advance(1000);
  assert.deepEqual(calls, ['last'], 'a flushed call must not also fire later');
});

test('flush reports false when nothing is pending and does not call through', () => {
  const timers = fakeTimers();
  const calls = [];
  const debounced = createDebounced((value) => calls.push(value), 200, timers);

  assert.equal(debounced.flush(), false);
  debounced.call('x');
  debounced.flush();
  assert.equal(debounced.flush(), false);
  assert.deepEqual(calls, ['x']);
});

test('cancel drops the pending call entirely', () => {
  const timers = fakeTimers();
  const calls = [];
  const debounced = createDebounced((value) => calls.push(value), 200, timers);

  debounced.call('x');
  debounced.cancel();

  assert.equal(debounced.pending, false);
  assert.equal(debounced.flush(), false);
  timers.advance(1000);
  assert.deepEqual(calls, []);
});
