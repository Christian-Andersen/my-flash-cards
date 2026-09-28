import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { isCodeBlock, type Block } from "../lib/types";

type CodeSnippetProps = {
  readonly block: Block;
};

/** How long the copy button confirms success, in ms. */
const COPIED_FEEDBACK_MS = 1600;

function CopyButton({ code }: { readonly code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A pending confirmation must not fire into an unmounted component.
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard access can be denied or unavailable outside a secure
      // context. Leaving the label unchanged is clearer than a false "Copied".
      setCopied(false);
    }
  }, [code]);

  // `copy` is async, but the click handler must not return a promise to the
  // DOM, so the returned value is deliberately discarded. Every failure path
  // is handled inside `copy`, so there is nothing to reject.
  const handleClick = useCallback(() => {
    void copy();
  }, [copy]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="border-line bg-surface-raised text-ink-muted hover:border-accent/50 hover:text-ink shrink-0 rounded-md border px-2 py-1 text-xs transition-colors"
    >
      {copied ? "Copied" : "Copy"}
      {/* Announces the result of the action to screen readers. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Code copied to clipboard" : ""}
      </span>
    </button>
  );
}

/**
 * A single code block: an optional caption, the pre-highlighted snippet, and a
 * copy button.
 *
 * The snippet is injected as HTML because Shiki produced it at build time from
 * this repo's own `cards.json`. See the `CodeBlock.html` doc comment for the
 * trust boundary.
 */
export function CodeSnippet({ block }: CodeSnippetProps) {
  if (!isCodeBlock(block)) return null;

  return (
    <figure className="my-1">
      <figcaption className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-ink-faint font-mono text-[0.6875rem] tracking-wide uppercase">
          {block.caption ?? block.language}
        </span>
        <CopyButton code={block.code} />
      </figcaption>
      <div
        // Trusted build-time output from cards.json; see CodeBlock.html.
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </figure>
  );
}
