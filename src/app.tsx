import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "preact/hooks";

import { ConfirmDialog } from "./components/ConfirmDialog";
import { FlipCard } from "./components/FlipCard";
import { ProgressBar } from "./components/ProgressBar";
import { SettingsView } from "./components/SettingsView";
import { StudyControls } from "./components/StudyControls";
import { categories, deck, getCard, getCategory } from "./lib/deck";
import {
  hasModifier,
  isActivatableTarget,
  isTypingTarget,
} from "./lib/keyboard";
import { newSeed } from "./lib/shuffle";
import { clearStudy, loadStudy, saveStudy } from "./lib/storage";
import {
  categoryCounts,
  isDeckFilteredOut,
  progressOf,
  reduceStudy,
  viewQueue,
  type Answer,
  type StudyAction,
  type StudyState,
} from "./lib/study";

/**
 * Applies a study action against the generated deck.
 *
 * The reducer is pure and returns an identical reference when an action is a
 * no-op, so state only re-renders when something actually changed.
 */
function reducer(state: StudyState, action: StudyAction): StudyState {
  return reduceStudy(state, action, deck);
}

type EmptyReason = "no-cards" | "all-hidden" | "all-done";

function EmptyState({ reason }: { readonly reason: EmptyReason }) {
  if (reason === "no-cards") {
    return (
      <div className="border-line text-ink-muted rounded-2xl border border-dashed p-10 text-center">
        <p className="text-ink text-lg font-semibold">No cards loaded</p>
        <p className="mt-2 text-sm">
          Add entries to <code className="text-ink font-mono">cards.json</code>{" "}
          and run <code className="text-ink font-mono">just cards</code>.
        </p>
      </div>
    );
  }

  if (reason === "all-hidden") {
    return (
      <div className="border-line text-ink-muted rounded-2xl border border-dashed p-10 text-center">
        <p className="text-ink text-lg font-semibold">Nothing selected</p>
        <p className="mt-2 text-sm">
          Every question type is switched off. Open{" "}
          <strong className="text-ink">Settings</strong> to turn some back on.
        </p>
      </div>
    );
  }

  return (
    <div className="border-line text-ink-muted rounded-2xl border border-dashed p-10 text-center">
      <p className="text-ink text-lg font-semibold">Deck complete</p>
      <p className="mt-2 text-sm">
        Every card is marked as known. Cards you got right are not shown again —
        use <strong className="text-ink">Reset</strong> to work through the
        whole deck from the start.
      </p>
    </div>
  );
}

type View = "study" | "settings";

export function App() {
  // Restored lazily on the first render. This app is client-only, and doing
  // the read in a mount effect would paint an empty deck first and, worse,
  // would race the persistence effect into overwriting the saved session.
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    loadStudy(deck),
  );
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<View>("study");
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    saveStudy(state);
  }, [state]);

  const progress = useMemo(() => progressOf(state, deck), [state]);
  const queue = useMemo(() => viewQueue(state, deck), [state]);
  const counts = useMemo(() => categoryCounts(state, deck), [state]);

  // Read straight off the queue rather than through `currentCardId`, so the
  // shuffle is not computed a second time for the same state.
  const cardId = queue[state.cursor];
  const card = cardId ? getCard(cardId) : undefined;
  const category = card ? getCategory(card.category) : undefined;

  // Grading or navigating moves to a different card, so the answer face must
  // not stay revealed across that transition.
  const answer = useCallback(
    (value: Answer) => {
      if (!cardId) return;
      dispatch({ type: "answer", cardId, answer: value });
      setFlipped(false);
    },
    [cardId],
  );

  const advance = useCallback((direction: 1 | -1) => {
    dispatch({ type: "advance", direction });
    setFlipped(false);
  }, []);

  /*
   * Deck navigation lives here rather than in the card, because Prev and Next
   * are session-level controls rather than part of the card. Left and right
   * work whether or not the answer is showing, and `advance` hides it so the
   * next card always starts on its question.
   *
   * Suspended away from the study view and while the reset dialog is up: there
   * is no card to navigate in settings, and in a modal the arrows belong to
   * the modal.
   */
  const canNavigate = view === "study" && !confirmingReset;
  useEffect(() => {
    if (!canNavigate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (hasModifier(event) || isTypingTarget(event.target)) return;

      const direction =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (direction === 0) return;

      // A focused control may give the arrows its own meaning; the card's own
      // shortcut handler applies the same rule for Space.
      if (isActivatableTarget(event.target)) return;

      event.preventDefault();
      advance(direction);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, canNavigate]);

  const reset = useCallback(() => {
    clearStudy();
    // A new seed, so a second pass is not dealt in the same order as the first.
    dispatch({ type: "reset", seed: newSeed() });
    setFlipped(false);
    setConfirmingReset(false);
  }, []);

  const toggleCategory = useCallback((categoryId: string, enabled: boolean) => {
    dispatch({ type: "set-category", categoryId, enabled });
    setFlipped(false);
  }, []);

  const setAllCategories = useCallback((enabled: boolean) => {
    for (const category of categories) {
      dispatch({ type: "set-category", categoryId: category.id, enabled });
    }
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-ink text-2xl font-bold tracking-tight">
          Flashcards
        </h1>
        <button
          type="button"
          onClick={() => {
            setView(view === "study" ? "settings" : "study");
            setFlipped(false);
          }}
          className="border-line text-ink-muted hover:text-ink hover:border-accent/50 rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          {view === "study" ? "Settings" : "Study"}
        </button>
      </header>

      {view === "study" ? (
        <>
          <ProgressBar progress={progress} />

          {card ? (
            <FlipCard
              card={card}
              category={category}
              flipped={flipped}
              onFlip={() => setFlipped((value) => !value)}
              onAnswer={answer}
              position={state.cursor + 1}
              total={queue.length}
            />
          ) : (
            <EmptyState
              reason={
                deck.ids.length === 0
                  ? "no-cards"
                  : isDeckFilteredOut(state, deck)
                    ? "all-hidden"
                    : "all-done"
              }
            />
          )}

          <StudyControls
            onReset={() => setConfirmingReset(true)}
            onPrevious={() => advance(-1)}
            onNext={() => advance(1)}
          />
        </>
      ) : (
        <SettingsView
          categories={categories}
          counts={counts}
          hidden={state.hidden}
          onToggleCategory={toggleCategory}
          onSetAllCategories={setAllCategories}
          onDone={() => setView("study")}
        />
      )}

      {confirmingReset && (
        <ConfirmDialog
          title="Reset progress?"
          description="Every grade will be cleared and the deck reshuffled. This cannot be undone."
          confirmLabel="Reset everything"
          destructive
          onConfirm={reset}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
