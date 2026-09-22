/**
 * Deterministic seeded pseudo-random generator.
 *
 * Any algorithm that uses randomness (randomised quicksort, reservoir
 * sampling, Las Vegas / Monte Carlo algorithms, hash seeds …) MUST take its
 * randomness from a `SeededRandom` instance created from the trace seed, so a
 * fixed (input, seed) pair always produces an identical trace.
 *
 * Algorithm: mulberry32 — small, fast, well distributed for teaching purposes.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Normalise to a 32-bit unsigned integer; 0 is a valid seed.
    this.state = (Math.trunc(seed) || 0) >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`SeededRandom.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Fisher-Yates shuffle, in place, deterministic for a fixed seed. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  /** Picks one element; throws on an empty list. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('SeededRandom.pick: empty list');
    return items[this.int(0, items.length - 1)];
  }

  /** Probability gate used by Monte Carlo style algorithms. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

export const DEFAULT_SEED = 20260101;
