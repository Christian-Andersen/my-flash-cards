# CLI contract. See the repo-standards skill for the full spec.
#
#   just audit   read-only dependency/vulnerability audit
#   just c       fast pre-commit gate: format check, lint, typecheck
#   just t       full test suite
#   just r       dev server
#   just ci      c then t — what CI runs

alias c := check
alias t := test
alias r := run

set shell := ["bash", "-uc"]

# `cards` must run first: src/generated/cards.ts is gitignored, so on a fresh
# clone it does not exist and the type-aware lint rules cannot resolve it.
#
# The fast pre-commit gate: format check, lint, typecheck.
check: cards fmt-check lint
    npm run typecheck
    @echo "check: ok"

ci: check test
    @echo "ci: ok"

test:
    npm run test

# Vite is the real entrypoint for this app; nothing else starts it.
run: cards
    npm run dev

# Read-only: never installs or upgrades anything. npm has no built-in license
# audit, so wiring one up would mean a new dependency; that is not done here.
#
# Dependency, vulnerability, and outdated-package audit.
audit:
    npm audit --audit-level=high
    @echo "--- outdated (informational) ---"
    npm outdated || true

lint:
    npm run lint

fmt:
    npm run fmt

fmt-check:
    npm run fmt-check

# Regenerate src/generated/cards.ts from cards.json.
cards:
    npm run cards

# Production build. The deploy job in .forgejo/workflows/ci.yml consumes this.
build: cards
    npm run build

clean:
    rm -rf dist coverage src/generated
