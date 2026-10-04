/**
 * @vitest-environment jsdom
 *
 * The deck's own text, rendered for real.
 *
 * `cards.json` is authored in a Markdown subset and every card is rendered by
 * the same component, so one malformed marker would surface as literal
 * punctuation in an answer rather than as a broken build. This walks the whole
 * generated deck and asserts the property the authoring format cannot check for
 * itself: that what comes out is prose, not markup.
 */
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { hasList, InlineText } from "../components/InlineText";
import { cards } from "../generated/cards";

afterEach(cleanup);

/** Every text block in the deck, paired with the card it came from. */
function textBlocks(): Array<{ readonly card: string; readonly text: string }> {
  return cards.flatMap((card) =>
    card.back
      .filter((block) => block.type === "text")
      .map((block) => ({ card: card.id, text: block.content })),
  );
}

/**
 * Renders a block wrapped in the element FlipCard would choose, and returns the
 * wrapper so the test can inspect it.
 *
 * The same choice FlipCard makes: a list cannot go inside a `<p>`, because the
 * HTML parser closes the paragraph and the DOM stops matching what the renderer
 * produced.
 */
function renderLikeFlipCard(text: string): {
  readonly wrapper: Element;
  readonly unmount: () => void;
} {
  const { container, unmount } = render(<InlineText text={text} />);
  const wrapper = document.createElement(hasList(text) ? "div" : "p");

  // Re-parsed through innerHTML rather than moved node by node, because the HTML
  // parser is what closes a <p> around a nested list. Assembling the tree with
  // DOM calls would produce nesting a browser would never emit, so the
  // paragraph assertion could not fail however wrong the wrapper tag was.
  wrapper.innerHTML = container.innerHTML;
  container.replaceChildren(wrapper);

  return { wrapper: container, unmount };
}

/** A `*`/`**` pair, which is what a leftover emphasis marker looks like. */
const EMPHASIS_PAIR = /\*\*|(^|\s)\*[^*\s][^*\n]*\*/;

/**
 * The rendered text of a block, ignoring anything inside a `<code>`.
 *
 * Code spans legitimately contain asterisks -- `*T` and `[*]T` are Zig pointer
 * types in this deck -- so they are excluded or the check reports prose that is
 * correct. Everything else in a card answer is authored prose, where a `*` pair
 * really is a marker that failed to render.
 */
function proseOf(container: Element): string {
  const clone = container.cloneNode(true) as Element;
  for (const code of clone.querySelectorAll("code")) code.remove();

  return clone.textContent ?? "";
}

describe("the deck's prose", () => {
  it("renders no text block with a leftover emphasis marker", () => {
    const leftovers: string[] = [];

    for (const { card, text } of textBlocks()) {
      const { wrapper, unmount } = renderLikeFlipCard(text);
      const shown = proseOf(wrapper);
      unmount();

      if (EMPHASIS_PAIR.test(shown)) leftovers.push(card);
    }

    expect(leftovers).toEqual([]);
  });

  it("turns every authored list line into a list item", () => {
    const mismatched: string[] = [];

    for (const { card, text } of textBlocks()) {
      const authored = text
        .split("\n")
        .filter((line) => /^\s*[-*]\s|^\s*\d+\.\s/.test(line)).length;
      if (authored === 0) continue;

      const { wrapper, unmount } = renderLikeFlipCard(text);
      const rendered = wrapper.querySelectorAll("li").length;
      unmount();

      if (rendered !== authored) {
        mismatched.push(`${card}: ${rendered} rendered, ${authored} authored`);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it("never puts a list inside a paragraph", () => {
    const offenders: string[] = [];

    // Selected by the authored marker rather than by hasList, so the check
    // still exercises the wrapper choice when hasList itself is what is wrong.
    for (const { card, text } of textBlocks()) {
      if (!/^\s*[-*]\s|^\s*\d+\.\s/m.test(text)) continue;

      const { wrapper, unmount } = renderLikeFlipCard(text);
      const bad = wrapper.querySelectorAll("p ul, p ol").length;
      unmount();

      if (bad > 0) offenders.push(card);
    }

    expect(offenders).toEqual([]);
  });

  it("exercises each markdown construct the deck actually uses", () => {
    // Guards the assertions above: a deck with no markdown would pass them all
    // without proving anything, and a construct nobody authors is not covered
    // by them either.
    //
    // Deliberately only the constructs the deck uses. `InlineText` also renders
    // ordered lists, which this deck has no use for, and `InlineText.test.tsx`
    // covers that directly rather than here.
    const all = textBlocks()
      .map((block) => block.text)
      .join("\n");

    // Each failure names the missing construct, since the message is the only
    // clue about which assertion failed.
    expect(all, "no bold anywhere").toMatch(/\*\*/);
    expect(all, "no italics anywhere").toMatch(/(^|\s)\*[^*\s][^*\n]*\*/);
    expect(all, "no inline code anywhere").toMatch(/`[^`]+`/);
    expect(all, "no bullet list anywhere").toMatch(/^\s*[-*]\s/m);
  });
});
