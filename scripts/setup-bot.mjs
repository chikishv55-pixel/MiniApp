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
await call('setMyCommands', { commands: [{ command: 'start', description: 'Открыть игры' }] })
await call('setMyShortDescription', { short_description: 'Мини-игры в 8-бит и вызовы друзьям' })
await call('setMyDescription', {
  description: 'Pixel Arena — аркада прямо в Telegram. Бей рекорды и кидай вызовы кентам: кто дальше пройдёт тех же врагов?',
})

const info = await call('getWebhookInfo')
if (info) console.log(`     вебхук: ${info.url}${info.last_error_message ? ' (ошибка: ' + info.last_error_message + ')' : ''}`)
