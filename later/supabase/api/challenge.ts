// POST /api/challenge { seed, level, kills } — создать вызов, вернуть короткий id.
// GET  /api/challenge?id=XXXXXXXXXX     — данные вызова и лучшие ответы.
// Сид и счёт хранятся на сервере, в ссылке только id — подменить их правкой ссылки нельзя.
import { randomBytes } from 'node:crypto'
import { ensurePlayer, rest } from './_lib/db.js'
import { authUser, fail, isInt, json, readJson, tgNickOf } from './_lib/http.js'

const ID_RE = /^[A-Za-z0-9]{10}$/
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
// потолок правдоподобного счёта за один забег — отсекает самые тупые накрутки
const MAX_KILLS = 1000

function newId(): string {
  const b = randomBytes(10)
  let s = ''
  for (let i = 0; i < 10; i++) s += ABC[b[i] % ABC.length]
  return s
}

export async function POST(req: Request): Promise<Response> {
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  const { seed, level, kills } = await readJson(req)
  if (!isInt(seed, 0, 0xffffffff) || !isInt(level, 1, 999) || !isInt(kills, 1, MAX_KILLS)) {
    return fail(400, 'bad params')
  }

  try {
    await ensurePlayer(user.id, tgNickOf(user))
    const [p] = await rest<{ nick: string }[]>(`players?tg_id=eq.${user.id}&select=nick`)
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newId()
      try {
        await rest('challenges', {
          method: 'POST',
          prefer: 'return=minimal',
          body: { id, seed, level, kills, creator_id: user.id, creator_nick: p?.nick ?? tgNickOf(user) },
        })
        return json({ id })
      } catch (e) {
        if (!String(e).includes('23505')) throw e // 23505 — такой id уже есть, пробуем другой
      }
    }
    return fail(500, 'id collision')
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
  }
}

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!ID_RE.test(id)) return fail(400, 'bad id')
  try {
    const [ch] = await rest<any[]>(`challenges?id=eq.${id}&select=id,seed,level,kills,creator_nick`)
    if (!ch) return fail(404, 'not found')
    const results = await rest<any[]>(
      `challenge_results?challenge_id=eq.${id}&select=nick,kills&order=kills.desc,created_at.asc&limit=5`,
    )
    return json({ challenge: { id: ch.id, s: ch.seed, l: ch.level, k: ch.kills, n: ch.creator_nick, results } })
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
  }
}
