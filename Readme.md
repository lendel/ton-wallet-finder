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
const { TonWalletFinder, saveResultsToFile } = require('ton-wallet-finder');

const finder = new TonWalletFinder(
  'abc',  // target ending
  true,   // showProcess — log each attempt
  true,   // showResult  — log found wallet
  true    // saveResult  — save to ton_wallet_results.txt
);

finder.findWalletWithEnding()
  .then(({ publicKey, privateKey, words, walletAddress }) => {
    console.log('Found:', walletAddress);
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
| `targetEnding` | `string` | required | Desired address ending. Latin letters, digits, `-`, `_` |
| `showProcess` | `boolean` | `false` | Log each attempted address to console |
| `showResult` | `boolean` | `true` | Log found wallet details to console |
| `saveResult` | `boolean` | `false` | Save result to `ton_wallet_results.txt` |

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

Search time grows exponentially with ending length. Rough estimates on a modern CPU:

| Ending length | ~Attempts | ~Time |
|--------------|-----------|-------|
| 1 char | ~32 | instant |
| 2 chars | ~1 000 | seconds |
| 3 chars | ~32 000 | minutes |
| 4 chars | ~1 000 000 | hours |

> The TON address alphabet is base64url, so each character has 64 possible values.

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

> Требуется Node.js 18 или выше.

### Быстрый старт

```javascript
const { TonWalletFinder, saveResultsToFile } = require('ton-wallet-finder');

const finder = new TonWalletFinder(
  'abc',  // желаемое окончание адреса
  true,   // showProcess — выводить каждую попытку
  true,   // showResult  — вывести найденный кошелёк
  true    // saveResult  — сохранить в ton_wallet_results.txt
);

finder.findWalletWithEnding()
  .then(({ publicKey, privateKey, words, walletAddress }) => {
    console.log('Найдено:', walletAddress);
  })
  .catch(console.error);
```

### Опции

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `targetEnding` | `string` | обязательный | Желаемое окончание адреса. Латиница, цифры, `-`, `_` |
| `showProcess` | `boolean` | `false` | Выводить каждый проверяемый адрес в консоль |
| `showResult` | `boolean` | `true` | Вывести найденный кошелёк в консоль |
| `saveResult` | `boolean` | `false` | Сохранить результат в `ton_wallet_results.txt` |

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
