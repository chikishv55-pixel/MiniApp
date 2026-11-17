// Настройка бота одной командой: node scripts/setup-bot.mjs
// Берёт TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET и WEBAPP_URL из .env.local
// и прописывает вебхук, кнопку меню, команды и описание. Токен в консоль не выводится.
import { readFileSync } from 'node:fs'

function loadEnv(file) {
  const env = {}
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* файла нет */
  }
  return env
}

const env = { ...loadEnv('.env.local'), ...process.env }
const TOKEN = env.TELEGRAM_BOT_TOKEN
const SECRET = env.TELEGRAM_WEBHOOK_SECRET
const APP_URL = env.WEBAPP_URL?.replace(/\/+$/, '')

const missing = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'WEBAPP_URL'].filter((k) => !env[k])
if (missing.length) {
  console.error('Не хватает в .env.local:', missing.join(', '))
  process.exit(1)
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json()
  console.log(`${data.ok ? 'OK  ' : 'FAIL'} ${method}${data.ok ? '' : ' — ' + data.description}`)
  if (!data.ok) process.exitCode = 1
  return data.result
}

const me = await call('getMe')
if (me) console.log(`     бот: @${me.username}`)

await call('setWebhook', {
  url: `${APP_URL}/api/bot`,
  secret_token: SECRET,
  allowed_updates: ['message'],
  drop_pending_updates: true,
})
await call('setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'Играть', web_app: { url: APP_URL } },
})
await call('setMyCommands', {
  commands: [
    { command: 'start', description: 'Открыть игры' },
    { command: 'help', description: 'Как играть' },
    { command: 'privacy', description: 'Приватность' },
  ],
})
// админские команды видны только админам (ADMIN_IDS) в их личке с ботом
for (const id of (env.ADMIN_IDS || '').split(',').map((s) => Number(s.replace(/[^0-9]/g, ''))).filter(Boolean)) {
  await call('setMyCommands', {
    scope: { type: 'chat', chat_id: id },
    commands: [
      { command: 'stats', description: 'Статистика: сегодня, вчера, 7 дней' },
      { command: 'games', description: 'Результаты по играм' },
      { command: 'funnel', description: 'Воронка: открыли → подписались → сыграли' },
      { command: 'ads', description: 'Показы и клики баннеров' },
      { command: 'shop', description: 'Покупки и пропуск' },
      { command: 'src', description: 'Откуда пришли: по рекламным ссылкам' },
      { command: 'link', description: 'Рекламная ссылка: /link метка' },
      { command: 'start', description: 'Открыть игры' },
      { command: 'help', description: 'Как играть' },
      { command: 'privacy', description: 'Приватность' },
      { command: 'id', description: 'Мой Telegram ID' },
    ],
  })
}
await call('setMyName', { name: 'Игры Джо' })
await call('setMyShortDescription', { short_description: 'Игры про Джо прямо в Telegram. Кидай вызовы друзьям! Канал: @JoesGames' })
await call('setMyDescription', {
  description:
    'Игры Джо — аркада про самого меткого парня на диком западе. Меткий Джо, Дуэль, Побег на поезде, Золотая лихорадка и Башня из бочек. ' +
    'Бей рекорды и кидай вызовы друзьям: кто пройдёт тех же врагов?\n\nКанал игры: @JoesGames',
})

const info = await call('getWebhookInfo')
if (info) console.log(`     вебхук: ${info.url}${info.last_error_message ? ' (ошибка: ' + info.last_error_message + ')' : ''}`)
