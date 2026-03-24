# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1.0] — 2025-03-24

### Added
- ESLint (`eslint.config.js`) with rules: `no-unused-vars`, `no-undef`, `eqeqeq`, `no-var`, `prefer-const`
- `"lint"` npm script (`eslint index.js`)
- `"exports"` field in `package.json` for modern Node.js subpath resolution
- `"sideEffects": false` for bundler tree-shaking
- `"funding"` field in `package.json` (Tonkeeper, PayPal, Ko-fi)
- `CHANGELOG.md`, `CONTRIBUTING.md`, `.editorconfig`
- ESLint and `npm audit` steps in CI pipeline

### Changed
- `@ton/ton` upgraded from `^15.2.1` to `^16.2.2` (API-compatible, all tests pass)
- `mocha` upgraded from `^10` to `^11.7.5`
- `sinon` upgraded from `^19` to `^21.0.3`
- Removed `--exit` flag from mocha — process now exits cleanly on its own
- `"author"` changed from plain string to object `{ name, url }`
- `"description"` updated to better reflect the library's purpose
- `"keywords"` expanded with `base64url`, `ed25519`, `seed-phrase`, `toncoin`, `cryptography`
- LICENSE copyright year updated to 2023–2025
- Switched from `.npmignore` denylist to explicit `"files"` allowlist in `package.json`

### Fixed
- `!=` coercion operator replaced with `!==` (caught by ESLint `eqeqeq`)
- `.github/workflows/ci.yml` was erroneously included in the published npm tarball — resolved by `"files"` allowlist
- CRITICAL vulnerability in `form-data` (transitive via `@ton/ton`) resolved by `npm audit fix`
- HIGH vulnerability in `axios` (transitive via `@ton/ton`) resolved by `npm audit fix`

### Security
- Published package now has **0 vulnerabilities** (`npm audit --omit=dev`)
- Remaining 3 vulnerabilities are in `mocha`'s own devDependencies (`diff`, `serialize-javascript`) — upstream issue in mocha; does not affect package consumers

---

## [3.0.0] — 2025-03-24

### Breaking Changes
- `showResult` parameter default changed from `true` to `false` — library is now silent by default; private keys are not printed to stdout unless explicitly requested
- `createWallet()` is now **synchronous** — no longer returns a `Promise`; remove any `await` on this call
- `saveResultsToFile()` now returns `Promise<void>` instead of `void`; always `await` it to ensure the file is written before process exit

### Added
- `AbortSignal` support in `findWalletWithEnding({ signal })` — enables cancelling long-running searches
- Path traversal protection in `saveResultsToFile` — `fileName` with path separators is rejected
- `"engines": { "node": ">=18" }` in `package.json`
- TypeScript `FindOptions` interface with `signal?: AbortSignal`
- `fail-fast: false` in GitHub Actions CI matrix
- `'use strict'` directive in `index.js`

### Fixed
- `findWalletWithEnding(null)` no longer throws `TypeError` (safe options destructuring)
- Unconditional `console.log('The search is over.')` removed — library is truly silent when `showResult=false`
- Dead code: removed unreachable `err.name === 'AbortError'` guard in catch block
- `address.toString()` called twice per found wallet — eliminated duplicate call
- Regex `/^[a-zA-Z0-9-_]+$/` — dash moved to end of character class (`/^[a-zA-Z0-9_-]+$/`) to avoid ambiguous range

### Changed
- All Russian-language comments in `index.js` translated to English
- `fs.writeFile` (callback-based) replaced with `fs.promises.writeFile` — data is never lost on fast process exit
- Performance table corrected: base64url alphabet has **64** possible values per character position (not 32)
- CI matrix: `fail-fast: false` added
- Sinon stub in error-path test now explicitly restored via `stub.restore()`

### Security
- `showResult` now defaults to `false` to prevent accidental private key exposure in shared/logged environments

---

## [2.1.0] — 2024

### Fixed
- BUG-01: `words.join is not a function` — `words` array correctly handled in `saveResultsToFile`
- BUG-02: `require.main` null guard for ESM and test framework environments

### Added
- TypeScript type declarations (`index.d.ts`)
- CI/CD pipeline (GitHub Actions, Node.js 18 / 20 / 22)
- Test suite (Mocha + Chai + Sinon, 27 tests)

---

## [2.0.0] — 2023

Initial public release using `@ton/ton` and `@ton/crypto`.
