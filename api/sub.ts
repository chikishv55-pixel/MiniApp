// GET /api/sub — подписан ли игрок на канал игры (нужен initData).
// Проверяет сервер через Telegram Bot API (getChatMember), бот должен быть админом канала.
// → { subscribed, channel }   channel — @username без @, чтобы клиент открыл ссылку на канал
import { authUser, fail, json } from './_lib/http.js'

const MEMBER = new Set(['creator', 'administrator', 'member'])

export async function GET(req: Request): Promise<Response> {
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  const token = process.env.TELEGRAM_BOT_TOKEN
  const channel = (process.env.CHANNEL_USERNAME || '').replace(/^@/, '')
  // канал не настроен — не блокируем игру
  if (!token || !channel) return json({ subscribed: true, channel: null })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: `@${channel}`, user_id: user.id }),
    })
    const data: any = await res.json()
    if (!data.ok) {
      // «user not found» и подобное = не подписан; остальные ошибки Telegram — не блокируем игрока
      const notMember = res.status === 400 && /user not found|participant|member/i.test(data.description || '')
      if (!notMember) console.error('getChatMember failed', res.status, data.description)
      return json({ subscribed: !notMember, channel })
    }
    const m = data.result
    const subscribed = MEMBER.has(m.status) || (m.status === 'restricted' && m.is_member === true)
    return json({ subscribed, channel })
  } catch (e) {
    console.error('getChatMember error', e)
    return json({ subscribed: true, channel })
  }
}
