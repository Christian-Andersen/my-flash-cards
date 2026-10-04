import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearStudy, loadStudy, saveStudy } from "./storage";
import { initialStudyState, type DeckIndex, type StudyState } from "./study";

const KEY = "flashcards:study:v1";
const SEED = 987_654_321;

const DECK: DeckIndex = {
  ids: ["a", "b", "c"],
  categoryOf: { a: "x", b: "y", c: "y" },
};

/** Minimal in-memory Storage, with hooks for the failure modes we handle. */
class FakeStorage implements Storage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

let storage: FakeStorage;

function setStorage(value: unknown) {
  Object.defineProperty(globalThis, "localStorage", {
    value,
    configurable: true,
    writable: true,
  });
}

const start = () => initialStudyState(SEED);

beforeEach(() => {
  storage = new FakeStorage();
  setStorage(storage);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadStudy", () => {
  it("returns a fresh session when nothing is stored", () => {
    const loaded = loadStudy(DECK);
    expect(loaded.answers).toEqual({});
    expect(loaded.cursor).toBe(0);
    expect(loaded.hidden).toEqual([]);
    // The seed is random, so compare the shape rather than the value.
    expect(Number.isInteger(loaded.seed)).toBe(true);
  });

  it("round-trips a saved session", () => {
    // A deck of its own, because this fixture needs a cursor that is genuinely
    // in range: hiding `y` in DECK leaves only card `a`, which is graded `got it`,
    // so the queue is empty and any cursor is past the end. That is the
    // clamping case below, not the round-trip case, and mixing the two in one
    // fixture is what let it pass unnoticed.
    const deck: DeckIndex = {
      ids: ["a", "b", "c", "d"],
      categoryOf: { a: "x", b: "y", c: "y", d: "y" },
    };
    const state: StudyState = {
      answers: { b: "got-it", c: "missed" },
      cursor: 1,
      seed: SEED,
      hidden: ["x"],
    };
    saveStudy(state);
    const loaded = loadStudy(deck);
    // The seed is the one field that does not come back: it is re-drawn, so
    // every load deals a new order. Everything else is restored verbatim.
    expect(loaded.answers).toEqual(state.answers);
    expect(loaded.cursor).toBe(state.cursor);
    expect(loaded.hidden).toEqual(state.hidden);
  });

  it("leaves the seed out of the stored payload", () => {
    // Asserted on the payload rather than on loadStudy, because this is what
    // makes the shuffle survive a future refactor of the loader: as long as the
    // seed is not written, a reload cannot resume the old order.
    saveStudy({ answers: {}, cursor: 3, seed: 4242, hidden: [] });
    const payload: unknown = JSON.parse(storage.getItem(KEY) as string);
    expect(Object.keys(payload as object).sort()).toEqual([
      "answers",
      "cursor",
      "hidden",
    ]);
  });

  it("does not resume the previous order after a reload", () => {
    // The behaviour the user asked for: a refresh is a new shuffle, not a
    // continuation of the last one. Only the grades carry over.
    const saved: StudyState = {
      answers: { a: "got-it" },
      cursor: 0,
      seed: 4242,
      hidden: [],
    };
    saveStudy(saved);
    // Two loads from the same stored payload, as two page loads would be.
    // Neither gets the seed that was written.
    const first = loadStudy(DECK);
    const second = loadStudy(DECK);
    expect(first.seed).not.toBe(4242);
    expect(second.seed).not.toBe(4242);
    // The grade is what carried over.
    expect(first.answers).toEqual({ a: "got-it" });
    expect(second.answers).toEqual({ a: "got-it" });
  });

  it("falls back to a fresh session on malformed JSON", () => {
    storage.setItem(KEY, "{not json");
    expect(loadStudy(DECK).answers).toEqual({});
  });

  it("falls back when the payload is not an object", () => {
    storage.setItem(KEY, '"a string"');
    expect(loadStudy(DECK).answers).toEqual({});
  });

  it("drops grades for cards that left the deck", () => {
    // A card removed from cards.json must not be replayed on a later visit.
    saveStudy({
      answers: { a: "got-it", gone: "missed" },
      cursor: 0,
      seed: SEED,
      hidden: [],
    });
    expect(loadStudy(DECK).answers).toEqual({ a: "got-it" });
  });

  it("rejects unknown grade values", () => {
    saveStudy({
      answers: { a: "sort-of" as never },
      cursor: 0,
      seed: SEED,
      hidden: [],
    });
    expect(loadStudy(DECK).answers).toEqual({});
  });

  it("rejects a negative, fractional, or runaway cursor", () => {
    for (const cursor of [-1, 1.5, 1e9, "3", null]) {
      saveStudy({
        answers: {},
        cursor: cursor as never,
        seed: SEED,
        hidden: [],
      });
      expect(loadStudy(DECK).cursor).toBe(0);
    }
  });

  it("clamps a cursor that points past the end of the queue", () => {
    // The realistic case: the deck shrank since the payload was written, so a
    // cursor that was in range is now past the end. Reading past the end yields
    // no card, and the app renders that as the empty state -- so an unclamped
    // cursor reports a deck with cards still ungraded as finished.
    storage.setItem(
      KEY,
      JSON.stringify({ answers: {}, cursor: 2, hidden: [] }),
    );

    // Queue is a, b, c. Cursor 2 is the last index, so this one is in range.
    expect(loadStudy(DECK).cursor).toBe(2);

    // One card retired: the queue is b, c and index 2 no longer exists.
    storage.setItem(
      KEY,
      JSON.stringify({ answers: { a: "got-it" }, cursor: 2, hidden: [] }),
    );
    expect(loadStudy(DECK).cursor).toBe(1);
  });

  it("clamps to zero when the restored queue is empty", () => {
    // Everything graded got it, or every category hidden: there is no index to
    // clamp to, so the cursor has to be 0 rather than left dangling.
    storage.setItem(
      KEY,
      JSON.stringify({ answers: {}, cursor: 2, hidden: ["x", "y"] }),
    );
    expect(loadStudy(DECK).cursor).toBe(0);
  });

  it("draws a new shuffle on every load, ignoring any stored seed", () => {
    // The order is deliberately not persisted, so a refresh deals a new one
    // rather than resuming the old sequence. A stale seed left in an older
    // payload must not bring the old order back.
    const seen = new Set<number>();
    for (const seed of [0, 1, 4242, -1, 1.5, "7", null, undefined]) {
      storage.setItem(
        KEY,
        JSON.stringify({ answers: {}, cursor: 0, seed, hidden: [] }),
      );
      const loaded = loadStudy(DECK);
      expect(Number.isInteger(loaded.seed)).toBe(true);
      expect(loaded.seed).toBeGreaterThanOrEqual(0);
      seen.add(loaded.seed);
    }
    // Independent draws, so at least some of the eight differ. A constant
    // fallback would make every load come back in the same order, which is the
    // one thing the shuffle exists to prevent.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("keeps only hidden categories the deck still has", () => {
    // A renamed or deleted category must not leave a hide flag that silently
    // matches nothing and makes the settings list look wrong.
    storage.setItem(
      KEY,
      JSON.stringify({
        answers: {},
        cursor: 0,
        seed: SEED,
        hidden: ["x", "retired-category", 42, null, "y", "y"],
      }),
    );
    // Deduplicated as well as filtered: "y" appears twice in the payload.
    expect(loadStudy(DECK).hidden).toEqual(["x", "y"]);
  });

  it("defaults hidden to empty when the field is not a list", () => {
    storage.setItem(
      KEY,
      JSON.stringify({ answers: {}, cursor: 0, seed: SEED, hidden: "x" }),
    );
    expect(loadStudy(DECK).hidden).toEqual([]);
  });

  it("ignores fields left over from earlier payload shapes", () => {
    // The storage key stayed at v1 through every shape change so far, on the
    // grounds that a session saved before one must still come back. This is
    // the test for that decision: the stale field is dropped, the rest is not.
    storage.setItem(
      KEY,
      JSON.stringify({
        answers: { a: "got-it", b: "missed" },
        cursor: 1,
        onlyMissed: true,
      }),
    );
    const loaded = loadStudy(DECK);
    expect(loaded.answers).toEqual({ a: "got-it", b: "missed" });
    expect(loaded.cursor).toBe(1);
    expect(loaded.hidden).toEqual([]);
  });

  it("survives storage that throws on read", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadStudy(DECK).answers).toEqual({});
  });
});

describe("saveStudy", () => {
  it("gives up quietly when storage is full", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveStudy(start())).not.toThrow();
  });

  it("gives up quietly when localStorage is absent", () => {
    setStorage(undefined);
    expect(() => saveStudy(start())).not.toThrow();
    expect(loadStudy(DECK).answers).toEqual({});
  });
});

describe("clearStudy", () => {
  it("removes the stored session", () => {
    saveStudy({ answers: { a: "missed" }, cursor: 0, seed: SEED, hidden: [] });
    clearStudy();
    expect(loadStudy(DECK).answers).toEqual({});
  });

  it("gives up quietly when removal throws", () => {
    vi.spyOn(storage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearStudy()).not.toThrow();
  });
});
