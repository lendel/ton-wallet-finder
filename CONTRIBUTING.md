# Contributing to ton-wallet-finder

Thank you for your interest in contributing!

---

## Development Setup

```sh
git clone https://github.com/lendel/ton-wallet-finder.git
cd ton-wallet-finder
npm install
```

**Requirements:** Node.js 18 or higher.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run the full test suite (Mocha) |
| `npm run lint` | Run ESLint on `index.js` |

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

### Dev-dependency note: mocha vulnerabilities

`mocha@11.x` has known vulnerabilities in its own internal dependencies (`diff`, `serialize-javascript`). These are **upstream issues in mocha itself** and do not affect the published package — `npm audit --omit=dev` reports 0 vulnerabilities. The mocha team has not yet released a fix.

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

To report a security vulnerability, please open a [GitHub Issue](https://github.com/lendel/ton-wallet-finder/issues) with the `security` label, or contact the author directly.

Do not disclose security vulnerabilities publicly before a fix is available.
