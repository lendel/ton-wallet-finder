# Migration guide

**English** · [Русский](MIGRATION.ru.md)

How to upgrade between major versions of `ton-wallet-finder`. Every change, including minor
and patch releases, is listed in the [CHANGELOG](../CHANGELOG.md).

- [5.x → 6.0](#5x--60)
- [4.x → 5.x](#4x--5x)
- [3.x → 4.0](#3x--40)
- [2.x → 3.x / 4.x](#2x--3x--4x)

---

## 5.x → 6.0

**What's new:** encrypted results (`saveResult: { password }` and `decryptResults()`), a faster
search (the single-threaded default is up to ~4× faster; worker threads now scale past 4
cores), and Node.js 22+.

| What changed | 5.x | 6.0 |
|---|---|---|
| Node.js | `>=20` | `>=22` |
| CPU use with `workers: 1` | one PBKDF2 at a time | up to 4 concurrent PBKDF2 calls on libuv's pool (set `UV_THREADPOOL_SIZE=1` to restore the old behaviour) |
| `saveResultsToFile()` 5th argument | `fileName` string | `fileName` string **or** `{ fileName, password }` (the string form still works) |

No other API changes: addresses, defaults and result shapes are identical.

---

## 4.x → 5.x

**What's new:** 5.0 replaced the positional constructor arguments with an options object and
made `workers` a constructor default. 5.1 added wallet version selection (`walletVersion:
'v3r2' | 'v4r2' | 'v5r1'`). The default stays `'v4r2'`, so existing callers keep getting exactly
the same addresses.

> 5.0.0 was never published to npm on its own; 5.1.0 is the first 5.x release on npm.

| What changed | 4.x | 5.x |
|---|---|---|
| Constructor signature | `TonWalletFinder(targetEnding, showProcess, showResult, saveResult)` | `TonWalletFinder(targetEnding, { showProcess, showResult, saveResult, workers, walletVersion })` |
| `workers` | `findWalletWithEnding({ workers })` only, default `1` | Also a constructor option (sets the default); `findWalletWithEnding({ workers })` still overrides it per call |
| `walletVersion` | did not exist | New option, default `'v4r2'`; `'v3r2'` / `'v5r1'` accepted since 5.1.0 |

### Checklist

1. **Constructor call.** Move the trailing booleans into an options object. There is no
   positional fallback:
   ```js
   // 4.x
   new TonWalletFinder('abc', true, true, false);
   // 5.x
   new TonWalletFinder('abc', { showProcess: true, showResult: true });
   ```

2. **`workers`.** If you always passed the same value to every `findWalletWithEnding()` call,
   you can move it to the constructor instead:
   ```js
   // 4.x
   const finder = new TonWalletFinder('abc');
   await finder.findWalletWithEnding({ workers: 'auto' });
   // 5.x
   const finder = new TonWalletFinder('abc', { workers: 'auto' });
   await finder.findWalletWithEnding();
   ```
   If you want to keep passing `workers` per call, nothing needs to change: it still works as a
   per-call override.

3. **`walletVersion`.** Nothing to do: it defaults to `'v4r2'`, which is what 4.x always
   produced. Pass `'v3r2'` or `'v5r1'` only if that is the wallet type you will import the
   mnemonic into.

---

## 3.x → 4.0

**No code changes are required.** 4.0 removed every production dependency: earlier versions
relied on `@ton/ton` and `@ton/crypto`, which pulled in 31 transitive packages (including
`tweetnacl`, `@ton/core`, `axios` and `jssha`). Since 4.0, everything is implemented with
Node.js built-ins only:

| What | How |
|---|---|
| Mnemonic generation | `crypto` CSPRNG + bundled BIP-39 word list |
| HMAC-SHA-512 / PBKDF2-SHA-512 | `crypto.createHmac` / `crypto.pbkdf2` |
| Ed25519 key derivation | `crypto.createPrivateKey` with PKCS#8 seed wrapping |
| Wallet address | TVM cell hash (SHA-256) + CRC-16/XMODEM |

`npm install ton-wallet-finder` installs **0 additional packages**.

> 4.0.1 (ESM import fix, safe result file, bounded retries) was not published on its own;
> its fixes ship in 4.1.0.

---

## 2.x → 3.x / 4.x

| What changed | 2.x | 3.x / 4.x |
|---|---|---|
| `showResult` default | `true`: printed the private key to stdout by default | `false`: silent by default |
| `createWallet()` | returned `Promise<Address>` | returns `Address` synchronously |
| `saveResultsToFile()` | returned `void` (fire-and-forget) | 3.x: `Promise<void>`; 4.0.1+: `Promise<string \| undefined>`, the written path |

### Checklist

1. **`showResult`.** If you relied on the default console output, pass it explicitly:
   ```js
   // 2.x (implicit)
   new TonWalletFinder('abc');
   // 3.x / 4.x
   new TonWalletFinder('abc', false, true);
   ```

2. **`createWallet()`.** If you called it with `await`, remove the `await`:
   ```js
   // 2.x
   const address = await finder.createWallet(keyPair);
   // 3.x / 4.x
   const address = finder.createWallet(keyPair);
   ```

3. **`saveResultsToFile()`.** If you called it standalone, add `await`:
   ```js
   // 2.x
   saveResultsToFile(pub, priv, words, addr);
   // 3.x / 4.x
   await saveResultsToFile(pub, priv, words, addr);
   ```

After that, continue with [3.x → 4.0](#3x--40) and [4.x → 5.x](#4x--5x).
