# Flashcards

A static flashcard app. Cards live in `cards.json`, code snippets are syntax
highlighted at build time, and the app grades each card so you can drill only
the ones you did not know.

Built with **Preact**, **TypeScript**, and **Tailwind CSS v4**. It is a fully
static bundle, so it deploys to Cloudflare Pages with no server or worker.

## Features

- **Card flipping** — a CSS 3D rotation between the question and the answer,
  which respects `prefers-reduced-motion`.
- **Category badges** — each card carries a category with its own accent
  colour, defined in `cards.json`.
- **Code snippets** — highlighted by [Shiki](https://shiki.style) using VS
  Code's grammars, precomputed during the build. No highlighter is shipped to
  the browser, and every snippet gets a copy button.
- **Progress tracking** — a stacked bar of got-it / missed / unvisited counts.
  The grades, the cursor and your category choices are persisted to
  `localStorage`; the shuffle order is not, so a reload keeps what you learned
  but deals a new order.
- **Known cards retire** — a card graded `got it` leaves the deck, so the deck
  is always exactly what you have not got right yet. `missed` cards stay in, and
  the counter shrinks as you work through it.
- **Shuffled, and de-clustered** — the deck is dealt in a random order, spread so
  two cards from the same subject rarely land back to back. A plain shuffle of
  this deck still averages about 141 adjacent same-category pairs out of 163
  possible slots; spreading cuts that to 0.11, and 90% of sessions get none at
  all.
- **Settings page** — switch whole categories in and out of the deck. Progress on
  a hidden category is kept and reported, so turning one back on shows how far it
  had got. Categories are stored as a deny-list, so a new category added to
  `cards.json` is on by default without anyone visiting settings.
- **Reset is confirmed** — clearing a session cannot be undone, so it goes
  through a modal with a focus trap rather than firing on the first click.
- **Dark-only UI** — the dark palette is the base, not a variant, so native
  widgets and scrollbars match.
- **Keyboard** — <kbd>Space</kbd> flips in both directions, <kbd>1</kbd> and
  <kbd>2</kbd> grade, and <kbd>←</kbd> / <kbd>→</kbd> move through the deck.
  A shortcut stands down whenever a control has focus, so <kbd>Space</kbd> on a
  focused button is that button's action rather than a flip. The list is in
  settings, not on the card view, so the cards get the space.

## Getting started

```sh
npm install
just r         # http://localhost:5173
```

`just` is optional; every recipe maps to an npm script in `package.json`.

## Commands

| Command      | Alias | What it does                                 |
| ------------ | ----- | -------------------------------------------- |
| `just run`   | `r`   | Generate cards, then start the dev server    |
| `just check` | `c`   | Format check, lint, and typecheck            |
| `just test`  | `t`   | Run the test suite                           |
| `just ci`    | —     | `check` followed by `test`                   |
| `just audit` | —     | Read-only dependency and vulnerability audit |
| `just cards` | —     | Regenerate `src/generated/cards.ts`          |
| `just build` | —     | Production build into `dist/`                |
| `just lint`  | —     | ESLint only                                  |
| `just fmt`   | —     | Apply Prettier formatting                    |
| `just clean` | —     | Remove build output and generated cards      |

`just check` is the pre-commit gate; `prek install` wires it into git hooks.
The hooks are defined as `local` hooks in `prek.toml` that call the Justfile
directly, rather than pulling tools from remote mirror repos. The
`pre-commit/mirrors-prettier` repo only tags up to `v3.1.0`, so pinning it
would install a different Prettier than the project uses and reformat files
differently from `just fmt-check`. Delegating keeps the hook and the gate on
the exact version in `package-lock.json`.

## Editing cards

`cards.json` is the only thing you need to edit. Add an entry to `cards` and
run `just cards` (or any build that depends on it):

```json
{
  "categories": [
    { "id": "javascript", "label": "JavaScript", "accent": "amber" }
  ],
  "cards": [
    {
      "id": "js-closure",
      "category": "javascript",
      "front": "What does a closure capture?",
      "back": [
        { "type": "text", "content": "It captures a *binding*, not a value." },
        {
          "type": "code",
          "language": "javascript",
          "caption": "var shares one binding",
          "code": "for (var i = 0; i < 3; i++) {}"
        }
      ]
    }
  ]
}
```

Notes on the format:

- **`id`** must be unique and stable. It is the `localStorage` key, so
  renaming a card resets its saved progress.
- **`category`** must match a declared category's `id`.
- **`accent`** is one of `amber`, `blue`, `cyan`, `emerald`, `indigo`, `orange`,
  `rose`, `sky`, `teal`, `violet`. Adding a new one is a three-file change:
  `AccentName` in `src/lib/types.ts`, `ACCENTS` in `scripts/build-cards.ts`, and
  `ACCENT_STYLES` in `src/components/accents.ts`.
- **`back`** is a list of `text` and `code` blocks. In `text` blocks a small
  subset of Markdown is rendered: `**bold**`, `*italic*`, `` `inline code` ``,
  and `-` / `1.` lists, where each list item is a line starting with the marker.
  A `-` or `1.` in the middle of a line is just a character.
- **`language`** is any Shiki language id, e.g. `ts`, `python`, `nix`, `bash`.

The build validates all of this and reports every problem at once, so a typo
in a card fails the build with a message pointing at the exact field rather
than rendering a broken card.

Generated output lives in `src/generated/` and is gitignored — it is a build
artifact, not a source file.

## Deploying to Cloudflare Pages

Connect the repository in the Cloudflare dashboard with:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

Or use `just build`, which runs the card generator first. The Node version
must be 22 or newer; `engines` in `package.json` records that.

`public/_headers` sets cache and security headers. Hashed assets under
`/assets/` are cached for a year and `index.html` is not cached, so a deploy
never serves references to a deleted bundle.

There is no SPA routing here, so no redirects file is needed.

## Layout

```
cards.json                 the deck - the only file most edits touch
scripts/build-cards.ts     validates cards.json, highlights code, emits TS
src/
  app.tsx                  state wiring, page layout, view switch
  index.css                Tailwind theme, flip animation, Shiki styling
  components/
    FlipCard.tsx           the card, its two faces, and the grading buttons
    InlineText.tsx         card prose: the Markdown subset, as elements
    ConfirmDialog.tsx      modal confirmation with a focus trap
    SettingsView.tsx       category toggles and the keyboard reference
    StudyControls.tsx      previous / next / reset
    ProgressBar.tsx        the graded / unvisited bar
    InlineText.test.tsx    what the prose markup renders as
  lib/
    types.ts               the shape of the generated card data
    study.ts               pure reducer: grading, queueing, filtering, progress
    shuffle.ts             seeded shuffle and category spreading
    storage.ts             localStorage load/save, with validation
    keyboard.ts            the shortcut guards shared by both key handlers
    deck.ts                runtime lookups over the generated deck
    study.test.ts          the reducer's rules, in plain Node
    storage.test.ts        load, save, and the corrupt-payload paths
    keyboard.test.ts       the shortcut guards
  test/
    app.test.tsx           end-to-end study flow in jsdom
    markdown.test.tsx      the deck's own prose, rendered for real
  generated/               build output (gitignored)
```

`study.ts` holds the rules and is pure, so the grading, retirement, filtering and
queue behaviour is tested without rendering anything. `app.test.tsx` then covers
the same flow through the real DOM.

`markdown.test.tsx` is the odd one out: it renders every text block in
`cards.json` and asserts the deck's own prose contains no leftover Markdown
markers. `cards.json` is authored in a Markdown subset, and the format cannot
check its own output, so a malformed marker would otherwise reach an answer as a
literal asterisk or hyphen rather than failing anything.

## Notes on a couple of decisions

**Why the order is seeded rather than random per render.** The queue is re-derived
from the seed on every read, and the cursor is an index into it, so an order that
changed on every render would move the card out from under the cursor. The seed
is drawn once on load and held in state, which makes the order stable for the
session and keeps the shuffle testable without stubbing `Math.random`.

**Why the seed is not persisted.** Storing it bought one thing: a reload resumed
the same sequence. It also meant a refresh silently continued where you left off
rather than starting a new pass, and it coupled the shuffle to the storage
schema — `saveStudy` had to know to leave a field out, or a future refactor
writing the whole state would quietly reinstate the old behaviour. The order is
now re-drawn on every load, so a refresh deals a new one and only the grades,
the cursor and the category choices carry over. The cursor still means something
because the queue it indexes no longer holds the cards you have got it.

**Why the storage key is still `v1`.** The payload has changed shape more than
once — the missed-only filter came and went, then `seed` and `hidden` were
added, then `seed` was dropped again — but `loadStudy` reads each field
defensively and defaults whatever is missing or malformed, so an older session
still restores. Bumping the key would discard real progress to buy nothing. The
one change a stored payload could notice was dropping `seed`, and it needed no
bump: a stale seed in storage is ignored and the order is re-drawn.

**Why the study view is capped at one screen but the settings view is not.** The
page was `min-h-dvh`, so it grew to whatever the card needed: the answer face
asked for 70% of the screen while the header, progress bar, and controls took
another ~240px. On a phone that is more than the viewport, so every card
scrolled the page — including the question view, because the hidden answer face
still set the height of the cell both faces share. The study column is now
exactly `h-dvh`, the card takes the space the rest of the page leaves over, and
each face scrolls its own content when it will not fit. The settings view keeps
`min-h-dvh`, because the category list really is taller than a phone and
bounding it would clip the toggles.

**Why the scroll resets on the card but not on the flip.** Both faces stay mounted
so the flip is a rotation rather than a state swap, which means the scroll
container is the same element from one card to the next — and an element keeps
its `scrollTop` when only its contents are swapped. Reading an answer, scrolling
down, then moving on left every later answer scrolled to that offset. The region
is keyed to the card so it is rebuilt instead of refilled. The key is on the
region and not the face because grading changes the card and hides the answer in
the same update, so the face has to run its reverse rotation on the element it is
already on; remounting it would drop the flip-back. Keying on the flip instead
would be wrong the other way, throwing away your place every time you turned
over to read the question and back.

**Why the confirmation is not a native `<dialog>`.** A native dialog brings focus
trapping and <kbd>Esc</kbd> handling for free, but jsdom does not implement
`showModal`, so it could only be tested through the fallback path. Hand-rolling it
on `role="dialog"` keeps the whole behaviour under test.

**Why the build script is TypeScript.** Node strips types natively, so
`node scripts/build-cards.ts` runs with no compile step, and the validation
logic is still typechecked. It imports the card types from `src/lib/types.ts`,
so a change to that shape fails the build rather than producing a deck the app
cannot render.

**TypeScript is pinned to 5.x, not 7.x.** `typescript-eslint` declares support
for `>=4.8.4 <6.1.0` and depends on the JavaScript compiler API, which
TypeScript 7's native port does not provide. Moving to 7 would mean giving up
`just lint`.

**Code is injected as pre-rendered HTML.** Shiki output is trusted markup
generated from this repository's own `cards.json` during the build, so it is
inserted without sanitising. If cards ever become editable at runtime, that
field needs sanitising first — see the `CodeBlock.html` doc comment.
