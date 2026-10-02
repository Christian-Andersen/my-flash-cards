/**
 * Runtime lookup helpers over the generated deck.
 *
 * The deck itself is generated at build time by `scripts/build-cards.ts` and
 * imported statically, so the app ships with no data fetch and no loading
 * state. These helpers only index it.
 */

import { cards, categories } from "../generated/cards";
import type { DeckIndex } from "./study";
import type { Card, Category } from "./types";

const cardsById: ReadonlyMap<string, Card> = new Map(
  cards.map((card) => [card.id, card]),
);

const categoriesById: ReadonlyMap<string, Category> = new Map(
  categories.map((category) => [category.id, category]),
);

/** Deck order. The study reducer treats this as the source of truth. */
export const allCardIds: readonly string[] = cards.map((card) => card.id);

/** The card-to-category lookup the study rules need, built once at import. */
const categoryOf: Readonly<Record<string, string>> = Object.fromEntries(
  cards.map((card) => [card.id, card.category]),
);

/** Everything the study rules need to know about the deck. */
export const deck: DeckIndex = { ids: allCardIds, categoryOf };

export function getCard(id: string): Card | undefined {
  return cardsById.get(id);
}

/** Cards whose category id has no matching category are a build error. */
export function getCategory(id: string): Category | undefined {
  return categoriesById.get(id);
}

export { cards, categories };
