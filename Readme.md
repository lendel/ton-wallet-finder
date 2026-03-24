# TON Wallet Finder

<div align="center">

![npm version](https://img.shields.io/npm/v/ton-wallet-finder?color=crimson&style=flat-square)
![npm downloads](https://img.shields.io/npm/dy/ton-wallet-finder?color=blue&style=flat-square)
![license](https://img.shields.io/npm/l/ton-wallet-finder?color=green&style=flat-square)
![CI](https://img.shields.io/github/actions/workflow/status/lendel/ton-wallet-finder/ci.yml?label=CI&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue?style=flat-square&logo=typescript)
![issues](https://img.shields.io/github/issues/lendel/ton-wallet-finder?style=flat-square)

**Vanity address generator for TON blockchain.**
Find a wallet whose address ends with any string you choose.

[English](#-installation) · [Русский](#установка)

</div>

---

**Security: 0 dependencies, 0 network calls. Verified pure logic. The "Network access" flag in some scanners is a false positive caused by the funding links in package.json.**

---

## Table of Contents

- [Installation](#-installation)
- [Quick Start](#quick-start)
- [Options](#options)
- [API](#api)
- [Performance](#performance)
- [What's new in v4](#-whats-new-in-v4)
- [Migration from v2/v3](#-migration-from-v2v3)
- [Support the Author](#-support-the-author)
- [License](#license)

---

## 📦 Installation

```sh
npm install ton-wallet-finder
```

> Requires Node.js 20 or higher.

---

## Quick Start

```javascript
const { TonWalletFinder } = require('ton-wallet-finder');

// Note: the address alphabet is base64url — matching is case-sensitive.
// 'abc' and 'ABC' are different patterns.
const finder = new TonWalletFinder('abc');

finder.findWalletWithEnding()
  .then(({ publicKey, privateKey, words, walletAddress }) => {
    console.log('Found:', walletAddress);
    // Store publicKey, privateKey and words securely — do NOT log them
    // in shared or CI environments.
  })
  .catch(console.error);
```

Run:

```sh
node findWallet.js
```

---

## Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetEnding` | `string` | required | Desired address ending. Latin letters, digits, `-`, `_`. **Case-sensitive.** |
| `showProcess` | `boolean` | `false` | Log each attempted address to console |
| `showResult` | `boolean` | `false` | Log found wallet details to console. **Keep `false` in shared/logged environments to avoid exposing private keys.** |
| `saveResult` | `boolean` | `false` | Save result to `ton_wallet_results.txt` |

---

## API

### `findWalletWithEnding([options]) → Promise<Result>`

Generates wallets until one matches the target ending. Returns:

| Field | Type | Description |
|-------|------|-------------|
| `publicKey` | `string` | Public key (hex) |
| `privateKey` | `string` | Private key (hex) |
| `words` | `string[]` | 24-word mnemonic seed phrase |
| `walletAddress` | `string` | TON address (e.g. `EQa...abc`) |

**Cancellation** — pass an `AbortSignal` to stop the search at any time:

```javascript
const controller = new AbortController();
setTimeout(() => controller.abort('timeout'), 30_000); // cancel after 30 s

try {
  const result = await finder.findWalletWithEnding({ signal: controller.signal });
} catch (err) {
  console.log('Search cancelled:', err.message);
}
```

TypeScript declarations are included (`index.d.ts`).

---

## Performance

Search time grows exponentially with ending length. Rough estimates on a modern CPU:

| Ending length | ~Attempts | ~Time |
|--------------|-----------|-------|
| 1 char | ~64 | instant |
| 2 chars | ~4 000 | seconds |
| 3 chars | ~260 000 | minutes |
| 4 chars | ~16 000 000 | hours |

> The TON address alphabet is base64url (A–Z, a–z, 0–9, `-`, `_`), so each character position has **64** possible values.

---

## 🚀 What's new in v4

Version 4.0.0 completely eliminates all production dependencies.

Previous versions relied on `@ton/ton` and `@ton/crypto`, which pulled in a chain of **31 transitive packages** (including `tweetnacl`, `@ton/core`, `axios`, `jssha`, and others).

Starting with v4, everything is implemented using **Node.js built-in modules only**:

| What | How |
|------|-----|
| Mnemonic generation | `crypto.randomBytes` + bundled BIP-39 word list |
| HMAC-SHA-512 / PBKDF2-SHA-512 | `crypto.createHmac` / `crypto.pbkdf2` |
| Ed25519 key derivation | `crypto.createPrivateKey` with PKCS#8 seed wrapping |
| WalletV4R2 address | TVM cell hash (SHA-256) + CRC-16/CCITT via `Buffer` |

**Result:** `npm install ton-wallet-finder` now installs **0 additional packages**.
The public API is identical — no code changes required when upgrading from v3.

---

## 🔀 Migration from v2/v3

### v2/v3 → v4 breaking changes

| What changed | v2 behaviour | v3 behaviour |
|---|---|---|
| `showResult` default | `true` — printed private key to stdout by default | `false` — silent by default |
| `createWallet()` | returned `Promise<Address>` | returns `Address` synchronously |
| `saveResultsToFile()` | returned `void` (fire-and-forget) | returns `Promise<void>` (awaited) |

### Migration checklist

1. **`showResult`** — if you relied on the default console output, pass `showResult: true` explicitly:
   ```js
   // v2 (implicit)
   new TonWalletFinder('abc');
   // v3 equivalent
   new TonWalletFinder('abc', false, true);
   ```

2. **`createWallet()`** — if you called it with `await`, remove the `await`:
   ```js
   // v2
   const address = await finder.createWallet(keyPair);
   // v3
   const address = finder.createWallet(keyPair);
   ```

3. **`saveResultsToFile()`** — if you called it standalone, add `await`:
   ```js
   // v2
   saveResultsToFile(pub, priv, words, addr);
   // v3
   await saveResultsToFile(pub, priv, words, addr);
   ```

---

## 💖 Support the Author

If this library saved you time — a small thank-you goes a long way!

<div align="center">

### 💎 TON

`UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau`

[![Donate via Tonkeeper](https://img.shields.io/badge/Donate-Tonkeeper-0088CC?style=for-the-badge&logo=telegram&logoColor=white)](https://app.tonkeeper.com/transfer/UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau?text=Thank%20you%20for%20ton-wallet-finder!)
[![Donate via Tonhub](https://img.shields.io/badge/Donate-Tonhub-2F80ED?style=for-the-badge&logo=telegram&logoColor=white)](https://tonhub.com/transfer/UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau?text=Thank%20you%20for%20ton-wallet-finder!)

---

### 💳 Other ways

[![PayPal](https://img.shields.io/badge/PayPal-lendelkz-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.me/lendelkz)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-lendelkz-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/lendelkz)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-lendelkz-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/voanerges)

</div>

Thank you for your support! 💙

---

## Русский

<details>
<summary>Документация на русском языке</summary>

### Установка

```sh
npm install ton-wallet-finder
```

> Требуется Node.js 20 или выше.

### Быстрый старт

```javascript
const { TonWalletFinder } = require('ton-wallet-finder');

// Алфавит адреса — base64url, поиск регистрозависим.
// 'abc' и 'ABC' — разные паттерны.
const finder = new TonWalletFinder('abc');

finder.findWalletWithEnding()
  .then(({ publicKey, privateKey, words, walletAddress }) => {
    console.log('Найдено:', walletAddress);
    // publicKey, privateKey и words храните безопасно —
    // не выводите в логи в shared/CI-окружениях.
  })
  .catch(console.error);
```

### Опции

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `targetEnding` | `string` | обязательный | Желаемое окончание адреса. Латиница, цифры, `-`, `_`. **Регистрозависимо.** |
| `showProcess` | `boolean` | `false` | Выводить каждый проверяемый адрес в консоль |
| `showResult` | `boolean` | `false` | Вывести найденный кошелёк в консоль. **Оставьте `false` в окружениях с логированием, чтобы не раскрывать приватный ключ.** |
| `saveResult` | `boolean` | `false` | Сохранить результат в `ton_wallet_results.txt` |

### API

#### `findWalletWithEnding([options]) → Promise<Result>`

Генерирует кошельки, пока не найдёт совпадение. Поддерживает отмену через `AbortSignal`. Возвращает:

| Поле | Тип | Описание |
|------|-----|----------|
| `publicKey` | `string` | Публичный ключ (hex) |
| `privateKey` | `string` | Приватный ключ (hex) |
| `words` | `string[]` | 24-словная мнемоническая фраза |
| `walletAddress` | `string` | Адрес TON (например, `EQa...abc`) |

**Отмена поиска** — передайте `AbortSignal` для остановки в любой момент:

```javascript
const controller = new AbortController();
setTimeout(() => controller.abort('таймаут'), 30_000); // отмена через 30 с

try {
  const result = await finder.findWalletWithEnding({ signal: controller.signal });
} catch (err) {
  console.log('Поиск отменён:', err.message);
}
```

Поставляется с декларациями TypeScript (`index.d.ts`).

### Производительность

Время поиска растёт экспоненциально с длиной окончания:

| Длина окончания | ~Попыток | ~Время |
|----------------|----------|--------|
| 1 символ | ~64 | мгновенно |
| 2 символа | ~4 000 | секунды |
| 3 символа | ~260 000 | минуты |
| 4 символа | ~16 000 000 | часы |

### Что нового в v4

В версии 4.0.0 полностью отказались от избыточных внешних зависимостей.

Предыдущие версии использовали `@ton/ton` и `@ton/crypto`, которые тянули за собой цепочку из **31 транзитивного пакета** (в том числе `tweetnacl`, `@ton/core`, `axios`, `jssha` и другие).

Начиная с v4 всё реализовано исключительно на **встроенных модулях Node.js**:

| Что | Как |
|-----|-----|
| Генерация мнемоники | `crypto.randomBytes` + встроенный список BIP-39 |
| HMAC-SHA-512 / PBKDF2-SHA-512 | `crypto.createHmac` / `crypto.pbkdf2` |
| Деривация ключа Ed25519 | `crypto.createPrivateKey` с обёрткой PKCS#8 |
| Адрес WalletV4R2 | Хэш TVM-ячейки (SHA-256) + CRC-16/CCITT через `Buffer` |

**Результат:** `npm install ton-wallet-finder` устанавливает **0 дополнительных пакетов**.
Публичный API не изменился — при обновлении с v3 никаких правок в коде не требуется.

### Миграция с v2/v3

| Что изменилось | v2 | v3/v4 |
|---|---|---|
| Дефолт `showResult` | `true` | `false` |
| `createWallet()` | `Promise<Address>` | `Address` (синхронно) |
| `saveResultsToFile()` | `void` | `Promise<void>` |

</details>

---

## License

MIT © [Lendel](https://github.com/lendel)
