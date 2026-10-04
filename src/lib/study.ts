/**
 * Study session state and transitions.
 *
 * Every function here is pure: it takes the deck and returns new state, never
 * mutating its arguments. That keeps the answer/review rules testable without
 * rendering anything, and lets the UI stay a thin wrapper around it.
 */

import { deckOrder } from "./shuffle";

/** How a card was graded while its back was showing. */
export type Answer = "got-it" | "missed";

export function isAnswer(value: unknown): value is Answer {
  return value === "got-it" || value === "missed";
}

/**
 * What the study rules need to know about the deck.
 *
 * Passed in rather than held in state so the generated deck stays the single
 * source of truth and these functions stay trivially testable against a
 * hand-built index. `ids` is deck order; it is shuffled on the way out, so it
 * only has to be stable and complete, not meaningful.
 */
export type DeckIndex = {
  readonly ids: readonly string[];
  /**
   * Category id per card id, used to spread the shuffle and to filter by
   * category. A card with no entry is treated as a category of its own, so a
   * malformed index cannot silently merge unrelated cards together.
   */
  readonly categoryOf: Readonly<Record<string, string>>;
};

export type StudyState = {
  /** Graded cards keyed by card id. Absent means "not studied yet". */
  readonly answers: Readonly<Record<string, Answer>>;
  /** Index into the current view queue. See {@link viewQueue}. */
  readonly cursor: number;
  /**
   * Drives the shuffle. Drawn on load and not persisted, so every page load
   * deals a new order, but the order is fixed for the life of the session --
   * the queue is re-derived from this on every read, so a seed that changed
   * underneath would move the cursor onto a different card.
   */
  readonly seed: number;
  /**
   * Category ids the user has switched off in settings.
   *
   * A deny-list rather than a set of enabled ones on purpose: a category added
   * to `cards.json` after a session started is on by default, and a user who
   * has never opened settings sees the whole deck.
   */
  readonly hidden: readonly string[];
};

export type StudyAction =
  /** Grades the card under the cursor, then moves to the next card. */
  | { type: "answer"; cardId: string; answer: Answer }
  | { type: "advance"; direction: 1 | -1 }
  | { type: "show-card"; cardId: string }
  /** Shows or hides a whole category. Carries the current card across if it survives. */
  | { type: "set-category"; categoryId: string; enabled: boolean }
  /**
   * Clears progress and draws a new seed, so a second pass through the deck is
   * not the same order as the first. The seed comes from the caller so the
   * reducer stays free of randomness.
   */
  | { type: "reset"; seed: number };

export function initialStudyState(seed: number): StudyState {
  return { answers: {}, cursor: 0, seed, hidden: [] };
}

function categoryOf(deck: DeckIndex, cardId: string): string {
  return deck.categoryOf[cardId] ?? cardId;
}

/**
 * Every card the user has not switched off, in study order.
 *
 * This is the deck as far as progress is concerned: the progress bar counts
 * what the user chose to study, not what happens to be in the file.
 */
export function activeDeck(
  state: StudyState,
  deck: DeckIndex,
): readonly string[] {
  const hidden = new Set(state.hidden);
  return deckOrder(deck.ids, (id) => categoryOf(deck, id), state.seed).filter(
    (id) => !hidden.has(categoryOf(deck, id)),
  );
}

/**
 * The cards the session is currently walking, in study order.
 *
 * Cards answered `got it` are excluded: once something is known it should not
 * come back in a later pass, so the queue is everything not yet known. Missed
 * cards stay in, so the deck shrinks as material is learned and the next pass
 * is exactly the material that still needs work.
 */
export function viewQueue(
  state: StudyState,
  deck: DeckIndex,
): readonly string[] {
  return activeDeck(state, deck).filter((id) => state.answers[id] !== "got-it");
}

/** The card under the cursor, or `undefined` when the queue is empty. */
export function currentCardId(
  state: StudyState,
  deck: DeckIndex,
): string | undefined {
  return viewQueue(state, deck)[state.cursor];
}

/** True when every category is switched off, so there is nothing to choose from. */
export function isDeckFilteredOut(state: StudyState, deck: DeckIndex): boolean {
  return deck.ids.length > 0 && activeDeck(state, deck).length === 0;
}

export type Progress = {
  readonly total: number;
  readonly gotIt: number;
  readonly missed: number;
  /** Cards in the deck that have not been graded yet. */
  readonly unvisited: number;
  /** Graded cards as a 0..1 fraction of the deck. */
  readonly ratio: number;
};

export type CategoryCount = {
  /** Cards in the deck belonging to this category. */
  readonly cards: number;
  readonly gotIt: number;
  readonly missed: number;
};

/**
 * Per-category counts across the whole deck, whatever the user has hidden.
 *
 * Deliberately not filtered: a category switched off still shows how far it
 * has got, so turning one back on reveals the progress already made rather
 * than resetting the impression of it.
 */
export function categoryCounts(
  state: StudyState,
  deck: DeckIndex,
): Readonly<Record<string, CategoryCount>> {
  // Accumulated into a mutable draft and handed back as the readonly public
  // shape, so the writes below do not each need a cast.
  type Draft = { -readonly [K in keyof CategoryCount]: number };
  const counts: Record<string, Draft> = {};

  for (const id of deck.ids) {
    const entry = (counts[categoryOf(deck, id)] ??= {
      cards: 0,
      gotIt: 0,
      missed: 0,
    });
    entry.cards += 1;
    const answer = state.answers[id];
    if (answer === "got-it") entry.gotIt += 1;
    else if (answer === "missed") entry.missed += 1;
  }
  return counts;
}

/**
 * Counts across the *active deck* rather than the current view queue, so the
 * numbers describe what has been studied without changing as cards retire. They
 * do follow the category filter, because a category the user switched off is
 * not part of the deck they are working through.
 */
export function progressOf(state: StudyState, deck: DeckIndex): Progress {
  let gotIt = 0;
  let missed = 0;
  const active = activeDeck(state, deck);
  for (const id of active) {
    const answer = state.answers[id];
    if (answer === "got-it") gotIt += 1;
    else if (answer === "missed") missed += 1;
  }
  const total = active.length;
  const graded = gotIt + missed;
  return {
    total,
    gotIt,
    missed,
    unvisited: total - graded,
    ratio: total === 0 ? 0 : graded / total,
  };
}

/**
 * Applies an action to the session.
 *
 * `deck` is the card index and is passed in rather than stored so that the
 * generated deck stays the single source of truth for ordering and the reducer
 * stays trivially testable.
 */
export function reduceStudy(
  state: StudyState,
  action: StudyAction,
  deck: DeckIndex,
): StudyState {
  switch (action.type) {
    case "answer": {
      if (!deck.ids.includes(action.cardId)) return state;
      const answers = { ...state.answers, [action.cardId]: action.answer };
      const next = { ...state, answers };
      const queue = viewQueue(next, deck);
      if (queue.length === 0) return { ...next, cursor: 0 };

      // Grading normally moves on to the following card, wrapping at the end.
      // The exception is grading `got it`, which retires the card from the
      // queue: advancing would then step over the card that took its place.
      // Holding the cursor lands on it instead, and the clamp covers the case
      // where that was the last card in the queue.
      if (!queue.includes(action.cardId)) {
        return { ...next, cursor: Math.min(state.cursor, queue.length - 1) };
      }
      return { ...next, cursor: (state.cursor + 1) % queue.length };
    }

    case "advance": {
      const length = viewQueue(state, deck).length;
      if (length === 0) return state;
      // Wraps in both directions so the deck is a loop rather than a dead end.
      const cursor =
        (((state.cursor + action.direction) % length) + length) % length;
      return { ...state, cursor };
    }

    case "show-card": {
      const index = viewQueue(state, deck).indexOf(action.cardId);
      if (index === -1) return state;
      return { ...state, cursor: index };
    }

    case "set-category": {
      const alreadyHidden = state.hidden.includes(action.categoryId);
      if (action.enabled === !alreadyHidden) return state;

      const hidden = action.enabled
        ? state.hidden.filter((id) => id !== action.categoryId)
        : [...state.hidden, action.categoryId];
      const next = { ...state, hidden };

      // Narrowing the deck can leave the cursor pointing past its end, and
      // simply resetting to zero would teleport the user away from the card
      // they were on. Keeping that card is the least surprising outcome when it
      // survives, and clamping to the end of the queue is the least surprising
      // one when it does not.
      const keep = currentCardId(state, deck);
      if (keep === undefined) return next;

      const queue = viewQueue(next, deck);
      const index = queue.indexOf(keep);
      return {
        ...next,
        cursor: index === -1 ? clampCursor(state.cursor, queue) : index,
      };
    }

    case "reset":
      return initialStudyState(action.seed);
  }
}

function clampCursor(cursor: number, queue: readonly string[]): number {
  return queue.length === 0 ? 0 : Math.min(cursor, queue.length - 1);
}
