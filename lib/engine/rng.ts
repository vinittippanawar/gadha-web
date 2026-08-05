/**
 * Small seedable PRNG (mulberry32) so games and tests are reproducible.
 * Not cryptographic -- fine for shuffling a deck of cards.
 */
export interface Rng {
  next(): number; // [0, 1)
  randrange(n: number): number; // [0, n)
  shuffle<T>(arr: T[]): T[]; // Fisher-Yates, in place, returns arr
}

export function makeRng(seed?: number): Rng {
  let a = (seed ?? Date.now()) >>> 0;
  function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randrange(n: number): number {
    return Math.floor(next() * n);
  }
  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randrange(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  return { next, randrange, shuffle };
}
