/**
 * Trailing-edge debounce that keeps the most recent arguments and can be
 * flushed. `flush()` is what guarantees the final keystroke still renders: the
 * page unload path calls it instead of dropping the pending call.
 *
 * Timers are injectable so the behaviour can be tested without real waiting.
 */
export function createDebounced(fn, waitMs, { setTimeout: setT = globalThis.setTimeout, clearTimeout: clearT = globalThis.clearTimeout } = {}) {
  let timer = null;
  let pendingArgs = null;

  function invoke() {
    const args = pendingArgs;
    timer = null;
    pendingArgs = null;
    fn(...args);
  }

  return {
    call(...args) {
      pendingArgs = args;
      if (timer !== null) clearT(timer);
      timer = setT(invoke, waitMs);
    },
    flush() {
      if (timer === null) return false;
      clearT(timer);
      invoke();
      return true;
    },
    cancel() {
      if (timer !== null) clearT(timer);
      timer = null;
      pendingArgs = null;
    },
    get pending() {
      return timer !== null;
    },
  };
}
