# Green City API (Cloudflare Worker)

Бэкенд Green City на Cloudflare Workers. Поэтапно заменяет Google Apps Script,
при этом **Google Sheets остаётся источником правды** — сотрудники продолжают
редактировать таблицы вручную, Worker читает (а позже и пишет) туда же через
Google Sheets API, под служебным аккаунтом (service account).

Текущий этап: подтверждена рабочая авторизация и чтение данных из таблицы
(`/test-sheets`). Бизнес-логика (разбор исключений, стикеры и т.д.) ещё не
перенесена — следующие этапы.

## Требования

- Node.js ≥ 20 (проверить: `node --version`). На Windows несколько
  установленных версий node.exe могут конфликтовать по PATH — через
  `where.exe node` видно, какой файл выполняется первым.
- Аккаунт Cloudflare (бесплатного тарифа достаточно).
- Service account в Google Cloud с доступом к нужной Google-таблице (таблица
  должна быть расшарена на email сервис-аккаунта, как на обычного пользователя).

## Установка

```bash
npm install
```

## Локальная разработка

1. Скопируйте `.dev.vars.example` в `.dev.vars` и вставьте туда реальный JSON
   ключа сервис-аккаунта (одной строкой, см. комментарий в файле).
   `.dev.vars` в git не попадает (см. `.gitignore`).
2. Запустите:
   ```bash
   npm run dev
   ```
3. Откройте `http://localhost:8787/test-sheets` — должен вернуться JSON с
   примером данных из листа "Ингредиенты".

## Продакшен: секрет сервис-аккаунта

Секрет **никогда** не хранится в коде или в `wrangler.toml` — только в
зашифрованном хранилище Cloudflare:

```bash
npx wrangler login
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```
(вставьте содержимое JSON-ключа, когда попросит — через стандартный ввод,
не как аргумент команды)

## Деплой

```bash
npm run deploy
```

После деплоя проверьте `https://<ваш-worker>.workers.dev/test-sheets`.

## Структура проекта

```
src/
  google-auth.js   — авторизация service account (JWT → access token), Web Crypto API
  index.js         — Worker: маршруты, CORS, чтение Google Sheets
wrangler.toml      — конфигурация Worker (имя, несекретные переменные)
.dev.vars.example  — шаблон локальных секретов для `wrangler dev`
```

## Важные заметки

- `SPREADSHEET_ID` в `wrangler.toml` — это ID таблицы из её URL, не секрет,
  поэтому хранится открыто.
- `getGoogleAccessToken(json, scope)` по умолчанию запрашивает scope только на
  чтение (`spreadsheets.readonly`). Для записи в таблицу нужно будет передавать
  `https://www.googleapis.com/auth/spreadsheets` явным вторым аргументом.
- Код не использует никаких Node.js-специфичных API — работает и в Workers, и
  в обычном Node (поэтому `nodejs_compat` в `wrangler.toml` не нужен).
