import { useEffect, useState } from 'react'
import { api } from './api'

type Ad = {
  id: string
  image_url: string
  link: string | null
  title: string | null
  active: boolean
  expires_at?: string | null
}

type Props = {
  onClose: () => void
  toast: (text: string) => void
}

const MAX_BYTES = 2 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
// h = 0 — без срока. Выбранный срок используется при загрузке, при повторном включении и при продлении.
const DURATIONS = [
  { h: 1, label: '1 ЧАС' },
  { h: 6, label: '6 ЧАСОВ' },
  { h: 24, label: '24 ЧАСА' },
  { h: 72, label: '3 ДНЯ' },
  { h: 168, label: '7 ДНЕЙ' },
  { h: 720, label: '30 ДНЕЙ' },
  { h: 0, label: 'БЕЗ СРОКА' },
]
const tg = (window as any).Telegram?.WebApp

function confirmAsk(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (tg?.showConfirm) tg.showConfirm(text, (ok: boolean) => resolve(ok))
    else resolve(window.confirm(text))
  })
}

const expired = (a: Ad, now: number) => Boolean(a.expires_at) && Date.parse(a.expires_at as string) <= now
const live = (a: Ad, now: number) => a.active && !expired(a, now)

// «осталось 5ч 12м», «2д 4ч», «срок вышел», «без срока»
function left(a: Ad, now: number): string {
  if (!a.expires_at) return 'без срока'
  const ms = Date.parse(a.expires_at) - now
  if (ms <= 0) return 'срок вышел'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return `осталось ${d}д ${h}ч`
  return h ? `осталось ${h}ч ${m % 60}м` : `осталось ${m}м`
}

export default function AdminModal({ onClose, toast }: Props) {
  const [ads, setAds] = useState<Ad[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    api<{ ads: Ad[] }>('admin/ads')
      .then((r) => setAds(r.ads))
      .catch((e) => setError(e.message))
  }, [])

  // обновляем «осталось» раз в 30 секунд
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pickFile = (f: File | undefined) => {
    if (!f) return
    if (!TYPES.includes(f.type)) return toast('ТОЛЬКО PNG, JPG, WEBP, GIF')
    if (f.size > MAX_BYTES) return toast('МАКСИМУМ 2 МБ')
    setFile(f)
  }

  const durLabel = DURATIONS.find((d) => d.h === hours)?.label ?? `${hours} Ч`

  const upload = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('hours', String(hours))
      if (link.trim()) form.append('link', link.trim())
      if (title.trim()) form.append('title', title.trim())
      const { ad } = await api<{ ad: Ad }>('admin/ads', { form })
      setAds((list) => [ad, ...(list ?? [])])
      setFile(null)
      setLink('')
      setTitle('')
      setNow(Date.now())
      toast(`БАННЕР ИДЁТ: ${durLabel}`)
    } catch (e) {
      toast(`ОШИБКА: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const patch = async (ad: Ad, body: Record<string, unknown>, ok: string) => {
    try {
      const r = await api<{ ad: Ad }>('admin/ads', { method: 'PATCH', body: { id: ad.id, ...body } })
      setAds((list) => list?.map((a) => (a.id === ad.id ? r.ad : a)) ?? null)
      setNow(Date.now())
      toast(ok)
    } catch (e) {
      toast(`ОШИБКА: ${(e as Error).message}`)
    }
  }

  // идёт сейчас → выключить; выключен или срок вышел → включить заново на выбранный срок
  const toggle = (ad: Ad) =>
    live(ad, now) ? patch(ad, { active: false }, 'ВЫКЛЮЧЕН') : patch(ad, { hours }, `ВКЛЮЧЁН: ${durLabel}`)

  // продлить на выбранный срок (у бессрочных продлевать нечего)
  const extend = (ad: Ad) => (hours === 0 ? patch(ad, { hours: 0 }, 'СРОК СНЯТ') : patch(ad, { extend: hours }, `ПРОДЛЕНО: +${durLabel}`))

  const remove = async (ad: Ad) => {
    if (!(await confirmAsk('Удалить баннер насовсем?'))) return
    try {
      await api(`admin/ads?id=${ad.id}`, { method: 'DELETE' })
      setAds((list) => list?.filter((a) => a.id !== ad.id) ?? null)
      toast('УДАЛЕНО')
    } catch (e) {
      toast(`ОШИБКА: ${(e as Error).message}`)
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal modal-admin" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">АДМИНКА</h2>

        <h3 className="admin-sub">НОВЫЙ БАННЕР</h3>
        <label className="upload">
          {preview ? <img src={preview} alt="" /> : <span>ВЫБРАТЬ КАРТИНКУ</span>}
          <input type="file" accept={TYPES.join(',')} onChange={(e) => pickFile(e.target.files?.[0])} />
        </label>
        <p className="hint">Лучше 1200×400 (3:1), до 2 МБ</p>

        <label className="field">
          <span>ССЫЛКА (КУДА ВЕДЁТ)</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://t.me/..." inputMode="url" />
        </label>
        <label className="field">
          <span>ПОДПИСЬ (ДЛЯ СЕБЯ)</span>
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Магазин кроссовок" />
        </label>

        <div className="field">
          <span>СРОК РАЗМЕЩЕНИЯ</span>
          <div className="dur-grid">
            {DURATIONS.map((d) => (
              <button key={d.h} type="button" className={`dur ${hours === d.h ? 'on' : ''}`} onClick={() => setHours(d.h)}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="hint dur-hint">Тот же срок применяется к кнопкам «ВКЛ» и «ПРОДЛИТЬ» в списке ниже.</p>
        </div>

        <button className="btn btn-main-sm full" onClick={upload} disabled={!file || busy}>
          {busy ? 'ЗАГРУЖАЮ...' : `ЗАГРУЗИТЬ НА ${durLabel}`}
        </button>

        <h3 className="admin-sub">БАННЕРЫ</h3>
        {error && <p className="hint err">Не загрузилось: {error}</p>}
        {!error && !ads && <p className="hint">Загрузка...</p>}
        {ads?.length === 0 && <p className="hint">Пока пусто</p>}
        <div className="ad-list">
          {ads?.map((ad) => {
            const on = live(ad, now)
            const over = expired(ad, now)
            const soon = on && ad.expires_at && Date.parse(ad.expires_at) - now < 3600e3
            return (
              <div key={ad.id} className={`ad-row ${on ? '' : 'off'}`}>
                <img src={ad.image_url} alt="" />
                <div className="ad-meta">
                  <b>{ad.title || 'Без подписи'}</b>
                  <small>{ad.link || 'без ссылки'}</small>
                  <small className={`ad-left ${over ? 'over' : soon ? 'soon' : on ? 'ok' : ''}`}>
                    {on ? left(ad, now) : over ? 'срок вышел' : 'выключен'}
                  </small>
                </div>
                <div className="ad-actions">
                  <button className={`mini ${on ? 'on' : ''}`} onClick={() => toggle(ad)}>
                    {on ? 'ВЫКЛ' : 'ВКЛ'}
                  </button>
                  {ad.expires_at && (
                    <button className="mini" onClick={() => extend(ad)}>
                      ПРОДЛИТЬ
                    </button>
                  )}
                  <button className="mini del" onClick={() => remove(ad)} aria-label="Удалить">
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button className="btn full" onClick={onClose}>
          ЗАКРЫТЬ
        </button>
      </div>
    </div>
  )
}
