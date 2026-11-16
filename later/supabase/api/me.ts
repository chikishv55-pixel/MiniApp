// POST /api/me — профиль игрока. Пустое тело: просто получить (и создать при первом входе).
// { nick?, avatar? } — изменить; { reset: true } — вернуть ник из Telegram и аву по умолчанию.
import { ensurePlayer, rest } from './_lib/db.js'
import { authUser, cleanNick, fail, isAdmin, json, readJson, tgNickOf } from './_lib/http.js'

const AVATAR_RE = /^(tg|px:[^\s<>"'&]{1,24})$/u

export async function POST(req: Request): Promise<Response> {
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  const body = await readJson(req)
  const tgNick = tgNickOf(user)

  const patch: Record<string, unknown> = {}
  if (body.reset === true) {
    patch.nick = tgNick
    patch.avatar = null
  } else {
    if ('nick' in body) patch.nick = cleanNick(body.nick) || tgNick
    if ('avatar' in body) {
      const a = body.avatar
      patch.avatar = typeof a === 'string' && AVATAR_RE.test(a) ? a : null
    }
  }

  try {
    await ensurePlayer(user.id, tgNick)
    let rows: any[]
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString()
      rows = await rest(`players?tg_id=eq.${user.id}&select=nick,avatar,best`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: patch,
      })
    } else {
      rows = await rest(`players?tg_id=eq.${user.id}&select=nick,avatar,best`)
    }
    return json({ player: rows[0] ?? null, isAdmin: isAdmin(user) })
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
  }
}
