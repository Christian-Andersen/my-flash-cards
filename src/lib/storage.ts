/**
 * localStorage persistence for a study session.
 *
 * Every read is defensive: the payload is whatever was in the browser's
 * storage, which may be absent, hand-edited, or left over from an older shape
 * of this app. A bad payload degrades to a fresh session rather than throwing,
 * because losing progress is recoverable and a blank screen is not.
 */

import { isSeed, newSeed } from "./shuffle";
import {
  initialStudyState,
  isAnswer,
  type DeckIndex,
  type StudyState,
} from "./study";

/**
 * Bump the suffix when a change makes older payloads unreadable.
 *
 * The version has stayed at v1 through several shape changes -- the missed-only
 * filter came and went, `seed` and `hidden` were added -- because
 * {@link loadStudy} reads each field defensively and defaults whatever is
 * missing or malformed. A v1 payload still restores a full session, and bumping
 * would throw away real progress for nothing. What an older payload does *not*
 * restore is the shuffle order: a session saved before `seed` existed comes
 * back in a new random order, which is a reasonable thing to happen on a first
 * run of the new build.
 */
const STORAGE_KEY = "flashcards:study:v1";

/** Guards against a corrupted payload declaring a runaway cursor. */
const MAX_CURSOR = 100_000;

function storage(): Storage | null {
  try {
    // Access can throw outright when storage is blocked by the browser.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Strings only, deduplicated, and trimmed of categories the deck no longer has. */
function readHidden(value: unknown, deck: DeckIndex): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(Object.values(deck.categoryOf));
  const out: string[] = [];
  for (const entry of value) {
    // Pruning unknown ids keeps a renamed category from silently hiding nothing
    // and confusing the settings list.
    if (typeof entry === "string" && known.has(entry) && !out.includes(entry)) {
      out.push(entry);
    }
  }
  return out;
}

/**
 * Restores the saved session, dropping anything that no longer matches the
 * deck.
 *
 * `deck` is the current deck, so a card deleted from `cards.json` since the last
 * visit is pruned from the saved answers instead of being replayed against a
 * card that no longer exists.
 */
export function loadStudy(deck: DeckIndex): StudyState {
  const store = storage();
  if (!store) return initialStudyState(newSeed());

  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return initialStudyState(newSeed());
  }
  if (!raw) return initialStudyState(newSeed());

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return initialStudyState(newSeed());
  }
  if (!isRecord(parsed)) return initialStudyState(newSeed());

  const answers: Record<string, "got-it" | "missed"> = {};
  if (isRecord(parsed.answers)) {
    for (const id of deck.ids) {
      const value = parsed.answers[id];
      if (isAnswer(value)) answers[id] = value;
    }
  }

  const cursor =
    typeof parsed.cursor === "number" &&
    Number.isInteger(parsed.cursor) &&
    parsed.cursor >= 0 &&
    parsed.cursor < MAX_CURSOR
      ? parsed.cursor
      : 0;

  return {
    answers,
    cursor,
    // A payload from before the shuffle, or a corrupted one, gets a fresh seed
    // rather than a fixed default: a constant seed would make every such
    // session come back in the same order, which is the thing the shuffle
    // exists to prevent.
    seed: isSeed(parsed.seed) ? parsed.seed : newSeed(),
    hidden: readHidden(parsed.hidden, deck),
  };
}

/** Persists the session. Silently gives up if storage is full or blocked. */
export function saveStudy(state: StudyState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private-mode restriction; progress is best-effort.
  }
}

export function clearStudy(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // See saveStudy.
  }
}
