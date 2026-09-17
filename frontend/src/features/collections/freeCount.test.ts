import { describe, expect, it } from 'vitest';
import { freeCount } from './freeCount';

describe('what a visitor may see of a board', () => {
  it('is a quarter of it, rounded up, so there is always something to look at', () => {
    expect(freeCount(10)).toBe(3);
    expect(freeCount(5)).toBe(2);
    // An exact quarter is taken as it is; anything over rounds up to the next.
    expect(freeCount(8)).toBe(2);
    expect(freeCount(9)).toBe(3);
    expect(freeCount(4)).toBe(1);
    expect(freeCount(3)).toBe(1);
    expect(freeCount(1)).toBe(1);
    expect(freeCount(0)).toBe(0);
  });
});
