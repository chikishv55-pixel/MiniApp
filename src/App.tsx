import { useCallback, useEffect, useRef, useState } from 'react'
import AdBanner from './AdBanner'
import AdminModal from './AdminModal'
import Avatar from './Avatar'
import GameCarousel, { type Game } from './GameCarousel'
import GameFrame, { type GameLaunch } from './GameFrame'
import PixelIcon from './PixelIcon'
import ProfileModal from './ProfileModal'
import { api, hasAuth } from './api'
import { createAndShare, plural, readIncomingCode, verifyChallenge, type Challenge, type RunInfo } from './challenge'
import { useProfile } from './profile'

const GAMES: Game[] = [
  { id: 'joe', title: 'МЕТКИЙ ДЖО', desc: 'Лови момент и стреляй в голову', icon: 'target', color: '#ffd93d', art: 'joe' },
  { id: 'reaction', title: 'REACTION', desc: 'Жми быстрее всех', icon: 'bolt', color: '#5cff5c', soon: true },
  { id: 'memory', title: 'MEMORY', desc: 'Запомни порядок', icon: 'memory', color: '#3dffe0', soon: true },
  { id: 'clicker', title: 'SPAM TAP', desc: '10 секунд на рекорд', icon: 'cursor', color: '#ff3d9a', soon: true },
]

const SHARE_TOAST: Record<string, string | null> = {
  telegram: null,
  shared: 'ВЫЗОВ ОТПРАВЛЕН',
  copied: 'ССЫЛКА СКОПИРОВАНА',
  cancelled: null,
  failed: 'НЕ ВЫШЛО СОЗДАТЬ ВЫЗОВ',
  noauth: 'ОТКРОЙ ИГРУ ЧЕРЕЗ TELEGRAM',
}

const tg = (window as any).Telegram?.WebApp

function haptic(kind: 'light' | 'medium' = 'light') {
  try {
    tg?.HapticFeedback?.impactOccurred(kind)
  } catch {
    /* вне телеграма */
  }
}

export default function App() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adKey, setAdKey] = useState(0)
  const [slide, setSlide] = useState(0)
  const [game, setGame] = useState<GameLaunch | null>(null)
  const [incoming, setIncoming] = useState<Challenge | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>()
  const { nick, avatar, save, tgNick, best, reportRun } = useProfile()

  const current = GAMES[slide]

  const showToast = useCallback((text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => {
    tg?.ready()
    tg?.expand()
    tg?.setHeaderColor?.('#0a0a0f')
    tg?.setBackgroundColor?.('#0a0a0f')
    // экран не скроллится — свайп вниз не должен случайно сворачивать приложение
    tg?.disableVerticalSwipes?.()
  }, [])

  // админ ли я: сервер отдаёт список баннеров только аккаунтам из ADMIN_IDS
  useEffect(() => {
    if (!hasAuth) return
    api('admin/ads')
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false))
  }, [])

  // вызов из ссылки: подпись проверяет сервер
  useEffect(() => {
    const code = readIncomingCode()
    if (!code) return
    verifyChallenge(code).then((ch) => {
      if (ch) setIncoming(ch)
      else showToast('ССЫЛКА НА ВЫЗОВ БИТАЯ')
    })
  }, [showToast])

  const play = (g: Game) => {
    if (g.soon) {
      showToast(`${g.title}: СКОРО`)
      return
    }
    haptic('medium')
    setGame({ mode: 'free' })
  }

  const changeSlide = useCallback((i: number) => {
    setSlide(i)
    try {
      tg?.HapticFeedback?.selectionChanged()
    } catch {
      /* вне телеграма */
    }
  }, [])

  const onChallenge = useCallback(
    async (r: RunInfo) => {
      const msg = SHARE_TOAST[await createAndShare(r, nick)]
      if (msg) showToast(msg)
    },
    [nick, showToast],
  )

  return (
    <div className="screen" style={{ ['--theme' as string]: current.color }}>
      {/* фон под текущую игру: слои плавно меняются местами */}
      {GAMES.map((g, i) => (
        <div
          key={g.id}
          className={`theme-layer ${i === slide ? 'on' : ''}`}
          style={{ ['--accent' as string]: g.color }}
        />
      ))}
      <div className="scanlines" />

      <header className="topbar">
        <button
          className="chip profile"
          onClick={() => {
            haptic()
            setProfileOpen(true)
          }}
          aria-label="Профиль"
        >
          <Avatar value={avatar} size={28} />
          <span className="nick">{nick.toUpperCase()}</span>
        </button>
        <div className="chip" title="Лучшая серия">
          <PixelIcon name="trophy" size={14} /> {best}
        </div>
        <div className="chip">LVL 1</div>
        {isAdmin && (
          <button className="chip chip-admin" onClick={() => setAdminOpen(true)} aria-label="Админка">
            ⚙
          </button>
        )}
      </header>

      <section className="hero">
        <h1 className="logo">
          PIXEL <span>ARENA</span>
        </h1>
        <p className="tagline">Бросай вызовы. Бей рекорды.</p>
      </section>

      <GameCarousel games={GAMES} index={slide} onIndex={changeSlide} onPlay={play} best={best} />

      <div className="actions">
        <button className="btn btn-main" onClick={() => play(current)} disabled={current.soon}>
          {current.soon ? 'СКОРО' : '▶ PLAY'}
        </button>
        <button
          className="btn btn-pink btn-square"
          disabled={current.soon}
          onClick={() => {
            showToast('СЫГРАЙ И ЖМИ «ВЫЗОВ ДРУГУ»')
            play(current)
          }}
          aria-label="Вызов другу"
        >
          <PixelIcon name="sword" size={24} />
        </button>
      </div>

      <AdBanner fresh={isAdmin} reloadKey={adKey} />

      {profileOpen && (
        <ProfileModal
          nick={nick}
          avatar={avatar}
          tgNick={tgNick}
          onSave={save}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {adminOpen && (
        <AdminModal
          onClose={() => {
            setAdminOpen(false)
            setAdKey((k) => k + 1)
          }}
          toast={showToast}
        />
      )}

      {incoming && !game && (
        <div className="modal-back" onClick={() => setIncoming(null)}>
          <div className="modal modal-pink" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <PixelIcon name="sword" size={56} />
            </div>
            <h2 className="modal-title pink">ВЫЗОВ!</h2>
            <p className="challenge-text">
              <b>{incoming.n.toUpperCase()}</b>
              <br />
              убил(а) {incoming.k} {plural(incoming.k)}
              <br />в «Метком Джо»
            </p>
            <p className="challenge-sub">Те же враги. Побьёшь?</p>
            <div className="modal-actions">
              <button
                className="btn btn-main-sm"
                onClick={() => {
                  haptic('medium')
                  setGame({ mode: 'challenge', ch: incoming })
                  setIncoming(null)
                }}
              >
                ПРИНЯТЬ
              </button>
              <button className="btn" onClick={() => setIncoming(null)}>
                ПОТОМ
              </button>
            </div>
          </div>
        </div>
      )}

      {game && (
        <GameFrame
          launch={game}
          onExit={() => setGame(null)}
          onChallenge={onChallenge}
          onResult={(r) => reportRun(r.kills)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
