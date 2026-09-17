/**
 * How much of a board a visitor may look at: a quarter of it, rounded up, so
 * even a board of three shows one and a board of ten shows three. The rest is
 * behind the gate, with the next one blurred so they can see there is a rest.
 */
export function freeCount(total: number): number {
  return Math.ceil(total / 4);
}
