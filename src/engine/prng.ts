// One u32, JSON-safe. Serializing a save just means storing this number.
export type PrngState = number;

export interface Prng {
  /** Next float in [0, 1). */
  next(): number;
  /**
   * Next integer in [min, max], both ends inclusive.
   * Requires min <= max; behavior is unspecified otherwise.
   */
  int(min: number, max: number): number;
  /** Picks a uniformly random element. Throws on an empty array. */
  choice<T>(items: readonly T[]): T;
  getState(): PrngState;
  setState(state: PrngState): void;
}

// mulberry32: a single 32-bit state advanced with only u32-exact ops
// (Math.imul, xor, shifts), which ECMAScript specifies bit-for-bit, so the
// output sequence is identical on every machine and runtime for a given
// seed. That reproducibility, not statistical strength, is why it is used
// here instead of a larger-state generator.
export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int(min: number, max: number): number {
      // Derived from next() by floor; the resulting bias at 32-bit
      // resolution is negligible for gameplay and visual effects.
      return min + Math.floor(next() * (max - min + 1));
    },
    choice<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('choice: cannot pick from an empty array');
      }
      return items[Math.floor(next() * items.length)] as T;
    },
    getState(): PrngState {
      return state;
    },
    setState(newState: PrngState): void {
      // Coerce so any number restored from JSON normalizes to a valid u32.
      state = newState >>> 0;
    },
  };
}
