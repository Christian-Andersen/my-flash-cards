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
    const state: StudyState = {
      answers: { a: "got-it", b: "missed" },
      cursor: 1,
      seed: SEED,
      hidden: ["y"],
    };
    saveStudy(state);
    expect(loadStudy(DECK)).toEqual(state);
  });

  it("restores the same shuffle order after a reload", () => {
    // The seed is what makes the queue stable across visits; without it the
    // cursor would point at a different card every time.
    saveStudy({ answers: {}, cursor: 2, seed: 4242, hidden: [] });
    expect(loadStudy(DECK).seed).toBe(4242);
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

  it("draws a fresh seed when the stored one is unusable", () => {
    // A constant fallback would make every such session come back in the same
    // order, which is the one thing the shuffle exists to prevent.
    for (const seed of [-1, 1.5, NaN, "7", null, undefined]) {
      storage.setItem(
        KEY,
        JSON.stringify({ answers: {}, cursor: 0, seed, hidden: [] }),
      );
      const loaded = loadStudy(DECK);
      expect(Number.isInteger(loaded.seed)).toBe(true);
      expect(loaded.seed).toBeGreaterThanOrEqual(0);
    }
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
