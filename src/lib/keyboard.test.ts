/**
 * @vitest-environment jsdom
 *
 * The guards are pure functions over an event target, but the fixtures are
 * built from real markup so the `closest` selectors are exercised as written.
 */
import { describe, expect, it } from "vitest";

import { hasModifier, isActivatableTarget, isTypingTarget } from "./keyboard";

/**
 * Parses `html` and returns the element matching `selector` inside it.
 *
 * The selector is explicit because a control is often not the outermost node
 * of its own markup: the event target for `<details><summary>` is the
 * `summary`, not the `details` around it.
 */
function pick(html: string, selector: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  const found = host.querySelector(selector);
  if (found === null) throw new Error(`no ${selector} parsed from ${html}`);
  return found;
}

describe("isTypingTarget", () => {
  it("is true for the controls that consume keystrokes as content", () => {
    const cases = [
      ["<input>", "input"],
      ["<textarea></textarea>", "textarea"],
      ["<select></select>", "select"],
      ['<div contenteditable="true"></div>', "div"],
    ] as const;

    for (const [html, selector] of cases) {
      expect(isTypingTarget(pick(html, selector))).toBe(true);
    }
  });

  it("is true for a control nested inside a text-entry element", () => {
    expect(
      isTypingTarget(pick("<div contenteditable><span>x</span></div>", "span")),
    ).toBe(true);
  });

  it("is false for a button, which activates rather than accepting text", () => {
    expect(isTypingTarget(pick("<button>Go</button>", "button"))).toBe(false);
  });

  it("is false for an element that is not an Element at all", () => {
    // A keydown dispatched on `window` targets the window object, which has no
    // `closest` method. This is the guard that keeps that from throwing.
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("isActivatableTarget", () => {
  it("is true for controls that run their own action on Space", () => {
    const cases = [
      ["<button>Go</button>", "button"],
      ['<a href="#x">Link</a>', "a"],
      ["<details><summary>More</summary></details>", "summary"],
      ['<div role="button"></div>', '[role="button"]'],
      ['<div role="switch"></div>', '[role="switch"]'],
      ['<div role="checkbox"></div>', '[role="checkbox"]'],
    ] as const;

    for (const [html, selector] of cases) {
      expect(isActivatableTarget(pick(html, selector))).toBe(true);
    }
  });

  it("is true for an activatable control nested inside a wrapper", () => {
    expect(
      isActivatableTarget(
        pick('<div class="row"><button>Go</button></div>', "button"),
      ),
    ).toBe(true);
  });

  it("is false for a plain element, so the shortcut still fires", () => {
    expect(isActivatableTarget(pick("<p>text</p>", "p"))).toBe(false);
  });

  it("is false for an element that is not an Element at all", () => {
    expect(isActivatableTarget(window)).toBe(false);
    expect(isActivatableTarget(null)).toBe(false);
  });
});

describe("hasModifier", () => {
  const event = (init: Partial<KeyboardEvent>) =>
    new KeyboardEvent("keydown", init);

  it("is true when a modifier would mean the key belongs to the browser", () => {
    expect(hasModifier(event({ metaKey: true }))).toBe(true);
    expect(hasModifier(event({ ctrlKey: true }))).toBe(true);
    expect(hasModifier(event({ altKey: true }))).toBe(true);
  });

  it("is false for a bare keypress", () => {
    expect(hasModifier(event({}))).toBe(false);
    // Shift is not one: it produces characters, and nothing here binds Shift.
    expect(hasModifier(event({ shiftKey: true }))).toBe(false);
  });
});
