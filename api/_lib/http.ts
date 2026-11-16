import { verifyInitData, type TgUser } from './tg.js'

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

export const fail = (status: number, error: string) => json({ error }, status)

// клиент шлёт Telegram.WebApp.initData в заголовке x-init-data
export function authUser(req: Request): TgUser | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const initData = req.headers.get('x-init-data')
  if (!token || !initData || initData.length > 4096) return null
  return verifyInitData(initData, token)
}

export function isAdmin(user: TgUser | null): boolean {
  if (!user) return false
  const ids = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.includes(String(user.id))
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

export const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export const NICK_MAX = 12

export function cleanNick(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim()
  return Array.from(s).slice(0, NICK_MAX).join('')
}

export const tgNickOf = (u: TgUser) => cleanNick(u.username || u.first_name || '') || 'PLAYER'
