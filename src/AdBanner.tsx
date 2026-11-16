import { useEffect, useState } from 'react'
import { api } from './api'

type Ad = { id: string; image_url: string; link: string | null; title: string | null }

const tg = (window as any).Telegram?.WebApp
const ROTATE_MS = 5000

// Несколько активных баннеров листаются сами каждые 5 секунд (пауза, когда приложение свёрнуто).
// fresh — админ: берём баннеры мимо кэша, чтобы сразу видеть свои правки.
// reloadKey меняется после закрытия админки → баннеры перезапрашиваются.
export default function AdBanner({ fresh = false, reloadKey = 0 }: { fresh?: boolean; reloadKey?: number }) {
  const [ads, setAds] = useState<Ad[]>([])
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let alive = true
    api<{ ads?: Ad[] }>(fresh ? 'ad?fresh=1' : 'ad')
      .then((r) => {
        if (!alive) return
        setAds(Array.isArray(r.ads) ? r.ads : [])
        setBroken(new Set())
        setIndex(0)
      })
      .catch(() => alive && setAds([]))
    return () => {
      alive = false
    }
  }, [fresh, reloadKey])

  const list = ads.filter((a) => !broken.has(a.id))

  useEffect(() => {
    if (list.length < 2) return
    const t = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % list.length)
    }, ROTATE_MS)
    return () => window.clearInterval(t)
  }, [list.length])

  if (!list.length) return null
  const current = list[index % list.length]

  const open = () => {
    if (!current.link) return
    if (tg?.openLink) tg.openLink(current.link)
    else window.open(current.link, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="ad-wrap">
      <button className="ad" onClick={open} disabled={!current.link} aria-label={current.title || 'Реклама'}>
        {list.map((a) => (
          <img
            key={a.id}
            src={a.image_url}
            alt={a === current ? a.title || '' : ''}
            className={a === current ? 'on' : ''}
            onError={() => setBroken((s) => new Set(s).add(a.id))}
          />
        ))}
        <span className="ad-tag">РЕКЛАМА</span>
      </button>
      {list.length > 1 && (
        <div className="ad-dots">
          {list.map((a, i) => (
            <button
              key={a.id}
              className={a === current ? 'on' : ''}
              onClick={() => setIndex(i)}
              aria-label={`Баннер ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
