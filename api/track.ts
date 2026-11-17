// POST /api/track { ev: [{ e, g?, v?, ad?, item?, n? }, …] } — пачка событий для статистики (нужен initData).
// Если база не подключена или недоступна — отвечаем ok:false, игра от этого не страдает.
import { authUser, fail, isInt, json, readJson } from './_lib/http.js'
import { GAMES, anon, day, redis, statsReady, type Cmd } from './_lib/stats.js'

const GAME_SET = new Set<string>(GAMES)
const AD_RE = /^[a-f0-9]{12}$/
const ITEM_RE = /^[a-z0-9_]{1,24}$/
const MAX_EVENTS = 40

// корзины результатов — чтобы видеть, докуда обычно доходят
const bucket = (v: number) => (v < 5 ? '0-4' : v < 10 ? '5-9' : v < 20 ? '10-19' : v < 30 ? '20-29' : v < 50 ? '30-49' : '50+')

// простейшая защита от спама внутри одного экземпляра функции: не больше 30 запросов в минуту на человека
const hits = new Map<number, number[]>()
function throttled(uid: number): boolean {
  const now = Date.now()
  const list = (hits.get(uid) || []).filter((t) => now - t < 60_000)
  list.push(now)
  hits.set(uid, list)
  if (hits.size > 5000) hits.clear()
  return list.length > 30
}

export async function POST(req: Request): Promise<Response> {
  if (!statsReady()) return json({ ok: false })
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  if (throttled(user.id)) return json({ ok: false })

  const body = await readJson(req)
  const list = Array.isArray(body.ev) ? (body.ev as unknown[]).slice(0, MAX_EVENTS) : []
  if (!list.length) return fail(400, 'no events')

  const u = anon(user.id)
  const d = day()
  const S = `s:${d}`
  const cmds: Cmd[] = []
  const newIdx: number[] = [] // индексы PFADD в u:all — по ним узнаём новых людей
  const inc = (field: string, by = 1) => cmds.push(['HINCRBY', S, field, by], ['HINCRBY', 's:all', field, by])

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const ev = raw as Record<string, unknown>
    const e = String(ev.e || '')
    const g = typeof ev.g === 'string' && GAME_SET.has(ev.g) ? ev.g : null
    const n = isInt(ev.n, 1, 50) ? (ev.n as number) : 1

    switch (e) {
      case 'open':
        newIdx.push(cmds.length)
        cmds.push(['PFADD', 'u:all', u], ['PFADD', `u:${d}`, u])
        inc('opens')
        break
      case 'gate_shown':
        cmds.push(['PFADD', `gs:${d}`, u])
        break
      case 'gate_passed':
        cmds.push(['PFADD', `go:${d}`, u])
        break
      case 'play':
        if (!g) break
        cmds.push(['PFADD', `p:${d}`, u])
        inc(`play:${g}`, n)
        break
      case 'result': {
        if (!g || !isInt(ev.v, 0, 1000)) break
        const v = ev.v as number
        inc(`res:${g}`)
        inc(`sum:${g}`, v)
        cmds.push(['HINCRBY', `hist:${g}`, bucket(v), 1], ['ZADD', `best:${g}`, 'GT', v, 'all'])
        break
      }
      case 'ch_create':
      case 'ch_open':
      case 'ch_play':
        if (!g) break
        inc(`${e}:${g}`, n)
        break
      case 'ad_view':
        if (typeof ev.ad !== 'string' || !AD_RE.test(ev.ad)) break
        inc(`adv:${ev.ad}`, n)
        cmds.push(['PFADD', `adu:${ev.ad}:${d}`, u])
        break
      case 'ad_click':
        if (typeof ev.ad !== 'string' || !AD_RE.test(ev.ad)) break
        inc(`adc:${ev.ad}`, n)
        break
      case 'buy':
        if (typeof ev.item !== 'string' || !ITEM_RE.test(ev.item)) break
        inc('buys')
        cmds.push(['HINCRBY', 'shop', ev.item, 1])
        break
      case 'pass':
        if (!isInt(ev.v, 1, 99)) break
        cmds.push(['HINCRBY', 'passlvl', String(ev.v), 1])
        inc('pass_buys')
        break
    }
  }

  if (!cmds.length) return fail(400, 'no valid events')
  try {
    const r = await redis(cmds)
    const fresh = newIdx.filter((i) => r[i] === 1).length // PFADD вернул 1 — такого человека ещё не было (оценка HLL)
    if (fresh) await redis([['HINCRBY', S, 'new', fresh], ['HINCRBY', 's:all', 'new', fresh]])
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ ok: false })
  }
}
