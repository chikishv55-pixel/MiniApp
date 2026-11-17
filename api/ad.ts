// GET /api/ad          — все показываемые сейчас баннеры (включены и срок не вышел). Публично, кэш на edge 30 секунд.
// GET /api/ad?fresh=1  — то же мимо всех кэшей; только для админа (видит свои правки сразу).
// until — время окончания в мс (или null, если без срока): клиент сам уберёт баннер, когда срок выйдет.
import { isLive, readAds } from './_lib/ads.js'
import { authUser, fail, isAdmin, json } from './_lib/http.js'

const PUBLIC_CACHE = { 'cache-control': 'public, s-maxage=30' }

export async function GET(req: Request): Promise<Response> {
  const fresh = new URL(req.url).searchParams.get('fresh') === '1'
  if (fresh && !isAdmin(authUser(req))) return fail(403, 'forbidden')

  try {
    const now = Date.now()
    const ads = (await readAds(fresh))
      .filter((a) => isLive(a, now))
      .map((a) => ({
        id: a.id,
        image_url: a.image_url,
        link: a.link,
        title: a.title,
        until: a.expires_at ? Date.parse(a.expires_at) : null,
      }))
    return fresh ? json({ ads }) : json({ ads }, 200, PUBLIC_CACHE)
  } catch (e) {
    console.error(e)
    // без баннера меню всё равно работает — отдаём пусто, а не ошибку
    return json({ ads: [] }, 200, fresh ? {} : { 'cache-control': 'public, s-maxage=10' })
  }
}
