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

[English](#-installation) · [Русский](#-установка)

</div>

---

## Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Options](#-options)
- [API](#-api)
- [Performance](#-performance)
- [Security](#-security)
- [Support the Author](#-support-the-author)
- [License](#-license)

---

## 📦 Installation

```sh
npm install ton-wallet-finder
```

> Requires Node.js 18 or higher.

---

## Quick Start

```javascript
const { TonWalletFinder } = require('ton-wallet-finder');

// Basic — WalletV4, single-threaded
const finder = new TonWalletFinder('abc');
const result = await finder.findWalletWithEnding();
console.log('Found:', result.walletAddress); // e.g. EQ...abc

// With options
const finder2 = new TonWalletFinder('xyz', {
  walletVersion: 'v5r1',  // WalletContractV5R1
  workers: 'auto',         // use all CPU cores
  showProcess: true,       // log each attempt (single-thread only)
  showResult: true,        // log found wallet to console
  saveResult: true,        // save credentials to file
  fileName: 'my_wallet.txt'
});
const result2 = await finder2.findWalletWithEnding();
```

Run:

```sh
node findWallet.js
```

---

## Options

```js
new TonWalletFinder(targetEnding, options?)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetEnding` | `string` | **required** | Desired address ending. Latin letters, digits, `-`, `_` |
| `options.showProcess` | `boolean` | `false` | Log each attempted address (single-thread only) |
| `options.showResult` | `boolean` | `true` | Log found wallet credentials to console |
| `options.saveResult` | `boolean` | `false` | Save credentials to a plain-text file |
| `options.walletVersion` | `'v4'` \| `'v5r1'` | `'v4'` | Wallet contract version |
| `options.workers` | `number` \| `'auto'` | `1` | Worker Threads count (`'auto'` = all CPU cores) |
| `options.fileName` | `string` | `'ton_wallet_results.txt'` | Output filename (when `saveResult: true`) |

---

## API

### `findWalletWithEnding() → Promise<Result>`

Generates wallets until one matches the target ending. Returns:

| Field | Type | Description |
|-------|------|-------------|
| `publicKey` | `string` | Public key (hex) |
| `privateKey` | `string` | Private key (hex) |
| `words` | `string[]` | 24-word mnemonic seed phrase |
| `walletAddress` | `string` | TON address (e.g. `EQa...abc`) |

TypeScript declarations are included (`index.d.ts`).

---

## Performance

Search time grows exponentially with ending length. Rough estimates on a single core (~1 000 wallets/s):

| Ending length | ~Attempts | ~Time (1 thread) |
|--------------|-----------|-----------------|
| 1 char | ~64 | instant |
| 2 chars | ~4 000 | ~4 s |
| 3 chars | ~262 000 | ~4 min |
| 4 chars | ~16 700 000 | ~4.5 h |

> The TON address alphabet is base64url — 64 possible values per character.

Use `workers: 'auto'` to search across all CPU cores and get a near-linear speedup.

---

## Security

> **Important:** when `saveResult: true`, your **private key** and **seed phrase** are written to a plain-text file on disk.

- **Never share** the output file or commit it to version control.
- Move or encrypt the file immediately after use.
- The library prints a warning to stderr every time it writes credentials to disk.
- If you only need the address, set `saveResult: false` (the default) and store the result securely yourself.

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
[![Ko-fi](https://img.shields.io/badge/Ko--fi-lendelkz-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/lendelkz)

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

> Требуется Node.js 18 или выше.

### Быстрый старт

```javascript
const { TonWalletFinder } = require('ton-wallet-finder');

// Базовое использование — WalletV4, один поток
const finder = new TonWalletFinder('abc');
const result = await finder.findWalletWithEnding();
console.log('Найдено:', result.walletAddress);

// С опциями
const finder2 = new TonWalletFinder('xyz', {
  walletVersion: 'v5r1', // WalletContractV5R1
  workers: 'auto',        // использовать все ядра CPU
  showProcess: true,      // выводить каждую попытку (только в одном потоке)
  showResult: true,
  saveResult: true,
  fileName: 'my_wallet.txt'
});
```

### Опции

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `targetEnding` | `string` | обязательный | Желаемое окончание адреса. Латиница, цифры, `-`, `_` |
| `options.showProcess` | `boolean` | `false` | Выводить каждый проверяемый адрес (только 1 поток) |
| `options.showResult` | `boolean` | `true` | Вывести найденный кошелёк в консоль |
| `options.saveResult` | `boolean` | `false` | Сохранить результат в файл |
| `options.walletVersion` | `'v4'` \| `'v5r1'` | `'v4'` | Версия контракта кошелька |
| `options.workers` | `number` \| `'auto'` | `1` | Число Worker Threads (`'auto'` = все ядра) |
| `options.fileName` | `string` | `'ton_wallet_results.txt'` | Имя файла при `saveResult: true` |

### API

#### `findWalletWithEnding() → Promise<Result>`

Генерирует кошельки, пока не найдёт совпадение. Возвращает:

| Поле | Тип | Описание |
|------|-----|----------|
| `publicKey` | `string` | Публичный ключ (hex) |
| `privateKey` | `string` | Приватный ключ (hex) |
| `words` | `string[]` | 24-словная мнемоническая фраза |
| `walletAddress` | `string` | Адрес TON (например, `EQa...abc`) |

Поставляется с декларациями TypeScript (`index.d.ts`).

### Производительность

Время поиска растёт экспоненциально с длиной окончания:

| Длина окончания | ~Попыток | ~Время |
|----------------|----------|--------|
| 1 символ | ~32 | мгновенно |
| 2 символа | ~1 000 | секунды |
| 3 символа | ~32 000 | минуты |
| 4 символа | ~1 000 000 | часы |

</details>

---

## License

MIT © [Lendel](https://github.com/lendel)
