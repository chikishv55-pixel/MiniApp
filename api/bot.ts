// Вебхук Telegram-бота (Vercel Function). Telegram присылает сюда апдейты.
// Всем: /start (кнопка «Играть», вызовы по ссылке), /help, /privacy, /id.
// Админам из ADMIN_IDS: /stats, /games, /funnel, /ads, /shop — отчёты по статистике.
import { reportAds, reportFunnel, reportGames, reportShop, reportSources, reportStats } from './_lib/report.js'
import { noteStart, registerSrc, statsReady } from './_lib/stats.js'
import { adminIds, sendText } from './_lib/tgbot.js'

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const APP_URL = process.env.WEBAPP_URL?.replace(/\/+$/, '')
const CHANNEL = (process.env.CHANNEL_USERNAME || '').replace(/^@/, '')
const BOT_NAME = process.env.VITE_BOT_USERNAME || 'JoeGame_Bot'

// подписанный вызов из ссылки t.me/<бот>?start=c4... (c3 — старый формат; подпись проверяет /api/challenge)
const CHALLENGE_RE = /^c[34][A-Za-z0-9_-]{22,56}$/
// рекламная ссылка t.me/<бот>?start=ad_<метка>
const AD_START_RE = /^ad_([A-Za-z0-9]{1,16})$/

const HELP = [
  '🎯 Как играть в «Игры Джо»',
  '',
  '1️⃣ Жми «Играть» и выбери игру свайпом.',
  '• Меткий Джо — жми, когда прицел смотрит на врага.',
  '• Дуэль — стреляй, когда появится «ОГОНЬ!». Раньше — фальстарт.',
  '• Побег на поезде — тап слева прыжок (держи — выше), тап справа выстрел, свайп вниз — присесть.',
  '• Золотая лихорадка — води пальцем, лови золото, динамит не лови (3 жизни).',
  '• Башня из бочек — тап бросает бочку. Ставь ровно: сильный крен — башня рухнет.',
  '',
  '2️⃣ Прошёл? Жми «⚔ Вызов другу» — друг пройдёт ТЕ ЖЕ препятствия, и сразу видно, кто лучше.',
  '',
  '3️⃣ За монеты — наряды Джо и уровни пропуска с эксклюзивами.',
  '',
  CHANNEL ? `Новости и новые игры: @${CHANNEL}` : '',
]
  .filter((l, i, a) => l !== '' || a[i - 1] !== '')
  .join('\n')
  .trim()

const PRIVACY = [
  '🔒 Приватность',
  '',
  '• Твой прогресс (монеты, наряды, рекорды, ник и аватар) хранится только на твоём устройстве.',
  '• На сервере мы считаем лишь общую статистику: сколько людей зашло, сколько игр сыграно. Твои Telegram ID, имя и ник в читаемом виде мы не сохраняем — счётчики ведутся без списка людей.',
  '• Подписку на канал проверяет Telegram в момент входа, результат мы не записываем.',
  '• Хостинг (Vercel) может вести технические журналы запросов — это вне нашего контроля.',
  '',
  CHANNEL ? `Вопросы — в канале @${CHANNEL}.` : '',
]
  .join('\n')
  .trim()

async function adminReport(cmd: string): Promise<string | null> {
  const reports: Record<string, () => Promise<string>> = {
    '/stats': reportStats,
    '/games': reportGames,
    '/funnel': reportFunnel,
    '/ads': reportAds,
    '/shop': reportShop,
    '/src': reportSources,
  }
  const make = reports[cmd]
  if (!make) return null
  if (!statsReady()) {
    return 'Статистика пока не подключена: нужны переменные UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN (бесплатная база на upstash.com).'
  }
  try {
    return await make()
  } catch (e) {
    console.error('report failed', e)
    return 'Не удалось собрать отчёт — попробуй ещё раз через минуту.'
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !SECRET || !APP_URL) return new Response('bot is not configured', { status: 500 })

  // Telegram подписывает каждый запрос секретом, который мы задали в setWebhook
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) {
    return new Response('forbidden', { status: 403 })
  }

  let update: any
  try {
    update = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const msg = update?.message
  const chatId = msg?.chat?.id
  const fromId = msg?.from?.id
  const text: string = typeof msg?.text === 'string' ? msg.text : ''

  // всё ниже — только личка с ботом (кнопки web_app в группах не работают)
  if (chatId && msg.chat.type === 'private' && text.startsWith('/')) {
    const parts = text.trim().split(/\s+/)
    const cmd = parts[0].split('@')[0].toLowerCase()
    const payload = parts[1] ?? ''

    if (cmd === '/id' && fromId) {
      await sendText(chatId, `Твой Telegram ID: ${fromId}`)
    } else if (cmd === '/help') {
      await sendText(chatId, HELP)
    } else if (cmd === '/privacy') {
      await sendText(chatId, PRIVACY)
    } else if (cmd === '/start') {
      const isChallenge = CHALLENGE_RE.test(payload)
      const tag = AD_START_RE.exec(payload)?.[1]?.toLowerCase()
      if (tag && fromId && statsReady()) {
        try {
          await noteStart(tag, fromId)
        } catch (e) {
          console.error('noteStart failed', e)
        }
      }
      const url = isChallenge ? `${APP_URL}/?startapp=${payload}` : tag ? `${APP_URL}/?src=${tag}` : APP_URL
      const share = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_NAME}`)}&text=${encodeURIComponent('Играем в «Игры Джо» — кидаем друг другу вызовы 🎯')}`
      const rows: unknown[][] = [[{ text: isChallenge ? '⚔ Принять вызов' : '▶ Играть', web_app: { url } }]]
      const second: unknown[] = []
      if (CHANNEL) second.push({ text: '📣 Канал', url: `https://t.me/${CHANNEL}` })
      second.push({ text: '👥 Позвать друга', url: share })
      rows.push(second)
      await sendText(
        chatId,
        isChallenge
          ? '⚔ Тебе прилетел вызов! Жми и покажи, кто тут меткий.'
          : '🎯 Игры Джо — игры про Джо прямо в Telegram.\n\n▶ Меткий Джо · ⚡ Дуэль · 🚂 Побег на поезде · 💰 Золотая лихорадка · 🛢 Башня из бочек\n\n⚔ Кидай вызовы друзьям: они пройдут те же препятствия, что и ты.\n\nПравила — /help' +
              (CHANNEL ? `\nНовости и новые игры — @${CHANNEL}` : ''),
        { reply_markup: { inline_keyboard: rows } },
      )
    } else if (fromId && adminIds().includes(fromId) && cmd === '/link') {
      // /link pub1 → заводит метку и отдаёт рекламную ссылку (только админам)
      const t = (parts[1] || '').toLowerCase()
      if (!/^[a-z0-9]{1,16}$/.test(t)) {
        await sendText(chatId, 'Напиши метку латиницей и цифрами (до 16 символов), например:\n/link pub1')
      } else if (!statsReady()) {
        await sendText(chatId, 'Статистика не подключена — метки считать негде.')
      } else {
        let ok = false
        try {
          ok = await registerSrc(t)
        } catch (e) {
          console.error('registerSrc failed', e)
        }
        await sendText(
          chatId,
          ok
            ? `Ссылка для рекламы «${t}»:\nhttps://t.me/${BOT_NAME}?start=ad_${t}\n\nСчитаются люди, которые пришли по ней: /src`
            : 'Не получилось завести метку — попробуй ещё раз.',
        )
      }
    } else if (fromId && adminIds().includes(fromId)) {
      // админские отчёты; чужим эти команды не отвечают вообще
      const out = await adminReport(cmd)
      if (out) await sendText(chatId, out)
    }
  }

  // всегда 200, иначе Telegram будет слать тот же апдейт повторно
  return new Response('ok')
}

export function GET(): Response {
  return new Response('joe games bot webhook: alive')
}
