// Управление баннерами. Доступ только Telegram-аккаунтам из ADMIN_IDS (проверка по initData).
// GET    /api/admin/ads               — все баннеры (заодно клиент так узнаёт, что он админ)
// POST   /api/admin/ads (form-data)   — image (файл), link?, title? → новый баннер
// PATCH  /api/admin/ads { id, active } — включить/выключить
// DELETE /api/admin/ads?id=            — удалить вместе с картинкой
import { randomBytes } from 'node:crypto'
import { deleteImage, readAds, uploadImage, writeAds, type Ad } from '../_lib/ads.js'
import { authUser, fail, isAdmin, json, readJson } from '../_lib/http.js'

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

  try {
    const ads = await readAds(true)
    if (ads.length >= MAX_ADS) return fail(400, `max ${MAX_ADS} banners`)
    const id = randomBytes(6).toString('hex')
    const ad: Ad = {
      id,
      image_url: await uploadImage(id, ext, file),
      link,
      title,
      active: true,
      created_at: new Date().toISOString(),
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
  const { id, active } = await readJson(req)
  if (typeof id !== 'string' || !ID_RE.test(id) || typeof active !== 'boolean') return fail(400, 'bad params')
  try {
    const ads = await readAds(true)
    const ad = ads.find((a) => a.id === id)
    if (!ad) return fail(404, 'not found')
    ad.active = active
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
