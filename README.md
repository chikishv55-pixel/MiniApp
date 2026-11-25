# Перекуп Джо

Telegram Mini App: симулятор перекупа — покупаешь ржавые тачки, доводишь до блеска и продаёшь дороже (`public/games/flip.html`). Старые аркады про Джо с вызовами друзьям лежат рядом, меню с ними выключено (`SOLO` в `src/App.tsx`). Перед игрой — обязательная подписка на канал [@JoesGames](https://t.me/JoesGames).
Бот: [@JoeGame_Bot](https://t.me/JoeGame_Bot) · прод: https://pixel-arena-omega.vercel.app

## Что внутри

- **Меню** (`src/`) — Vite + React + TypeScript, профиль из Telegram (ник, аватар — хранятся на устройстве).
- **Меткий Джо** (`public/games/joe.html`) — игра в iframe. Рандом сидированный: в вызове оба игрока проходят одних и тех же врагов.
- **Вызовы** (`api/challenge.ts`) — ссылка `t.me/<бот>?start=c3...` подписана сервером (HMAC), подделать счёт или сид нельзя.
- **Бот** (`api/bot.ts`) — вебхук: `/start` с приветственной картинкой (`public/bot/welcome.jpg`) и кнопкой «Играть», `/help`, `/privacy`, `/id`.
- **Реклама** (`api/ad.ts`, `api/admin/ads.ts`) — баннеры в Vercel Blob, админка в меню только для `ADMIN_IDS`.
- **`later/supabase/`** — готовая версия с базой (ТОП, синхронизация между устройствами), пока не подключена.

Все запросы к API подписаны `Telegram.WebApp.initData`, сервер проверяет подпись токеном бота.

## Запуск

```bash
npm install --registry=https://registry.npmjs.org
npm run dev
```

API (`/api/*`) работает только на Vercel или в `vercel dev`.

## Переменные окружения

Шаблон — `.env.example`, локально — `.env.local` (в git не попадает).

| Переменная | Где | Зачем |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | сервер | токен бота из @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | сервер | подпись вебхука и вызовов |
| `WEBAPP_URL` | сервер | адрес сайта для кнопок бота |
| `ADMIN_IDS` | сервер | Telegram ID админов через запятую |
| `CHANNEL_USERNAME` | сервер | канал, на который нужна подписка (бот — админ канала) |
| `BLOB_READ_WRITE_TOKEN` | сервер | Vercel добавляет сам при подключении Blob |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | сервер | бесплатная база для статистики (необязательно) |
| `CRON_SECRET` | сервер | секрет ежедневной сводки админам |
| `STATS_TZ` | сервер | часовой пояс отчётов, по умолчанию 3 |
| `VITE_BOT_USERNAME` | клиент | ник бота без @ |
| `VITE_APP_SHORTNAME` | клиент | короткое имя мини-аппа из `/newapp` (необязательно) |

## Статистика (для админа)
Команды бота только для `ADMIN_IDS`: `/stats`, `/games`, `/funnel`, `/ads`, `/shop`; каждое утро приходит сводка за вчера.
Счёт ведётся в бесплатном Upstash Redis без хранения Telegram ID: уникальные люди считаются HyperLogLog'ом, в базе только счётчики.
Клиент копит события и шлёт пачкой (`src/track.ts` → `api/track.ts`), отчёты — `api/_lib/report.ts`.
Проверка без интернета: собрать API (`npx tsc -p tsconfig.json --noEmit false --allowImportingTsExtensions false --outDir content/api-build --declaration false`),
затем `node scripts/stats-test.mjs` и `node scripts/track-client-test.mjs`.

## Скрипты

- `node scripts/push-env.mjs KEY ...` — залить переменные из `.env.local` в Vercel (значения не печатаются).
- `node scripts/setup-bot.mjs` — прописать боту вебхук, кнопку меню, команды и описание.

## Деплой

Vercel привязан к репозиторию: пуш в `main` → автоматический деплой в прод.
