import { useEffect, useState } from 'react'
import { api } from './api'

type Ad = { id: string; image_url: string; link: string | null; title: string | null; active: boolean }

type Props = {
  onClose: () => void
  toast: (text: string) => void
}

const MAX_BYTES = 2 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const tg = (window as any).Telegram?.WebApp

function confirmAsk(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (tg?.showConfirm) tg.showConfirm(text, (ok: boolean) => resolve(ok))
    else resolve(window.confirm(text))
  })
}

export default function AdminModal({ onClose, toast }: Props) {
  const [ads, setAds] = useState<Ad[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ ads: Ad[] }>('admin/ads')
      .then((r) => setAds(r.ads))
      .catch((e) => setError(e.message))
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

  const upload = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('image', file)
      if (link.trim()) form.append('link', link.trim())
      if (title.trim()) form.append('title', title.trim())
      const { ad } = await api<{ ad: Ad }>('admin/ads', { form })
      setAds((list) => [ad, ...(list ?? [])])
      setFile(null)
      setLink('')
      setTitle('')
      toast('БАННЕР ДОБАВЛЕН')
    } catch (e) {
      toast(`ОШИБКА: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (ad: Ad) => {
    try {
      const r = await api<{ ad: Ad }>('admin/ads', { method: 'PATCH', body: { id: ad.id, active: !ad.active } })
      setAds((list) => list?.map((a) => (a.id === ad.id ? r.ad : a)) ?? null)
    } catch (e) {
      toast(`ОШИБКА: ${(e as Error).message}`)
    }
  }

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
        <button className="btn btn-main-sm full" onClick={upload} disabled={!file || busy}>
          {busy ? 'ЗАГРУЖАЮ...' : 'ЗАГРУЗИТЬ'}
        </button>

        <h3 className="admin-sub">БАННЕРЫ</h3>
        {error && <p className="hint err">Не загрузилось: {error}</p>}
        {!error && !ads && <p className="hint">Загрузка...</p>}
        {ads?.length === 0 && <p className="hint">Пока пусто</p>}
        <div className="ad-list">
          {ads?.map((ad) => (
            <div key={ad.id} className={`ad-row ${ad.active ? '' : 'off'}`}>
              <img src={ad.image_url} alt="" />
              <div className="ad-meta">
                <b>{ad.title || 'Без подписи'}</b>
                <small>{ad.link || 'без ссылки'}</small>
              </div>
              <button className={`mini ${ad.active ? 'on' : ''}`} onClick={() => toggle(ad)}>
                {ad.active ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
              <button className="mini del" onClick={() => remove(ad)} aria-label="Удалить">
                ✕
              </button>
            </div>
          ))}
        </div>

        <button className="btn full" onClick={onClose}>
          ЗАКРЫТЬ
        </button>
      </div>
    </div>
  )
}
