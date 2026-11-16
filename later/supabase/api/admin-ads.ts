// Управление баннерами. Доступ только Telegram-аккаунтам из ADMIN_IDS (проверка по initData).
// GET    /api/admin/ads             — все баннеры
// POST   /api/admin/ads (form-data) — image (файл), link?, title? → новый баннер
// PATCH  /api/admin/ads { id, active } — включить/выключить
// DELETE /api/admin/ads?id=          — удалить вместе с картинкой
import { randomBytes } from 'node:crypto'
import { removeObject, rest, uploadPublic } from '../_lib/db.js'
import { authUser, fail, isAdmin, isInt, json, readJson } from '../_lib/http.js'

const BUCKET = 'ads'
const MAX_BYTES = 2 * 1024 * 1024
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
    return json({ ads: await rest('ads?select=id,image_url,link,title,active,created_at&order=created_at.desc') })
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
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
    const path = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
    const imageUrl = await uploadPublic(BUCKET, path, await file.arrayBuffer(), file.type)
    const [ad] = await rest<any[]>('ads?select=id,image_url,link,title,active,created_at', {
      method: 'POST',
      prefer: 'return=representation',
      body: { image_url: imageUrl, image_path: path, link, title, active: true },
    })
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
  if (!isInt(id, 1, Number.MAX_SAFE_INTEGER) || typeof active !== 'boolean') return fail(400, 'bad params')
  try {
    const [ad] = await rest<any[]>(`ads?id=eq.${id}&select=id,image_url,link,title,active,created_at`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { active },
    })
    return ad ? json({ ad }) : fail(404, 'not found')
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = guard(req)
  if (denied) return denied
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!isInt(id, 1, Number.MAX_SAFE_INTEGER)) return fail(400, 'bad id')
  try {
    const [ad] = await rest<any[]>(`ads?id=eq.${id}&select=image_path`, { method: 'DELETE', prefer: 'return=representation' })
    if (!ad) return fail(404, 'not found')
    await removeObject(BUCKET, ad.image_path)
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return fail(500, 'db error')
  }
}
