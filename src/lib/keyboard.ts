/**
 * Keyboard-shortcut guards shared by the card and the deck controls.
 *
 * Both surfaces listen on `window` so shortcuts work without anything holding
 * focus. That means each handler has to decide on its own whether a keypress
 * really belongs to it, and there are two cases to step aside for:
 *
 *  - the event came from a text-entry control, where the keystroke is content;
 *  - the event came from a control that runs its own action on Space, so
 *    flipping the card as well would perform two actions for one keypress.
 *
 * The second guard is only safe because the card's hidden face is `inert`.
 * Without that, focus can rest on a control inside the face the user cannot
 * see, and stepping aside for it would make Space do nothing at all.
 */

/** Controls that consume keystrokes as content rather than as shortcuts. */
const TYPING = "input, textarea, select, [contenteditable]";

/**
 * Controls that act on Space by themselves.
 *
 * `summary` is included because it toggles a `<details>` on Space, and the ARIA
 * roles are included because a control can carry a button-like role without
 * being a `<button>`.
 */
const ACTIVATABLE =
  "button, a[href], summary, [role='button'], [role='switch'], [role='checkbox']";

/**
 * True when the event originated inside a text-entry control.
 *
 * Guards against shortcuts firing while the user is typing somewhere on the
 * page. The target is not always an element -- an event dispatched on `window`
 * or `document` targets those objects, which have no `closest` method.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING) !== null;
}

/** True when the focused control will run its own action on a Space press. */
export function isActivatableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ACTIVATABLE) !== null;
}

/**
 * True when a modifier is held.
 *
 * Shortcuts must stay out of the way of browser and OS bindings such as
 * Cmd-R, Ctrl-F, and Alt-Left for browser history.
 */
export function hasModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}
