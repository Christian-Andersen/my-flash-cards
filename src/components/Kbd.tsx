import type { ComponentChildren } from "preact";

type KbdProps = {
  readonly children: ComponentChildren;
  /** Extra classes, for the surface the badge sits on. */
  readonly class?: string;
};

/**
 * A keyboard shortcut rendered as a key badge.
 *
 * Hidden from assistive technology because the prose around it already names
 * the shortcut in words ("to flip", "to grade"). Leaving the badge readable
 * would announce the key twice, and on the navigation buttons it would also
 * leak an arrow glyph into the accessible name, breaking anything that selects
 * a control by its label.
 */
export function Kbd({ children, class: className = "" }: KbdProps) {
  return (
    <kbd
      aria-hidden="true"
      className={`border-line rounded border px-1 py-0.5 font-mono text-xs ${className}`}
    >
      {children}
    </kbd>
  );
}
