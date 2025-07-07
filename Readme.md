# TON Wallet Finder

![npm](https://img.shields.io/npm/v/ton-wallet-finder?color=crimson&style=flat-square)
![downloads](https://img.shields.io/npm/dy/ton-wallet-finder?color=blue&style=flat-square)
![license](https://img.shields.io/npm/l/ton-wallet-finder?color=green&style=flat-square)
![issues](https://img.shields.io/github/issues/andrey-karpov/ton-wallet-finder?style=flat-square)

---

This library allows you to find TON wallets with specific address endings. It generates wallets until it finds one whose address ends with the desired string.

## Installation

To install the library, use the following command:

```sh
npm install ton-wallet-finder
```

## Usage

Create a new JavaScript file, for example, `findWallet.js`, and add the following code:

```javascript
const { TonWalletFinder, saveResultsToFile } = require('ton-wallet-finder');

// Set the target address ending and options for displaying progress, results, and saving to a file
const targetEnding = '8'; // Replace with the desired address ending (e.g., 'abc')
const showProcess = true;  // Set to true to display the search progress in the console
const showResult = true;   // Set to true to display the results in the console
const saveResult = true;   // Set to true to save the results to a file

// Create a new instance of the TonWalletFinder class
const finder = new TonWalletFinder(targetEnding, showProcess, showResult, saveResult);

// Find a wallet with the specified address ending
finder.findWalletWithEnding().then(({ publicKey, privateKey, words, walletAddress }) => {
  // Optionally, handle the result here if needed
}).catch(error => {
  console.error('Error:', error);
});
```

Run your script using Node.js:

```sh
node findWallet.js
```

### How It Works
- The library generates TON wallets and checks their addresses until it finds one that ends with the specified `targetEnding`.
- If `showProcess` is `true`, it logs each attempted address to the console.
- If `showResult` is `true`, it logs the found wallet's details (public key, private key, mnemonic words, and address) to the console.
- If `saveResult` is `true`, it saves the wallet details to a file named `ton_wallet_results.txt` in the script's directory.

## Options

The `TonWalletFinder` constructor accepts the following parameters:

- **`targetEnding`** (required): The desired ending for the wallet address. Must consist of Latin letters, numbers, dashes, and underscores.
- **`showProcess`** (optional, default: `false`): If `true`, displays the search progress in the console.
- **`showResult`** (optional, default: `true`): If `true`, displays the search results in the console.
- **`saveResult`** (optional, default: `false`): If `true`, saves the search results to a file.

## Methods

### `findWalletWithEnding()`
This method returns a Promise that resolves with an object containing the following properties:

- **`publicKey`**: A string representing the public key in hexadecimal format.
- **`privateKey`**: A string representing the private key in hexadecimal format.
- **`words`**: An array of 24 words representing the wallet's mnemonic seed phrase.
- **`walletAddress`**: A string representing the wallet address in the TON format (e.g., `EQ...`).

## 💖 Support the Author

If this library saved you time or helped your project — consider sending a small thank-you 🙏

### 💎 TonCoin (TON)
`EQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJXtr`

[Donation](https://tonkeeper.com/transfer/EQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJXtr?text=Thank%20you%20for%20supporting%20ton-wallet-finder%20%F0%9F%92%99)



### ☕ Other ways
- [PayPal](https://paypal.me/lendelkz)


## License

This library is licensed under the MIT License.

---

# TON Wallet Finder

Эта библиотека позволяет находить кошельки TON с определенными окончаниями адресов. Она генерирует кошельки, пока не найдет тот, чей адрес заканчивается на указанную строку.

## Установка

Для установки библиотеки используйте команду:

```sh
npm install ton-wallet-finder
```

## Использование

Создайте новый JavaScript файл, например, `findWallet.js`, и добавьте следующий код:

```javascript
const { TonWalletFinder, saveResultsToFile } = require('ton-wallet-finder');

// Установите желаемое окончание адреса и опции для отображения прогресса, результатов и сохранения в файл
const targetEnding = '8'; // Замените на желаемое окончание адреса (например, 'abc')
const showProcess = true;  // Установите true, чтобы отображать прогресс поиска в консоли
const showResult = true;   // Установите true, чтобы отображать результаты в консоли
const saveResult = true;   // Установите true, чтобы сохранить результаты в файл

// Создание нового экземпляра класса TonWalletFinder
const finder = new TonWalletFinder(targetEnding, showProcess, showResult, saveResult);

// Поиск кошелька с указанным окончанием адреса
finder.findWalletWithEnding().then(({ publicKey, privateKey, words, walletAddress }) => {
  // Опционально, обработайте результат здесь, если нужно
}).catch(error => {
  console.error('Ошибка:', error);
});
```

Запустите ваш скрипт с помощью Node.js:

```sh
node findWallet.js
```

### Как это работает
- Библиотека генерирует кошельки TON и проверяет их адреса, пока не найдет тот, который заканчивается на указанное `targetEnding`.
- Если `showProcess` установлено в `true`, в консоль выводится каждый проверенный адрес.
- Если `showResult` установлено в `true`, в консоль выводятся детали найденного кошелька (публичный ключ, приватный ключ, мнемонические слова и адрес).
- Если `saveResult` установлено в `true`, детали кошелька сохраняются в файл `ton_wallet_results.txt` в директории скрипта.

## Опции

Конструктор `TonWalletFinder` принимает следующие параметры:

- **`targetEnding`** (обязательный): Желаемое окончание адреса кошелька. Должно состоять из латинских букв, цифр, дефисов и подчеркиваний.
- **`showProcess`** (необязательный, по умолчанию: `false`): Если `true`, отображает прогресс поиска в консоли.
- **`showResult`** (необязательный, по умолчанию: `true`): Если `true`, отображает результаты поиска в консоли.
- **`saveResult`** (необязательный, по умолчанию: `false`): Если `true`, сохраняет результаты поиска в файл.

## Методы

### `findWalletWithEnding()`
Этот метод возвращает Promise, который разрешается объектом, содержащим следующие свойства:

- **`publicKey`**: Строка, представляющая публичный ключ в шестнадцатеричном формате.
- **`privateKey`**: Строка, представляющая приватный ключ в шестнадцатеричном формате.
- **`words`**: Массив из 24 слов, представляющих мнемоническую фразу кошелька.
- **`walletAddress`**: Строка, представляющая адрес кошелька в формате TON (например, `EQ...`).

## Пожертвования

Если вы хотите проявить свою благодарность и поддержку, вы можете пожертвовать криптовалюту на адрес кошелька TonCoin (TON):  
`EQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJXtr`.

## Лицензия

Эта библиотека распространяется под лицензией MIT.
