// Тонкая обёртка над Supabase REST (PostgREST) и Storage — без SDK, чтобы функции были лёгкими.
// Работает только на сервере: secret key обходит RLS и не должен попадать в клиент.

const BASE = process.env.SUPABASE_URL?.replace(/\/+$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function headers(extra: Record<string, string> = {}): Record<string, string> {
  if (!BASE || !KEY) throw new Error('supabase is not configured')
  const h: Record<string, string> = { apikey: KEY, ...extra }
  // новые ключи sb_secret_* передаются только в apikey, старые JWT-ключи — ещё и как Bearer
  if (!KEY.startsWith('sb_')) h.Authorization = `Bearer ${KEY}`
  return h
}

type RestInit = { method?: string; body?: unknown; prefer?: string }

export async function rest<T = any>(path: string, init: RestInit = {}): Promise<T> {
  const h = headers({ 'content-type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) })
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: h,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`db ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : null) as T
}

export async function uploadPublic(bucket: string, path: string, data: ArrayBuffer, contentType: string): Promise<string> {
  const h = headers({ 'content-type': contentType, 'cache-control': 'max-age=31536000', 'x-upsert': 'false' })
  const res = await fetch(`${BASE}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: h, body: data })
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return `${BASE}/storage/v1/object/public/${bucket}/${path}`
}

export async function removeObject(bucket: string, path: string): Promise<void> {
  const res = await fetch(`${BASE}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ prefixes: [path] }),
  })
  if (!res.ok) console.error(`storage delete ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

// игрок создаётся при первом обращении; повторная вставка игнорируется
export async function ensurePlayer(tgId: number, nick: string): Promise<void> {
  await rest('players?on_conflict=tg_id', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=minimal',
    body: { tg_id: tgId, nick },
  })
}
