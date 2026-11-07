# CLAUDE.md

Guidance for Claude Code sessions working in this repository. Human contributors: see
[CONTRIBUTING.md](CONTRIBUTING.md) — this file only summarises it.

## Git

- Default branch: `main`. Never push to it directly; open a PR.
- **Branch names:** `<type>/<short-kebab-description>`, type = Conventional Commits type:
  `feat/`, `fix/`, `perf/`, `docs/`, `refactor/`, `test/`, `ci/`, `chore/`, `release/vX.Y.Z`.
  Examples: `feat/encrypted-results`, `fix/123-abort-latency`. Do not create `claude/…` branches.
  If the session was assigned a `claude/…` branch, ask the user before pushing to a
  differently named one.
- **Commits:** Conventional Commits (`type(scope): summary`, `!` for breaking changes).
- Never commit `ton_wallet_results*` files, private keys or mnemonics.

## Commands

- `npm ci` — install (Node.js 22.12+; `.nvmrc` pins 24)
- `npm run check` — lint + typecheck + tests with coverage; must pass before every push
- `npm test` — tests only; `npm run pack:check` — what would be published

## Rules

- Zero runtime dependencies: only Node.js built-ins in `index.js` / `worker.js`.
- `test/crypto.test.js` reference vectors must never be edited to make a test pass.
- Public API changes: update `index.d.ts`, `test/types/index.test.ts`, `README.md` + `README.ru.md`
  (and `docs/MIGRATION*.md` for breaking changes) and
  `CHANGELOG.md` under `[Unreleased]`.
