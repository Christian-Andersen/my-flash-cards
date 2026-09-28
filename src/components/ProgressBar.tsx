import type { Progress } from "../lib/study";

type ProgressBarProps = {
  readonly progress: Progress;
};

/**
 * A stacked bar of graded cards, split by grade.
 *
 * The bar is decorative: the same information is repeated in text below it,
 * because a bar alone conveys nothing to a screen reader. The numbers update
 * in a polite live region so a grade is announced without stealing focus.
 */
export function ProgressBar({ progress }: ProgressBarProps) {
  const { total, gotIt, missed, unvisited } = progress;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  return (
    <div className="w-full shrink-0">
      <div
        className="bg-surface-raised border-line flex h-2 w-full overflow-hidden rounded-full border"
        aria-hidden="true"
      >
        {gotIt > 0 && (
          <div
            className="bg-got h-full transition-[width] duration-300"
            style={{ width: `${pct(gotIt)}%` }}
          />
        )}
        {missed > 0 && (
          <div
            className="bg-missed h-full transition-[width] duration-300"
            style={{ width: `${pct(missed)}%` }}
          />
        )}
        {unvisited > 0 && (
          <div
            className="bg-line h-full transition-[width] duration-300"
            style={{ width: `${pct(unvisited)}%` }}
          />
        )}
      </div>

      <p className="text-ink-faint mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
        <span className="text-got">{gotIt} got it</span>
        <span className="text-missed">{missed} missed</span>
        <span>{unvisited} left</span>
        <span aria-live="polite" className="sr-only">
          {gotIt + missed} of {total} cards graded.
        </span>
      </p>
    </div>
  );
}
