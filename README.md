# TON Wallet Finder

[![npm version](https://img.shields.io/npm/v/ton-wallet-finder?color=crimson&style=flat-square)](https://www.npmjs.com/package/ton-wallet-finder)
[![npm downloads](https://img.shields.io/npm/dm/ton-wallet-finder?style=flat-square)](https://www.npmjs.com/package/ton-wallet-finder)
[![CI](https://img.shields.io/github/actions/workflow/status/lendel/ton-wallet-finder/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/lendel/ton-wallet-finder/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/ton-wallet-finder?style=flat-square)](https://nodejs.org/)
[![types](https://img.shields.io/npm/types/ton-wallet-finder?style=flat-square)](index.d.ts)
[![license](https://img.shields.io/npm/l/ton-wallet-finder?color=green&style=flat-square)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lendel/ton-wallet-finder/badge?style=flat-square)](https://scorecard.dev/viewer/?uri=github.com/lendel/ton-wallet-finder)

**Vanity address generator for the TON blockchain** — a command-line tool and a Node.js library.
Generates fresh wallets until one has an address ending with the string you choose — for example
`EQ…cafe`.

**English** · [Русский](README.ru.md)

## Why this library

- **Zero dependencies, zero network calls.** Only Node.js built-ins (`crypto`, `fs`, `os`,
  `path`, `worker_threads`) — check with `grep require index.js worker.js`.
- **Verifiable releases.** Every npm version is published from CI with a
  [provenance attestation](https://docs.npmjs.com/generating-provenance-statements).
- **Correct addresses.** Key derivation and address hashing are pinned to reference vectors
  produced with `@ton/crypto` and `@ton/ton`, for wallet versions v3r2, v4r2 and v5r1.
- **Uses every core.** Parallel search on worker threads, cancellable with an `AbortSignal`.

## ⚠️ Safety first

This library creates **real private keys**. Treat its output like cash.

- Run it on a machine you trust, not in CI or a shared environment.
- Keep `showResult` off wherever stdout is logged.
- Prefer `saveResult: { password }` (an encrypted file) over plain-text `saveResult: true`.
- **Before sending any funds**, import the 24 words into your wallet app and check that it
  shows exactly the address you found (see [Wallet versions](#wallet-versions)).

The software is provided "as is", without warranty of any kind (see [LICENSE](LICENSE)).

## Install

```sh
npm install ton-wallet-finder        # as a library
npx ton-wallet-finder --help         # or run the command line tool without installing
```

Requires **Node.js 22** or newer.

## Command line

```sh
npx ton-wallet-finder abc --wallet v5r1
```

The tool asks for a password **before** the search starts, shows live progress (attempts,
speed, expected time) and saves the result to an encrypted `ton_wallet_results.enc.json`. The
mnemonic is not printed unless you pass `--show`. Read the file back later with:

```sh
npx ton-wallet-finder --decrypt ton_wallet_results.enc.json
```

| Option | Description |
|---|---|
| `-w, --wallet <v3r2\|v4r2\|v5r1>` | Wallet contract (default `v4r2`); must match your wallet app — Tonkeeper and Telegram Wallet use `v5r1` |
| `-j, --workers <n\|auto>` | Worker threads (default `auto`: one per CPU core) |
| `-o, --output <file>` | File name in the current directory |
| `--password-env <VAR>` | Take the password from an environment variable instead of asking (for scripts) |
| `--plain` | Save as plain text instead of encrypting |
| `--no-save --show` | Only print the result, write no file |
| `--decrypt <file>` | Print the wallet stored in an encrypted file |
| `-q, --quiet` | No progress line |

Ctrl+C stops the search cleanly (exit code 130). Exit codes: `0` found, `1` error, `2` invalid
usage. `npx ton-wallet-finder --help` lists everything.

## Library quick start

```js
import { TonWalletFinder } from 'ton-wallet-finder';

const password = process.env.WALLET_FILE_PASSWORD;   // never hard-code it
if (!password) throw new Error('Set WALLET_FILE_PASSWORD first');

// The address alphabet is base64url, so matching is case-sensitive: 'abc' ≠ 'ABC'.
const finder = new TonWalletFinder('abc', {
  walletVersion: 'v5r1',          // must match your wallet app
  workers: 'auto',                // use every CPU core
  saveResult: { password },       // → encrypted ton_wallet_results.enc.json
});

const { walletAddress } = await finder.findWalletWithEnding();
console.log('Found:', walletAddress);
```

CommonJS works too: `const { TonWalletFinder } = require('ton-wallet-finder');`

## Wallet versions

| `walletVersion` | Contract | Notes |
|---|---|---|
| `'v3r2'` | WalletV3R2 | Legacy contract, still importable in most wallets |
| `'v4r2'` | WalletV4R2 | **Default.** Same addresses as every previous release |
| `'v5r1'` | WalletV5R1 (W5) | Current default in Tonkeeper, MyTonWallet and others. Mainnet wallet id, subwallet 0 |

> **The same mnemonic gives a different address for every version.** The address you find
> exists only for the version you searched with, so `walletVersion` must match the wallet app
> you will import the words into. If unsure, check which address your wallet shows for an
> existing seed phrase.

## Options

```js
new TonWalletFinder(targetEnding, { showProcess, showResult, saveResult, workers, walletVersion });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `targetEnding` | `string` | required | Desired address ending: Latin letters, digits, `-`, `_`; at most 46 characters. **Case-sensitive.** |
| `showProcess` | `boolean` | `false` | Log every attempted address |
| `showResult` | `boolean` | `false` | Log the found keys and mnemonic. **Keep off where output is logged.** |
| `saveResult` | `boolean \| { password?, fileName? }` | `false` | Save the result in the current directory: `true` → plain-text `ton_wallet_results.txt`; `{ password }` → encrypted `ton_wallet_results.enc.json` ([details](#encrypted-results)). Never overwrites — adds `-2`, `-3`, … |
| `workers` | `number \| 'auto'` | `1` | Worker threads for the search; `'auto'` = one per CPU core. Can be overridden per call |
| `walletVersion` | `'v3r2' \| 'v4r2' \| 'v5r1'` | `'v4r2'` | Wallet contract to derive the address for ([see above](#wallet-versions)) |

Invalid options throw at construction time.

## API

### `finder.findWalletWithEnding([options]) → Promise<Result>`

Generates wallets until one matches and resolves with:

| Field | Type | Description |
|---|---|---|
| `walletAddress` | `string` | Bounceable, URL-safe address (`EQ…abc`) |
| `words` | `string[]` | 24-word TON mnemonic |
| `publicKey` | `string` | Ed25519 public key, hex |
| `privateKey` | `string` | Ed25519 secret key (seed ‖ public key), hex |

`options.signal` cancels the search; `options.workers` overrides the constructor's `workers`
for this call; `options.onProgress(attempts)` is called after every attempted address with the
running total across all workers (for progress bars):

```js
const controller = new AbortController();
setTimeout(() => controller.abort('timeout'), 60_000);

try {
  await finder.findWalletWithEnding({ signal: controller.signal, workers: 4 });
} catch (err) {
  if (err.name === 'AbortError') console.log('Cancelled:', err.message); // err.cause === signal.reason
}
```

If key generation fails 5 times in a row, the promise rejects with the last error as `cause`
instead of retrying forever.

### `saveResultsToFile(publicKey, privateKey, words, walletAddress, [options]) → Promise<string | undefined>`

Writes a result to the **current working directory** with file mode `0600` — this is what
`saveResult` uses. `options` is a plain file name or `{ fileName?, password? }`; with a
password the file is encrypted — and if the `password` key is present but empty or
`undefined` (say, an unset environment variable), nothing is written: there is no silent
fall-back to plain text. Never overwrites (adds a numeric suffix), rejects path
separators in `fileName`, and resolves with the absolute path written — or `undefined` if
writing failed (the error is logged, never thrown).

### `decryptResults(data, password) → Promise<Result>`

Reads an encrypted results file back. `data` is the file content (`string` or `Buffer`).
Rejects on a wrong password, a modified file or an unknown format.

### Encrypted results

```js
import { readFileSync } from 'node:fs';
import { decryptResults } from 'ton-wallet-finder';

const wallet = await decryptResults(readFileSync('ton_wallet_results.enc.json'), password);
```

The key is derived with **scrypt** (N = 2¹⁷, r = 8, p = 1, random 16-byte salt) and the data is
encrypted with **AES-256-GCM** (random 12-byte IV, format header authenticated), using only
Node.js `crypto`. Nothing secret — not even the address — is stored in the clear. Encryption is
only as strong as the password: use a long random one, never hard-code it, and delete the file
once the wallet is in your wallet app.

### Lower-level API

- `finder.createKeyPair()` → `Promise<{ keyPair: { publicKey, secretKey }, words }>` — a fresh
  mnemonic and its Ed25519 key pair.
- `finder.createWallet(keyPair)` → object whose `toString()` returns the address for the
  configured `walletVersion` (synchronous).
- `_internals` — the cryptographic primitives behind these, exported for testing and advanced
  use; **not covered by semver**.

TypeScript declarations ship with the package ([`index.d.ts`](index.d.ts)).

## Performance

Each extra character multiplies the work by **64** (the base64url alphabet), so an
*n*-character ending takes **64ⁿ** attempts on average. Every attempt is deliberately
expensive — a TON mnemonic costs about 200 000 HMAC-SHA-512 rounds — so expect roughly
**8–10 addresses per second per CPU core**.

| Ending length | Attempts (avg) | 1 core (~8/s) | 8 cores (~64/s) |
|---|---|---|---|
| 1 char | 64 | ~8 seconds | ~1 second |
| 2 chars | 4 096 | ~9 minutes | ~1 minute |
| 3 chars | 262 144 | ~9 hours | ~1 hour |
| 4 chars | 16 777 216 | ~3.5 weeks | ~3 days |

Estimate: `time ≈ 64ⁿ / (8 × cores)` seconds. Runs vary widely (the number of attempts is
geometrically distributed), so treat these as medians.

- `workers: 1` (default) keeps JavaScript on the main thread but runs several attempts at
  once, so PBKDF2 uses up to 4 cores through libuv's thread pool (`UV_THREADPOOL_SIZE`).
- `workers: 'auto'` or a number spreads the search over worker threads and scales with cores.

## Upgrading

Coming from an older major version? See the [migration guide](docs/MIGRATION.md).
Every change is listed in the [CHANGELOG](CHANGELOG.md).

## Contributing and security

- Bug reports and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
  [Code of Conduct](CODE_OF_CONDUCT.md).
- **Security issues:** please report them privately, as described in [SECURITY.md](SECURITY.md).
  If this library and a TON wallet ever disagree on the address for a mnemonic, that is a
  security bug.

## Support the author

If this library saved you time, a small thank-you goes a long way 💙

- **TON:** `UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau` —
  [Tonkeeper](https://app.tonkeeper.com/transfer/UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau?text=Thank%20you%20for%20ton-wallet-finder!) ·
  [Tonhub](https://tonhub.com/transfer/UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau?text=Thank%20you%20for%20ton-wallet-finder!)
- [PayPal](https://www.paypal.me/lendelkz) · [Buy Me a Coffee](https://www.buymeacoffee.com/voanerges) · [Ko-fi](https://ko-fi.com/voanerges)

## License

[MIT](LICENSE) © [Lendel](https://github.com/lendel)
