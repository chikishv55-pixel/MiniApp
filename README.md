# Pixel Arena

Telegram Mini App: аркада в 8-бит стиле с вызовами друзьям.
Бот: [@pixelaren_bot](https://t.me/pixelaren_bot) · прод: https://pixel-arena-omega.vercel.app

## Что внутри

- **Меню** (`src/`) — Vite + React + TypeScript, профиль из Telegram (ник, аватар — хранятся на устройстве).
- **Меткий Джо** (`public/games/joe.html`) — игра в iframe. Рандом сидированный: в вызове оба игрока проходят одних и тех же врагов.
- **Вызовы** (`api/challenge.ts`) — ссылка `t.me/<бот>?start=c3...` подписана сервером (HMAC), подделать счёт или сид нельзя.
- **Бот** (`api/bot.ts`) — вебхук: `/start` с кнопкой «Играть», приём вызовов, `/id`.
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
| `BLOB_READ_WRITE_TOKEN` | сервер | Vercel добавляет сам при подключении Blob |
| `VITE_BOT_USERNAME` | клиент | ник бота без @ |
| `VITE_APP_SHORTNAME` | клиент | короткое имя мини-аппа из `/newapp` (необязательно) |

## Скрипты

- `node scripts/push-env.mjs KEY ...` — залить переменные из `.env.local` в Vercel (значения не печатаются).
- `node scripts/setup-bot.mjs` — прописать боту вебхук, кнопку меню, команды и описание.

## Деплой

Vercel привязан к репозиторию: пуш в `main` → автоматический деплой в прод.
