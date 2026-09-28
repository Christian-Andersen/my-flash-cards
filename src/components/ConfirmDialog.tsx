import { useEffect, useId, useRef } from "preact/hooks";

type ConfirmDialogProps = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** Styles the confirm button as destructive, for actions that lose work. */
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

/**
 * A modal confirmation for an action that cannot be undone.
 *
 * Hand-rolled on `role="dialog"` rather than a native `<dialog>`: the native
 * element brings focus trapping and Escape handling for free, but jsdom does
 * not implement `showModal`, so a native version could only be tested through
 * the one code path that runs when it is missing.
 *
 * Focus starts on the confirm button rather than the cancel button, because the
 * confirm button is where a reflexive Enter goes -- but Escape and the cancel
 * button are both one keystroke away, so a mis-fire costs nothing.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Move focus in on open, and put it back where it came from on close, so
  // dismissing the dialog does not strand the user at the top of the document.
  useEffect(() => {
    // Captured before the focus call below. Reading it afterwards would record
    // the confirm button, and the cleanup would then try to restore focus to
    // the very node being unmounted, leaving focus on <body>.
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  /*
   * Focus trap. A dialog marked `aria-modal` is expected to hold focus, and
   * without this Tab walks out into the page behind it, which is both a
   * keyboard trap of the bad kind and a lie to assistive technology.
   */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = document.activeElement;

    // Only intervene at the two ends; in the middle, let the browser walk the
    // list itself so the order stays the document order.
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={onKeyDown}
    >
      {/*
        A presentational backdrop. It is a button so that clicking it, or
        reaching it with the keyboard, is a cancel; `aria-hidden` stops it
        appearing in the accessibility tree as an unnamed control.
      */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="border-line bg-surface relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-ink text-lg font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="text-ink-muted mt-2 text-sm">
          {description}
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border-line text-ink-muted hover:text-ink hover:border-accent/50 rounded-lg border px-4 py-2 text-sm transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
              destructive ? "bg-missed text-canvas" : "bg-accent text-canvas"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
