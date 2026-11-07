# TON Wallet Finder

[![npm version](https://img.shields.io/npm/v/ton-wallet-finder?color=crimson&style=flat-square)](https://www.npmjs.com/package/ton-wallet-finder)
[![npm downloads](https://img.shields.io/npm/dm/ton-wallet-finder?style=flat-square)](https://www.npmjs.com/package/ton-wallet-finder)
[![CI](https://img.shields.io/github/actions/workflow/status/lendel/ton-wallet-finder/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/lendel/ton-wallet-finder/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/ton-wallet-finder?style=flat-square)](https://nodejs.org/)
[![types](https://img.shields.io/npm/types/ton-wallet-finder?style=flat-square)](index.d.ts)
[![license](https://img.shields.io/npm/l/ton-wallet-finder?color=green&style=flat-square)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lendel/ton-wallet-finder/badge?style=flat-square)](https://scorecard.dev/viewer/?uri=github.com/lendel/ton-wallet-finder)

**Генератор красивых адресов для блокчейна TON** — консольная программа и библиотека для
Node.js. Создаёт новые кошельки, пока не найдёт тот, чей адрес заканчивается на выбранную вами
строку — например, `EQ…cafe`.

[English](README.md) · **Русский**

## Почему эта библиотека

- **Ноль зависимостей и ноль сетевых запросов.** Только встроенные модули Node.js (`crypto`,
  `fs`, `os`, `path`, `worker_threads`) — проверьте командой `grep require index.js worker.js`.
- **Проверяемые релизы.** Каждая версия публикуется в npm из CI с
  [provenance-подписью](https://docs.npmjs.com/generating-provenance-statements).
- **Правильные адреса.** Вывод ключей и хэширование адреса сверяются с эталонными векторами
  из `@ton/crypto` и `@ton/ton` для версий кошелька v3r2, v4r2 и v5r1.
- **Использует все ядра.** Параллельный поиск в worker-потоках, отмена через `AbortSignal`.

## ⚠️ Сначала о безопасности

Библиотека создаёт **настоящие приватные ключи**. Обращайтесь с результатом как с наличными.

- Запускайте на машине, которой доверяете, а не в CI или общем окружении.
- Не включайте `showResult` там, где вывод пишется в логи.
- Вместо открытого текста (`saveResult: true`) используйте зашифрованный файл:
  `saveResult: { password }`.
- **Прежде чем отправлять средства**, импортируйте 24 слова в приложение кошелька и убедитесь,
  что оно показывает ровно найденный адрес (см. [Версии кошелька](#версии-кошелька)).

Программа предоставляется «как есть», без каких-либо гарантий (см. [LICENSE](LICENSE)).

## Установка

```sh
npm install ton-wallet-finder        # как библиотеку
npx ton-wallet-finder --help         # или запустить консольную программу без установки
```

Требуется **Node.js 22** или новее.

## Командная строка

```sh
npx ton-wallet-finder abc                 # кошелёк W5 (v5r1), как в Tonkeeper
```

Программа спрашивает пароль **до** начала поиска, показывает прогресс (число попыток, скорость,
ожидаемое время) и сохраняет результат в зашифрованный `ton_wallet_results.enc.json`. Мнемоника
на экран не выводится, если не указать `--show`. Прочитать файл потом можно так:

```sh
npx ton-wallet-finder --decrypt ton_wallet_results.enc.json
```

| Опция | Описание |
|---|---|
| `-w, --wallet <v3r2\|v4r2\|v5r1>` | Контракт кошелька (по умолчанию `v5r1` — текущий стандарт Tonkeeper и Telegram Wallet); должен совпадать с вашим приложением |
| `-j, --workers <n\|auto>` | Число потоков (по умолчанию `auto` — по одному на ядро) |
| `-o, --output <file>` | Имя файла в текущей директории |
| `--password-env <VAR>` | Брать пароль из переменной окружения, а не спрашивать (для скриптов) |
| `--plain` | Сохранить открытым текстом, без шифрования |
| `--no-save --show` | Только вывести результат, файл не создавать |
| `--decrypt <file>` | Показать кошелёк из зашифрованного файла |
| `-q, --quiet` | Без строки прогресса |

Ctrl+C корректно останавливает поиск (код возврата 130). Коды возврата: `0` — найдено, `1` — ошибка,
`2` — неверные аргументы. Полный список — `npx ton-wallet-finder --help`.

## Библиотека: быстрый старт

```js
import { TonWalletFinder } from 'ton-wallet-finder';

const password = process.env.WALLET_FILE_PASSWORD;   // не храните пароль в коде
if (!password) throw new Error('Сначала задайте WALLET_FILE_PASSWORD');

// Алфавит адреса — base64url, поиск регистрозависим: 'abc' ≠ 'ABC'.
const finder = new TonWalletFinder('abc', {
  walletVersion: 'v5r1',          // должна совпадать с вашим кошельком
  workers: 'auto',                // все ядра процессора
  saveResult: { password },       // → зашифрованный ton_wallet_results.enc.json
});

const { walletAddress } = await finder.findWalletWithEnding();
console.log('Найдено:', walletAddress);
```

CommonJS тоже работает: `const { TonWalletFinder } = require('ton-wallet-finder');`

## Версии кошелька

| `walletVersion` | Контракт | Примечания |
|---|---|---|
| `'v3r2'` | WalletV3R2 | Устаревший контракт, но импортируется большинством кошельков |
| `'v4r2'` | WalletV4R2 | **По умолчанию.** Те же адреса, что и во всех предыдущих версиях библиотеки |
| `'v5r1'` | WalletV5R1 (W5) | Сейчас создаётся по умолчанию в Tonkeeper, MyTonWallet и других. Mainnet wallet id, subwallet 0 |

> **Одна и та же мнемоника даёт разный адрес для каждой версии.** Найденный адрес существует
> только для той версии, с которой вы искали, поэтому `walletVersion` должна совпадать с
> приложением, в которое вы импортируете слова. Если не уверены — посмотрите, какой адрес ваш
> кошелёк показывает для уже существующей сид-фразы.

## Опции

```js
new TonWalletFinder(targetEnding, { showProcess, showResult, saveResult, workers, walletVersion });
```

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `targetEnding` | `string` | обязательный | Желаемое окончание адреса: латиница, цифры, `-`, `_`; не более 46 символов. **Регистрозависимо.** |
| `showProcess` | `boolean` | `false` | Выводить каждый проверяемый адрес |
| `showResult` | `boolean` | `false` | Вывести найденные ключи и мнемонику. **Не включайте там, где вывод логируется.** |
| `saveResult` | `boolean \| { password?, fileName? }` | `false` | Сохранить результат в текущей директории: `true` → открытым текстом в `ton_wallet_results.txt`; `{ password }` → зашифрованный `ton_wallet_results.enc.json` ([подробнее](#зашифрованное-сохранение)). Не перезаписывает — добавляет `-2`, `-3`, … |
| `workers` | `number \| 'auto'` | `1` | Число worker-потоков; `'auto'` — по одному на ядро. Можно переопределить при вызове |
| `walletVersion` | `'v3r2' \| 'v4r2' \| 'v5r1'` | `'v4r2'` | Контракт кошелька, для которого выводится адрес ([см. выше](#версии-кошелька)) |

Неверные опции вызывают ошибку уже в конструкторе.

## API

### `finder.findWalletWithEnding([options]) → Promise<Result>`

Генерирует кошельки, пока не найдёт совпадение, и возвращает:

| Поле | Тип | Описание |
|---|---|---|
| `walletAddress` | `string` | Bounceable URL-safe адрес (`EQ…abc`) |
| `words` | `string[]` | 24-словная TON-мнемоника |
| `publicKey` | `string` | Публичный ключ Ed25519, hex |
| `privateKey` | `string` | Секретный ключ Ed25519 (seed ‖ публичный ключ), hex |

`options.signal` отменяет поиск, `options.workers` переопределяет `workers` из конструктора
для этого вызова, а `options.onProgress(attempts)` вызывается после каждой попытки с общим
числом попыток по всем потокам (для индикатора прогресса):

```js
const controller = new AbortController();
setTimeout(() => controller.abort('таймаут'), 60_000);

try {
  await finder.findWalletWithEnding({ signal: controller.signal, workers: 4 });
} catch (err) {
  if (err.name === 'AbortError') console.log('Отменено:', err.message); // err.cause === signal.reason
}
```

Если генерация ключа падает 5 раз подряд, промис отклоняется с последней ошибкой в `cause`,
а не повторяет попытки бесконечно.

### `saveResultsToFile(publicKey, privateKey, words, walletAddress, [options]) → Promise<string | undefined>`

Записывает результат в **текущую рабочую директорию** с правами `0600` — именно эту функцию
использует `saveResult`. `options` — простое имя файла или `{ fileName?, password? }`; с паролем
файл шифруется. Если ключ `password` указан, но пуст или равен `undefined` (например, не задана
переменная окружения), ничего не записывается — молча перейти на открытый текст библиотека не
может. Никогда не перезаписывает (добавляет числовой суффикс), отклоняет разделители
пути в `fileName` и возвращает абсолютный путь записанного файла — или `undefined`, если запись
не удалась (ошибка логируется, не выбрасывается).

### `decryptResults(data, password) → Promise<Result>`

Читает зашифрованный файл результатов. `data` — содержимое файла (`string` или `Buffer`).
Отклоняется при неверном пароле, изменённом файле или неизвестном формате.

### Зашифрованное сохранение

```js
import { readFileSync } from 'node:fs';
import { decryptResults } from 'ton-wallet-finder';

const wallet = await decryptResults(readFileSync('ton_wallet_results.enc.json'), password);
```

Ключ выводится через **scrypt** (N = 2¹⁷, r = 8, p = 1, случайная 16-байтная соль), данные
шифруются **AES-256-GCM** (случайный 12-байтный IV, заголовок формата аутентифицируется) —
только встроенный `crypto` Node.js. Ничего секретного, даже адрес, не хранится открытым текстом.
Защита не сильнее пароля: используйте длинный случайный пароль, не пишите его в коде и удалите
файл, когда кошелёк уже в приложении.

### Низкоуровневый API

- `finder.createKeyPair()` → `Promise<{ keyPair: { publicKey, secretKey }, words }>` — новая
  мнемоника и её пара ключей Ed25519.
- `finder.createWallet(keyPair)` → объект, чей `toString()` возвращает адрес для выбранной
  `walletVersion` (синхронно).
- `_internals` — криптографические примитивы, на которых всё построено; экспортированы для
  тестов и продвинутого использования, **не покрыты гарантиями semver**.

Декларации TypeScript входят в пакет ([`index.d.ts`](index.d.ts)).

## Производительность

Каждый лишний символ умножает работу на **64** (размер алфавита base64url), поэтому для
окончания из *n* символов нужно в среднем **64ⁿ** попыток. Каждая попытка дорога по самой
природе TON-мнемоники — около 200 000 раундов HMAC-SHA-512, — так что рассчитывайте примерно
на **8–10 адресов в секунду на одно ядро**.

| Длина окончания | Попыток (в среднем) | 1 ядро (~8/с) | 8 ядер (~64/с) |
|---|---|---|---|
| 1 символ | 64 | ~8 секунд | ~1 секунда |
| 2 символа | 4 096 | ~9 минут | ~1 минута |
| 3 символа | 262 144 | ~9 часов | ~1 час |
| 4 символа | 16 777 216 | ~3,5 недели | ~3 дня |

Оценка: `время ≈ 64ⁿ / (8 × ядра)` секунд. Разброс между запусками большой (число попыток
распределено геометрически), так что это медианы.

- `workers: 1` (по умолчанию) — JavaScript работает в основном потоке, но несколько попыток идут
  одновременно, и PBKDF2 занимает до 4 ядер через пул потоков libuv (`UV_THREADPOOL_SIZE`).
- `workers: 'auto'` или число — поиск в worker-потоках, масштабируется по числу ядер.

## Обновление

Переходите со старой мажорной версии? См. [руководство по миграции](docs/MIGRATION.ru.md).
Все изменения перечислены в [CHANGELOG](CHANGELOG.md) (на английском).

## Участие и безопасность

- Сообщения об ошибках и pull request'ы приветствуются — см. [CONTRIBUTING.md](CONTRIBUTING.md)
  и [Кодекс поведения](CODE_OF_CONDUCT.md) (на английском).
- **Уязвимости** сообщайте приватно, как описано в [SECURITY.md](SECURITY.md). Если библиотека и
  TON-кошелёк показывают для одной мнемоники разные адреса — это уязвимость.

## Поддержать автора

Если библиотека сэкономила вам время, небольшое «спасибо» очень приятно 💙

- **TON:** `UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau` —
  [Tonkeeper](https://app.tonkeeper.com/transfer/UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau?text=Thank%20you%20for%20ton-wallet-finder!) ·
  [Tonhub](https://tonhub.com/transfer/UQA7h7IS4PvdaWi_0-77XfNRpZSLcDev4erumQpl5fbUJSau?text=Thank%20you%20for%20ton-wallet-finder!)
- [PayPal](https://www.paypal.me/lendelkz) · [Buy Me a Coffee](https://www.buymeacoffee.com/voanerges) · [Ko-fi](https://ko-fi.com/voanerges)

## Лицензия

[MIT](LICENSE) © [Lendel](https://github.com/lendel)
