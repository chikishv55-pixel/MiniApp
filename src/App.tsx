import { useCallback, useEffect, useRef, useState } from 'react'
import AdBanner from './AdBanner'
import AdminModal from './AdminModal'
import Avatar from './Avatar'
import GameFrame, { type GameLaunch } from './GameFrame'
import PixelIcon, { type IconName } from './PixelIcon'
import ProfileModal from './ProfileModal'
import { api, hasAuth } from './api'
import { createAndShare, plural, readIncomingCode, verifyChallenge, type Challenge, type RunInfo } from './challenge'
import { useProfile } from './profile'

type Game = {
  id: string
  title: string
  desc: string
  icon: IconName
  color: string
  soon?: boolean
}

const GAMES: Game[] = [
  { id: 'joe', title: 'МЕТКИЙ ДЖО', desc: 'Стреляй вовремя', icon: 'target', color: 'var(--yellow)' },
  { id: 'reaction', title: 'REACTION', desc: 'Жми быстрее всех', icon: 'bolt', color: 'var(--green)', soon: true },
  { id: 'memory', title: 'MEMORY', desc: 'Запомни порядок', icon: 'memory', color: 'var(--cyan)', soon: true },
  { id: 'clicker', title: 'SPAM TAP', desc: '10 секунд на рекорд', icon: 'cursor', color: 'var(--pink)', soon: true },
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
  const [game, setGame] = useState<GameLaunch | null>(null)
  const [incoming, setIncoming] = useState<Challenge | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>()
  const { nick, avatar, save, tgNick, best, reportRun } = useProfile()

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

  const playJoe = () => {
    haptic('medium')
    setGame({ mode: 'free' })
  }

  const pick = (g: Game) => {
    if (g.soon) {
      showToast(`${g.title}: СКОРО`)
      return
    }
    playJoe()
  }

  const onChallenge = useCallback(
    async (r: RunInfo) => {
      const msg = SHARE_TOAST[await createAndShare(r, nick)]
      if (msg) showToast(msg)
    },
    [nick, showToast],
  )

  return (
    <div className="screen">
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
      </header>

      <section className="hero">
        <p className="hello blink">&gt; PRESS START</p>
        <h1 className="logo">
          PIXEL
          <br />
          <span>ARENA</span>
        </h1>
        <p className="tagline">Бросай вызовы. Бей рекорды.</p>
      </section>

      <button className="btn btn-main" onClick={playJoe}>
        ▶ PLAY
      </button>

      <h2 className="section-title">ИГРЫ</h2>
      <div className="grid">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={`card ${g.soon ? 'soon' : ''}`}
            style={{ ['--accent' as string]: g.color }}
            onClick={() => pick(g)}
          >
            {g.soon && <span className="badge">СКОРО</span>}
            <span className="card-icon">
              <PixelIcon name={g.icon} size={36} />
            </span>
            <span className="card-title">{g.title}</span>
            <span className="card-desc">{g.desc}</span>
          </button>
        ))}
      </div>

      <AdBanner fresh={isAdmin} reloadKey={adKey} />

      <button
        className="btn btn-pink btn-icon"
        onClick={() => {
          showToast('СЫГРАЙ И ЖМИ «ВЫЗОВ ДРУГУ»')
          playJoe()
        }}
      >
        <PixelIcon name="sword" size={16} />
        ВЫЗОВ ДРУГУ
      </button>

      <footer className="footer">
        v0.3 · 8-BIT EDITION
        {isAdmin && (
          <button className="admin-link" onClick={() => setAdminOpen(true)}>
            ⚙ АДМИНКА
          </button>
        )}
      </footer>

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
