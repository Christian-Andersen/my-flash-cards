import { describe, expect, it } from "vitest";

import {
  deckOrder,
  newSeed,
  spreadCategories,
  shuffleWithSeed,
} from "./shuffle";
import {
  activeDeck,
  categoryCounts,
  currentCardId,
  initialStudyState,
  isAnswer,
  isDeckFilteredOut,
  progressOf,
  reduceStudy,
  viewQueue,
  type DeckIndex,
  type StudyState,
} from "./study";

const SEED = 20_240_517;

/** Four cards across two categories: a,b in one and c,d in the other. */
const DECK: DeckIndex = {
  ids: ["a", "b", "c", "d"],
  categoryOf: { a: "x", b: "x", c: "y", d: "y" },
};

const EMPTY: DeckIndex = { ids: [], categoryOf: {} };

/** Forty cards in four blocks of ten, so deck order is heavily clustered. */
const BIG_IDS: readonly string[] = Array.from(
  { length: 40 },
  (_, i) => `c${i}`,
);
const BIG: DeckIndex = {
  ids: BIG_IDS,
  categoryOf: Object.fromEntries(
    BIG_IDS.map((id, i) => [id, `cat${Math.floor(i / 10)}`]),
  ),
};

const cat = (deck: DeckIndex) => (id: string) => deck.categoryOf[id] ?? id;

/** Applies a sequence of actions to the initial state. */
function play(
  state: StudyState,
  ...actions: Parameters<typeof reduceStudy>[1][]
) {
  return actions.reduce((acc, action) => reduceStudy(acc, action, DECK), state);
}

const start = () => initialStudyState(SEED);
const grade = (cardId: string, answer: "got-it" | "missed") =>
  ({ type: "answer", cardId, answer }) as const;

/** The queue as a sorted set, for assertions about membership not order. */
const remaining = (state: StudyState) => [...viewQueue(state, DECK)].sort();

/** Adjacent pairs in `order` whose two entries share a category. */
function adjacentRepeats(order: readonly string[], deck: DeckIndex): number {
  let repeats = 0;
  for (let i = 1; i < order.length; i++) {
    if (
      deck.categoryOf[order[i - 1] as string] ===
      deck.categoryOf[order[i] as string]
    ) {
      repeats += 1;
    }
  }
  return repeats;
}

describe("isAnswer", () => {
  it("accepts only the two grades", () => {
    expect(isAnswer("got-it")).toBe(true);
    expect(isAnswer("missed")).toBe(true);
  });

  it("rejects anything else, including lookalike strings", () => {
    for (const value of ["", "missed ", "GOT-IT", null, undefined, 1]) {
      expect(isAnswer(value)).toBe(false);
    }
  });
});

describe("shuffleWithSeed", () => {
  it("is deterministic for a given seed", () => {
    const ids = [...BIG_IDS];
    expect(shuffleWithSeed(ids, 7)).toEqual(shuffleWithSeed(ids, 7));
  });

  it("produces a different order for a different seed", () => {
    const ids = [...BIG_IDS];
    // 40 cards: two seeds colliding on the exact same permutation is a 1-in-40!
    // chance, but the test should not depend on that. Check a spread instead.
    const orders = new Set(
      Array.from({ length: 25 }, (_, seed) =>
        shuffleWithSeed(ids, seed).join(","),
      ),
    );
    expect(orders.size).toBe(25);
  });

  it("keeps every card exactly once", () => {
    const shuffled = shuffleWithSeed(BIG_IDS, 3);
    expect([...shuffled].sort()).toEqual([...BIG_IDS].sort());
  });

  it("does not mutate the array it is given", () => {
    const ids = [...BIG_IDS];
    const snapshot = [...ids];
    shuffleWithSeed(ids, 11);
    expect(ids).toEqual(snapshot);
  });

  it("handles an empty and a single-item deck", () => {
    expect(shuffleWithSeed([], 1)).toEqual([]);
    expect(shuffleWithSeed(["only"], 1)).toEqual(["only"]);
  });
});

describe("spreadCategories", () => {
  it("breaks up a run of same-category cards", () => {
    // Deck order is cat0 x10, then cat1 x10, and so on: 36 adjacent repeats.
    expect(adjacentRepeats(BIG_IDS, BIG)).toBe(36);
    const order = spreadCategories(BIG_IDS, cat(BIG), 5);
    expect(adjacentRepeats(order, BIG)).toBeLessThan(
      adjacentRepeats(BIG_IDS, BIG),
    );
  });

  it("leaves the order alone when every card shares a category", () => {
    // Nothing to swap with, so a single-category deck must come back intact
    // rather than being mangled.
    const ids = ["p", "q", "r", "s"];
    expect(spreadCategories(ids, () => "same", 5)).toEqual(ids);
  });

  it("is deterministic and keeps every card", () => {
    const once = spreadCategories(BIG_IDS, cat(BIG), 9);
    expect(spreadCategories(BIG_IDS, cat(BIG), 9)).toEqual(once);
    expect([...once].sort()).toEqual([...BIG_IDS].sort());
  });
});

describe("deckOrder", () => {
  /*
   * Measured over a fixed sweep of seeds rather than one seed: the whole point
   * is that the order is good for every session, and a single seed would pass
   * by luck. The window is bounded, so this is a strong reduction rather than a
   * guarantee, and the test says so rather than asserting zero.
   */
  const repeatsOverSeeds = (order: (seed: number) => readonly string[]) =>
    Array.from({ length: 200 }, (_, seed) => adjacentRepeats(order(seed), BIG));

  const mean = (values: readonly number[]) =>
    values.reduce((total, n) => total + n, 0) / values.length;

  it("cuts adjacent same-category runs far below a plain shuffle", () => {
    const plain = repeatsOverSeeds((seed) => shuffleWithSeed(BIG_IDS, seed));
    const spread = repeatsOverSeeds((seed) =>
      deckOrder(BIG_IDS, cat(BIG), seed),
    );
    // A plain shuffle of 40 cards in four blocks of ten averages around nine
    // runs; spreading should cut that to well under a fifth.
    expect(mean(spread)).toBeLessThan(mean(plain) / 5);
  });

  it("keeps the worst case small across seeds", () => {
    const spread = repeatsOverSeeds((seed) =>
      deckOrder(BIG_IDS, cat(BIG), seed),
    );
    // The bounded swap window cannot always find a non-repeating neighbour, so
    // this is a ceiling, not a promise of a perfect interleave.
    expect(Math.max(...spread)).toBeLessThanOrEqual(5);
  });

  it("shuffles and then spreads", () => {
    expect(deckOrder(BIG_IDS, cat(BIG), 5)).toEqual(
      spreadCategories(shuffleWithSeed(BIG_IDS, 5), cat(BIG), 5),
    );
  });

  it("is stable for a session and different across seeds", () => {
    expect(deckOrder(BIG_IDS, cat(BIG), 42)).toEqual(
      deckOrder(BIG_IDS, cat(BIG), 42),
    );
    expect(deckOrder(BIG_IDS, cat(BIG), 42)).not.toEqual(
      deckOrder(BIG_IDS, cat(BIG), 43),
    );
  });
});

describe("newSeed", () => {
  it("produces varied non-negative integers", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => newSeed()));
    expect(seeds.size).toBeGreaterThan(40);
    // mulberry32 coerces with >>> 0, so anything within the uint32 range is a
    // usable seed and no value is out of range.
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(4_294_967_295);
    }
  });
});

describe("progressOf", () => {
  it("counts unvisited cards and a zero ratio for an empty deck", () => {
    expect(progressOf(start(), EMPTY)).toEqual({
      total: 0,
      gotIt: 0,
      missed: 0,
      unvisited: 0,
      ratio: 0,
    });
  });

  it("reports a graded fraction of the whole deck", () => {
    const state = play(start(), grade("a", "got-it"), grade("b", "missed"));
    expect(progressOf(state, DECK)).toEqual({
      total: 4,
      gotIt: 1,
      missed: 1,
      unvisited: 2,
      ratio: 0.5,
    });
  });

  it("counts only the categories that are switched on", () => {
    const state = play(start(), grade("a", "got-it"), {
      type: "set-category",
      categoryId: "x",
      enabled: false,
    });
    // "a" is hidden along with the rest of category x, so it leaves the
    // progress count as well as the queue: 0 of 2 graded.
    expect(progressOf(state, DECK)).toEqual({
      total: 2,
      gotIt: 0,
      missed: 0,
      unvisited: 2,
      ratio: 0,
    });
  });
});

describe("answer", () => {
  it("records the grade against the card", () => {
    expect(play(start(), grade("b", "missed")).answers).toEqual({
      b: "missed",
    });
  });

  it("lets a later grade overwrite an earlier one", () => {
    const state = play(start(), grade("b", "missed"), grade("b", "got-it"));
    expect(state.answers.b).toBe("got-it");
  });

  it("ignores a card that is not in the deck", () => {
    expect(play(start(), grade("zz", "missed")).answers).toEqual({});
  });

  it("moves to the following card after grading", () => {
    const order = viewQueue(start(), DECK);
    const state = play(start(), grade(order[0] as string, "missed"));
    expect(currentCardId(state, DECK)).toBe(order[1]);
  });

  it("skips a card answered got it when advancing", () => {
    // Retiring the visible card must land on the card that took its place
    // rather than stepping over it.
    const order = viewQueue(start(), DECK);
    const state = play(start(), grade(order[0] as string, "got-it"));
    expect(currentCardId(state, DECK)).toBe(order[1]);
  });

  it("wraps back to the first card when grading the last one", () => {
    const order = viewQueue(start(), DECK);
    const last = order.at(-1) as string;
    const before: StudyState = { ...start(), cursor: order.length - 1 };
    // Graded `missed`, so the card stays in the queue and the cursor wraps.
    expect(play(before, grade(last, "missed")).cursor).toBe(0);
  });

  it("empties the queue when the last card is retired", () => {
    const state: StudyState = {
      ...start(),
      answers: { b: "got-it", c: "got-it", d: "got-it" },
    };
    const only = viewQueue(state, DECK)[0] as string;
    const after = reduceStudy(state, grade(only, "got-it"), DECK);
    expect(viewQueue(after, DECK)).toEqual([]);
    expect(currentCardId(after, DECK)).toBeUndefined();
  });
});

describe("viewQueue", () => {
  it("is the whole deck when nothing is graded", () => {
    expect(remaining(start())).toEqual(["a", "b", "c", "d"]);
  });

  it("drops a card once it is answered got it", () => {
    expect(remaining(play(start(), grade("a", "got-it")))).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("keeps missed and unvisited cards", () => {
    const state = play(start(), grade("a", "got-it"), grade("b", "missed"));
    expect(remaining(state)).toEqual(["b", "c", "d"]);
  });

  it("excludes hidden categories", () => {
    const state = reduceStudy(
      start(),
      { type: "set-category", categoryId: "y", enabled: false },
      DECK,
    );
    expect(remaining(state)).toEqual(["a", "b"]);
  });

  it("brings a hidden category back without losing its grades", () => {
    // "c" is graded missed, so it is in the queue both before and after; the
    // point is that switching it off and on again does not discard the grade.
    const state = play(
      start(),
      grade("c", "missed"),
      { type: "set-category", categoryId: "y", enabled: false },
      { type: "set-category", categoryId: "y", enabled: true },
    );
    expect(remaining(state)).toEqual(["a", "b", "c", "d"]);
    expect(state.answers).toEqual({ c: "missed" });
  });

  it("gives a different order for a different seed", () => {
    const one = viewQueue(start(), DECK).join(",");
    const other = viewQueue(initialStudyState(SEED + 1), DECK).join(",");
    expect(one).not.toBe(other);
  });

  it("keeps the same order across calls for one session", () => {
    expect(viewQueue(start(), DECK)).toEqual(viewQueue(start(), DECK));
  });
});

describe("activeDeck", () => {
  it("includes cards already retired, unlike the queue", () => {
    const state = play(start(), grade("a", "got-it"));
    expect([...activeDeck(state, DECK)].sort()).toEqual(["a", "b", "c", "d"]);
    expect(remaining(state)).toEqual(["b", "c", "d"]);
  });
});

describe("isDeckFilteredOut", () => {
  it("is true only when a non-empty deck has every category hidden", () => {
    const state = play(
      start(),
      { type: "set-category", categoryId: "x", enabled: false },
      { type: "set-category", categoryId: "y", enabled: false },
    );
    expect(isDeckFilteredOut(state, DECK)).toBe(true);
  });

  it("is false for an empty deck, which is a different problem", () => {
    expect(isDeckFilteredOut(start(), EMPTY)).toBe(false);
  });
});

describe("advance", () => {
  it("moves forward and backward", () => {
    const state = play(
      start(),
      { type: "advance", direction: 1 },
      { type: "advance", direction: 1 },
      { type: "advance", direction: -1 },
    );
    expect(state.cursor).toBe(1);
  });

  it("wraps at both ends so the deck is a loop", () => {
    expect(play(start(), { type: "advance", direction: -1 }).cursor).toBe(3);
    expect(play(start(), { type: "advance", direction: 1 }).cursor).toBe(1);
  });

  it("is a no-op when the queue is empty", () => {
    const state: StudyState = {
      ...start(),
      answers: { a: "got-it", b: "got-it", c: "got-it", d: "got-it" },
    };
    expect(reduceStudy(state, { type: "advance", direction: 1 }, DECK)).toBe(
      state,
    );
  });
});

describe("set-category", () => {
  it("keeps showing the card that was on screen", () => {
    // Narrowing the deck must not teleport the user to the top of it. Hiding
    // the *other* category is the case that can preserve the card; hiding this
    // one's own category is the clamp case below.
    const before = play(start(), { type: "advance", direction: 1 });
    const showing = currentCardId(before, DECK) as string;
    const other = DECK.categoryOf[showing] === "x" ? "y" : "x";
    const after = reduceStudy(
      before,
      { type: "set-category", categoryId: other, enabled: false },
      DECK,
    );
    expect(currentCardId(after, DECK)).toBe(showing);
  });

  it("clamps to the end of the queue when the visible card is hidden", () => {
    const order = viewQueue(start(), DECK);
    const showing = order.at(-1) as string;
    const before: StudyState = { ...start(), cursor: order.length - 1 };
    const after = reduceStudy(
      before,
      {
        type: "set-category",
        categoryId: DECK.categoryOf[showing] as string,
        enabled: false,
      },
      DECK,
    );
    const queue = viewQueue(after, DECK);
    expect(queue).not.toContain(showing);
    // The card is gone, so the cursor lands on the new last card rather than
    // pointing past the end of the shorter queue.
    expect(after.cursor).toBe(queue.length - 1);
  });

  it("returns the same state when the category is already in that mode", () => {
    const before = start();
    expect(
      reduceStudy(
        before,
        { type: "set-category", categoryId: "x", enabled: true },
        DECK,
      ),
    ).toBe(before);

    const hidden = reduceStudy(
      before,
      { type: "set-category", categoryId: "x", enabled: false },
      DECK,
    );
    expect(
      reduceStudy(
        hidden,
        { type: "set-category", categoryId: "x", enabled: false },
        DECK,
      ),
    ).toBe(hidden);
  });
});

describe("categoryCounts", () => {
  it("counts cards and grades per category, ignoring the filter", () => {
    const state = play(
      start(),
      grade("a", "got-it"),
      grade("b", "missed"),
      grade("c", "missed"),
      { type: "set-category", categoryId: "x", enabled: false },
    );
    // Hidden categories still report their progress, so turning one back on
    // shows how far it had got rather than appearing untouched.
    expect(categoryCounts(state, DECK)).toEqual({
      x: { cards: 2, gotIt: 1, missed: 1 },
      y: { cards: 2, gotIt: 0, missed: 1 },
    });
  });

  it("reports zeroed categories for an empty deck", () => {
    expect(categoryCounts(start(), EMPTY)).toEqual({});
  });
});

describe("reset", () => {
  it("clears progress, the category filter, and the cursor", () => {
    const state = play(
      start(),
      grade("a", "got-it"),
      grade("b", "missed"),
      { type: "set-category", categoryId: "x", enabled: false },
      { type: "reset", seed: SEED },
    );
    expect(state).toEqual(initialStudyState(SEED));
    expect(remaining(state)).toEqual(["a", "b", "c", "d"]);
  });

  it("deals a new order by taking a new seed", () => {
    const before = viewQueue(start(), DECK).join(",");
    const after = viewQueue(
      reduceStudy(start(), { type: "reset", seed: SEED + 1 }, DECK),
      DECK,
    ).join(",");
    expect(after).not.toBe(before);
  });
});

describe("show-card", () => {
  it("jumps to a card that is in the current queue", () => {
    const state = play(start(), { type: "show-card", cardId: "c" });
    expect(currentCardId(state, DECK)).toBe("c");
  });

  it("ignores a card that has left the queue", () => {
    // Card "c" is known, so it is no longer in the queue and the reducer
    // returns the same state object rather than moving the cursor.
    const retired: StudyState = { ...start(), answers: { c: "got-it" } };
    expect(reduceStudy(retired, { type: "show-card", cardId: "c" }, DECK)).toBe(
      retired,
    );
  });

  it("ignores a card in a hidden category", () => {
    const hidden = reduceStudy(
      start(),
      { type: "set-category", categoryId: "y", enabled: false },
      DECK,
    );
    // Pick a hidden card that is not already showing, so an unchanged cursor
    // cannot be mistaken for success.
    const showing = currentCardId(hidden, DECK);
    const target = (["c", "d"] as const).find((id) => id !== showing);
    expect(target).toBeDefined();
    expect(
      reduceStudy(
        hidden,
        { type: "show-card", cardId: target as string },
        DECK,
      ),
    ).toBe(hidden);
  });
});

describe("purity", () => {
  it("does not mutate the state it is given", () => {
    const before = start();
    const snapshot = structuredClone(before);
    reduceStudy(before, grade("a", "missed"), DECK);
    expect(before).toEqual(snapshot);
  });

  it("does not mutate the deck it is given", () => {
    const deck: DeckIndex = {
      ids: [...DECK.ids],
      categoryOf: { ...DECK.categoryOf },
    };
    const snapshot = structuredClone(deck);
    reduceStudy(start(), grade("a", "missed"), deck);
    expect(deck).toEqual(snapshot);
  });
});
