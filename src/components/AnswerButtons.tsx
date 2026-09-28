import { useCallback } from "preact/hooks";

import type { Answer } from "../lib/study";

type AnswerButtonsProps = {
  readonly onAnswer: (answer: Answer) => void;
};

/**
 * The grade controls shown on the back of a card.
 *
 * Rendered as a real group of buttons so both choices are reachable by Tab and
 * fire on Enter/Space, with the shortcut key displayed on each. Digit keys
 * are handled by the card that owns this component, which is where the
 * keyboard listener already lives.
 */
export function AnswerButtons({ onAnswer }: AnswerButtonsProps) {
  const grade = useCallback(
    (answer: Answer) => () => {
      onAnswer(answer);
    },
    [onAnswer],
  );

  return (
    <div
      role="group"
      aria-label="Grade this card"
      className="flex flex-col gap-2 sm:flex-row"
    >
      <button
        type="button"
        onClick={grade("got-it")}
        className="border-got/40 bg-got/10 text-got hover:bg-got/20 flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        Got it
        <kbd className="border-got/30 text-got/80 rounded border px-1.5 py-0.5 font-mono text-[0.6875rem]">
          1
        </kbd>
      </button>
      <button
        type="button"
        onClick={grade("missed")}
        className="border-missed/40 bg-missed/10 text-missed hover:bg-missed/20 flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        Didn&apos;t know
        <kbd className="border-missed/30 text-missed/80 rounded border px-1.5 py-0.5 font-mono text-[0.6875rem]">
          2
        </kbd>
      </button>
    </div>
  );
}
