import { useEffect, useState } from 'react'
import { api } from './api'

type Ad = { id: string; image_url: string; link: string | null; title: string | null }

const tg = (window as any).Telegram?.WebApp

// fresh — админ: берём баннер мимо кэша, чтобы сразу видеть свои правки.
// reloadKey меняется после закрытия админки → баннер перезапрашивается.
export default function AdBanner({ fresh = false, reloadKey = 0 }: { fresh?: boolean; reloadKey?: number }) {
  const [ad, setAd] = useState<Ad | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let alive = true
    api<{ ad: Ad | null }>(fresh ? 'ad?fresh=1' : 'ad')
      .then((r) => {
        if (!alive) return
        setBroken(false)
        setAd(r.ad)
      })
      .catch(() => alive && setAd(null))
    return () => {
      alive = false
    }
  }, [fresh, reloadKey])

  if (!ad || broken) return null

  const open = () => {
    if (!ad.link) return
    if (tg?.openLink) tg.openLink(ad.link)
    else window.open(ad.link, '_blank', 'noopener,noreferrer')
  }

  return (
    <button className="ad" onClick={open} disabled={!ad.link} aria-label={ad.title || 'Реклама'}>
      <img src={ad.image_url} alt={ad.title || ''} onError={() => setBroken(true)} />
      <span className="ad-tag">РЕКЛАМА</span>
    </button>
  )
}
