# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

Tooling, CI and repository standards only. No public API and no runtime behaviour
changed: the only edit to a shipped source file is the module-private rename noted
under *Changed*, which the existing 103 tests cover unchanged.

### Added
- **Type-declaration tests.** `test/types.test-d.ts` asserts the whole public type surface
  of the hand-written `index.d.ts` (`expectType<T>()` + `@ts-expect-error`), importing the
  package by name so the `types` entries in the `exports` map resolve as a consumer's
  TypeScript resolves them. `npm run typecheck` compiles it with `tsc --noEmit` under
  `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Until now nothing
  verified that `index.d.ts` even parsed, let alone matched the implementation.
- `npm run check` — the three commands CI runs (lint, typecheck, test) in one script.
- `tsconfig.json` (type-checking only, `noEmit`; not published).
- `.mocharc.json` — the Mocha configuration is now explicit (`spec`, `extension`, `timeout`,
  `slow`) and `forbid-only` makes a stray `.only()` fail CI instead of silently skipping
  the rest of the suite.
- CI job **Package contents**: `npm pack`, install the tarball into a scratch project, then
  load it through both `require()` and `import`. A new runtime file missing from the `files`
  whitelist in `package.json` now fails the PR instead of shipping a broken release.
- `.github/workflows/codeql.yml` — CodeQL static analysis (`security-and-quality`) on pushes,
  PRs and weekly.
- `.github/dependabot.yml` — weekly npm and GitHub Actions updates, with `chai >= 5` ignored
  (it is ESM-only; see CONTRIBUTING.md).
- `.github/ISSUE_TEMPLATE/` (bug report, feature request, security contact link),
  `.github/pull_request_template.md`, `.github/CODEOWNERS`, `.nvmrc`.
- `publishConfig` (`access: public`, `provenance: true`) so a manual publish matches CI.

### Changed
- **ESLint config rebuilt on `@eslint/js` recommended.** The previous config hand-listed ten
  rules and a hand-maintained globals map that was missing `URL`, `TextEncoder`,
  `structuredClone`, `setInterval` and others — any future use of them would have tripped a
  spurious `no-undef`. Globals now come from the `globals` package, and the recommended set
  is layered with `no-shadow`, `no-implicit-coercion`, `prefer-promise-reject-errors`,
  `require-atomic-updates` and `object-shorthand`. Deprecated `no-return-await` dropped.
- `npm run lint` is now `eslint .` — it covers every file in the repository, including
  `eslint.config.js` and `wordlist.js`, which the explicit file list had missed.
- CI and publish workflows: top-level `permissions: contents: read`, `persist-credentials: false`
  on every checkout, per-job `timeout-minutes`, and a `concurrency` group on CI so a new push
  cancels the superseded run. Both workflows now run `npm run typecheck`.
- Dev dependencies are pinned to exact versions (`@eslint/js`, `globals`, `typescript`,
  `@types/node` added; all zero-dependency). Production dependencies remain **zero**.
- `.gitignore` now covers `*.tgz`, `coverage/` and — importantly — `ton_wallet_results*.txt`,
  the file `saveResult: true` writes private keys into.
- `SECURITY.md`: the supported-versions table still claimed 4.x was supported and did not
  mention 5.x at all. Corrected.
- The module-private address-dispatch function was renamed `walletAddress` →
  `deriveWalletAddress` to stop it shadowing the `walletAddress` local/parameter used
  throughout the class. `_internals.walletAddress` is unchanged — the export key, its
  signature and its behaviour are all the same.

---

## [5.1.1] — 2026-09-06

### Fixed
- `require('ton-wallet-finder/package.json')` (and the ESM equivalent) failed with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` because the `exports` map only listed `"."`. The map now
  also exposes `./package.json`, which bundlers, version checkers and other tooling read.
  No other subpath is exported; the public API is unchanged.

---

## [5.1.0] — 2026-09-06

### Added
- **Wallet version selection.** `walletVersion` now accepts `'v3r2'` and `'v5r1'` in addition
  to `'v4r2'` (still the default, so existing callers get exactly the same addresses as before).
  Different versions derive different addresses from the same mnemonic — pick the one matching
  the wallet software the mnemonic will be imported into.
  - `'v3r2'`: WalletV3R2 — data cell `seqno | subwallet_id | pubkey` (320 bits).
  - `'v5r1'`: WalletV5R1 (W5) — data cell `is_signature_allowed | seqno | wallet_id | pubkey |
    extensions` (322 bits); `wallet_id` is the mainnet client context (workchain 0, subwallet 0)
    XOR'ed with the network global id `-239`, as in `@ton/ton`.
- Worker threads receive `walletVersion` and derive the same address as the main thread.
- `_internals.walletAddress(version, publicKey)`, `_internals.walletV3R2Address`,
  `_internals.walletV5R1Address`.
- `test/crypto.test.js`: reference addresses for V3R2 and V5R1 for the existing reference
  mnemonic, produced with `@ton/ton` 16.3 (`WalletContractV3R2` / `WalletContractV5R1`,
  installed in a scratch directory — still not a project dependency). The code-cell hash and
  depth constants come from the same run.

### Changed
- `index.d.ts`: `WalletVersion` is `'v3r2' | 'v4r2' | 'v5r1'`.
- Address derivation refactored around a shared `StateInit` hashing helper; `walletV4Address`
  behaviour is unchanged (same reference vector).

---

## [5.0.0] — 2026-09-06

### Breaking Changes
- **Options-object constructor.** `TonWalletFinder(targetEnding, showProcess, showResult,
  saveResult)` is replaced by `TonWalletFinder(targetEnding, { showProcess, showResult,
  saveResult, workers, walletVersion })`. No positional-argument fallback — see the migration
  table below.
- **`workers` moved to the constructor.** It was a `findWalletWithEnding()`-only option since
  4.1.0; it is now also a constructor option that sets the default for every call on that
  instance. `findWalletWithEnding({ workers })` still accepts `workers` as a per-call override
  of the constructor default, exactly as `signal` already worked.

### Added
- `walletVersion` constructor option. Only `'v4r2'` (the existing, and now default, behaviour)
  is accepted for now — anything else throws at construction time. This reserves the option
  name and default so that adding `'v3r2'` / `'v5r1'` support later is an additive (minor)
  change, not another breaking one.
- `index.d.ts`: `TonWalletFinderOptions` interface and `WalletVersion` type; `workers` and
  `walletVersion` added as readonly instance properties on `TonWalletFinder`.

### Migration checklist

| v4.x position | v5.0.0 key |
|---|---|
| `new TonWalletFinder(targetEnding, showProcess, showResult, saveResult)` | `new TonWalletFinder(targetEnding, { showProcess, showResult, saveResult })` |
| `findWalletWithEnding({ workers })` (per-call only) | `new TonWalletFinder(targetEnding, { workers })` (default) or `findWalletWithEnding({ workers })` (per-call override, unchanged) |
| *(none)* | `walletVersion` — new, defaults to `'v4r2'` (only supported value for now) |

```js
// v4.x
new TonWalletFinder('abc', false, true, false);

// v5.0.0
new TonWalletFinder('abc', { showResult: true });
```

---

## [4.1.0] — 2026-09-06

### Added
- **Parallel search.** `findWalletWithEnding({ workers })` runs the search on N
  `worker_threads` (`'auto'` = one per CPU core) and resolves with the first match; all
  workers are terminated on match, abort or error. Throughput scales almost linearly with
  cores. Default stays `1` (single-threaded, unchanged behaviour). Ships as `worker.js`.
- `FindOptions.workers` in `index.d.ts`; README performance table now shows 1-core and
  8-core estimates.

### Changed
- CI matrix now covers Node.js 20, 22, 24 and 26; the publish workflow runs on Node.js 24
  (Active LTS). Node.js 20 reached end-of-life on 2026-04-30 and remains supported only until
  the next major release; README and CONTRIBUTING say so.
- `npm run lint` now also lints `worker.js`.
- `_internals` is declared in `index.d.ts`; `walletV4Address` and `cellHash` accept any
  `Uint8Array`, not only `Buffer`.
- Release process documented in CONTRIBUTING (tag-driven publish, trusted publishing).
- `publish.yml` switched to npm **trusted publishing** (OIDC): the `NPM_TOKEN` secret is
  no longer used (npm now rejects direct publishing with tokens that bypass 2FA). The
  workflow also verifies that the pushed tag matches `package.json` and can be started
  manually (`workflow_dispatch`).

### Documentation
- README: `saveResultsToFile`, `createKeyPair`, `createWallet` and `_internals` documented;
  cancellation errors described (`name: 'AbortError'`, `cause`); retry limit described;
  `targetEnding` length limit added to the options table; ES-module example added to the
  Russian section; the checksum is correctly named CRC-16/XMODEM (not CRC-16/CCITT); the
  migration table distinguishes the v3 and 4.0.1 return types of `saveResultsToFile`.
- The "network access" scanner note in the README no longer blames the funding links; the
  stale lock file that listed `axios` was the more likely cause and is gone since 4.0.1.

---

## [4.0.1] — 2026-09-06

### Fixed
- **ESM import was broken.** `import { TonWalletFinder } from 'ton-wallet-finder'` failed with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` because the `exports` map had no `import`/`default` condition
  (regression since 3.1.0). The map now lists `types`, `import`, `require` and `default`.
  A regression test (`test/esm.test.mjs`) imports the package by name.
- **`saveResultsToFile` no longer overwrites an existing file.** The file is created with the
  exclusive `wx` flag; if it already exists a numeric suffix is appended
  (`ton_wallet_results-2.txt`, `-3`, …). Previously a second run silently destroyed the
  previously found private key.
- **`saveResultsToFile` writes to the current working directory** (`process.cwd()`) instead of
  the directory of the process entry point (`require.main`), which could be inside
  `node_modules`, an `npx` cache or a read-only location. The function now returns the
  absolute path of the written file (`Promise<string | undefined>`).
- **`findWalletWithEnding` no longer retries forever.** After 5 consecutive generation
  failures it rejects with an Error whose `cause` is the last failure. Transient errors are
  still retried as before.
- Cancellation errors now have `name === 'AbortError'` and carry the original
  `signal.reason` as `cause`, so callers can distinguish cancellation from failure.
  The error message is unchanged.
- `targetEnding` longer than 46 characters is rejected at construction time: a TON address
  has only 46 matchable characters after the `EQ`/`UQ` tag, so such a search could never end.
- Removed redundant manual padding of the data cell (the `padBits` helper already does it);
  `Buffer.slice` replaced with `Buffer.subarray`.

### Added
- `test/crypto.test.js`: reference vector (mnemonic → public key → address) produced with
  `@ton/crypto` and `@ton/ton`, plus unit tests for `cellHash` (empty-cell hash), `padBits`,
  and `crc16` (CRC-16/XMODEM check value). Any regression in the hand-written crypto now fails
  the suite instead of producing a valid-looking address that does not belong to the mnemonic.
- `_internals` export exposing the low-level primitives for testing and advanced use
  (not yet covered by semver guarantees).
- `SECURITY.md` with private vulnerability reporting instructions and notes on key handling.

### Changed
- README performance table replaced with measured numbers (about 5 addresses/s per CPU core;
  the TON mnemonic derivation costs roughly 200 000 HMAC-SHA-512 rounds per candidate).
- `package-lock.json` regenerated; the previous lock still described version 3.2.1 with
  `@ton/ton` and `@ton/crypto` as dependencies, which polluted `npm audit` with packages
  that were not installed.
- Dev dependency `mocha` upgraded to 12.0.0 (fixes the `serialize-javascript` advisory;
  the `overrides` entry is no longer needed and was removed).
- CHANGELOG reordered chronologically; missing 3.2.1 entry added; release dates corrected.
- CONTRIBUTING now states Node.js 20 (matches `engines`) and points to `SECURITY.md`.
- Removed `.npmignore` (ineffective and misleading while `files` is set).
- `publish.yml`: least-privilege `permissions` on the test job.

### Infrastructure
- OpenSSF Scorecard workflow (weekly and on push to `master`), all actions pinned to
  verified commit SHAs; badge in README.

---

## [4.0.0] — 2026-03-24

### Breaking Changes
- **Zero production dependencies.** `@ton/ton` and `@ton/crypto` (and their 29 transitive packages) are completely removed. The package now installs with no dependencies at all.

### Changed
- Mnemonic generation and validation reimplemented using Node.js built-in `crypto` (HMAC-SHA-512, PBKDF2-SHA-512) and a bundled BIP-39 word list (`wordlist.js`)
- Ed25519 key derivation reimplemented using Node.js `crypto.createPrivateKey` with PKCS#8 DER seed wrapping — no `tweetnacl` required
- WalletV4R2 address computation reimplemented as a pure TVM cell-hash algorithm (SHA-256 repr) with a hardcoded code-cell hash/depth constant — no `@ton/core` required
- CRC-16/CCITT and base64url address encoding done via built-in `Buffer` — no external helpers
- `wordlist.js` (BIP-39, 2048 words, MIT) added to the published package files
- Minimum Node.js version raised to 20 (`engines`)

### Security
- `saveResultsToFile` now writes with `mode: 0o600` — the output file is no longer world-readable, preventing other local users from reading exported private keys

### Fixed
- Fixed dropped Promise / double-call pattern in null-options test
- Type validation added to `saveResultsToFile`: non-string `publicKey`, `privateKey`, or `walletAddress` now logs an error and returns early instead of writing malformed output

### Infrastructure
- ESLint now covers `test/` directory in addition to `index.js`
- `npm run lint` script updated to `eslint index.js test/`
- Added `AbortController` and `AbortSignal` globals to ESLint config for test files
- Added `no-throw-literal` and `curly` rules to ESLint config
- `FindOptions.signal` is now `readonly` in `index.d.ts`

---

## [3.2.2] — 2026-03-24

### Security
- All dependency versions pinned to exact values (removed `^` ranges) — eliminates
  semver drift risk; package installs are now reproducible at the manifest level,
  not just via the lockfile

---

## [3.2.1] — 2026-03-24

### Fixed
- Flaky `console.log` test stabilised by stubbing the crypto helpers

---

## [3.2.0] — 2026-03-24

### Added
- `Readme.md` is now included in the published npm package (`files` field)
- npm provenance attestation via `--provenance` flag on publish (verifiable on socket.dev and npmjs.com)

### Infrastructure
- GitHub Actions steps pinned to commit hashes with least-privilege permissions
- Automated npm publish workflow on `v*` tags

---

## [3.1.0] — 2026-03-24

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

## [3.0.0] — 2026-02-18

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
