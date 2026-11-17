import { hasAuth, initData } from './api'

// Статистика: события копятся и уходят пачкой (экономит бесплатный лимит базы).
// Ни имён, ни ников, ни ID мы не шлём — сервер сам берёт псевдоним из подписи Telegram,
// и в базе остаются только общие счётчики. Если не в Telegram или сервер недоступен — молча ничего не делаем.
export type TrackEvent = { e: string; g?: string; v?: number; ad?: string; item?: string; n?: number }

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
