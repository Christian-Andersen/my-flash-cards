/**
 * Shape of the card data and the module the build script generates from
 * `cards.json`. See `scripts/build-cards.ts` for the validation rules that
 * produce a value assignable to {@link Card}.
 */

/** Accent tokens a category may use. Kept in sync with `ACCENT_STYLES`. */
export type AccentName =
  "amber" | "emerald" | "rose" | "sky" | "teal" | "violet";

export type Category = {
  /** Stable slug, referenced by {@link Card.category}. Unique within a deck. */
  readonly id: string;
  /** Human-readable name shown in the category badge. */
  readonly label: string;
  readonly accent: AccentName;
};

export type TextBlock = {
  readonly type: "text";
  readonly content: string;
};

export type CodeBlock = {
  readonly type: "code";
  /** Shiki language id, e.g. `ts`, `python`, `rust`. */
  readonly language: string;
  /** Unhighlighted source. Kept for the copy-to-clipboard button. */
  readonly code: string;
  /**
   * Shiki-rendered HTML, produced at build time.
   *
   * Trusted markup, not user input: it is generated from this repo's own
   * `cards.json` and injected without sanitising. If the deck ever becomes
   * user-editable at runtime, this field must be sanitised before it reaches
   * `dangerouslySetInnerHTML`.
   */
  readonly html: string;
  readonly caption?: string;
};

export type Block = TextBlock | CodeBlock;

export type Card = {
  /** Stable id. Used as the persistence key, so renaming a card resets it. */
  readonly id: string;
  /** Id of a {@link Category} declared in the same deck. */
  readonly category: string;
  /** The prompt, shown before the card is flipped. Plain text. */
  readonly front: string;
  /** The answer, revealed after flipping. Rendered as an ordered list of blocks. */
  readonly back: readonly Block[];
};

export type Deck = {
  readonly categories: readonly Category[];
  readonly cards: readonly Card[];
};

/** Narrowing helper: is this block a code snippet? */
export function isCodeBlock(block: Block): block is CodeBlock {
  return block.type === "code";
}
