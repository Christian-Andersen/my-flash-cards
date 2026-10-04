/**
 * localStorage persistence for a study session.
 *
 * Every read is defensive: the payload is whatever was in the browser's
 * storage, which may be absent, hand-edited, or left over from an older shape
 * of this app. A bad payload degrades to a fresh session rather than throwing,
 * because losing progress is recoverable and a blank screen is not.
 */

import { newSeed } from "./shuffle";
import {
  initialStudyState,
  isAnswer,
  viewQueue,
  type Answer,
  type DeckIndex,
  type StudyState,
} from "./study";

/**
 * Bump the suffix when a change makes older payloads unreadable.
 *
 * The version has stayed at v1 through several shape changes -- the missed-only
 * filter came and went, `seed` and `hidden` were added, `seed` was dropped
 * again -- because {@link loadStudy} reads each field defensively and defaults
 * whatever is missing or malformed. A v1 payload still restores a full session,
 * and bumping would throw away real progress for nothing.
 *
 * Dropping `seed` was the one change that a stored payload could notice, and it
 * needed no version bump: a stale seed in storage is simply ignored, and the
 * order is re-drawn.
 */
const STORAGE_KEY = "flashcards:study:v1";

/**
 * A sanity ceiling on a declared cursor, ahead of the clamp to the real queue
 * length in {@link loadStudy}.
 *
 * Cheap insurance against a payload carrying a cursor large enough to be worth
 * rejecting on sight, so the arithmetic in the clamp is never handed a value
 * from untrusted input.
 */
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  // Built with fromEntries rather than by assigning keys as the loop goes.
  // `answers["__proto__"] = value` on a plain object literal invokes the
  // inherited setter, so the write is silently discarded and no own key
  // appears; fromEntries defines a real own property for every entry. Card ids
  // are author-supplied and the build only requires them to be non-empty
  // strings, so `__proto__` is a legal id that would lose its grade on every
  // reload. Reduce the code below never hits this, because a computed key in an
  // object literal creates an own property.
  const restored: Array<readonly [string, Answer]> = [];
  if (isRecord(parsed.answers)) {
    for (const id of deck.ids) {
      const value = parsed.answers[id];
      if (isAnswer(value)) restored.push([id, value]);
    }
  }
  const answers = Object.fromEntries(restored);

  const stored =
    typeof parsed.cursor === "number" &&
    Number.isInteger(parsed.cursor) &&
    parsed.cursor >= 0 &&
    parsed.cursor < MAX_CURSOR
      ? parsed.cursor
      : 0;

  const state: StudyState = {
    answers,
    cursor: stored,
    // Always a fresh seed: the shuffle is re-drawn on every load, so a reload
    // starts a new order rather than resuming the old one. A payload that used
    // to carry a seed is simply no longer read.
    seed: newSeed(),
    hidden: readHidden(parsed.hidden, deck),
  };

  // Clamp to the queue, not just to MAX_CURSOR. A cursor can be in range and
  // still point past the end: the deck shrank since the payload was written
  // (a card was deleted or merged out of it), or cards the payload had graded
  // `got it` now retire, or a category it saved as hidden no longer exists.
  // Reading past the end yields no card, which the app renders as the empty
  // state -- so a session with 160 cards still ungraded would claim the deck is
  // finished. MAX_CURSOR alone cannot catch this, because a deck of any
  // plausible size is far below it.
  const length = viewQueue(state, deck).length;
  return length === 0
    ? { ...state, cursor: 0 }
    : { ...state, cursor: Math.min(stored, length - 1) };
}

/**
 * Persists the session. Silently gives up if storage is full or blocked.
 *
 * The seed is deliberately left out. The order is derived from it, so storing
 * it is what made a reload resume the same sequence; without it every load
 * deals a new one. The grades, the cursor and the category choices are the
 * part worth keeping, and the cursor still means something because the queue
 * it indexes no longer contains the cards already got it.
 */
export function saveStudy(state: StudyState): void {
  const store = storage();
  if (!store) return;
  try {
    const { answers, cursor, hidden } = state;
    store.setItem(STORAGE_KEY, JSON.stringify({ answers, cursor, hidden }));
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
