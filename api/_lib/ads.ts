// Баннеры в Vercel Blob: картинки — отдельными файлами, список — один JSON (ads/index.json).
// Админка читает список мимо CDN (useCache: false), поэтому всегда видит свежие данные;
// публичная выдача читает через CDN — дёшево, а свежесть до минуты там не критична.
import { del, get, put } from '@vercel/blob'

export type Ad = {
  id: string
  image_url: string
  link: string | null
  title: string | null
  active: boolean
  created_at: string
}

const INDEX = 'ads/index.json'

export async function readAds(fresh: boolean): Promise<Ad[]> {
  const res = await get(INDEX, { access: 'public', useCache: !fresh })
  if (!res || res.statusCode !== 200) return []
  const data = await new Response(res.stream).json().catch(() => null)
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
