// GET /api/ad          — случайный активный баннер (или null). Публично, кэш на edge 30 секунд.
// GET /api/ad?fresh=1  — то же мимо всех кэшей; только для админа (видит свои правки сразу).
import { readAds } from './_lib/ads.js'
import { authUser, fail, isAdmin, json } from './_lib/http.js'

const PUBLIC_CACHE = { 'cache-control': 'public, s-maxage=30' }

export async function GET(req: Request): Promise<Response> {
  const fresh = new URL(req.url).searchParams.get('fresh') === '1'
  if (fresh && !isAdmin(authUser(req))) return fail(403, 'forbidden')

  try {
    const ads = (await readAds(fresh)).filter((a) => a.active)
    const pick = ads.length ? ads[Math.floor(Math.random() * ads.length)] : null
    const ad = pick && { id: pick.id, image_url: pick.image_url, link: pick.link, title: pick.title }
    return fresh ? json({ ad }) : json({ ad }, 200, PUBLIC_CACHE)
  } catch (e) {
    console.error(e)
    // без баннера меню всё равно работает — отдаём пусто, а не ошибку
    return json({ ad: null }, 200, fresh ? {} : { 'cache-control': 'public, s-maxage=10' })
  }
}
