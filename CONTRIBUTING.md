# Contributing to ton-wallet-finder

Thank you for your interest in contributing!

---

## Development Setup

```sh
git clone https://github.com/lendel/ton-wallet-finder.git
cd ton-wallet-finder
npm install
```

**Requirements:** Node.js 22.12 or higher for development (the test suite loads the ESM-only
`chai` through `require()`); the library itself supports Node.js 22+. `.nvmrc` pins the
recommended version (`nvm use`). CI runs the tests on Node.js 22, 24 and 26 on Linux, plus
Node.js 24 on macOS and Windows.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run the full test suite (Mocha) |
| `npm run lint` | Run ESLint on the repository |
| `npm run typecheck` | Compile-check `index.d.ts` against `test/types/index.test.ts` (TypeScript) |
| `npm run coverage` | Run the tests under c8 with coverage thresholds (`.c8rc.json`) |
| `npm run pack:check` | List exactly what would be published to npm |
| `npm run check` | Lint + typecheck + coverage — what CI runs; run it before every PR |

---

## Code Style

- All source code uses `'use strict'`
- ESLint enforces `no-var`, `prefer-const`, `eqeqeq` (always), `no-unused-vars`, `no-undef`
- Run `npm run lint` before submitting a PR — CI will fail otherwise

---

## Testing

Tests live in `test/` (Mocha + Chai + Sinon):

| File | Covers |
|------|--------|
| `TonWalletFinder.test.js` | Constructor validation, single-threaded search, cancellation, `saveResultsToFile` |
| `workers.test.js` | Worker-thread pool (deterministic fake workers + real-thread integration) |
| `crypto.test.js` | Reference vectors for mnemonic → key → address, `cellHash`, `padBits`, `crc16` |
| `encryption.test.js` | Encrypted results: round-trip, wrong password, tampering, file output |
| `esm.test.mjs` | Package is importable from ES modules through the `exports` map |
| `types/index.test.ts` | Type-level test of `index.d.ts` (compiled, never executed) |

- Every new feature or bug fix must include a corresponding test
- All stubs must be restored (use `try/finally` with `stub.restore()`)
- Tests that write real files must do so in a temporary directory (see `encryption.test.js`)
- Tests that involve real key generation carry `this.timeout(60000)` — this is intentional

### Reference vectors

`test/crypto.test.js` pins the mnemonic → key → address derivation to a vector produced with `@ton/crypto` and `@ton/ton`. If you touch anything in the crypto or cell-hashing code and this test goes red, the change is wrong — do not update the vector to make it pass.

### ESM regression test

`test/esm.test.mjs` imports the package **by name** (Node package self-reference) so the `exports` map in `package.json` is exercised exactly as a consumer would. Keep it green when changing `exports`.

---

## Documentation

| File | Contents |
|------|----------|
| `README.md` / `README.ru.md` | What the library is, install, quick start, options, API, performance — keep both languages in sync |
| `docs/MIGRATION.md` / `docs/MIGRATION.ru.md` | How to upgrade between major versions — add a section for every breaking release |
| `CHANGELOG.md` | Every change, per release (English only); becomes the GitHub Release notes |

The README is a landing page, not a changelog: put "what's new" in `CHANGELOG.md` and upgrade
steps in `docs/MIGRATION.md`. Code examples in the README must run as written.

---

## Pull Request Process

1. Fork the repository and create a branch named as below
2. Write tests for your changes
3. Ensure `npm run check` passes
4. Update `CHANGELOG.md` under `[Unreleased]`
5. Open a PR against `main`; the branch is deleted after merge

### Branch names

`<type>/<short-description>` in lowercase kebab-case, where `<type>` matches the
[Conventional Commits](https://www.conventionalcommits.org/) type of the change:

| Prefix | Use for | Example |
|--------|---------|---------|
| `feat/` | New features | `feat/encrypted-results` |
| `fix/` | Bug fixes | `fix/worker-threadpool-cap` |
| `perf/` | Performance work | `perf/main-thread-concurrency` |
| `docs/` | Documentation only | `docs/readme-performance-table` |
| `refactor/` | Code changes with no behaviour change | `refactor/split-lib-modules` |
| `test/` | Tests only | `test/encryption-tampering` |
| `ci/` | Workflows, Dependabot | `ci/codeql` |
| `chore/` | Tooling, dependencies, housekeeping | `chore/bump-eslint` |
| `release/` | Release preparation | `release/v6.0.0` |

Add an issue number when there is one: `fix/123-abort-latency`. Branches created by bots
(`dependabot/…`) keep their own naming.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, with
`!` or a `BREAKING CHANGE:` footer for breaking changes (`build!: require Node.js 22`).

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

1. Merge the release PR into `main` (version bumped in `package.json`, `CHANGELOG.md` updated).
2. Tag and push:
   ```sh
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
3. The workflow checks that the tag matches `package.json`, runs `npm run check` on
   Node.js 24, then `npm publish --provenance`.
4. When the publish succeeds, `.github/workflows/release.yml` creates the GitHub Release
   for the tag, with that version's `CHANGELOG.md` section as the notes — so write the
   changelog entry with release readers in mind. To create a missing release for an
   already published tag, run **GitHub Release** manually from the *Actions* tab with the tag.

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
workflow manually from the *Actions* tab (**Run workflow**) on `main`.

---

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md). Please do not report vulnerabilities in public issues.
