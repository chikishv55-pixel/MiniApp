// POST /api/result { seed, level, kills, challengeId? } — итог забега.
// Обновляет личный рекорд и, если это ответ на вызов, лучший результат игрока в этом вызове.
import { ensurePlayer, rest } from './_lib/db.js'
import { authUser, fail, isInt, json, readJson, tgNickOf } from './_lib/http.js'

const ID_RE = /^[A-Za-z0-9]{10}$/
const MAX_KILLS = 1000

export async function POST(req: Request): Promise<Response> {
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  const { seed, level, kills, challengeId } = await readJson(req)
  if (!isInt(seed, 0, 0xffffffff) || !isInt(level, 1, 999) || !isInt(kills, 0, MAX_KILLS)) {
    return fail(400, 'bad params')
  }
  if (challengeId !== undefined && (typeof challengeId !== 'string' || !ID_RE.test(challengeId))) {
    return fail(400, 'bad challenge id')
  }

  try {
    await ensurePlayer(user.id, tgNickOf(user))
    const [p] = await rest<{ nick: string; best: number }[]>(`players?tg_id=eq.${user.id}&select=nick,best`)
    let best = p?.best ?? 0
    if (kills > best) {
      best = kills
      await rest(`players?tg_id=eq.${user.id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { best, updated_at: new Date().toISOString() },
      })
    }

    if (challengeId && kills > 0) {
      const [ch] = await rest<any[]>(`challenges?id=eq.${challengeId}&select=seed,level`)
      if (!ch) return fail(404, 'challenge not found')
      // засчитываем только забег на том же раунде, что и вызов
      if (Number(ch.seed) !== seed || ch.level !== level) return fail(400, 'round mismatch')

      const [prev] = await rest<any[]>(
        `challenge_results?challenge_id=eq.${challengeId}&player_id=eq.${user.id}&select=kills`,
      )
      if (!prev) {
        await rest('challenge_results', {
          method: 'POST',
          prefer: 'return=minimal',
          body: { challenge_id: challengeId, player_id: user.id, nick: p?.nick ?? tgNickOf(user), kills },
        })
      } else if (kills > prev.kills) {
        await rest(`challenge_results?challenge_id=eq.${challengeId}&player_id=eq.${user.id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: { kills, nick: p?.nick ?? tgNickOf(user) },
        })
      }
    }
    return json({ ok: true, best })
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
  }
}
