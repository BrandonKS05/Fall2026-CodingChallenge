let last = 0;

/**
 * A timestamp that never repeats. Postgres resolves times finely enough that two
 * rows written in a row are strictly ordered; `new Date()` is only accurate to the
 * millisecond, so without this the fakes tie and order assertions become flaky.
 */
export function nextInstant(): Date {
  last = Math.max(Date.now(), last + 1);
  return new Date(last);
}
