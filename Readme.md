# TON Wallet Finder

This library allows you to find TON wallets with specific address endings.

## Installation

```sh
npm install ton-wallet-finder
```

## Usage

Create a new JavaScript file, for example `findWallet.js`, and add the following code:

```javascript
const { TonWalletFinder, saveResultsToFile } = require('ton-wallet-finder');

// Set the target address ending and options for displaying progress and results
const targetEnding = '8'; // Replace with the desired address ending
const showProcess = true; // Display the search progress
const showResult = true; // Display the results in the console
const saveResult = true;

// Create a new instance of the TonWalletFinder class
const finder = new TonWalletFinder(targetEnding, showProcess, showResult, saveResult);

// Find a wallet with the specified address ending
finder.findWalletWithEnding().then(({ publicKey, privateKey, words, walletAddress }) => {
  
}).catch(error => {
  console.error('Error:', error);
});
```

Run your script:

```sh
node findWallet.js
```

## Options

The `TonWalletFinder` constructor takes the following options:

- `targetEnding` (required): The desired ending for the wallet address.
- `showProgress` (optional, default: `false`): Display the search progress in the console.
- `showResult` (optional, default: `false`): Display the search results in the console.

## Methods

### findWalletWithEnding()

This method returns a Promise that resolves with an object containing the following properties:

- `keyPair`: An object with `public` and `secret` keys.
- `words`: An array of words representing the wallet seed phrase.
- `address`: A wallet address object.

## Donations

If you would like to show your gratitude and support, you can donate cryptocurrency to the TonCoin (TON) wallet address: EQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJXtr.

## License

MIT

---

# TON Wallet Finder

Эта библиотека позволяет находить кошельки TON с определенными окончаниями адресов.

## Установка

```sh
npm install ton-wallet-finder
```

## Использование

Создайте новый JavaScript файл, например, `findWallet.js`, и добавьте следующий код:

```javascript
const { TonWalletFinder, saveResultsToFile } = require('ton-wallet-finder');

// Set the target address ending and options for displaying progress and results
const targetEnding = '8'; // Замените на желаемое окончание адреса
const showProcess = true; // Отображать прогресс поиска в консоли
const showResult = true; // Отображать результаты поиска в консоли
const saveResult = true;

// Создание нового экземпляра класса TonWalletFinder
const finder = new TonWalletFinder(targetEnding, showProcess, showResult, saveResult);

// Поиск кошелька с указанным окончанием адреса
finder.findWalletWithEnding().then(({ publicKey, privateKey, words, walletAddress }) => {
  
}).catch(error => {
  console.error('Ошибка:', error);
});
```

Запустите ваш скрипт:

```sh
node findWallet.js
```

## Опции

Конструктор `

TonWalletFinder` принимает следующие опции:

- `targetEnding` (обязательный): Желаемое окончание адреса кошелька.
- `showProgress` (необязательный, по умолчанию: `false`): Отображать прогресс поиска в консоли.
- `showResult` (необязательный, по умолчанию: `false`): Отображать результаты поиска в консоли.

## Методы

### findWalletWithEnding()

Этот метод возвращает Promise, который разрешается объектом, содержащим следующие свойства:

- `keyPair`: Объект с публичным (`public`) и секретным (`secret`) ключами.
- `words`: Массив слов, представляющих сид-фразу кошелька.
- `address`: Объект адреса кошелька.

## Пожертвования

Если вы хотите проявить свою благодарность и поддержку, вы можете пожертвовать криптовалюту на адрес кошелька TonCoin (TON): EQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJXtr.

## Лицензия

MIT