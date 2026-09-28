import { Kbd } from "./Kbd";

type StudyControlsProps = {
  readonly onReset: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
};

/**
 * Session-level controls: deck navigation and reset.
 *
 * There is no missed-only filter. It was redundant once grading `got it`
 * retired the card from the queue, since the deck is already narrowed to
 * whatever is not yet known.
 */
export function StudyControls({
  onReset,
  onPrevious,
  onNext,
}: StudyControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="border-line text-ink-muted hover:text-ink hover:border-accent/50 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          <Kbd>&larr;</Kbd>
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          className="border-line text-ink-muted hover:text-ink hover:border-accent/50 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          Next
          <Kbd>&rarr;</Kbd>
        </button>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="text-ink-faint hover:text-ink rounded-lg px-2 py-1.5 text-sm transition-colors"
      >
        Reset
      </button>
    </div>
  );
}
