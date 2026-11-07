# Руководство по миграции

[English](MIGRATION.md) · **Русский**

Как переходить между мажорными версиями `ton-wallet-finder`. Все изменения, включая минорные и
патч-версии, перечислены в [CHANGELOG](../CHANGELOG.md) (на английском).

- [5.x → 6.0](#5x--60)
- [4.x → 5.x](#4x--5x)
- [3.x → 4.0](#3x--40)
- [2.x → 3.x / 4.x](#2x--3x--4x)

---

## 5.x → 6.0

**Что нового:**
- зашифрованное сохранение: `saveResult: { password }` и `decryptResults()`;
- более быстрый поиск: однопоточный режим по умолчанию быстрее до ~4 раз, а worker-потоки
  масштабируются дальше 4 ядер;
- требуется Node.js 22+.

| Что изменилось | 5.x | 6.0 |
|---|---|---|
| Node.js | `>=20` | `>=22` |
| Нагрузка на CPU при `workers: 1` | один PBKDF2 за раз | до 4 одновременных PBKDF2 в пуле libuv (`UV_THREADPOOL_SIZE=1` вернёт старое поведение) |
| 5-й аргумент `saveResultsToFile()` | строка `fileName` | строка `fileName` **или** `{ fileName, password }` (строка по-прежнему работает) |

Других изменений API нет: адреса, значения по умолчанию и формат результата те же.

---

## 4.x → 5.x

**Что нового:** в 5.0 позиционные аргументы конструктора заменены объектом опций, а `workers`
стал значением по умолчанию в конструкторе. В 5.1 добавлен выбор версии кошелька
(`walletVersion: 'v3r2' | 'v4r2' | 'v5r1'`). По умолчанию остаётся `'v4r2'`, поэтому существующий
код получает ровно те же адреса.

> Версия 5.0.0 отдельно в npm не публиковалась; первая версия 5.x в npm — 5.1.0.

| Что изменилось | 4.x | 5.x |
|---|---|---|
| Сигнатура конструктора | `TonWalletFinder(targetEnding, showProcess, showResult, saveResult)` | `TonWalletFinder(targetEnding, { showProcess, showResult, saveResult, workers, walletVersion })` |
| `workers` | только в `findWalletWithEnding({ workers })`, по умолчанию `1` | Также опция конструктора (задаёт значение по умолчанию); `findWalletWithEnding({ workers })` по-прежнему переопределяет её для вызова |
| `walletVersion` | не существовала | Новая опция, по умолчанию `'v4r2'`; `'v3r2'` / `'v5r1'` принимаются с 5.1.0 |

### Чек-лист

1. **Вызов конструктора.** Перенесите булевы аргументы в объект опций, позиционные аргументы
   больше не поддерживаются:
   ```js
   // 4.x
   new TonWalletFinder('abc', true, true, false);
   // 5.x
   new TonWalletFinder('abc', { showProcess: true, showResult: true });
   ```

2. **`workers`.** Если вы всегда передавали одно и то же значение в каждый вызов
   `findWalletWithEnding()`, его можно перенести в конструктор:
   ```js
   // 4.x
   const finder = new TonWalletFinder('abc');
   await finder.findWalletWithEnding({ workers: 'auto' });
   // 5.x
   const finder = new TonWalletFinder('abc', { workers: 'auto' });
   await finder.findWalletWithEnding();
   ```
   Если хотите и дальше передавать `workers` при каждом вызове, ничего менять не нужно: это
   по-прежнему работает как переопределение для вызова.

3. **`walletVersion`.** Ничего делать не нужно: по умолчанию `'v4r2'`, ровно то, что всегда
   выдавала 4.x. Передавайте `'v3r2'` или `'v5r1'`, только если именно в такой кошелёк будете
   импортировать мнемонику.

---

## 3.x → 4.0

**Код менять не нужно.** В 4.0 убраны все внешние зависимости. Раньше библиотека использовала
`@ton/ton` и `@ton/crypto`, которые тянули за собой 31 транзитивный пакет (в том числе
`tweetnacl`, `@ton/core`, `axios` и `jssha`). С 4.0 всё реализовано только на встроенных
модулях Node.js:

| Что | Как |
|---|---|
| Генерация мнемоники | CSPRNG из `crypto` + встроенный список слов BIP-39 |
| HMAC-SHA-512 / PBKDF2-SHA-512 | `crypto.createHmac` / `crypto.pbkdf2` |
| Вывод ключа Ed25519 | `crypto.createPrivateKey` с обёрткой seed в PKCS#8 |
| Адрес кошелька | Хэш TVM-ячейки (SHA-256) + CRC-16/XMODEM |

`npm install ton-wallet-finder` устанавливает **0 дополнительных пакетов**.

> Версия 4.0.1 (исправление ESM-импорта, безопасное сохранение файла, ограничение повторов)
> отдельно не публиковалась; её исправления вошли в 4.1.0.

---

## 2.x → 3.x / 4.x

| Что изменилось | 2.x | 3.x / 4.x |
|---|---|---|
| Значение `showResult` по умолчанию | `true`: приватный ключ по умолчанию выводился в консоль | `false`: по умолчанию ничего не выводится |
| `createWallet()` | возвращала `Promise<Address>` | возвращает `Address` синхронно |
| `saveResultsToFile()` | возвращала `void` (без ожидания) | 3.x: `Promise<void>`; 4.0.1+: `Promise<string \| undefined>` с путём к файлу |

### Чек-лист

1. **`showResult`.** Если вы полагались на вывод в консоль по умолчанию, включите его явно:
   ```js
   // 2.x (неявно)
   new TonWalletFinder('abc');
   // 3.x / 4.x
   new TonWalletFinder('abc', false, true);
   ```

2. **`createWallet()`.** Если вызывали с `await`, уберите `await`:
   ```js
   // 2.x
   const address = await finder.createWallet(keyPair);
   // 3.x / 4.x
   const address = finder.createWallet(keyPair);
   ```

3. **`saveResultsToFile()`.** Если вызывали отдельно, добавьте `await`:
   ```js
   // 2.x
   saveResultsToFile(pub, priv, words, addr);
   // 3.x / 4.x
   await saveResultsToFile(pub, priv, words, addr);
   ```

После этого переходите к разделам [3.x → 4.0](#3x--40) и [4.x → 5.x](#4x--5x).
