// POST /api/track { ev: [{ e, g?, v?, ad?, item?, n?, src?, p?, m? }, …] } — пачка событий для статистики (нужен initData).
// Если база не подключена или недоступна — отвечаем ok:false, игра от этого не страдает.
import { authUser, fail, isInt, json, readJson } from './_lib/http.js'
import { FLIP_STEPS, GAMES, SRC_RE, anon, day, flipBucket, redis, statsReady, type Cmd } from './_lib/stats.js'

const GAME_SET = new Set<string>(GAMES)
const AD_RE = /^[a-f0-9]{12}$/
const ITEM_RE = /^[a-z0-9_]{1,24}$/
const MAX_EVENTS = 40
const STEP_SET = new Set<string>(FLIP_STEPS)
const CAR_RE = /^[a-z0-9]{1,16}$/
const MONEY = 1_000_000 // потолок сумм в долларах игры — защита от мусора

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

  // рекламная метка первого захода (её присылает клиент в open/play); считаем, только если админ её заводил
  let src: string | null = null
  const cand = list.map((x) => (x as { src?: unknown } | null)?.src).find((s) => typeof s === 'string' && SRC_RE.test(s)) as string | undefined
  if (cand) {
    try {
      if ((await redis([['SISMEMBER', 'srcs', cand]]))[0] === 1) src = cand
    } catch {
      /* без метки статистика остаётся общей */
    }
  }

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
        if (src) cmds.push(['PFADD', `src:o:${src}`, u])
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
        if (src) cmds.push(['PFADD', `src:p:${src}`, u])
        inc(`play:${g}`, n)
        break
      case 'result': {
        // у Перекупа результат — навар в долларах, у аркад — очки
        if (!g || !isInt(ev.v, 0, g === 'flip' ? MONEY : 1000)) break
        const v = ev.v as number
        inc(`res:${g}`)
        inc(`sum:${g}`, v)
        cmds.push(['HINCRBY', `hist:${g}`, g === 'flip' ? flipBucket(v) : bucket(v), 1], ['ZADD', `best:${g}`, 'GT', v, 'all'])
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
      // Перекуп: шаг новичка (уникальные люди за день и за всё время)
      case 'f_step':
        if (typeof ev.item !== 'string' || !STEP_SET.has(ev.item)) break
        cmds.push(['PFADD', `fs:${ev.item}:${d}`, u], ['PFADD', `fs:${ev.item}:all`, u])
        inc(`f_step:${ev.item}`)
        break
      // купил машину: item — модель, v — цена
      case 'f_car':
        if (typeof ev.item !== 'string' || !CAR_RE.test(ev.item) || !isInt(ev.v, 0, MONEY)) break
        inc('f_buys')
        inc('f_spent', ev.v as number)
        cmds.push(['HINCRBY', 'f:buy', ev.item, 1])
        break
      // продал: v — цена продажи, p — навар (может быть минус), m — минут от покупки до продажи
      case 'f_sale': {
        if (typeof ev.item !== 'string' || !CAR_RE.test(ev.item) || !isInt(ev.v, 0, MONEY) || !isInt(ev.p, -MONEY, MONEY)) break
        const p = ev.p as number
        inc('f_sales')
        inc('f_revenue', ev.v as number)
        inc('f_profit', p)
        if (isInt(ev.m, 0, 525_600)) { inc('f_minutes', ev.m as number); inc('f_timed') }
        cmds.push(['HINCRBY', 'f:sell', ev.item, 1], ['HINCRBY', 'f:hist', flipBucket(p), 1], ['ZADD', 'f:best', 'GT', p, 'all'])
        break
      }
      // покупка в игре: краска, инструмент, тюнинг; v — сколько потратил
      case 'f_shop':
        if (typeof ev.item !== 'string' || !ITEM_RE.test(ev.item) || !isInt(ev.v, 0, MONEY)) break
        inc('f_shop')
        inc('f_shop_spent', ev.v as number)
        cmds.push(['HINCRBY', 'f:shop', ev.item, 1])
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
