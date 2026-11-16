// GET /api/ad          — все активные баннеры (меню крутит их по очереди). Публично, кэш на edge 30 секунд.
// GET /api/ad?fresh=1  — то же мимо всех кэшей; только для админа (видит свои правки сразу).
import { readAds } from './_lib/ads.js'
import { authUser, fail, isAdmin, json } from './_lib/http.js'

const PUBLIC_CACHE = { 'cache-control': 'public, s-maxage=30' }

export async function GET(req: Request): Promise<Response> {
  const fresh = new URL(req.url).searchParams.get('fresh') === '1'
  if (fresh && !isAdmin(authUser(req))) return fail(403, 'forbidden')

  try {
    const ads = (await readAds(fresh))
      .filter((a) => a.active)
      .map((a) => ({ id: a.id, image_url: a.image_url, link: a.link, title: a.title }))
    return fresh ? json({ ads }) : json({ ads }, 200, PUBLIC_CACHE)
  } catch (e) {
    console.error(e)
    // без баннера меню всё равно работает — отдаём пусто, а не ошибку
    return json({ ads: [] }, 200, fresh ? {} : { 'cache-control': 'public, s-maxage=10' })
  }
}
