/**
 * @vitest-environment jsdom
 *
 * InlineText turns the Markdown subset used in `cards.json` into real elements.
 * These assert on the rendered element, not on the text content alone, because
 * the whole point of the component is which wrapper a span gets: a reader needs
 * `<strong>` and `<li>`, and a `<code>` that is not a `<code>` is invisible to
 * every consumer except a visual one.
 */
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { hasList, InlineText } from "./InlineText";

afterEach(cleanup);

/**
 * Renders a block and returns the wrapper Preact rendered into.
 *
 * The wrapper rather than its first child, because the component emits sibling
 * elements (a paragraph and a list) directly, so the first child is only part
 * of the output.
 */
function renderBlock(text: string): Element {
  const { container } = render(<InlineText text={text} />);
  return container;
}

describe("InlineText emphasis", () => {
  it("renders **bold** as a strong element", () => {
    const host = renderBlock("**Overlapping subproblems** is the signal.");
    const strong = host.querySelector("strong");

    expect(strong?.textContent).toBe("Overlapping subproblems");
  });

  it("renders *italic* as an em element", () => {
    const host = renderBlock("Useful for *rejecting* algorithms.");

    expect(host.querySelector("em")?.textContent).toBe("rejecting");
  });

  it("renders `code` as a code element and drops the backticks", () => {
    const host = renderBlock("Use `satisfies` to keep the shape.");

    expect(host.querySelector("code")?.textContent).toBe("satisfies");
  });

  it("leaves no emphasis or code markers in the rendered text", () => {
    const host = renderBlock("**bold**, *italic*, and `code` in one line.");
    const text = host.textContent ?? "";

    expect(text).not.toMatch(/[*`]/);
  });

  it("does not nest emphasis across markers", () => {
    // `**` has to close before `*` opens, so the bold run ends at the first
    // `**` rather than swallowing the italic pair.
    const host = renderBlock("**bold** and *italic*");
    const strong = host.querySelector("strong");
    const em = host.querySelector("em");

    expect(strong?.textContent).toBe("bold");
    expect(em?.textContent).toBe("italic");
  });

  it("leaves an unclosed marker as literal text rather than deleting the rest", () => {
    const host = renderBlock("2 * 3 is not markup");
    const text = host.textContent ?? "";

    expect(text).toContain("2 * 3 is not markup");
    expect(host.querySelector("em")).toBeNull();
  });

  it("treats a bare asterisk mid-word as literal text", () => {
    const host = renderBlock("the *args glob");

    expect(host.querySelector("em")).toBeNull();
  });

  it("keeps asterisks that live inside a code span", () => {
    // Zig pointer types, which this deck uses: `*T` is a single pointer and
    // `[*]T` is a pointer of unknown length. Neither is emphasis.
    const host = renderBlock("Pointers: `*T` and `[*]T` are both pointers.");
    const codes = [...host.querySelectorAll("code")].map((c) => c.textContent);

    expect(codes).toEqual(["*T", "[*]T"]);
    expect(host.querySelector("em")).toBeNull();
  });
});

describe("InlineText lists", () => {
  it("renders consecutive - lines as one bullet list", () => {
    const host = renderBlock("- first item\n- second item\n- third item");
    const items = host.querySelectorAll("li");

    expect(items.length).toBe(3);
    expect(host.querySelector("ul")).not.toBeNull();
    expect(host.querySelector("ol")).toBeNull();
    expect([...items].map((li) => li.textContent)).toEqual([
      "first item",
      "second item",
      "third item",
    ]);
  });

  it("renders consecutive 1. lines as one ordered list", () => {
    const host = renderBlock("1. profile the data\n2. clean it\n3. validate");
    const items = host.querySelectorAll("li");

    expect(items.length).toBe(3);
    expect(host.querySelector("ol")).not.toBeNull();
  });

  it("resolves inline formatting inside a list item", () => {
    const host = renderBlock("- `COUNT(*)` counts rows\n- **bold** item");
    const items = host.querySelectorAll("li");

    expect(items[0]?.querySelector("code")?.textContent).toBe("COUNT(*)");
    expect(items[1]?.querySelector("strong")?.textContent).toBe("bold");
  });

  it("keeps a hyphen that is not at the start of a line as literal text", () => {
    const host = renderBlock("call-by-name - not call-by-need");
    const text = host.textContent ?? "";

    expect(host.querySelector("li")).toBeNull();
    expect(text).toContain("call-by-name - not call-by-need");
  });

  it("keeps prose and a list as siblings rather than absorbing the prose", () => {
    const host = renderBlock("The fix:\n- seed the RNG\n- isolate fixtures");
    const items = host.querySelectorAll("li");

    expect(items.length).toBe(2);
    expect(host.textContent).toContain("The fix:");
  });

  it("starts a second list after prose separating two lists", () => {
    const host = renderBlock("- one\n- two\nAnd then:\n- three");
    const lists = host.querySelectorAll("ul");

    expect(lists.length).toBe(2);
  });
});

describe("hasList", () => {
  it("is true for a block that opens a bullet", () => {
    expect(hasList("- an item")).toBe(true);
  });

  it("is true for a block that opens a numbered item", () => {
    expect(hasList("1. an item")).toBe(true);
  });

  it("is false for prose with no marker at the start of a line", () => {
    expect(
      hasList("A plain sentence, with a - hyphen and a 1. reference."),
    ).toBe(false);
  });

  it("is false for prose with emphasis markers only", () => {
    expect(hasList("**bold** and *italic*")).toBe(false);
  });
});
