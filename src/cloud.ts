// Синхронизация сохранений между устройствами через Telegram CloudStorage.
// Игры и меню по-прежнему пишут в localStorage — этот модуль копирует нужные ключи в облако
// Telegram (привязано к пользователю и боту) и при запуске подтягивает оттуда более свежую версию.
//
// Облако: 'm' — манифест { группа: { t, s, n } }, данные группы — JSON {ключ: значение},
// порезанный на куски по 4096 символов: g_<группа>_<слот>_<i>. Пишем в свободный слот,
// потом переключаем манифест — так другое устройство никогда не прочитает полузаписанную группу.

type Group = {
  keys: string[]
  // сравнение при первой синхронизации, когда прогресс есть и тут, и в облаке: больше — лучше
  score?: (v: Record<string, string | null>) => number
  wait?: number // пауза после изменения перед отправкой, мс
}

const json = (s: string | null | undefined): any => {
  try {
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
}

const GROUPS: Record<string, Group> = {
  // «Перекуп Джо»: деньги и текущая машина — только вместе, иначе деньги задвоятся или пропадут
  flip: {
    keys: ['flip-v1', 'flip-job-v1'],
    score: (v) => {
      const s = json(v['flip-v1']) || {}
      const j = json(v['flip-job-v1'])?.job
      return (s.sold | 0) * 1e9 + (Number(s.cash) || 0) + (Number(j?.paid) || 0)
    },
    wait: 30000, // слои машины весят десятки-сотни КБ — не гоняем их на каждый мазок
  },
  // монеты и косметика, общие для аркад
  joe: {
    keys: ['metkiy-joe-v1'],
    score: (v) => {
      const s = json(v['metkiy-joe-v1']) || {}
      return (s.coins | 0) + ((s.ownW?.length | 0) + (s.ownS?.length | 0)) * 1e6
    },
  },
  arcade: { keys: ['duel-v1', 'train-v1', 'canyon-v1', 'rodeo-v1', 'gold-v1', 'tower-v1'] },
  profile: { keys: ['pixel-arena:profile', 'pixel-arena:best'] },
  prefs: { keys: ['flip-sound', 'joe-controls', 'joe-seen'] },
}

const CHUNK = 4096
const MAX_CHUNKS = 300 // ~1.2 МБ на группу; два слота → укладываемся в лимит 1024 ключа
const META = 'cloud-sync' // локально: { группа: время последнего изменения, которое мы знаем }
const PULL_TIMEOUT = 5000

type Manifest = Record<string, { t: number; s: 0 | 1; n: number }>

const tg = (window as any).Telegram?.WebApp
const cs = tg?.CloudStorage
const enabled = !!cs && !!tg?.initData && (tg.isVersionAtLeast?.('6.9') ?? false)

/* ---------- обёртки над колбэчным API ---------- */
const csGet = (keys: string[]) =>
  new Promise<Record<string, string>>((ok, fail) => cs.getItems(keys, (e: unknown, r: Record<string, string>) => (e ? fail(e) : ok(r || {}))))
const csSet = (k: string, v: string) =>
  new Promise<void>((ok, fail) => cs.setItem(k, v, (e: unknown) => (e ? fail(e) : ok())))
const csDel = (keys: string[]) =>
  new Promise<void>((ok) => (keys.length ? cs.removeItems(keys, () => ok()) : ok()))

async function getMany(keys: string[]) {
  const out: Record<string, string> = {}
  for (let i = 0; i < keys.length; i += 100) Object.assign(out, await csGet(keys.slice(i, i + 100)))
  return out
}
async function setMany(items: [string, string][]) {
  for (let i = 0; i < items.length; i += 8) await Promise.all(items.slice(i, i + 8).map(([k, v]) => csSet(k, v)))
}
const chunkKey = (g: string, s: number, i: number) => `g_${g}_${s}_${i}`

/* ---------- локальная сторона ---------- */
const readLocal = (g: string) => {
  const v: Record<string, string | null> = {}
  for (const k of GROUPS[g].keys) {
    try {
      v[k] = localStorage.getItem(k)
    } catch {
      v[k] = null
    }
  }
  return v
}
const isEmpty = (v: Record<string, string | null>) => Object.values(v).every((x) => x == null)
function writeLocal(v: Record<string, string | null>) {
  for (const [k, x] of Object.entries(v)) {
    try {
      if (x == null) localStorage.removeItem(k)
      else localStorage.setItem(k, x)
    } catch {
      /* переполнено или приватный режим */
    }
  }
}
let meta: Record<string, number> = json((() => { try { return localStorage.getItem(META) } catch { return null } })()) || {}
const saveMeta = () => {
  try {
    localStorage.setItem(META, JSON.stringify(meta))
  } catch {
    /* ничего */
  }
}

/* ---------- состояние ---------- */
let manifest: Manifest = {}
const snap: Record<string, string> = {} // что лежит в облаке (или что мы видели последним) — для поиска изменений
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
const pending: Record<string, boolean> = {}
let busy: Promise<void> = Promise.resolve()
let started = false
let abandoned = false // облако не ответило вовремя — игра уже стартовала с локальным, ничего не трогаем

async function pullGroup(g: string, m: Manifest[string]) {
  const keys = Array.from({ length: m.n }, (_, i) => chunkKey(g, m.s, i))
  const got = await getMany(keys)
  const raw = keys.map((k) => got[k] ?? '').join('')
  const v = json(raw)
  return v && typeof v === 'object' ? (v as Record<string, string | null>) : null
}

// облачная копия «Перекупа»: картинки слоёв машины пересжимаем, в крайнем случае шлём без них
async function shrink(g: string, v: Record<string, string | null>) {
  if (g !== 'flip' || !v['flip-job-v1']) return null
  const job = json(v['flip-job-v1'])
  if (!job) return null
  const webp = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')
  if (webp) { // PNG маски ~320 КБ → WebP ~35 КБ: 9 запросов к облаку вместо 80 (iOS WebP не кодирует — шлём PNG)
    for (const f of ['mask', 'coat', 'gloss', 'glass']) {
      if (typeof job[f] !== 'string') continue
      job[f] = await new Promise<string>((ok) => {
        const im = new Image()
        im.onload = () => {
          const c = document.createElement('canvas')
          c.width = im.naturalWidth
          c.height = im.naturalHeight
          c.getContext('2d')!.drawImage(im, 0, 0)
          ok(c.toDataURL('image/webp', 0.85))
        }
        im.onerror = () => ok(job[f])
        im.src = job[f]
      })
    }
  }
  const s = JSON.stringify({ ...v, 'flip-job-v1': JSON.stringify(job) })
  if (s.length <= MAX_CHUNKS * CHUNK) return s
  // без слоёв машина откроется заново ржавой, но сама машина и деньги не потеряются
  const bare = { job: job.job }
  return JSON.stringify({ ...v, 'flip-job-v1': JSON.stringify(bare) })
}

async function pushGroup(g: string) {
  const v = readLocal(g)
  const cur = JSON.stringify(v)
  if (cur === snap[g]) return
  const body = (await shrink(g, v)) ?? cur
  if (!body || body.length > MAX_CHUNKS * CHUNK) return
  const old = manifest[g]
  const s: 0 | 1 = old ? (old.s ? 0 : 1) : 0
  const n = Math.ceil(body.length / CHUNK) || 1
  const items: [string, string][] = []
  for (let i = 0; i < n; i++) items.push([chunkKey(g, s, i), body.slice(i * CHUNK, (i + 1) * CHUNK)])
  await setMany(items)
  const t = meta[g] || Date.now()
  // манифест перечитываем прямо перед записью — его могло обновить другое устройство по другим группам
  const fresh = json((await csGet(['m'])).m) || {}
  manifest = { ...fresh, [g]: { t, s, n } }
  await csSet('m', JSON.stringify(manifest))
  snap[g] = cur
  // старый слот больше не нужен
  if (old) await csDel(Array.from({ length: old.n }, (_, i) => chunkKey(g, old.s, i)))
}

function schedule(g: string, now = false) {
  clearTimeout(timers[g])
  pending[g] = true
  const run = () => {
    pending[g] = false
    busy = busy.then(() => pushGroup(g)).catch((e) => console.warn('cloud push', g, e))
  }
  if (now) run()
  else timers[g] = setTimeout(run, GROUPS[g].wait ?? 2000)
}

// заметили изменение локально — запоминаем время и ставим отправку (уже стоящую не откладываем)
function check(now = false) {
  for (const g of Object.keys(GROUPS)) {
    if (JSON.stringify(readLocal(g)) === snap[g]) continue
    if (pending[g] && !now) continue
    meta[g] = Date.now()
    saveMeta()
    schedule(g, now)
  }
}

/** Подтянуть сохранения из облака. Вызывать до старта приложения: игры читают localStorage при загрузке. */
export async function cloudPull(): Promise<void> {
  if (!enabled || started) return
  started = true
  const work = (async () => {
    manifest = json((await csGet(['m'])).m) || {}
    for (const g of Object.keys(GROUPS)) {
      const local = readLocal(g)
      const m = manifest[g]
      if (!m) {
        snap[g] = isEmpty(local) ? JSON.stringify(local) : '' // пусто в облаке — отправим своё
        continue
      }
      const lt = meta[g] || 0
      if (lt >= m.t) {
        snap[g] = lt === m.t ? JSON.stringify(local) : ''
        continue
      }
      let remote = await pullGroup(g, m)
      if (!remote) {
        // другое устройство как раз переключило слот — перечитываем манифест
        const m2 = (json((await csGet(['m'])).m) || {})[g]
        if (m2) {
          manifest[g] = m2
          remote = await pullGroup(g, m2)
        }
      }
      if (!remote) {
        snap[g] = JSON.stringify(local) // не смогли прочитать — не затираем облако старым
        continue
      }
      // это устройство ещё ни разу не синхронизировалось, а прогресс на нём есть — оставляем лучший
      const sc = GROUPS[g].score
      if (!lt && !isEmpty(local) && sc && sc(local) > sc(remote)) {
        meta[g] = Date.now()
        snap[g] = ''
        continue
      }
      const full: Record<string, string | null> = {}
      for (const k of GROUPS[g].keys) full[k] = remote[k] ?? null
      if (abandoned) return
      writeLocal(full)
      meta[g] = manifest[g].t
      snap[g] = JSON.stringify(readLocal(g))
    }
    saveMeta()
  })()
  try {
    await Promise.race([work, new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), PULL_TIMEOUT))])
  } catch (e) {
    // нет сети или облако тормозит — играем с локальным, но ничего не отправляем поверх облака вслепую
    abandoned = true
    console.warn('cloud pull', e)
    return
  }
  watch()
}

function watch() {
  for (const g of Object.keys(GROUPS)) if (snap[g] !== JSON.stringify(readLocal(g))) {
    if (!meta[g] || meta[g] <= (manifest[g]?.t ?? 0)) meta[g] = Date.now()
    schedule(g)
  }
  saveMeta()
  setInterval(() => check(), 3000)
  addEventListener('storage', () => check()) // запись из iframe игры
  const flush = () => {
    check(true)
    setTimeout(() => check(true), 300) // игра сохраняет машину в том же событии — подождём её
  }
  document.addEventListener('visibilitychange', () => document.hidden && flush())
  addEventListener('pagehide', flush)
}
