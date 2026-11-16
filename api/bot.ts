// Вебхук Telegram-бота (Vercel Function). Telegram присылает сюда апдейты,
// а мы отвечаем сообщением с кнопкой, которая открывает мини-апп.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const APP_URL = process.env.WEBAPP_URL?.replace(/\/+$/, '')

// подписанный вызов из ссылки t.me/<бот>?start=c3... (подпись проверяет /api/challenge)
const CHALLENGE_RE = /^c3[A-Za-z0-9_-]{22,55}$/

async function callTg(method: string, body: unknown): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`telegram ${method} failed: ${res.status} ${await res.text()}`)
}

export async function POST(req: Request): Promise<Response> {
  if (!TOKEN || !SECRET || !APP_URL) return new Response('bot is not configured', { status: 500 })

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
  const text: string | undefined = msg?.text

  // /id — показать свой Telegram ID (нужен, чтобы прописать себя в ADMIN_IDS)
  if (chatId && msg.chat.type === 'private' && text?.trim() === '/id' && msg.from?.id) {
    try {
      await callTg('sendMessage', { chat_id: chatId, text: `Твой Telegram ID: ${msg.from.id}` })
    } catch (e) {
      console.error('sendMessage error', e)
    }
    return new Response('ok')
  }

  // кнопки web_app работают только в личке с ботом
  if (chatId && msg.chat.type === 'private' && text?.startsWith('/start')) {
    const payload = text.split(' ')[1] ?? ''
    const isChallenge = CHALLENGE_RE.test(payload)
    const url = isChallenge ? `${APP_URL}/?startapp=${payload}` : APP_URL

    try {
      await callTg('sendMessage', {
        chat_id: chatId,
        text: isChallenge
          ? '⚔ Тебе прилетел вызов! Жми и покажи, кто тут меткий.'
          : '🕹 Pixel Arena — мини-игры и вызовы друзьям.\n\nБей рекорды, кидай вызовы кентам. Жми «Играть»!',
        reply_markup: {
          inline_keyboard: [[{ text: isChallenge ? '⚔ Принять вызов' : '▶ Играть', web_app: { url } }]],
        },
      })
    } catch (e) {
      console.error('sendMessage error', e)
    }
  }

  // всегда 200, иначе Telegram будет слать тот же апдейт повторно
  return new Response('ok')
}

export function GET(): Response {
  return new Response('pixel arena bot webhook: alive')
}
