# Changelog

All notable changes to this project will be documented in this file.

---

## [3.0.0] — 2026-02-18

### Breaking changes

- **Constructor API changed.** The four positional boolean parameters (`showProcess`, `showResult`, `saveResult` + no wallet version) are replaced by a single options object.

  ```js
  // v2.x (old)
  new TonWalletFinder('abc', true, true, false)

  // v3.x (new)
  new TonWalletFinder('abc', { showProcess: true, showResult: true, saveResult: false })
  ```

  All options are optional; defaults are unchanged.

### New features

- **WalletContractV5R1 support** — pass `{ walletVersion: 'v5r1' }` to generate V5R1 addresses. Default remains `'v4'`.
- **Worker Threads** — parallel address search across multiple CPU cores via `{ workers: N }` or `{ workers: 'auto' }` (uses all logical cores). Provides near-linear speedup for longer patterns.
- **Custom output filename** — `{ fileName: 'my_wallet.txt' }` controls where credentials are saved when `saveResult: true`.
- **Security warning** — a `console.warn` message is now printed to stderr whenever credentials are written to disk (`saveResult: true`).

### Fixes / improvements

- `sinon` updated to v21.0.1 to resolve `diff` DoS vulnerability (GHSA-73rr-hh4g-fpgx).
- All other transitive dependency vulnerabilities resolved via `npm audit fix` (axios, brace-expansion, form-data, js-yaml).
- **CI**: added `npm audit --audit-level=high` step to the GitHub Actions workflow.
- **Packaging**: added `.github/` to `.npmignore` so CI configuration is not bundled in the NPM package.

---

## [2.1.0] — 2026-02-17

### Fixed

- **BUG-01** `TypeError: words.join is not a function` in `saveResultsToFile()` when `saveResult: true`. Words array is now correctly joined with spaces; passing a pre-joined string is also handled safely.
- **BUG-02** `Cannot read properties of null` when accessing `require.main.filename` in ESM environments or when running under Mocha. Fixed with a safe fallback to `process.cwd()`.

### Added

- Full TypeScript declarations (`index.d.ts`) with `WalletResult` interface and JSDoc for all public members.
- Comprehensive test suite (Mocha + Chai + Sinon): 20 test cases covering constructor validation, key generation, wallet creation, integration search, BUG-01 regression, and file I/O.
- GitHub Actions CI workflow (Node 18, 20, 22).
- Bilingual README (English + Russian) with options table, API reference, performance benchmarks, and support links.

---

## [2.0.0] — 2025-xx-xx

Initial public release.
