// Баннеры в Vercel Blob: картинки — отдельными файлами, список — один JSON (ads/index.json).
// Как читаем список — см. indexUrl (метка в адресе, чтобы не получать устаревшую копию из CDN).
import { del, put } from '@vercel/blob'

export type Ad = {
  id: string
  image_url: string
  link: string | null
  title: string | null
  active: boolean
  created_at: string
  expires_at?: string | null // когда баннер сам выключится; нет значения — без срока (старые баннеры)
}

const INDEX = 'ads/index.json'

export const MAX_HOURS = 24 * 90 // не больше 90 дней

export const isExpired = (a: Ad, now = Date.now()): boolean => Boolean(a.expires_at) && Date.parse(a.expires_at as string) <= now
// баннер показывается, если включён и срок не вышел
export const isLive = (a: Ad, now = Date.now()): boolean => a.active && !isExpired(a, now)
export const expiryIn = (hours: number | null, now = Date.now()): string | null => (hours ? new Date(now + hours * 3600e3).toISOString() : null)

// срок из формы или JSON: 0 / пусто / 'forever' → без срока (null); целое 1…MAX_HOURS → часы; остальное → undefined (ошибка)
export function parseHours(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === '' || v === 'forever') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^[0-9]{1,5}$/.test(v) ? Number(v) : NaN
  if (!Number.isInteger(n) || n < 0 || n > MAX_HOURS) return undefined
  return n === 0 ? null : n
}

// сколько осталось, по-человечески: «5ч 12м», «2д 4ч», «истёк», «без срока»
export function leftText(a: Ad, now = Date.now()): string {
  if (!a.expires_at) return 'без срока'
  const ms = Date.parse(a.expires_at) - now
  if (ms <= 0) return 'истёк'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return `${d}д ${h}ч`
  return h ? `${h}ч ${m % 60}м` : `${m}м`
}

// Публичный файл нельзя прочитать «мимо кэша» средствами библиотеки (useCache:false у неё работает только
// для приватных), а CDN держал старый список часами. Поэтому читаем адрес с меткой ?v=…:
//  fresh (админка и любые правки) — случайная метка, всегда свежий файл;
//  иначе (игроки) — метка меняется раз в 30 секунд: кэш работает, но отстаёт не больше чем на полминуты.
function indexUrl(fresh: boolean): string {
  const storeId = (process.env.BLOB_READ_WRITE_TOKEN || '').split('_')[3] || ''
  if (!storeId) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  const v = fresh ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : String(Math.floor(Date.now() / 30000))
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${INDEX}?v=${v}`
}

export async function readAds(fresh: boolean): Promise<Ad[]> {
  const res = await fetch(indexUrl(fresh), { cache: 'no-store' })
  if (res.status === 404) return []
  if (!res.ok) throw new Error('blob read ' + res.status)
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data : []
}

export async function writeAds(ads: Ad[]): Promise<void> {
  await put(INDEX, JSON.stringify(ads), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  })
}

export async function uploadImage(id: string, ext: string, file: File): Promise<string> {
  const blob = await put(`ads/img/${id}.${ext}`, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: true, // уникальный адрес → картинку можно кэшировать навсегда
  })
  return blob.url
}

export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url)
  } catch (e) {
    console.error('blob delete failed', e)
  }
}
