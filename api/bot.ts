// Вебхук Telegram-бота (Vercel Function). Telegram присылает сюда апдейты.
// Всем: /start (приветствие с кнопкой «Играть», вызовы по старым ссылкам), /help, /privacy, /id.
// Админам из ADMIN_IDS: /stats, /games, /funnel, /ads, /shop — отчёты по статистике.
import { reportAds, reportFunnel, reportGames, reportShop, reportSources, reportStats } from './_lib/report.js'
import { noteStart, registerSrc, statsReady } from './_lib/stats.js'
import { adminIds, sendPhoto, sendText } from './_lib/tgbot.js'

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const APP_URL = process.env.WEBAPP_URL?.replace(/\/+$/, '')
const CHANNEL = (process.env.CHANNEL_USERNAME || '').replace(/^@/, '')
const BOT_NAME = process.env.VITE_BOT_USERNAME || 'JoeGame_Bot'

// подписанный вызов из ссылки t.me/<бот>?start=c4... (c3 — старый формат; подпись проверяет /api/challenge)
const CHALLENGE_RE = /^c[34][A-Za-z0-9_-]{22,56}$/
// рекламная ссылка t.me/<бот>?start=ad_<метка>
const AD_START_RE = /^ad_([A-Za-z0-9]{1,16})$/

const HELP = [
  '🔧 Как играть в «Перекуп Джо»',
  '',
  '1️⃣ В гараже жми на компьютер 🖥 и открой счёт в банке «Копейка» — там твои деньги.',
  '2️⃣ На «Авто с рук» выбери тачку по карману. Поторгуйся — продавцы уступают.',
  '3️⃣ Приведи её в порядок пальцем: отмой грязь, сдери ржавчину, покрась и отполируй. Краску нужного цвета закажи на «ЗапчастиТут».',
  '4️⃣ Сфотографируй машину 📷, когда она блестит, и выставь на своём сайте «Джо Моторс».',
  '5️⃣ Жди предложений и продавай дороже, чем купил. Навар — в новые тачки и инструмент: мойку, дрель, краскопульт, полировальную машинку.',
  '',
  '💾 Прогресс сохраняется в Telegram — играй и с телефона, и с компьютера.',
  CHANNEL ? `\nНовости игры: @${CHANNEL}` : '',
]
  .join('\n')
  .trim()

const PRIVACY = [
  '🔒 Приватность',
  '',
  '• Твой прогресс (деньги, машины, инструменты, настройки) хранится на устройстве и в облачном хранилище Telegram, привязанном к твоему аккаунту и этому боту. Его видишь только ты, у нас отдельной базы с ним нет.',
  '• На сервере мы считаем лишь общую статистику: сколько людей зашло, сколько игр сыграно. Твои Telegram ID, имя и ник в читаемом виде мы не сохраняем — счётчики ведутся без списка людей.',
  '• Подписку на канал проверяет Telegram в момент входа, результат мы не записываем.',
  '• Хостинг (Vercel) может вести технические журналы запросов — это вне нашего контроля.',
  '',
  CHANNEL ? `Вопросы — в канале @${CHANNEL}.` : '',
]
  .join('\n')
  .trim()

// приветствие после /start; картинка — public/bot/welcome.jpg (нет файла — уйдёт просто текстом)
const WELCOME = [
  '🔧 Перекуп Джо',
  '',
  'Покупай ржавые тачки за копейки, доводи до блеска и продавай втридорога.',
  '',
  '🚗 Десять машин — от «Шивы» до DMW 5-series',
  '🧽 Моешь, сдираешь ржавчину, красишь и полируешь прямо пальцем',
  '💰 Торгуешься с продавцами и покупателями',
  '🛠 Копишь на мойку, дрель и краскопульт',
  '',
  '💾 Прогресс общий на телефоне и компьютере.',
  'Как играть — /help',
].join('\n')

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
      const share = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_NAME}`)}&text=${encodeURIComponent('Перекуп Джо: покупаю ржавые тачки, делаю конфетку и продаю дороже 🔧 Залетай!')}`
      const rows: unknown[][] = [[{ text: isChallenge ? '⚔ Принять вызов' : '🔧 Играть', web_app: { url } }]]
      const second: unknown[] = []
      if (CHANNEL) second.push({ text: '📣 Канал', url: `https://t.me/${CHANNEL}` })
      second.push({ text: '👥 Позвать друга', url: share })
      rows.push(second)
      const markup = { reply_markup: { inline_keyboard: rows } }
      if (isChallenge) await sendText(chatId, '⚔ Тебе прилетел вызов! Жми и покажи, на что способен.', markup)
      else {
        const caption = WELCOME + (CHANNEL ? `\nНовости — @${CHANNEL}` : '')
        // картинки ещё нет или Telegram не смог её скачать — шлём то же самое текстом
        if (!(await sendPhoto(chatId, `${APP_URL}/bot/welcome.jpg`, caption, markup))) await sendText(chatId, caption, markup)
      }
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
  return new Response('perekup joe bot webhook: alive')
}
