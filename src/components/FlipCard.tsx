import { useEffect } from "preact/hooks";

import {
  hasModifier,
  isActivatableTarget,
  isTypingTarget,
} from "../lib/keyboard";
import type { Answer } from "../lib/study";
import type { Block, Card, Category } from "../lib/types";
import { ACCENT_STYLES } from "./accents";
import { AnswerButtons } from "./AnswerButtons";
import { CategoryBadge } from "./CategoryBadge";
import { CodeSnippet } from "./CodeSnippet";
import { InlineText } from "./InlineText";

type FlipCardProps = {
  readonly card: Card;
  readonly category: Category | undefined;
  readonly flipped: boolean;
  readonly onFlip: () => void;
  readonly onAnswer: (answer: Answer) => void;
  readonly position: number;
  readonly total: number;
};

function AnswerBlocks({ blocks }: { readonly blocks: readonly Block[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeSnippet key={i} block={block} />
        ) : (
          <p key={i} className="text-ink-muted leading-relaxed text-pretty">
            <InlineText text={block.content} />
          </p>
        ),
      )}
    </div>
  );
}

/**
 * A single study card that rotates between its question and its answer.
 *
 * The flip is a CSS 3D transform rather than a state swap, so both faces stay
 * mounted and the answer keeps its scroll position and rendered highlights.
 *
 * Every control is a distinct button rather than one click-to-flip surface:
 * nesting the grade buttons inside a single clickable card would produce
 * invalid nested-interactive markup and confuse keyboard and screen-reader
 * users. Keyboard shortcuts fill the gap: Space flips, 1 and 2 grade.
 */
export function FlipCard({
  card,
  category,
  flipped,
  onFlip,
  onAnswer,
  position,
  total,
}: FlipCardProps) {
  // Listens on the window so shortcuts work without the card holding focus.
  // Keys are ignored while another control has focus, so typing in a field
  // elsewhere on the page never triggers an action here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Browser and OS bindings (Cmd-R, Ctrl-F, Alt-Left) stay untouched.
      if (hasModifier(event)) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === " " || event.key === "Spacebar") {
        // A focused control runs its own action on Space, so flipping as well
        // would perform two actions for one press. Only visible controls can
        // hold focus here: the hidden face is inert.
        if (isActivatableTarget(event.target)) return;
        // Toggles in both directions. Gating this on the question face made
        // Space a silent no-op once the answer was up, which reads as a dead
        // key rather than as a deliberate one-way binding.
        event.preventDefault();
        onFlip();
        return;
      }

      if (!flipped) return;
      if (event.key === "1") {
        event.preventDefault();
        onAnswer("got-it");
      } else if (event.key === "2") {
        event.preventDefault();
        onAnswer("missed");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipped, onFlip, onAnswer]);

  const accent = ACCENT_STYLES[category?.accent ?? "sky"] ?? ACCENT_STYLES.sky;

  return (
    // Takes the space the header, progress bar, and controls leave over, and
    // shrinks below its content when even that is not enough. The cap keeps the
    // card from stretching into a tall narrow slab on a large display, where
    // there is more room than a card this wide has any use for.
    <div className="flip-scene flex max-h-[40rem] min-h-0 flex-1">
      <div className="flip-inner" data-flipped={flipped}>
        {/* Question */}
        <section
          className={`flip-face border-line bg-surface flex max-h-full min-h-0 flex-col gap-5 overflow-hidden rounded-2xl border p-6 shadow-xl sm:p-8`}
          aria-hidden={flipped}
          // `aria-hidden` alone only hides from assistive technology; the
          // buttons on the back face stay in the tab order and stay clickable
          // through the rotation. `inert` removes the whole hidden face from
          // focus, hit testing, and the a11y tree, which also means a
          // keypress can never be aimed at a control the user cannot see.
          inert={flipped}
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <CategoryBadge category={category} />
            <span className="text-ink-faint font-mono text-xs tabular-nums">
              {position} / {total}
            </span>
          </div>

          {/* Scrolls inside the card rather than growing the page, so a long
              question still fits on a short screen. */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <h2 className="text-ink text-xl leading-snug font-semibold text-balance sm:text-2xl">
              <InlineText text={card.front} />
            </h2>
          </div>

          <button
            type="button"
            onClick={onFlip}
            tabIndex={flipped ? -1 : 0}
            className="bg-accent text-canvas w-full shrink-0 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            Show answer
            <kbd className="bg-canvas/20 ml-2 rounded px-1.5 py-0.5 font-mono text-[0.6875rem]">
              Space
            </kbd>
          </button>
        </section>

        {/* Answer */}
        <section
          className="flip-back flip-face border-line bg-surface flex max-h-full min-h-0 flex-col gap-5 overflow-hidden rounded-2xl border p-6 shadow-xl sm:p-8"
          aria-hidden={!flipped}
          inert={!flipped}
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <CategoryBadge category={category} />
            <button
              type="button"
              onClick={onFlip}
              tabIndex={flipped ? 0 : -1}
              className="text-ink-faint hover:text-ink text-xs transition-colors"
            >
              Back to question
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <AnswerBlocks blocks={card.back} />
          </div>

          <div className="border-line shrink-0 border-t pt-4">
            <AnswerButtons onAnswer={onAnswer} />
          </div>

          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent.edge} to-transparent`}
          />
        </section>
      </div>
    </div>
  );
}
