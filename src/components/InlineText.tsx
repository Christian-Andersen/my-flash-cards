/**
 * Renders authored prose with a small subset of Markdown.
 *
 * Card text is written in Markdown for readability in `cards.json`, so without
 * this the markers would appear literally: `**bold**` as asterisks, and a
 * `- ` bullet list as run-on hyphens.
 *
 * Supported, because the deck uses it: `**bold**`, `*italic*`, `` `code` ``,
 * `- ` and `* ` bullet lists, and `1. ` numbered lists. A list is one block
 * from its first marker to its last item; blank lines inside a text block
 * separate paragraphs in the source but are not authored anywhere in the deck,
 * so the block is rendered as a single list.
 *
 * Everything is emitted as Preact children, never as an HTML string, so no
 * markup in `cards.json` can reach the page. Shiki output is the only trusted
 * HTML in the app and it is injected in `CodeSnippet`, not here.
 *
 * An unclosed marker is left as literal text rather than swallowed: a stray
 * `*` in prose should not silently delete the rest of the sentence.
 */

import type { ComponentChildren } from "preact";

/** One inline span: literal text, or a run wrapped in emphasis or code. */
type Span = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
};

type Token =
  | { readonly kind: "text"; readonly value: string }
  | {
      readonly kind: "item";
      readonly value: string;
      readonly ordinal: string | null;
    };

/** `(` `)` or `` ` ``, so a delimiter inside its own run does not close it. */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;

/** A line that starts a bullet, and the text after the marker. */
const BULLET = /^\s*[-*]\s+(.*)$/;

/** A line that starts an ordered item, and its literal ordinal ("1."). */
const ORDERED = /^\s*\d+\.\s+(.*)$/;

const literal = (text: string): Span => ({
  text,
  bold: false,
  italic: false,
  code: false,
});

/**
 * Splits one run of prose into spans, resolving emphasis and code markers.
 *
 * The regex only matches a marker pair that closes on the same construct, so
 * `**bold**`, `*italic*` and `` `code` `` are unambiguous against each other,
 * and a lone `*` falls through as literal text.
 */
function spans(text: string): Span[] {
  const parts = text.split(INLINE);
  const out: Span[] = [];

  for (const part of parts) {
    if (part.length === 0) continue;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ ...literal(part.slice(2, -2)), bold: true });
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      out.push({ ...literal(part.slice(1, -1)), italic: true });
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      out.push({ ...literal(part.slice(1, -1)), code: true });
    } else {
      out.push(literal(part));
    }
  }

  return out;
}

/**
 * Tokenises a text block into inline spans, hard breaks, and list items.
 *
 * Splitting on newlines first is what makes a `- ` line a list item rather than
 * a literal hyphen: the markers are only meaningful at the start of a line.
 */
function tokenise(text: string): Token[] {
  const tokens: Token[] = [];

  for (const line of text.split("\n")) {
    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);

    if (bullet !== null) {
      tokens.push({ kind: "item", value: bullet[1] ?? "", ordinal: null });
      continue;
    }

    if (ordered !== null) {
      // The ordinal is the marker as written ("1.", "3."), so the list keeps
      // the author's numbering instead of silently renumbering from one.
      tokens.push({
        kind: "item",
        value: ordered[1] ?? "",
        ordinal: line.trim().split(/\s+/)[0] ?? "",
      });
      continue;
    }

    tokens.push({ kind: "text", value: line });
  }

  return tokens;
}

/**
 * A single inline span. Emphasis renders as real elements rather than classes so
 * the markup is testable, and so a screen reader gets the emphasis for free.
 */
function SpanNode({
  span,
  key,
}: {
  readonly span: Span;
  readonly key: number;
}) {
  if (span.code) {
    return (
      <code
        key={key}
        className="border-line bg-surface-raised text-ink rounded border px-1 py-0.5 font-mono text-[0.85em]"
      >
        {span.text}
      </code>
    );
  }

  if (span.bold) {
    return (
      <strong key={key} className="text-ink font-semibold">
        {span.text}
      </strong>
    );
  }

  if (span.italic) {
    return <em key={key}>{span.text}</em>;
  }

  return <span key={key}>{span.text}</span>;
}

/**
 * Collects a run of item tokens into one list element.
 *
 * `ul` for bullets and `ol` for numbers, because the ordinals are meaningful to
 * a screen reader and copying the answer should carry them across.
 */
function listTag(ordinal: string | null): "ul" | "ol" {
  return ordinal === null ? "ul" : "ol";
}

function renderItem(item: Extract<Token, { kind: "item" }>, key: number) {
  const marker =
    item.ordinal === null
      ? "list-disc marker:text-ink-muted"
      : "list-decimal marker:text-ink-muted";

  return (
    <li key={key} className={`pl-1 ${marker}`}>
      {spans(item.value).map((span, i) => (
        <SpanNode key={i} span={span} />
      ))}
    </li>
  );
}

/**
 * Whether a text block renders a list, so its caller can pick a container that
 * may legally hold one.
 *
 * A `ul` inside a `p` is invalid HTML, and the browser's parser silently closes
 * the paragraph, so the renderer and the resulting DOM stop agreeing.
 */
export function hasList(text: string): boolean {
  return text
    .split("\n")
    .some((line) => BULLET.test(line) || ORDERED.test(line));
}

type InlineTextProps = {
  readonly text: string;
};

export function InlineText({ text }: InlineTextProps) {
  const tokens = tokenise(text);
  const children: ComponentChildren[] = [];
  let list: Array<Extract<Token, { kind: "item" }>> = [];

  const flushList = () => {
    if (list.length === 0) return;
    // A list cannot mix bullets with numbers, so the tag comes from the first
    // item and a stray mixed list renders as the dominant kind.
    const first = list[0];
    const Tag = first === undefined ? "ul" : listTag(first.ordinal);
    children.push(
      <Tag
        key={`list-${children.length}`}
        className="my-1 space-y-1 pl-5 text-pretty"
      >
        {list.map(renderItem)}
      </Tag>,
    );
    list = [];
  };

  let key = 0;

  for (const token of tokens) {
    if (token.kind === "item") {
      list.push(token);
      continue;
    }

    // Prose between two lists closes the first one, so the lists stay separate.
    flushList();

    children.push(
      <span key={key++} className="block">
        {spans(token.value).map((span, i) => (
          <SpanNode key={i} span={span} />
        ))}
      </span>,
    );
  }

  flushList();

  return <>{children}</>;
}
