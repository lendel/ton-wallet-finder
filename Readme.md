# TON Wallet Finder

<div align="center">

![npm version](https://img.shields.io/npm/v/ton-wallet-finder?color=crimson&style=flat-square)
![npm downloads](https://img.shields.io/npm/dy/ton-wallet-finder?color=blue&style=flat-square)
![license](https://img.shields.io/npm/l/ton-wallet-finder?color=green&style=flat-square)
![CI](https://img.shields.io/github/actions/workflow/status/lendel/ton-wallet-finder/ci.yml?label=CI&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue?style=flat-square&logo=typescript)
![issues](https://img.shields.io/github/issues/lendel/ton-wallet-finder?style=flat-square)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lendel/ton-wallet-finder/badge)](https://scorecard.dev/viewer/?uri=github.com/lendel/ton-wallet-finder)

**Vanity address generator for TON blockchain.**
Find a wallet whose address ends with any string you choose.

[English](#-installation) · [Русский](#установка)

</div>

---

**Security: 0 dependencies, 0 network calls.** The only modules imported are Node.js built-ins (`crypto`, `fs`, `os`, `path`, `worker_threads`) — verify with `grep require index.js worker.js`. Every npm release is published from CI with a provenance attestation.

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

> Requires Node.js 20 or higher. **Node.js 22 or 24 (LTS) is recommended**: Node.js 20 reached end-of-life on 30 April 2026 and support for it will be dropped in the next major release.

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

ES modules work too:

```javascript
import { TonWalletFinder } from 'ton-wallet-finder';
```

Run:

```sh
node findWallet.js
```

---

## Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetEnding` | `string` | required | Desired address ending. Latin letters, digits, `-`, `_`, at most 46 characters. **Case-sensitive.** |
| `showProcess` | `boolean` | `false` | Log each attempted address to console |
| `showResult` | `boolean` | `false` | Log found wallet details to console. **Keep `false` in shared/logged environments to avoid exposing private keys.** |
| `saveResult` | `boolean` | `false` | Save result to `ton_wallet_results.txt` in the current working directory. Never overwrites: an existing file gets a `-2`, `-3`, … suffix |

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
  if (err.name === 'AbortError') {
    console.log('Search cancelled:', err.message); // err.cause === signal.reason
  }
}
```

If key generation fails 5 times in a row (for example, a runtime without Ed25519 support),
the promise rejects with the last error as `cause` instead of retrying forever.

**Parallel search** — pass `workers` to use several CPU cores. Throughput scales almost
linearly with the number of cores:

```javascript
// one worker thread per CPU core
const result = await finder.findWalletWithEnding({ workers: 'auto' });

// or an explicit count
const result = await finder.findWalletWithEnding({ workers: 4 });
```

`workers` defaults to `1` (single-threaded, same behaviour as before). It can be combined with `signal`.

### `saveResultsToFile(publicKey, privateKey, words, walletAddress, [fileName]) → Promise<string | undefined>`

Writes the credentials as plain text to `fileName` (default `ton_wallet_results.txt`) in the
**current working directory**, with file mode `0600`. Never overwrites: if the file exists, a
numeric suffix is appended (`ton_wallet_results-2.txt`, `-3`, …). Resolves with the absolute
path of the written file, or `undefined` if writing failed (the error is logged, never thrown).
`fileName` must be a plain file name — path separators are rejected. This is what
`saveResult: true` calls internally.

### Lower-level methods

- `finder.createKeyPair()` → `Promise<{ keyPair: { publicKey, secretKey }, words }>` — a fresh
  24-word TON mnemonic and its Ed25519 key pair.
- `finder.createWallet(keyPair)` → object whose `toString()` returns the bounceable, URL-safe
  WalletV4 address (synchronous).
- `_internals` — the primitives behind the above (`mnemonicNew`, `mnemonicToPrivateKey`,
  `isBasicSeed`, `walletV4Address`, `cellHash`, `padBits`, `crc16`). Exported for testing and
  advanced use; not yet covered by semver guarantees.

TypeScript declarations are included (`index.d.ts`).

---

## Performance

Search time grows exponentially with ending length: on average **64ⁿ** candidates for an
*n*-character ending. Each candidate is expensive by design — a TON mnemonic requires
about 256 PBKDF2 seed-version checks plus one 100 000-iteration PBKDF2, roughly
200 000 HMAC-SHA-512 rounds per address. Measured throughput is about **5 addresses per
second per CPU core**.

| Ending length | Attempts (avg) | 1 core | 8 cores (`workers: 'auto'`) |
|--------------|----------------|--------|------------------------------|
| 1 char | 64 | ~12 seconds | ~2 seconds |
| 2 chars | 4 096 | ~13 minutes | ~2 minutes |
| 3 chars | 262 144 | ~14 hours | ~2 hours |
| 4 chars | 16 777 216 | ~5 weeks | ~5 days |

Estimate: `time ≈ 64ⁿ / (5 × cores)` seconds. Individual runs vary widely (the attempt
count is geometrically distributed), so treat these as medians, not guarantees.

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
| WalletV4R2 address | TVM cell hash (SHA-256) + CRC-16/XMODEM via `Buffer` |

**Result:** `npm install ton-wallet-finder` now installs **0 additional packages**.
The public API is identical — no code changes required when upgrading from v3.

---

## 🔀 Migration from v2/v3

### v2/v3 → v4 breaking changes

| What changed | v2 behaviour | v3 / v4 behaviour |
|---|---|---|
| `showResult` default | `true` — printed private key to stdout by default | `false` — silent by default |
| `createWallet()` | returned `Promise<Address>` | returns `Address` synchronously |
| `saveResultsToFile()` | returned `void` (fire-and-forget) | v3: `Promise<void>`; 4.0.1+: `Promise<string \| undefined>` — the written path |

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

> Требуется Node.js 20 или выше. **Рекомендуется Node.js 22 или 24 (LTS)**: поддержка Node.js 20 закончилась 30 апреля 2026 года, и в следующей мажорной версии она будет убрана.

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

ES-модули тоже поддерживаются:

```javascript
import { TonWalletFinder } from 'ton-wallet-finder';
```

### Опции

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `targetEnding` | `string` | обязательный | Желаемое окончание адреса. Латиница, цифры, `-`, `_`, не более 46 символов. **Регистрозависимо.** |
| `showProcess` | `boolean` | `false` | Выводить каждый проверяемый адрес в консоль |
| `showResult` | `boolean` | `false` | Вывести найденный кошелёк в консоль. **Оставьте `false` в окружениях с логированием, чтобы не раскрывать приватный ключ.** |
| `saveResult` | `boolean` | `false` | Сохранить результат в `ton_wallet_results.txt` в текущей рабочей директории. Существующий файл не перезаписывается: добавляется суффикс `-2`, `-3`, … |

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
  if (err.name === 'AbortError') {
    console.log('Поиск отменён:', err.message); // err.cause === signal.reason
  }
}
```

Если генерация ключа падает 5 раз подряд (например, рантайм без поддержки Ed25519),
промис отклоняется с последней ошибкой в `cause`, а не крутится бесконечно.

**Параллельный поиск** — опция `workers` задействует несколько ядер CPU. Скорость растёт
почти линейно с числом ядер:

```javascript
// по одному потоку на ядро
const result = await finder.findWalletWithEnding({ workers: 'auto' });

// или явное число
const result = await finder.findWalletWithEnding({ workers: 4 });
```

По умолчанию `workers: 1` (один поток, прежнее поведение). Сочетается с `signal`.

#### `saveResultsToFile(publicKey, privateKey, words, walletAddress, [fileName]) → Promise<string | undefined>`

Записывает данные кошелька открытым текстом в `fileName` (по умолчанию `ton_wallet_results.txt`)
в **текущей рабочей директории** с правами `0600`. Никогда не перезаписывает: если файл существует,
добавляется числовой суффикс (`ton_wallet_results-2.txt`, `-3`, …). Возвращает абсолютный путь
записанного файла или `undefined`, если запись не удалась (ошибка логируется, не выбрасывается).
`fileName` должен быть простым именем файла — разделители пути отклоняются. Именно эту функцию
вызывает `saveResult: true`.

#### Низкоуровневые методы

- `finder.createKeyPair()` → `Promise<{ keyPair: { publicKey, secretKey }, words }>` — новая
  24-словная TON-мнемоника и её пара ключей Ed25519.
- `finder.createWallet(keyPair)` → объект, чей `toString()` возвращает bounceable URL-safe
  адрес WalletV4 (синхронно).
- `_internals` — примитивы, на которых всё построено (`mnemonicNew`, `mnemonicToPrivateKey`,
  `isBasicSeed`, `walletV4Address`, `cellHash`, `padBits`, `crc16`). Экспортированы для тестов и
  продвинутого использования; пока не покрыты гарантиями semver.

Поставляется с декларациями TypeScript (`index.d.ts`).

### Производительность

Время поиска растёт экспоненциально с длиной окончания: в среднем **64ⁿ** кандидатов для
окончания из *n* символов. Каждый кандидат дорог по самой природе TON-мнемоники: около
256 проверок seed-версии через PBKDF2 плюс один PBKDF2 на 100 000 итераций, то есть
порядка 200 000 раундов HMAC-SHA-512 на один адрес. Измеренная скорость — около
**5 адресов в секунду на одно ядро**.

| Длина окончания | Попыток (в среднем) | 1 ядро | 8 ядер (`workers: 'auto'`) |
|----------------|---------------------|--------|-----------------------------|
| 1 символ | 64 | ~12 секунд | ~2 секунды |
| 2 символа | 4 096 | ~13 минут | ~2 минуты |
| 3 символа | 262 144 | ~14 часов | ~2 часа |
| 4 символа | 16 777 216 | ~5 недель | ~5 дней |

Оценка: `время ≈ 64ⁿ / (5 × ядра)` секунд. Разброс между запусками большой (число попыток
распределено геометрически), поэтому это медианы, а не гарантии.

### Что нового в v4

В версии 4.0.0 полностью отказались от избыточных внешних зависимостей.

Предыдущие версии использовали `@ton/ton` и `@ton/crypto`, которые тянули за собой цепочку из **31 транзитивного пакета** (в том числе `tweetnacl`, `@ton/core`, `axios`, `jssha` и другие).

Начиная с v4 всё реализовано исключительно на **встроенных модулях Node.js**:

| Что | Как |
|-----|-----|
| Генерация мнемоники | `crypto.randomBytes` + встроенный список BIP-39 |
| HMAC-SHA-512 / PBKDF2-SHA-512 | `crypto.createHmac` / `crypto.pbkdf2` |
| Деривация ключа Ed25519 | `crypto.createPrivateKey` с обёрткой PKCS#8 |
| Адрес WalletV4R2 | Хэш TVM-ячейки (SHA-256) + CRC-16/XMODEM через `Buffer` |

**Результат:** `npm install ton-wallet-finder` устанавливает **0 дополнительных пакетов**.
Публичный API не изменился — при обновлении с v3 никаких правок в коде не требуется.

### Миграция с v2/v3

| Что изменилось | v2 | v3/v4 |
|---|---|---|
| Дефолт `showResult` | `true` | `false` |
| `createWallet()` | `Promise<Address>` | `Address` (синхронно) |
| `saveResultsToFile()` | `void` | v3: `Promise<void>`; 4.0.1+: `Promise<string \| undefined>` — путь к файлу |

</details>

---

## License

MIT © [Lendel](https://github.com/lendel)
