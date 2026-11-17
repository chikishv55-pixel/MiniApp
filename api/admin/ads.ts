// Управление баннерами. Доступ только Telegram-аккаунтам из ADMIN_IDS (проверка по initData).
// GET    /api/admin/ads                          — все баннеры (заодно клиент так узнаёт, что он админ)
// POST   /api/admin/ads (form-data)              — image (файл), link?, title?, hours? → новый баннер;
//                                                  hours — на сколько часов (1…2160), 0/пусто — без срока
// PATCH  /api/admin/ads { id, active?, hours?, extend? }
//          active   — включить/выключить вручную;
//          hours    — включить заново на N часов от сейчас (0 — без срока);
//          extend   — продлить на N часов (от конца срока или от сейчас, если срок уже вышел)
// DELETE /api/admin/ads?id=                      — удалить вместе с картинкой
import { randomBytes } from 'node:crypto'
import { MAX_HOURS, deleteImage, expiryIn, isExpired, parseHours, readAds, uploadImage, writeAds, type Ad } from '../_lib/ads.js'
import { authUser, fail, isAdmin, isInt, json, readJson } from '../_lib/http.js'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ADS = 50
const ID_RE = /^[a-f0-9]{12}$/
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const guard = (req: Request) => (isAdmin(authUser(req)) ? null : fail(403, 'forbidden'))

function cleanLink(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || v.length > 500) return undefined
  try {
    const u = new URL(v.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

export async function GET(req: Request): Promise<Response> {
  const denied = guard(req)
  if (denied) return denied
  try {
    return json({ ads: await readAds(true) })
  } catch (e) {
    console.error(e)
    return fail(500, 'storage error')
  }
}

export async function POST(req: Request): Promise<Response> {
  const denied = guard(req)
  if (denied) return denied

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, 'expected form-data')
  }
  const file = form.get('image')
  if (!(file instanceof File)) return fail(400, 'no image')
  const ext = TYPES[file.type]
  if (!ext) return fail(400, 'only png, jpg, webp, gif')
  if (file.size > MAX_BYTES) return fail(400, 'max 2 MB')

  const link = cleanLink(form.get('link'))
  if (link === undefined) return fail(400, 'bad link')
  const titleRaw = form.get('title')
  const title = typeof titleRaw === 'string' ? titleRaw.trim().slice(0, 60) || null : null
  const hours = parseHours(form.get('hours'))
  if (hours === undefined) return fail(400, `bad hours (1…${MAX_HOURS} or 0)`)

  try {
    const ads = await readAds(true)
    if (ads.length >= MAX_ADS) return fail(400, `max ${MAX_ADS} banners`)
    const id = randomBytes(6).toString('hex')
    const now = Date.now()
    const ad: Ad = {
      id,
      image_url: await uploadImage(id, ext, file),
      link,
      title,
      active: true,
      created_at: new Date(now).toISOString(),
      expires_at: expiryIn(hours, now),
    }
    await writeAds([ad, ...ads])
    return json({ ad })
  } catch (e) {
    console.error(e)
    return fail(500, 'upload failed')
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const denied = guard(req)
  if (denied) return denied
  const body = await readJson(req)
  const { id, active } = body
  if (typeof id !== 'string' || !ID_RE.test(id)) return fail(400, 'bad id')

  const hasActive = typeof active === 'boolean'
  const hasHours = body.hours !== undefined
  const hasExtend = body.extend !== undefined
  const hours = hasHours ? parseHours(body.hours) : undefined
  if (hasHours && hours === undefined) return fail(400, 'bad hours')
  if (hasExtend && !isInt(body.extend, 1, MAX_HOURS)) return fail(400, 'bad extend')
  if (!hasActive && !hasHours && !hasExtend) return fail(400, 'nothing to change')

  try {
    const ads = await readAds(true)
    const ad = ads.find((a) => a.id === id)
    if (!ad) return fail(404, 'not found')
    const now = Date.now()

    if (hasHours) {
      // включить заново на выбранный срок от сейчас
      ad.expires_at = expiryIn(hours ?? null, now)
      ad.active = true
    }
    if (hasExtend) {
      if (!ad.expires_at) return fail(400, 'banner has no expiry to extend')
      const base = Math.max(now, Date.parse(ad.expires_at))
      ad.expires_at = new Date(base + (body.extend as number) * 3600e3).toISOString()
      ad.active = true
    }
    if (hasActive) {
      // включить просроченный баннер без нового срока нельзя — он тут же выключился бы снова
      if (active && isExpired(ad, now) && !hasHours && !hasExtend) return fail(400, 'banner expired: pass hours')
      ad.active = active as boolean
    }
    await writeAds(ads)
    return json({ ad })
  } catch (e) {
    console.error(e)
    return fail(500, 'storage error')
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = guard(req)
  if (denied) return denied
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!ID_RE.test(id)) return fail(400, 'bad id')
  try {
    const ads = await readAds(true)
    const ad = ads.find((a) => a.id === id)
    if (!ad) return fail(404, 'not found')
    await writeAds(ads.filter((a) => a.id !== id))
    await deleteImage(ad.image_url)
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return fail(500, 'storage error')
  }
}
