/**
 * Deck ordering.
 *
 * The study queue is shuffled rather than walked in `cards.json` order, so the
 * deck cannot be answered by muscle memory of the file. Two things make the
 * order *good* rather than merely random:
 *
 * - It is seeded, so the order is stable for the life of a session. The seed is
 *   drawn on load and not persisted, so every page load deals a new order, but
 *   the order does not move under the cursor while you are looking at it.
 *   A cursor into an order that reshuffles on every render would point at a
 *   different card each time.
 * - Cards are spread apart by category, so a run of consecutive questions is
 *   not a run of consecutive subjects. Clustering is what makes a shuffled deck
 *   feel like the same deck with the numbers changed.
 *
 * Everything here is pure and takes its randomness from the seed, so a given
 * seed always produces the same order and the behaviour is testable without
 * stubbing `Math.random`.
 */

/**
 * How far ahead {@link spreadCategories} will look for a card to swap with.
 *
 * Bounded on purpose: an unbounded search can pull a card from the far end of
 * the deck to fix a repeat, which is a worse trade than leaving the repeat in
 * place. Twenty is wide enough to break up real runs and narrow enough that the
 * rest of the deck keeps its shape.
 */
const SPREAD_WINDOW = 20;

/**
 * Mulberry32: a 32-bit state PRNG returning floats in [0, 1).
 *
 * Chosen for being four lines and having no visible bias at the scale of a
 * flashcard deck. It is not cryptographic and must not be used as such.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh seed, or `0` when the platform has no CSPRNG.
 *
 * Drawn once per page load and not stored, so it only has to be good for the
 * life of one session. Collapsing to `0` rather than throwing keeps the app
 * usable in an environment without `crypto`; the deck is still shuffled, just
 * the same way every time.
 */
export function newSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(values);
  return values[0] ?? 0;
}

/** Fisher-Yates over a copy, so the input array is never touched. */
export function shuffleWithSeed<T>(
  items: readonly T[],
  seed: number,
): readonly T[] {
  const out = items.slice();
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = out[i] as T;
    out[i] = out[j] as T;
    out[j] = swap;
  }
  return out;
}

/**
 * Breaks up runs of same-category cards by swapping a repeated card with a
 * nearer one from a different category.
 *
 * Best effort, not a guarantee: a deck with only one category enabled has
 * nothing to swap with and is returned unchanged. Where there are several
 * candidates the choice is taken from the seeded stream, so the same deck
 * reshuffles differently under a different seed but identically under the same
 * one.
 */
export function spreadCategories<T>(
  items: readonly T[],
  categoryOf: (item: T) => string,
  seed: number,
): readonly T[] {
  const out = items.slice();
  const random = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  for (let i = 1; i < out.length; i++) {
    const previous = categoryOf(out[i - 1] as T);
    if (categoryOf(out[i] as T) !== previous) continue;

    const candidates: number[] = [];
    const limit = Math.min(out.length, i + SPREAD_WINDOW);
    for (let j = i + 1; j < limit; j++) {
      if (categoryOf(out[j] as T) !== previous) candidates.push(j);
    }
    if (candidates.length === 0) continue;

    const j = candidates[Math.floor(random() * candidates.length)] as number;
    const swap = out[i] as T;
    out[i] = out[j] as T;
    out[j] = swap;
  }
  return out;
}

/**
 * The deck in study order: shuffled, then spread by category.
 *
 * `categoryOf` returning a constant leaves the order as a plain shuffle, which
 * is the correct behaviour for a deck with no categories.
 */
export function deckOrder<T>(
  items: readonly T[],
  categoryOf: (item: T) => string,
  seed: number,
): readonly T[] {
  return spreadCategories(shuffleWithSeed(items, seed), categoryOf, seed);
}
