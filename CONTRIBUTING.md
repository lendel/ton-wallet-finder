# Contributing to ton-wallet-finder

Thank you for your interest in contributing!

---

## Development Setup

```sh
git clone https://github.com/lendel/ton-wallet-finder.git
cd ton-wallet-finder
npm install
```

**Requirements:** Node.js 20 or higher (matches `engines` in `package.json`).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run the full test suite (Mocha) |
| `npm run lint` | Run ESLint on `index.js` and `test/` |

---

## Code Style

- All source code uses `'use strict'`
- ESLint enforces `no-var`, `prefer-const`, `eqeqeq` (always), `no-unused-vars`, `no-undef`
- Run `npm run lint` before submitting a PR — CI will fail otherwise

---

## Testing

Tests live in `test/TonWalletFinder.test.js` (Mocha + Chai + Sinon).

- Every new feature or bug fix must include a corresponding test
- All stubs must be restored (use `try/finally` with `stub.restore()`)
- Tests that involve real key generation carry `this.timeout(60000)` — this is intentional

### Dev-dependency note: Chai v4

`chai` is intentionally pinned to `^4.x` and **must not be upgraded to v5+**.
Chai v5 dropped CommonJS support. Since this package is a pure CJS library and does not use ESM, upgrading chai would break the test suite without any benefit.

### Reference vectors

`test/crypto.test.js` pins the mnemonic → key → address derivation to a vector produced with `@ton/crypto` and `@ton/ton`. If you touch anything in the crypto or cell-hashing code and this test goes red, the change is wrong — do not update the vector to make it pass.

### ESM regression test

`test/esm.test.mjs` imports the package **by name** (Node package self-reference) so the `exports` map in `package.json` is exercised exactly as a consumer would. Keep it green when changing `exports`.

---

## Pull Request Process

1. Fork the repository and create a feature branch
2. Write tests for your changes
3. Ensure `npm run lint` and `npm test` both pass
4. Update `CHANGELOG.md` under `[Unreleased]`
5. Open a PR against `master`

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (`x.x.Z`): bug fixes, dependency updates, documentation
- **Minor** (`x.Y.0`): new features, new options, additive changes
- **Major** (`X.0.0`): breaking changes to the public API

Breaking changes include: changing parameter defaults, changing return types, removing exports.

---

## Security

See [SECURITY.md](SECURITY.md). Please do not report vulnerabilities in public issues.
