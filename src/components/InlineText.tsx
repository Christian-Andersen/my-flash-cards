/**
 * Renders authored prose with `` `inline code` `` spans.
 *
 * Card text is written in Markdown-style backticks for readability in
 * `cards.json`, but it is rendered as plain text, so without this the
 * backticks would appear literally in the answer.
 *
 * Only the backtick span is interpreted. Everything is emitted as a text node,
 * so no HTML in `cards.json` can be injected into the page.
 */

const INLINE_CODE = /(`[^`]+`)/g;

type InlineTextProps = {
  readonly text: string;
};

export function InlineText({ text }: InlineTextProps) {
  // The capture group keeps the delimiters in the result, so odd-indexed
  // parts are the code spans.
  const parts = text.split(INLINE_CODE);

  return (
    <>
      {parts.map((part, i) => {
        const isCode =
          part.length > 2 && part.startsWith("`") && part.endsWith("`");
        return isCode ? (
          <code
            key={i}
            className="border-line bg-surface-raised text-ink rounded border px-1 py-0.5 font-mono text-[0.85em]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        );
      })}
    </>
  );
}
