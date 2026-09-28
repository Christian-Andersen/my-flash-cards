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
- **Progress tracking** — a stacked bar of got-it / missed / unvisited counts,
  persisted to `localStorage` so a reload resumes the session.
- **Known cards retire** — a card graded `got it` leaves the deck, so the deck
  is always exactly what you have not got right yet. `missed` cards stay in, and
  the counter shrinks as you work through it.
- **Shuffled, and de-clustered** — the deck is dealt in a random order that stays
  fixed for the session, then spread so two cards from the same subject rarely
  land back to back. A plain shuffle of this deck still averages about nine
  adjacent same-category pairs out of 57; spreading cuts that to well under one.
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

The repo pins its toolchain with Nix and `direnv`, so `cd`ing in is enough:

```sh
direnv allow   # once, to activate the flake
just r         # http://localhost:5173
```

Without Nix, `npm install` is enough; only `just` is a convenience.

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
- **`accent`** is one of `amber`, `emerald`, `rose`, `sky`, `teal`, `violet`.
- **`back`** is a list of `text` and `code` blocks. In `text` blocks, wrapping
  a word in backticks renders it as inline code.
- **`language`** is any Shiki language id, e.g. `ts`, `python`, `nix`, `bash`.

The build validates all of this and reports every problem at once, so a typo
in a card fails the build with a message pointing at the exact field rather
than rendering a broken card.

Generated output lives in `src/generated/` and is gitignored — it is a build
artifact, not a source file.

## Continuous integration

`.forgejo/workflows/ci.yml` runs the same gate locally and remotely:

1. **`ci`** — `npm ci` then `just ci` (format, lint, typecheck, tests).
2. **`update-and-deploy`** — only after `ci` passes: `npm ci`, `just build`,
   create the Pages project if it is missing, then `wrangler pages deploy
./dist`.

Everything runs inside `nix develop`, so CI and local development share one
pinned toolchain. `flake.lock` is committed, so the `nixpkgs` revision is the
same on every machine and every run.

The deploy uses the separate `deploy` dev shell, which adds `wrangler` from
the pinned flake. It is kept out of the default shell so `just r` does not
pull a tool only CI needs. Calling the pinned binary also means the deploy is
reproducible, rather than resolving whatever `npx` fetches at run time.

Both jobs need the two secrets `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`, configured under **Settings → Actions → Secrets** in
your Forgejo instance. The Pages project name is taken from the repository
name; change it in the workflow if the project differs. The first run creates
the project, with `main` as the production branch to match the push trigger.
Later runs see it exists and skip straight to deploying.

## Deploying to Cloudflare Pages

Connect the repository in the Cloudflare dashboard with:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

Or use `just build`, which runs the card generator first. The Node version
must be 22 or newer; `engines` in `package.json` records that.

If you would rather let Forgejo do the deploying, the workflow above already
does it and you do not need a Pages build config at all.

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
    ConfirmDialog.tsx      modal confirmation with a focus trap
    SettingsView.tsx       category toggles and the keyboard reference
    StudyControls.tsx      previous / next / reset
    ProgressBar.tsx        the graded / unvisited bar
  lib/
    types.ts               the shape of the generated card data
    study.ts               pure reducer: grading, queueing, filtering, progress
    shuffle.ts             seeded shuffle and category spreading
    storage.ts             localStorage load/save, with validation
    keyboard.ts            the shortcut guards shared by both key handlers
    deck.ts                runtime lookups over the generated deck
  test/app.test.tsx        end-to-end study flow in jsdom
  generated/               build output (gitignored)
```

`study.ts` holds the rules and is pure, so the grading, retirement, filtering and
queue behaviour is tested without rendering anything. `app.test.tsx` then covers
the same flow through the real DOM.

## Notes on a couple of decisions

**Why the order is seeded rather than random per render.** The cursor is an index
into the queue, so an order that reshuffled on every render would point at a
different card each time and make the stored cursor meaningless. A seed in
`localStorage` gives a fresh order per session that survives a reload. The same
seed always produces the same order, which is also what makes the shuffle
testable without stubbing `Math.random`.

**Why the storage key is still `v1`.** The payload has changed shape more than
once — the missed-only filter came and went, then `seed` and `hidden` were
added — but `loadStudy` reads each field defensively and defaults whatever is
missing or malformed, so an older session still restores. Bumping the key would
discard real progress to buy nothing. A session saved before the seed existed
comes back in a new random order, which is a reasonable thing to happen the first
time the new build runs.

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
