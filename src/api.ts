// Запросы к нашему API. Каждый запрос подписан initData из Telegram —
// по нему сервер узнаёт, кто ты, и подделать это без токена бота нельзя.
const tg = (window as any).Telegram?.WebApp

export const initData: string = tg?.initData || ''
export const hasAuth = initData.length > 0

type Opts = { method?: string; body?: unknown; form?: FormData }

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (initData) headers['x-init-data'] = initData

  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(`/api/${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return data as T
}
