import { hasAuth, initData } from './api'

// Статистика: события копятся и уходят пачкой (экономит бесплатный лимит базы).
// Ни имён, ни ников, ни ID мы не шлём — сервер сам берёт псевдоним из подписи Telegram,
// и в базе остаются только общие счётчики. Если не в Telegram или сервер недоступен — молча ничего не делаем.
export type TrackEvent = { e: string; g?: string; v?: number; ad?: string; item?: string; n?: number; src?: string }

// Откуда пришёл человек: рекламная ссылка t.me/бот?start=ad_метка открывает игру с ?src=метка
// (или t.me/бот/приложение?startapp=ad_метка). Запоминаем метку первого захода на устройстве — это не личные данные.
const SRC_RE = /^[a-z0-9]{1,16}$/
const SRC_KEY = 'joe-src'
function detectSource(): string | null {
  try {
    const tg = (window as any).Telegram?.WebApp
    const sp = String(tg?.initDataUnsafe?.start_param || '')
    const raw = new URLSearchParams(location.search).get('src') || (sp.startsWith('ad_') ? sp.slice(3) : '')
    const fresh = raw.toLowerCase()
    const saved = localStorage.getItem(SRC_KEY)
    if (saved && SRC_RE.test(saved)) return saved // первая метка остаётся за человеком
    if (SRC_RE.test(fresh)) {
      localStorage.setItem(SRC_KEY, fresh)
      return fresh
    }
  } catch {
    /* без хранилища метка живёт только до закрытия */
  }
  return null
}
const SOURCE = detectSource()

// эти события можно складывать в одно с числом повторов
const MERGE = new Set(['play', 'ch_create', 'ch_open', 'ch_play', 'ad_view', 'ad_click'])
const FLUSH_MS = 4000

let queue: TrackEvent[] = []
let timer: number | undefined

export function flush(): void {
  window.clearTimeout(timer)
  if (!queue.length || !hasAuth) {
    queue = []
    return
  }
  const ev = queue.splice(0, 40)
  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-init-data': initData },
    body: JSON.stringify({ ev }),
    keepalive: true, // чтобы пачка ушла, даже если приложение сворачивают
  }).catch(() => {
    /* статистика не должна ничего ломать */
  })
  if (queue.length) timer = window.setTimeout(flush, FLUSH_MS)
}

export function track(ev: TrackEvent): void {
  if (!hasAuth) return
  if (SOURCE && (ev.e === 'open' || ev.e === 'play')) ev = { ...ev, src: SOURCE }
  const same = MERGE.has(ev.e) ? queue.find((q) => q.e === ev.e && q.g === ev.g && q.ad === ev.ad) : undefined
  if (same) same.n = (same.n || 1) + 1
  else queue.push({ ...ev })
  if (queue.length >= 30) flush()
  else {
    window.clearTimeout(timer)
    timer = window.setTimeout(flush, FLUSH_MS)
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) flush()
})
window.addEventListener('pagehide', flush)
