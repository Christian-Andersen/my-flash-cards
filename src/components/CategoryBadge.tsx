import { ACCENT_STYLES } from "./accents";
import type { Category } from "../lib/types";

type CategoryBadgeProps = {
  readonly category: Category | undefined;
  /** Appended to the chip's classes when a custom size is needed. */
  readonly className?: string;
};

/**
 * The coloured label identifying which topic a card belongs to.
 *
 * Renders nothing when the category is missing. `build-cards` rejects a card
 * whose category is undeclared, so this is a type-level safeguard for
 * hand-edited data rather than a state the app can actually reach.
 */
export function CategoryBadge({
  category,
  className = "",
}: CategoryBadgeProps) {
  if (!category) return null;
  const styles = ACCENT_STYLES[category.accent] ?? ACCENT_STYLES.sky;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide ${styles.chip} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${styles.dot}`}
      />
      {category.label}
    </span>
  );
}
