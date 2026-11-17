// Ежедневная сводка админам в личку + срок жизни старых ключей. Запускается Vercel Cron (см. vercel.json).
// Vercel сам шлёт заголовок Authorization: Bearer <CRON_SECRET>, остальным вход закрыт.
import { digestText, setTtls } from '../_lib/report.js'
import { statsReady } from '../_lib/stats.js'
import { adminIds, sendText } from '../_lib/tgbot.js'

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('forbidden', { status: 403 })
  if (!statsReady()) return new Response('stats not configured')

  try {
    const text = await digestText()
    for (const id of adminIds()) await sendText(id, text)
    await setTtls()
    return new Response('ok')
  } catch (e) {
    console.error(e)
    return new Response('failed', { status: 500 })
  }
}
