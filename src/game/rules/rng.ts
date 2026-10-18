/**
 * Deterministic, serializable PRNG (mulberry32). The full generator state is a
 * single uint32, so it can be stored in a save file and resumed exactly.
 */
export class Rng {
  private s: number;

  constructor(state: number) {
    this.s = state >>> 0;
  }

  get state(): number {
    return this.s;
  }

  nextUint32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Unbiased integer in [0, n) via rejection sampling. */
  nextInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) throw new Error(`Invalid range ${n}`);
    const limit = Math.floor(0x100000000 / n) * n;
    let x: number;
    do {
      x = this.nextUint32();
    } while (x >= limit);
    return x % n;
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
