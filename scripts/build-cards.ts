/**
 * Turns `cards.json` into a typed TypeScript module with every code snippet
 * already highlighted by Shiki.
 *
 * Highlighting at build time keeps the highlighting engine out of the browser
 * bundle entirely and makes the app render code with zero client-side cost.
 * The cost is that this must run before `vite` and before `tsc`, which is why
 * `npm run dev` and `npm run build` both invoke it first.
 *
 * Emits: src/generated/cards.ts
 *
 * Run with `node scripts/build-cards.ts`; Node strips the types, so there is
 * no compile step and the file is still typechecked by `just typecheck`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { codeToHtml } from "shiki";

import type { AccentName, Card, Category, CodeBlock } from "../src/lib/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "cards.json");
const OUTPUT = resolve(ROOT, "src/generated/cards.ts");

/** Shiki theme used for the rendered snippets. The app is dark-only. */
const THEME = "github-dark-default";

const ACCENTS: ReadonlySet<string> = new Set<AccentName>([
  "amber",
  "emerald",
  "rose",
  "sky",
  "teal",
  "violet",
]);

class ValidationError extends Error {
  problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`cards.json is invalid:\n  - ${problems.join("\n  - ")}`);
    this.name = "ValidationError";
    this.problems = problems;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Renders one snippet, recording a problem instead of aborting so the caller
 * still sees the rest of the deck's errors. Returns an empty string on
 * failure, which the validation pass then reports.
 */
async function highlight(
  code: string,
  language: string,
  at: string,
  problems: string[],
): Promise<string> {
  try {
    return await codeToHtml(code, { lang: language, theme: THEME });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    problems.push(`${at}: cannot highlight "${language}" (${reason})`);
    return "";
  }
}

/**
 * Validates the deck and returns it with code blocks highlighted.
 *
 * Every card id is checked for uniqueness because ids are the persistence
 * key: a duplicate would silently overwrite the saved answer for the earlier
 * card.
 */
async function build(deck: unknown): Promise<{
  categories: Category[];
  cards: Card[];
}> {
  const problems: string[] = [];

  if (!isRecord(deck)) {
    throw new ValidationError(["top level must be an object"]);
  }

  const { categories: rawCategories, cards: rawCards } = deck;

  // Reported together so one run surfaces every structural problem, not just
  // the first. Throwing here also narrows both values for the code below.
  if (!Array.isArray(rawCategories) || !Array.isArray(rawCards)) {
    throw new ValidationError([
      ...(Array.isArray(rawCategories)
        ? []
        : ["`categories` must be an array"]),
      ...(Array.isArray(rawCards) ? [] : ["`cards` must be an array"]),
    ]);
  }

  const categoryIds = new Set<string>();
  const categories: Category[] = [];

  for (const [i, raw] of rawCategories.entries()) {
    const at = `categories[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${at} must be an object`);
      continue;
    }
    const { id, label, accent } = raw;

    if (!isNonEmptyString(id)) {
      problems.push(`${at}.id must be a non-empty string`);
    } else if (categoryIds.has(id)) {
      problems.push(`${at}.id "${id}" is duplicated`);
    } else {
      categoryIds.add(id);
    }

    if (!isNonEmptyString(label))
      problems.push(`${at}.label must be a non-empty string`);

    if (!isNonEmptyString(accent) || !ACCENTS.has(accent)) {
      problems.push(`${at}.accent must be one of: ${[...ACCENTS].join(", ")}`);
      continue;
    }

    if (isNonEmptyString(id) && isNonEmptyString(label)) {
      categories.push({ id, label, accent: accent as AccentName });
    }
  }

  const seenIds = new Set<string>();
  const cards: Card[] = [];

  for (const [i, raw] of rawCards.entries()) {
    const at = `cards[${i}]`;
    if (!isRecord(raw)) {
      problems.push(`${at} must be an object`);
      continue;
    }
    const { id, category, front, back } = raw;

    if (!isNonEmptyString(id)) {
      problems.push(`${at}.id must be a non-empty string`);
    } else if (seenIds.has(id)) {
      // Ids are the localStorage key, so a clash loses saved progress.
      problems.push(`${at}.id "${id}" is duplicated`);
    } else {
      seenIds.add(id);
    }

    if (!isNonEmptyString(category)) {
      problems.push(`${at}.category must be a non-empty string`);
    } else if (!categoryIds.has(category)) {
      problems.push(
        `${at}.category "${category}" does not match any declared category`,
      );
    }

    if (!isNonEmptyString(front))
      problems.push(`${at}.front must be a non-empty string`);

    if (!Array.isArray(back) || back.length === 0) {
      problems.push(`${at}.back must be a non-empty array of blocks`);
      continue;
    }

    const blocks: Card["back"][number][] = [];

    for (const [j, rawBlock] of back.entries()) {
      const blockAt = `${at}.back[${j}]`;
      if (!isRecord(rawBlock)) {
        problems.push(`${blockAt} must be an object`);
        continue;
      }
      const { type, content, language, code, caption } = rawBlock;

      if (type === "text") {
        if (!isNonEmptyString(content)) {
          problems.push(`${blockAt}.content must be a non-empty string`);
          continue;
        }
        blocks.push({ type: "text", content });
        continue;
      }

      if (type === "code") {
        if (!isNonEmptyString(language)) {
          problems.push(`${blockAt}.language must be a non-empty string`);
          continue;
        }
        if (!isNonEmptyString(code)) {
          problems.push(`${blockAt}.code must be a non-empty string`);
          continue;
        }
        if (caption !== undefined && !isNonEmptyString(caption)) {
          problems.push(`${blockAt}.caption must be a non-empty string`);
          continue;
        }
        const html = await highlight(code, language, blockAt, problems);
        const codeBlock: CodeBlock = {
          type: "code",
          language,
          code,
          html,
          ...(isNonEmptyString(caption) ? { caption } : {}),
        };
        blocks.push(codeBlock);
        continue;
      }

      problems.push(
        `${blockAt}.type must be "text" or "code", got ${JSON.stringify(type)}`,
      );
    }

    if (
      isNonEmptyString(id) &&
      isNonEmptyString(category) &&
      isNonEmptyString(front)
    ) {
      cards.push({ id, category, front, back: blocks });
    }
  }

  if (problems.length > 0) throw new ValidationError(problems);
  return { categories, cards };
}

const BANNER = `/**
 * AUTO-GENERATED by scripts/build-cards.ts. Do not edit.
 *
 * Source of truth: cards.json. Run \`npm run cards\` to regenerate.
 * Code highlighting is precomputed here so the browser ships no highlighter.
 */
`;

/** Serialises a value as TS source, using double-quoted keys and strings. */
function serialise(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const padInner = "  ".repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map(
      (item) => `${padInner}${serialise(item, indent + 1)}`,
    );
    return `[\n${items.join(",\n")},\n${pad}]`;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const parts = entries.map(
      ([key, item]) =>
        `${padInner}${JSON.stringify(key)}: ${serialise(item, indent + 1)}`,
    );
    return `{\n${parts.join(",\n")},\n${pad}}`;
  }

  return JSON.stringify(value) ?? "null";
}

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(SOURCE, "utf8");
  } catch {
    console.error(`build-cards: cannot read ${SOURCE}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("build-cards: cards.json is not valid JSON");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const { categories, cards } = await build(parsed);

  const body = `${BANNER}import type { Category, Card } from "../lib/types";

export const categories: Category[] = ${serialise(categories)};

export const cards: Card[] = ${serialise(cards)};
`;

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, body, "utf8");

  const withCode = cards.filter((card) =>
    card.back.some((block) => block.type === "code"),
  ).length;

  console.log(
    `build-cards: ${cards.length} cards, ${categories.length} categories, ` +
      `code highlighted in ${withCode} card(s) -> src/generated/cards.ts`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof ValidationError) {
    console.error(`build-cards: ${error.message}`);
    process.exit(1);
  }
  throw error;
});
