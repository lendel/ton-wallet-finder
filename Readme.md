# TON Wallet Finder

This library allows you to find TON wallets with specific address endings.

## Installation

```sh
npm install ton-wallet-finder
```

## Usage

Create a new JavaScript file, for example `findWallet.js`, and add the following code:

```javascript
const { TonWalletFinder } = require('ton-wallet-finder');

// Set the target address ending and options for displaying progress and results
const targetEnding = '8'; // Replace with the desired address ending
const showProgress = true; // Display the search progress
const showResult = true; // Display the results in the console

// Create a new instance of the TonWalletFinder class
const finder = new TonWalletFinder(targetEnding, showProgress, showResult);

// Find a wallet with the specified address ending
finder.findWalletWithEnding().then(({ keyPair, words, address }) => {
  console.log('Public Key:', keyPair.public);
  console.log('Private Key:', keyPair.secret);
  console.log('Words:', words);
  console.log('Wallet:', address.toString(true, true, true));
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
const { TonWalletFinder } = require('ton-wallet-finder');

// Задаем окончание адреса и опции отображения прогресса и результатов
const targetEnding = '8'; // Замените на нужное окончание адреса
const showProgress = true; // Отображать ли процесс поиска
const showResult = true; // Отображать ли результаты в консоли

// Создаем экземпляр класса TonWalletFinder
const finder = new TonWalletFinder(targetEnding, showProgress, showResult);

// Ищем кошелек с заданным окончанием адреса
finder.findWalletWithEnding().then(({ keyPair, words, address }) => {
  console.log('Публичный ключ:', keyPair.public);
  console.log('Приватный ключ:', keyPair.secret);
  console.log('Слова:', words);
  console.log('Кошелек:', address.toString(true, true, true));
}).catch(error => {
  console.error('Ошибка:', error);
});
```

Запустите ваш скрипт:

```sh
node findWallet.js
```

## Опции

Конструктор `TonWalletFinder` принимает следующие опции:

- `targetEnding` (обязательный): Желаемое окончание адреса кошелька.
- `showProgress` (необязательный, по умолчанию: `false`): Отображать процесс поиска в консоли.
- `showResult` (необязательный, по умолчанию: `false`): Отображать результаты поиска в консоли.

## Методы

### findWalletWithEnding()

Этот метод возвращает Promise, который разрешается объектом, содержащим следующие свойства:

- `keyPair`: Объект с публичным (`public`) и секретным (`secret`) ключами.
- `words`: Массив слов, представляющих сид-фразу кошелька.
- `address`: Объект адреса кошелька.

## Лицензия

MIT