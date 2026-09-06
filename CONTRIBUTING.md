# Contributing to ton-wallet-finder

Thank you for your interest in contributing!

---

## Development Setup

```sh
git clone https://github.com/lendel/ton-wallet-finder.git
cd ton-wallet-finder
npm install
```

**Requirements:** Node.js 20 or higher (matches `engines` in `package.json`). Develop on
Node.js 22 or 24 (LTS) — `.nvmrc` pins 22 for `nvm use`; CI runs the suite on 20, 22, 24 and 26. Node.js 20 is end-of-life
(30 April 2026) and is kept only until the next major release.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run check` | Everything CI runs: lint + typecheck + tests |
| `npm test` | Run the full test suite (Mocha, configured by `.mocharc.json`) |
| `npm run lint` | Run ESLint over the whole repository |
| `npm run typecheck` | Compile `index.d.ts` and `test/types.test-d.ts` with `tsc --noEmit` |

Run `npm run check` before opening a PR — CI runs the same three steps.

---

## Code Style

- All source code uses `'use strict'`
- ESLint runs the flat config in `eslint.config.js`: `@eslint/js` **recommended**
  plus `no-var`, `prefer-const`, `eqeqeq` (always), `curly`, `no-shadow`,
  `no-throw-literal`, `no-implicit-coercion`, `prefer-promise-reject-errors`,
  `require-atomic-updates` and `object-shorthand`
- Globals come from the `globals` package (`globals.node`, `globals.mocha`) — do not
  hand-maintain a globals list
- `npm run lint` lints **every** file in the repository (`eslint .`), the config file included
- Run `npm run check` before submitting a PR — CI will fail otherwise

---

## Testing

Tests live in `test/` (Mocha + Chai + Sinon):

| File | Covers |
|------|--------|
| `TonWalletFinder.test.js` | Constructor validation, single-threaded search, cancellation, `saveResultsToFile` |
| `workers.test.js` | Worker-thread pool (deterministic fake workers + real-thread integration) |
| `crypto.test.js` | Reference vectors for mnemonic → key → address, `cellHash`, `padBits`, `crc16` |
| `esm.test.mjs` | Package is importable from ES modules through the `exports` map |
| `types.test-d.ts` | Compile-time assertions on `index.d.ts` (not run by Mocha — see below) |

- Every new feature or bug fix must include a corresponding test
- All stubs must be restored (use `try/finally` with `stub.restore()`)
- Tests that involve real key generation carry `this.timeout(60000)` — this is intentional

### Dev-dependency policy

The package has **zero production dependencies** and that is a hard rule — new
functionality must be built on Node.js built-ins (`npm ls --omit=dev` must stay
empty). Dev dependencies are pinned to exact versions (no `^`, no `~`) so `npm ci`
and CI resolve identically; Dependabot proposes the bumps weekly
(`.github/dependabot.yml`).

`chai` is intentionally pinned to `4.3.7` and **must not be upgraded to v5+**.
Chai v5 dropped CommonJS support. Since this package is a pure CJS library and does
not use ESM, upgrading chai would break the test suite without any benefit — the
Dependabot config already ignores `chai >= 5`.

### Reference vectors

`test/crypto.test.js` pins the mnemonic → key → address derivation to a vector produced with `@ton/crypto` and `@ton/ton`. If you touch anything in the crypto or cell-hashing code and this test goes red, the change is wrong — do not update the vector to make it pass.

### Type-declaration test

`index.d.ts` is hand-written, so nothing derives it from the implementation — it can
drift silently. `test/types.test-d.ts` pins it: it imports the package **by name**
(so the `types` entries in the `exports` map are resolved the way a consumer's
TypeScript resolves them) and asserts each exported type with `expectType<T>()` and
`@ts-expect-error`. It is never executed; `npm run typecheck` compiles it with
`tsc --noEmit` under `strict` (plus `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess`) and both a wrong type *and* an `@ts-expect-error` that no
longer suppresses anything fail the build. Mocha does not pick it up — `.mocharc.json`
only loads `.test.js` / `.test.mjs`.

**Any change to the public API must touch `index.d.ts` and `test/types.test-d.ts`
together.**

### ESM regression test

`test/esm.test.mjs` imports the package **by name** (Node package self-reference) so the `exports` map in `package.json` is exercised exactly as a consumer would. Keep it green when changing `exports`.

---

## Pull Request Process

1. Fork the repository and create a feature branch
2. Write tests for your changes
3. Ensure `npm run check` passes (lint + typecheck + tests)
4. Update `index.d.ts` and `test/types.test-d.ts` if the public API changed
5. Update `CHANGELOG.md` under `[Unreleased]`
6. Open a PR against `master`

CI additionally packs the tarball and installs it into a scratch project
(the `Package contents` job), so a new runtime file that is missing from the
`files` whitelist in `package.json` fails the PR rather than the release.

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (`x.x.Z`): bug fixes, dependency updates, documentation
- **Minor** (`x.Y.0`): new features, new options, additive changes
- **Major** (`X.0.0`): breaking changes to the public API

Breaking changes include: changing parameter defaults, changing return types, removing exports.

---

## Release Process

Releases are published by CI only (`.github/workflows/publish.yml`), never from a laptop.

1. Merge the release PR into `master` (version bumped in `package.json`, `CHANGELOG.md` updated).
2. Tag and push:
   ```sh
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
3. The workflow checks that the tag matches `package.json`, runs lint + typecheck +
   tests + `npm audit` on Node.js 24, then `npm publish --provenance`.

### Authentication: npm trusted publishing (OIDC)

The workflow carries **no npm token**. npm authenticates the GitHub Actions run through
its OIDC identity, and the provenance attestation is generated automatically. This has to
be registered once on npmjs.com by a package maintainer:

1. Open <https://www.npmjs.com/package/ton-wallet-finder/access> → **Trusted Publisher**
   (also under the package's *Settings*).
2. Choose **GitHub Actions** and enter:
   - Organization or user: `lendel`
   - Repository: `ton-wallet-finder`
   - Workflow filename: `publish.yml`
   - Environment: leave empty
3. Delete the old `NPM_TOKEN` repository secret on GitHub — it is no longer used, and
   npm is phasing out publishing with tokens that bypass 2FA.

If a tagged run failed (for example before the trusted publisher was registered), fix the
cause and either move the tag to the fixed commit and push it again, or start the
workflow manually from the *Actions* tab (**Run workflow**) on `master`.

---

## Security

See [SECURITY.md](SECURITY.md). Please do not report vulnerabilities in public issues.
