/**
 * @vitest-environment jsdom
 *
 * The app-level flow test. The reducer and storage units run in plain Node;
 * this one needs real DOM behaviour to assert what the user actually sees.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../app";
// Pulled in so jsdom has the real cascade. Without it the layout assertions
// below would only ever see user-agent defaults.
import "../index.css";
import { allCardIds, cards, categories } from "../lib/deck";

/** The buttons the user clicks, found by their accessible name. */
const showAnswer = () => screen.getByRole("button", { name: /show answer/i });
const backToQuestion = () =>
  screen.getByRole("button", { name: /back to question/i });
const gotIt = () => screen.getByRole("button", { name: /got it/i });
const didntKnow = () => screen.getByRole("button", { name: /didn't know/i });
/** Exact names, because the reset dialog adds a second button matching /reset/. */
const resetControl = () => screen.getByRole("button", { name: "Reset" });
const confirmReset = () =>
  screen.getByRole("button", { name: "Reset everything" });
const settingsToggle = () => screen.getByRole("button", { name: "Settings" });
const backToStudy = () =>
  screen.getByRole("button", { name: /back to study/i });
const categoryToggle = (label: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${label}: `) });

/** Flips the visible card to its answer face. */
function reveal() {
  fireEvent.click(showAnswer());
}

/** Whether the card is currently showing its answer. */
function isFlipped(): boolean {
  return (
    document.querySelector(".flip-inner")?.getAttribute("data-flipped") ===
    "true"
  );
}

/** The question on screen, which identifies a card without depending on DOM shape. */
function visibleQuestion(): string {
  return (
    document.querySelectorAll(".flip-face")[0]?.querySelector("h2")
      ?.textContent ?? ""
  );
}

/**
 * The whole study order, walked from wherever the cursor happens to be.
 *
 * The deck is a loop, so this is a rotation of the same sequence; use
 * {@link rotateTo} to line two walks up before comparing them.
 */
function fullOrder(): string[] {
  const order: string[] = [];
  for (let i = 0; i < allCardIds.length; i++) {
    order.push(visibleQuestion());
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
  }
  return order;
}

/** Reorders a walk so it starts at `first`, making two walks comparable. */
function rotateTo(order: string[], first: string): string[] {
  const at = order.indexOf(first);
  return at === -1 ? order : [...order.slice(at), ...order.slice(0, at)];
}

/** Advances until `found` returns true for the visible card, or the deck runs out. */
function walkUntil(found: () => boolean): boolean {
  for (let i = 0; i < allCardIds.length; i++) {
    if (found()) return true;
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
  }
  return found();
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("deck rendering", () => {
  it("shows a question with a category badge from the deck", () => {
    render(<App />);
    expect(showAnswer()).toBeTruthy();
    expect(visibleQuestion().length).toBeGreaterThan(0);

    // The badge is rendered from the deck's declared categories. Which one is
    // on screen depends on the shuffle, so check it is one of the real ones.
    const labels = categories.map((category) => category.label);
    expect(
      labels.some((label) => document.body.textContent?.includes(label)),
    ).toBe(true);
  });

  it("hides the answer until the card is flipped", () => {
    render(<App />);
    // aria-hidden marks the face that is turned away, so the answer content
    // is present in the DOM but not exposed to assistive technology.
    const sections = document.querySelectorAll("section");
    expect(sections[0]?.getAttribute("aria-hidden")).toBe("false");
    expect(sections[1]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("returns to the question face on request", () => {
    render(<App />);
    reveal();
    const sections = document.querySelectorAll("section");
    expect(sections[1]?.getAttribute("aria-hidden")).toBe("false");

    fireEvent.click(backToQuestion());
    expect(sections[0]?.getAttribute("aria-hidden")).toBe("false");
  });

  it("renders inline code spans from backticks in prose", () => {
    render(<App />);
    // Not every answer uses backticks and the deck is shuffled, so walk until
    // one turns up rather than assuming the first card does. Advancing puts the
    // card back on its question, so each step has to flip it again.
    const found = walkUntil(() => {
      reveal();
      const prose = document.querySelector(".text-pretty");
      return (prose?.querySelectorAll("code").length ?? 0) > 0;
    });
    expect(found).toBe(true);

    const prose = document.querySelector(".text-pretty")!;
    expect(prose.textContent).not.toContain("`");
  });

  it("renders highlighted code on the answer face", () => {
    render(<App />);
    // Only some cards carry a code block, so walk until one turns up.
    // Shiki emits token spans at build time; a plain <pre> would not.
    const found = walkUntil(() => {
      reveal();
      return document.querySelectorAll(".shiki span[style]").length > 0;
    });
    expect(found).toBe(true);
  });

  it("lists the position within the deck", () => {
    render(<App />);
    expect(document.body.textContent).toContain(`1 / ${allCardIds.length}`);
  });
});

describe("grading a card", () => {
  it("withholds the grade buttons until the answer is showing", () => {
    render(<App />);
    // The answer face is aria-hidden while turned away, so its buttons are
    // correctly absent from the accessibility tree.
    expect(() => gotIt()).toThrow();

    reveal();
    expect(gotIt()).toBeTruthy();
    expect(didntKnow()).toBeTruthy();
  });

  it("moves on to the next card after grading", () => {
    render(<App />);
    reveal();
    fireEvent.click(gotIt());

    // The card just answered is now known, so it leaves the deck: the queue
    // shrinks by one and the cursor holds on what is now the first card.
    expect(document.body.textContent).toContain(`1 / ${allCardIds.length - 1}`);
  });

  it("returns the next card to its question face", () => {
    render(<App />);
    reveal();
    fireEvent.click(gotIt());
    // Grading should not leave the following card showing its answer.
    const sections = document.querySelectorAll("section");
    expect(sections[0]?.getAttribute("aria-hidden")).toBe("false");
  });

  it("records the grade in the progress summary", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());
    expect(document.body.textContent).toContain("1 missed");
    expect(document.body.textContent).toContain("0 got it");
  });
});

describe("answered cards do not come back", () => {
  it("removes a card answered got it from the deck", () => {
    render(<App />);
    const before = allCardIds.length;

    reveal();
    fireEvent.click(gotIt());

    expect(document.body.textContent).toContain(`1 / ${before - 1}`);
  });

  it("keeps a card answered missed in the deck", () => {
    render(<App />);
    const before = allCardIds.length;

    reveal();
    fireEvent.click(didntKnow());

    // A missed card is still unknown, so it stays queued for another look.
    expect(document.body.textContent).toContain(`2 / ${before}`);
  });

  it("never shows a card again once it is got it, even by advancing", () => {
    render(<App />);
    // The deck is shuffled, so the card to retire has to be read off the screen
    // rather than assumed to be the first one in cards.json.
    const retired = visibleQuestion();
    expect(retired.length).toBeGreaterThan(0);

    reveal();
    fireEvent.click(gotIt());

    // Walk the whole remaining deck and confirm the retired card is gone.
    for (let i = 0; i < allCardIds.length; i++) {
      expect(visibleQuestion()).not.toBe(retired);
      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    }
  });

  it("shows a deck-complete state once every card is known", () => {
    render(<App />);
    const total = allCardIds.length;

    for (let i = 0; i < total; i++) {
      reveal();
      fireEvent.click(gotIt());
    }

    expect(document.body.textContent).toContain("Deck complete");
  });

  it("brings a retired card back on reset", () => {
    render(<App />);
    reveal();
    fireEvent.click(gotIt());
    expect(document.body.textContent).toContain(`1 / ${allCardIds.length - 1}`);

    fireEvent.click(resetControl());
    fireEvent.click(confirmReset());
    expect(document.body.textContent).toContain(`1 / ${allCardIds.length}`);
  });
});

describe("the deck is shuffled", () => {
  it("opens on a different card for each new session", () => {
    // cards.json is grouped by category, so unshuffled it would open on the
    // same card every time. Twenty fresh sessions over 57 cards: the expected
    // distinct count is around 17, so a low bar still catches a deck that
    // failed to shuffle at all.
    const firsts = new Set<string>();
    for (let i = 0; i < 20; i++) {
      localStorage.clear();
      const view = render(<App />);
      firsts.add(visibleQuestion());
      view.unmount();
      cleanup();
    }
    expect(firsts.size).toBeGreaterThan(8);
  });

  it("keeps the same order after a reload", () => {
    // The seed is persisted precisely so a reload does not reshuffle under a
    // cursor that points at a card index.
    const first = render(<App />);
    const before = fullOrder();
    first.unmount();

    render(<App />);
    // The cursor is restored too, so the second walk starts elsewhere in the
    // loop; rotating it onto the same card compares order, not position.
    expect(rotateTo(fullOrder(), before[0] as string)).toEqual(before);
  });

  it("reshuffles on reset", () => {
    const first = render(<App />);
    const before = fullOrder();
    first.unmount();
    render(<App />);
    // Same session, so reloading must not change the order...
    expect(rotateTo(fullOrder(), before[0] as string)).toEqual(before);

    fireEvent.click(resetControl());
    fireEvent.click(confirmReset());
    // ...but a reset draws a new seed, so it does.
    expect(fullOrder()).not.toEqual(before);
  });

  it("does not put two cards from the same category back to back", () => {
    // The point of the spread pass: a shuffled deck that still dealt whole
    // subjects in a row would be no better than deck order.
    render(<App />);

    let runs = 0;
    let previous: string | undefined;
    for (let i = 0; i < 40; i++) {
      const label = document
        .querySelector(".flip-face span.rounded-full")
        ?.textContent?.trim();
      if (label === previous) runs += 1;
      previous = label;
      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    }
    expect(categories.length).toBeGreaterThan(1);
    expect(runs).toBeLessThanOrEqual(5);
  });
});

describe("reset needs confirming", () => {
  it("opens a dialog rather than clearing immediately", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());
    expect(document.body.textContent).toContain("1 missed");

    fireEvent.click(resetControl());
    expect(
      screen.getByRole("dialog", { name: /reset progress/i }),
    ).toBeTruthy();
    // Still there: nothing has been thrown away yet.
    expect(document.body.textContent).toContain("1 missed");
  });

  it("clears progress once confirmed", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());

    fireEvent.click(resetControl());
    fireEvent.click(confirmReset());

    expect(document.body.textContent).toContain("0 missed");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps progress when cancelled", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());

    fireEvent.click(resetControl());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.textContent).toContain("1 missed");
  });

  it("closes on Escape without clearing", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());

    fireEvent.click(resetControl());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.textContent).toContain("1 missed");
  });

  it("puts focus on the confirm button, and back on Reset afterwards", () => {
    render(<App />);
    resetControl().focus();
    fireEvent.click(resetControl());
    expect(document.activeElement).toBe(confirmReset());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(resetControl());
  });

  it("traps Tab inside the dialog", () => {
    render(<App />);
    fireEvent.click(resetControl());
    const dialog = screen.getByRole("dialog");
    const cancel = screen.getByRole("button", { name: "Cancel" });

    // Tab from the last control wraps to the first rather than escaping to the
    // page behind, which is still in the DOM.
    confirmReset().focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);

    // And backwards from the first control wraps to the last.
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirmReset());
  });
});

describe("settings", () => {
  it("is reached from the header and returns to the study view", () => {
    render(<App />);
    fireEvent.click(settingsToggle());
    expect(
      screen.getByRole("heading", { name: /question types/i }),
    ).toBeTruthy();
    expect(() => showAnswer()).toThrow();

    fireEvent.click(screen.getByRole("button", { name: /back to study/i }));
    expect(showAnswer()).toBeTruthy();
  });

  it("lists a checkbox for every category, all on by default", () => {
    render(<App />);
    fireEvent.click(settingsToggle());
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(categories.length);
    for (const box of boxes) {
      expect((box as HTMLInputElement).checked).toBe(true);
    }
  });

  it("takes a category out of the deck when switched off", () => {
    render(<App />);
    const before = allCardIds.length;

    fireEvent.click(settingsToggle());
    fireEvent.click(categoryToggle("Nix"));
    fireEvent.click(screen.getByRole("button", { name: /back to study/i }));

    const nixCards = 2;
    expect(document.body.textContent).toContain(`1 / ${before - nixCards}`);
  });

  it("keeps progress on a category that is switched off and back on", () => {
    render(<App />);
    const question = visibleQuestion();
    const label = document
      .querySelector(".flip-face span.rounded-full")
      ?.textContent?.trim() as string;
    const inCategory = cards.filter(
      (card) => categories.find((c) => c.label === label)?.id === card.category,
    ).length;

    reveal();
    fireEvent.click(didntKnow());

    // Switching the graded card's own category off takes it out of the deck
    // and out of the progress count with everything else in that category.
    fireEvent.click(settingsToggle());
    fireEvent.click(categoryToggle(label));
    fireEvent.click(screen.getByRole("button", { name: /back to study/i }));
    expect(document.body.textContent).toContain("0 missed");
    expect(document.body.textContent).toContain(
      ` / ${allCardIds.length - inCategory}`,
    );

    // Turning it back on restores the grade rather than a fresh card. Progress
    // is counted over the active deck, so a restored grade is proof that the
    // card is back in it; the cursor is not restored, so look for the card
    // somewhere in the deck rather than expecting it to be the one on screen.
    fireEvent.click(settingsToggle());
    fireEvent.click(categoryToggle(label));
    fireEvent.click(backToStudy());
    expect(document.body.textContent).toContain("1 missed");
    expect(fullOrder()).toContain(question);
  });

  it("explains itself when every category is off", () => {
    render(<App />);
    fireEvent.click(settingsToggle());
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    fireEvent.click(screen.getByRole("button", { name: /back to study/i }));

    expect(document.body.textContent).toContain("Nothing selected");
    expect(() => showAnswer()).toThrow();
  });

  it("restores the whole deck with Select all", () => {
    render(<App />);
    fireEvent.click(settingsToggle());
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    fireEvent.click(backToStudy());

    expect(showAnswer()).toBeTruthy();
    expect(document.body.textContent).toContain(` / ${allCardIds.length}`);
  });

  it("disables Select all when everything is already on", () => {
    render(<App />);
    fireEvent.click(settingsToggle());
    const selectAll = screen.getByRole("button", { name: /select all/i });
    expect(selectAll.hasAttribute("disabled")).toBe(true);
  });

  it("remembers the selection across a reload", () => {
    const first = render(<App />);
    fireEvent.click(settingsToggle());
    fireEvent.click(categoryToggle("Testing"));
    first.unmount();

    render(<App />);
    fireEvent.click(settingsToggle());
    expect((categoryToggle("Testing") as HTMLInputElement).checked).toBe(false);
  });

  it("keeps the card on screen when a category is switched off", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    const showing = visibleQuestion();
    const label = document
      .querySelector(".flip-face span.rounded-full")
      ?.textContent?.trim() as string;

    fireEvent.click(settingsToggle());
    // Switch off a category the visible card is not in, so it can be preserved.
    fireEvent.click(categoryToggle(label === "Nix" ? "Git" : "Nix"));
    fireEvent.click(backToStudy());

    // Narrowing the deck must not teleport the user to a different card. The
    // position number does move, because the queue is shorter.
    expect(visibleQuestion()).toBe(showing);
  });

  it("documents the keyboard shortcuts", () => {
    render(<App />);
    fireEvent.click(settingsToggle());
    const text = document.body.textContent ?? "";
    for (const action of [
      "flip the card",
      "got it",
      "didn't know",
      "previous card",
      "next card",
    ]) {
      expect(text).toContain(action);
    }
  });

  it("has no help text left under the heading", () => {
    render(<App />);
    const header = document.querySelector("header");
    // The heading and the settings toggle only; the shortcut prose that used
    // to sit here now lives in settings.
    expect(header?.querySelectorAll("p")).toHaveLength(0);
    expect(header?.textContent).toBe("FlashcardsSettings");
  });

  it("does not navigate the deck with the arrows while in settings", () => {
    render(<App />);
    const before = visibleQuestion();
    fireEvent.click(settingsToggle());
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.click(backToStudy());
    expect(visibleQuestion()).toBe(before);
  });
});

/**
 * The declarations the compiled stylesheet applies to `selector`.
 *
 * jsdom has no layout engine and does not resolve `display` or `position` out
 * of a stylesheet, so `getComputedStyle` can only ever report user-agent
 * defaults here. Reading the cascade text is the only way to assert what
 * actually ships.
 */
function declarationsFor(selector: string): string {
  const css = [...document.querySelectorAll("style")]
    .map((tag) => tag.textContent ?? "")
    .join("\n");

  const rule = new RegExp(`(^|[};])\\s*${selector}\\s*\\{([^}]*)\\}`, "m").exec(
    css,
  );
  if (rule === null) {
    throw new Error(`no rule found for ${selector} in the compiled CSS`);
  }
  return (rule[2] ?? "").replace(/\s+/g, " ").trim();
}

describe("card layout", () => {
  // Regression guard. The faces used to be `position: absolute; inset: 0`
  // inside a `h-full` wrapper, which gave the wrapper no intrinsic height: it
  // collapsed to zero, both faces spilled out on top of each other, and the
  // hidden one showed through mirrored. Stacking them as grid items in a single
  // cell sizes the card to the taller face instead.
  it("stacks both faces in one grid cell rather than absolutely positioning them", () => {
    render(<App />);

    expect(declarationsFor(".flip-inner")).toContain("display: grid");
    expect(declarationsFor(".flip-face")).toContain("grid-area: 1 / 1");
    expect(declarationsFor(".flip-face")).toContain("position: relative");
    expect(declarationsFor(".flip-face")).not.toContain("position: absolute");
  });

  it("hides the face pointing away from the viewer", () => {
    render(<App />);

    // Without this the front face is visible through the back once rotated.
    expect(declarationsFor(".flip-face")).toContain(
      "backface-visibility: hidden",
    );
    expect(declarationsFor(".flip-back")).toContain("rotateY(180deg)");
  });

  it("renders exactly two faces per card", () => {
    render(<App />);
    expect(document.querySelectorAll(".flip-inner > .flip-face")).toHaveLength(
      2,
    );
  });
});

describe("the deck is what is not yet known", () => {
  it("offers no filter, only navigation and reset", () => {
    render(<App />);
    // The missed-only switch was removed as redundant: grading `got it`
    // already retires the card, so the queue is the unstudied-and-missed set.
    expect(screen.queryByRole("switch", { name: /review missed/i })).toBeNull();
    expect(document.body.textContent).not.toContain("Review missed");
    expect(screen.getByRole("button", { name: "Prev" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Next" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDefined();
  });

  it("leaves missed cards in the queue and counts them", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());
    reveal();
    fireEvent.click(didntKnow());

    // Nothing retired, so the deck is untouched and the counter still reports.
    expect(document.body.textContent).toContain("2 missed");
    expect(document.body.textContent).toContain(`3 / ${allCardIds.length}`);
  });
});

describe("persistence", () => {
  it("restores grades after a remount", () => {
    const first = render(<App />);
    reveal();
    fireEvent.click(didntKnow());
    reveal();
    fireEvent.click(gotIt());
    const { unmount } = first;

    unmount();
    render(<App />);

    // One card retired, one missed, both remembered.
    expect(document.body.textContent).toContain("1 missed");
    expect(document.body.textContent).toContain("1 got it");
    expect(document.body.textContent).toContain(`2 / ${allCardIds.length - 1}`);
  });

  it("clears stored progress on reset", () => {
    render(<App />);
    reveal();
    fireEvent.click(didntKnow());
    expect(document.body.textContent).toContain("1 missed");

    fireEvent.click(resetControl());
    fireEvent.click(confirmReset());
    expect(document.body.textContent).toContain("0 missed");
  });
});

describe("keyboard shortcuts", () => {
  it("flips the card on Space while the question is showing", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: " " });
    const sections = document.querySelectorAll("section");
    expect(sections[1]?.getAttribute("aria-hidden")).toBe("false");
  });

  it("grades with 1 and 2 once the answer is showing", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "2" });
    expect(document.body.textContent).toContain("1 missed");
  });

  it("ignores the grade keys while the question is showing", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "2" });
    expect(document.body.textContent).toContain("0 missed");
  });

  it("flips back on Space while the answer is showing", () => {
    // Regression guard. Space used to be a silent no-op once the answer was up,
    // so it only ever worked one way and read as a dead key.
    render(<App />);
    fireEvent.keyDown(window, { key: " " });
    expect(isFlipped()).toBe(true);

    fireEvent.keyDown(window, { key: " " });
    expect(isFlipped()).toBe(false);
  });

  it("leaves Space to a focused control instead of flipping", () => {
    // Space on a button is that button's action. Flipping as well would run
    // two actions for one press. jsdom does not implement the browser's
    // key-to-click default action, so only the half this app controls is
    // asserted here; the button really does activate in a browser.
    render(<App />);
    const button = showAnswer();
    button.focus();

    fireEvent.keyDown(button, { key: " " });
    expect(isFlipped()).toBe(false);
  });

  it("ignores Space when a modifier is held", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: " ", ctrlKey: true });
    expect(isFlipped()).toBe(false);
  });

  it("ignores shortcuts while a text field has focus", () => {
    render(<App />);
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(input, { key: " " });
    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(isFlipped()).toBe(false);
    expect(document.body.textContent).toContain(`1 / ${allCardIds.length}`);
    input.remove();
  });
});

describe("arrow key navigation", () => {
  const position = () =>
    document.body.textContent?.match(/(\d+)\s*\/\s*(\d+)/)?.[0] ?? null;

  it("goes to the next card on ArrowRight", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(position()).toBe(`2 / ${allCardIds.length}`);
  });

  it("goes back on ArrowLeft", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(position()).toBe(`2 / ${allCardIds.length}`);
  });

  it("hides the answer when an arrow key changes card", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: " " });
    expect(isFlipped()).toBe(true);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(isFlipped()).toBe(false);
  });

  it("leaves the arrows to a focused control", () => {
    // A focused control may give the arrows its own meaning, so the shortcut
    // stands down rather than navigating underneath it.
    render(<App />);
    const next = screen.getByRole("button", { name: "Next" });
    next.focus();

    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(position()).toBe(`1 / ${allCardIds.length}`);
  });

  it("ignores the arrows when a modifier is held", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "ArrowRight", metaKey: true });
    expect(position()).toBe(`1 / ${allCardIds.length}`);
  });
});

describe("the hidden card face is out of reach", () => {
  it("marks the face that is not showing as inert", () => {
    render(<App />);
    const [question, answer] = document.querySelectorAll(
      ".flip-inner > .flip-face",
    );

    expect(question?.hasAttribute("inert")).toBe(false);
    expect(answer?.hasAttribute("inert")).toBe(true);

    fireEvent.keyDown(window, { key: " " });
    expect(question?.hasAttribute("inert")).toBe(true);
    expect(answer?.hasAttribute("inert")).toBe(false);
  });
});
