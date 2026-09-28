import { Kbd } from "./Kbd";
import type { CategoryCount } from "../lib/study";
import type { Category } from "../lib/types";
import { ACCENT_STYLES } from "./accents";

type SettingsViewProps = {
  readonly categories: readonly Category[];
  readonly counts: Readonly<Record<string, CategoryCount>>;
  /** Category ids currently switched off. */
  readonly hidden: readonly string[];
  readonly onToggleCategory: (categoryId: string, enabled: boolean) => void;
  readonly onSetAllCategories: (enabled: boolean) => void;
  readonly onDone: () => void;
};

/** The shortcuts, as data, so the list and the prose cannot drift apart. */
const SHORTCUTS: readonly {
  readonly keys: readonly string[];
  readonly action: string;
}[] = [
  { keys: ["Space"], action: "flip the card" },
  { keys: ["1"], action: "got it" },
  { keys: ["2"], action: "didn't know" },
  { keys: ["←"], action: "previous card" },
  { keys: ["→"], action: "next card" },
];

/**
 * The settings page: which categories to study, and what the keys do.
 *
 * The keyboard reference lives here rather than under the heading because the
 * cards are worth the space, and because this is the one place a user goes
 * looking for it.
 */
export function SettingsView({
  categories,
  counts,
  hidden,
  onToggleCategory,
  onSetAllCategories,
  onDone,
}: SettingsViewProps) {
  const allOn = categories.every((c) => !hidden.includes(c.id));
  const noneOn = categories.every((c) => hidden.includes(c.id));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-ink text-lg font-semibold">Question types</h2>
            <p className="text-ink-muted mt-1 text-sm">
              Switch off a subject to take it out of the deck. Progress you have
              already made on it is kept.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={allOn}
              onClick={() => onSetAllCategories(true)}
              className="border-line text-ink-muted hover:text-ink hover:border-accent/50 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              disabled={noneOn}
              onClick={() => onSetAllCategories(false)}
              className="border-line text-ink-muted hover:text-ink hover:border-accent/50 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </div>

        {/*
          A fieldset with a visible legend rather than a list of bare checkboxes:
          the legend is what tells a screen reader that these checkboxes are one
          related group, which is exactly the question the user is answering.
        */}
        <fieldset className="border-line bg-surface divide-line divide-y rounded-2xl border">
          <legend className="sr-only">Categories to include in the deck</legend>
          {categories.map((category) => {
            const count = counts[category.id] ?? {
              cards: 0,
              gotIt: 0,
              missed: 0,
            };
            const enabled = !hidden.includes(category.id);
            const styles = ACCENT_STYLES[category.accent] ?? ACCENT_STYLES.sky;
            const graded = count.gotIt + count.missed;

            return (
              <label
                key={category.id}
                className="hover:bg-surface-raised flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  /*
                   * An explicit name rather than the wrapping label's text. The
                   * label concatenates to "Nix0 / 2" with no separator, which a
                   * screen reader announces as one run-on word; naming the
                   * checkbox here also keeps it independent of the layout text.
                   */
                  aria-label={`${category.label}: ${graded} of ${count.cards} studied`}
                  onChange={(event) =>
                    onToggleCategory(category.id, event.currentTarget.checked)
                  }
                  className="accent-accent size-4 shrink-0"
                />
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${styles.dot}`}
                />
                <span className="text-ink flex-1 text-sm font-medium">
                  {category.label}
                </span>

                {/* Graded state as dots: a number per category is noise, but a
                    glanceable sense of which subjects are already done is not. */}
                {graded > 0 && (
                  <span
                    className="flex shrink-0 items-center gap-1"
                    aria-hidden="true"
                  >
                    {Array.from({ length: count.gotIt }, (_, i) => (
                      <span
                        key={`g${i}`}
                        className="bg-got size-1.5 rounded-full"
                      />
                    ))}
                    {Array.from({ length: count.missed }, (_, i) => (
                      <span
                        key={`m${i}`}
                        className="bg-missed size-1.5 rounded-full"
                      />
                    ))}
                  </span>
                )}

                <span className="text-ink-faint shrink-0 font-mono text-xs tabular-nums">
                  {graded} / {count.cards}
                </span>
              </label>
            );
          })}
        </fieldset>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-lg font-semibold">Keyboard</h2>
        <dl className="border-line bg-surface divide-line divide-y rounded-2xl border">
          {SHORTCUTS.map(({ keys, action }) => (
            <div
              key={action}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <dt className="flex shrink-0 gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dt>
              <dd className="text-ink-muted text-right text-sm">{action}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div>
        <button
          type="button"
          onClick={onDone}
          className="bg-accent text-canvas rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          Back to study
        </button>
      </div>
    </div>
  );
}
