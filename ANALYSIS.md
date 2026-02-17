# Профессиональный анализ: `ton-wallet-finder` v2.0.0

> Дата анализа: 2026-02-17
> Ветка: `claude/analysis-recommendations-plan-92yUi`

---

## Краткое резюме

`ton-wallet-finder` — NPM-библиотека для генерации TON-кошельков с заданным окончанием адреса (vanity address finder). Код функционален в базовых сценариях, однако содержит **два критических бага**, которые ломают ключевую опцию `saveResult: true`. Инфраструктура тестирования настроена, но тесты удалены. Отсутствуют TypeScript-декларации и CI/CD.

---

## 1. Критические баги

### BUG-01 — `TypeError: words.join is not a function` (`index.js:96`)

**Воспроизводится:** При каждом вызове с опцией `saveResult: true`.

```js
// findWalletWithEnding() строка 84 — words передаётся как уже готовая строка:
saveResultsToFile(publicKey, privateKey, words.join(' '), walletAddress);

// saveResultsToFile() строка 96 — вызов .join() на строке → TypeError:
const data = `Words: ${words.join(' ')}\n`;
```

**Исправление:** Передавать `words` массивом в `saveResultsToFile` и убрать дублирующий `.join()`.

---

### BUG-02 — `Cannot read properties of null` в `saveResultsToFile` (`index.js:93`)

**Воспроизводится:** При вызове из ESM-модуля (`"type": "module"`), в тестовой среде (mocha), при `require()` без main-контекста.

```js
// require.main === null в этих окружениях:
const scriptDirectory = path.dirname(require.main.filename); // ← crash
```

**Исправление:** Использовать `require.main?.filename ?? process.cwd()`.

---

## 2. Проблемы безопасности

| ID | Проблема | Уровень | Рекомендация |
|----|----------|---------|--------------|
| SEC-01 | Приватный ключ сохраняется в plain-text файл | HIGH | Добавить явное предупреждение в README и console; рассмотреть шифрование |
| SEC-02 | 24-словная мнемоника в plain-text файл | HIGH | Аналогично SEC-01 |
| SEC-03 | Нет ограничения минимальной длины `targetEnding` | LOW | Рекомендовать минимум 4 символа (вероятность 1/14.7M) |

---

## 3. Архитектурные проблемы

### 3.1 Positional API (хрупкий конструктор)

```js
// Текущий API — порядок параметров легко перепутать:
new TonWalletFinder('abc', false, true, false)

// Рекомендуется options-object:
new TonWalletFinder('abc', {
    showProcess: false,
    showResult: true,
    saveResult: false
})
```

### 3.2 Нет механизма отмены поиска

```js
const finder = new TonWalletFinder('abcde');
finder.findWalletWithEnding(); // запустили
// Нет AbortController, нет stop(), нет способа остановить
```

**Рекомендация:** Принимать `AbortSignal` в `findWalletWithEnding(signal?)`.

### 3.3 Прогресс только через console.log

При `showProcess: true` интегрировать библиотеку в UI-приложение невозможно без перехвата stdout.

**Рекомендация:** Поддержать `EventEmitter` или callback `onProgress(count, address)`.

### 3.4 Жёстко задан WalletContractV4

TON-экосистема уже имеет V5R1. Пользователи новых кошельков не могут использовать библиотеку.

**Рекомендация:** Добавить опцию `walletVersion: 'v4' | 'v5r1'`.

### 3.5 Однопоточность

Node.js Worker Threads не используются. Брутфорс однопоточный.

**Оценка времени** (примерная, Node.js, 1 поток):

| Длина окончания | Пространство | Ожидаемое время |
|---|---|---|
| 2 символа | 3,844 | < 1 секунды |
| 3 символа | 238,328 | ~ 5–15 секунд |
| 4 символа | ~14.7M | ~ 5–30 минут |
| 5 символов | ~916M | ~ 5–50 часов |
| 6 символов | ~56.8B | недели |

**Рекомендация:** Реализовать опциональный параллельный поиск через `worker_threads`.

---

## 4. Отсутствующая инфраструктура

| Компонент | Статус | Приоритет |
|-----------|--------|-----------|
| Тесты | ❌ Удалены (`.gitignore` включает `test/`) | CRITICAL |
| TypeScript declarations (`index.d.ts`) | ❌ Отсутствуют | HIGH |
| GitHub Actions CI | ❌ Отсутствует | MEDIUM |
| CHANGELOG | ❌ Отсутствует | LOW |
| Оценка времени поиска в README | ❌ Отсутствует | LOW |

---

## 5. Мелкие проблемы

- `keywords` в `package.json` содержит `tonweb` — устаревшая библиотека, вводит в заблуждение при поиске в npm
- Комментарии в коде на русском, но библиотека публичная (международная аудитория)
- Нет JSDoc для публичного API

---

## Подробный пошаговый план действий

---

### ФАЗА 1 — Исправление критических багов (срочно)

**Шаг 1.1** — Исправить `BUG-01`: в `findWalletWithEnding` передавать `words` (массив) напрямую, убрать `words.join(' ')` из `saveResultsToFile`.

**Шаг 1.2** — Исправить `BUG-02`: заменить `require.main.filename` на безопасный вариант с optional chaining и fallback на `process.cwd()`.

**Шаг 1.3** — Добавить `try-catch` в основной цикл `findWalletWithEnding` для обработки ошибок криптографических операций.

**Результат:** `saveResult: true` работает корректно во всех окружениях.

---

### ФАЗА 2 — Восстановление тестов

**Шаг 2.1** — Убрать `test/` из `.gitignore`.

**Шаг 2.2** — Создать `test/TonWalletFinder.test.js` с покрытием:
- Валидация `targetEnding` в конструкторе (корректные/некорректные символы)
- `createKeyPair()` возвращает `{ keyPair, words }` с нужной структурой
- `createWallet()` возвращает адрес
- `findWalletWithEnding()` с коротким паттерном (1 символ) для быстрого теста
- `saveResultsToFile()` — mock `fs.writeFile` через sinon, проверить корректный контент

**Шаг 2.3** — Убедиться, что `npm test` проходит зелёным.

---

### ФАЗА 3 — TypeScript-декларации

**Шаг 3.1** — Создать `index.d.ts`:
```typescript
export interface WalletResult {
    publicKey: string;
    privateKey: string;
    words: string[];
    walletAddress: string;
}

export class TonWalletFinder {
    constructor(
        targetEnding: string,
        showProcess?: boolean,
        showResult?: boolean,
        saveResult?: boolean
    );
    createKeyPair(): Promise<{ keyPair: any; words: string[] }>;
    createWallet(keyPair: any): Promise<any>;
    findWalletWithEnding(): Promise<WalletResult>;
}

export function saveResultsToFile(
    publicKey: string,
    privateKey: string,
    words: string[],
    walletAddress: string,
    fileName?: string
): void;
```

**Шаг 3.2** — Добавить `"types": "index.d.ts"` в `package.json`.

---

### ФАЗА 4 — CI/CD

**Шаг 4.1** — Создать `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

---

### ФАЗА 5 — Улучшение package.json

**Шаг 5.1** — Исправить `keywords`: убрать `tonweb`, добавить `vanity`, `mnemonic`, `ton-blockchain`.

**Шаг 5.2** — Добавить `"types": "index.d.ts"`.

**Шаг 5.3** — Обновить версию до `2.1.0` (патчи + minor additions).

---

### ФАЗА 6 — Долгосрочные улучшения (backlog)

| Задача | Сложность | Ценность |
|--------|-----------|---------|
| Поддержка `WalletContractV5R1` | Средняя | Высокая |
| Параллельный поиск (Worker Threads) | Высокая | Высокая для длинных паттернов |
| Options-object API (с BC-совместимостью) | Средняя | Средняя |
| EventEmitter / onProgress callback | Средняя | Средняя |
| AbortController поддержка | Средняя | Средняя |
| CLI-обёртка (`npx ton-wallet-finder --ending abc`) | Средняя | Высокая для юзабилити |
| Оценка времени до нахождения в консоли | Низкая | Высокая |

---

## Итоговые приоритеты

```
P0 (СРОЧНО): BUG-01, BUG-02
P1 (ВАЖНО):  Тесты, TypeScript declarations
P2 (НУЖНО):  CI/CD, package.json fixes
P3 (BACKLOG): Worker Threads, options API, CLI, EventEmitter
```
