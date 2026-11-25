import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdBanner from './AdBanner'
import AdminModal from './AdminModal'
import Avatar from './Avatar'
import GameCarousel, { type Game } from './GameCarousel'
import PassModal from './PassModal'
import Wardrobe from './Wardrobe'
import GameFrame, { type GameAd, type GameLaunch } from './GameFrame'
import PixelIcon from './PixelIcon'
import ProfileModal from './ProfileModal'
import SubscribeGate from './SubscribeGate'
import PaperGate from './PaperGate'
import { api, hasAuth } from './api'
import {
  GAME_TEXT,
  createAndShare,
  readIncomingCode,
  verifyChallenge,
  type Challenge,
  type GameId,
  type RunInfo,
} from './challenge'
import { useProfile } from './profile'
import { track } from './track'
import { useWallet } from './wallet'

const GAMES: Game[] = [
  { id: 'joe', title: 'МЕТКИЙ ДЖО', desc: 'Лови момент и бей точно в цель', icon: 'target', color: '#ffd93d', art: 'joe' },
  { id: 'duel', title: 'ДУЭЛЬ', desc: 'Жди сигнала и стреляй первым', icon: 'bolt', color: '#5cff5c', art: 'duel' },
  { id: 'train', title: 'ПОБЕГ НА ПОЕЗДЕ', desc: 'Прыгай, стреляй, пригибайся', icon: 'cursor', color: '#3dffe0', art: 'train' },
  { id: 'canyon', title: 'КАНЬОН', desc: 'Держи, отпускай — прыгай в центр', icon: 'bolt', color: '#ff9a3d', art: 'canyon', fresh: true },
  { id: 'rodeo', title: 'ДИКОЕ РОДЕО', desc: 'Лови лассо — но не скунса!', icon: 'target', color: '#9bd36a', art: 'rodeo', fresh: true },
  { id: 'flip', title: 'ПЕРЕКУП ДЖО', desc: 'Купи ржавую тачку, отмой, покрась — продай дороже', icon: 'bolt', color: '#e8b04a', poster: 'games/flip/poster.jpg', fresh: true },
]

// Пока приложение — одна игра: меню не показываем, сразу открываем «Перекуп Джо».
// Вернуть меню со всеми играми: SOLO = null.
const SOLO: GameId | null = 'flip'

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
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [passOpen, setPassOpen] = useState(false)
  const wallet = useWallet()
  const [slide, setSlide] = useState(0)
  // новинки с бейджем «НОВОЕ» — пока игрок не открыл игру (хранится на устройстве)
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('joe-seen') || '[]')
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  const games = useMemo(() => GAMES.map((g) => (g.fresh && seen.includes(g.id) ? { ...g, fresh: false } : g)), [seen])
  const markSeen = (id: string) =>
    setSeen((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      try {
        localStorage.setItem('joe-seen', JSON.stringify(next))
      } catch {
        /* без хранилища бейдж просто покажется снова */
      }
      return next
    })
  const [game, setGame] = useState<GameLaunch | null>(null)
  const [incoming, setIncoming] = useState<Challenge | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // подписка на канал: без initData (браузер, не Telegram) проверку пропускаем
  const [sub, setSub] = useState<{ state: 'checking' | 'ok' | 'need'; channel: string }>({
    state: hasAuth ? 'checking' : 'ok',
    channel: '',
  })
  const toastTimer = useRef<number>()
  const gateSeen = useRef(false) // показывали ли в этом заходе экран «подпишись» (для воронки)
  const [subMiss, setSubMiss] = useState(false) // нажал «Я подписался», а подписки нет
  const { nick, avatar, save, tgNick, best, reportRun } = useProfile()

  const current = GAMES[slide]

  const showToast = useCallback((text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  // пока открыта игра: меню не рисует постеры и не крутит CSS-анимации
  useEffect(() => {
    document.body.classList.toggle('playing', !!game)
  }, [game])

  useEffect(() => {
    track({ e: 'open' })
  }, [])

  // одна игра без меню: запуск игры = прошёл подписку (для воронки в статистике)
  useEffect(() => {
    if (SOLO && sub.state === 'ok') track({ e: 'play', g: SOLO })
  }, [sub.state])

  useEffect(() => {
    tg?.ready()
    tg?.expand()
    tg?.setHeaderColor?.('#0a0a0f')
    tg?.setBackgroundColor?.('#0a0a0f')
    // экран не скроллится — свайп вниз не должен случайно сворачивать приложение
    tg?.disableVerticalSwipes?.()

    // Высота экрана = реальная высота окна. Переменная Telegram «stable height» после
    // сворачивания (вышел в чат и вернулся) может остаться маленькой — меню ужималось в полоску.
    // Поэтому пересчитываем сами при любом изменении и разворачиваем приложение при возврате.
    const sync = () => {
      document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`)
    }
    const back = () => {
      if (document.hidden) return
      tg?.expand?.()
      sync()
      // Telegram доводит окно до размера с анимацией — досчитываем после неё
      window.setTimeout(sync, 300)
    }
    sync()
    window.addEventListener('resize', sync)
    document.addEventListener('visibilitychange', back)
    tg?.onEvent?.('viewportChanged', sync)
    tg?.onEvent?.('activated', back)
    return () => {
      window.removeEventListener('resize', sync)
      document.removeEventListener('visibilitychange', back)
      tg?.offEvent?.('viewportChanged', sync)
      tg?.offEvent?.('activated', back)
    }
  }, [])

  const checkSub = useCallback(
    async (manual = false) => {
      if (!hasAuth) return
      if (manual) setSub((s) => ({ ...s, state: 'checking' }))
      try {
        const r = await api<{ subscribed: boolean; channel: string | null }>('sub')
        const gated = !r.subscribed && Boolean(r.channel)
        if (gated && !gateSeen.current) {
          gateSeen.current = true
          track({ e: 'gate_shown' })
        } else if (!gated && gateSeen.current) {
          gateSeen.current = false
          track({ e: 'gate_passed' })
        }
        setSub({ state: r.subscribed || !r.channel ? 'ok' : 'need', channel: r.channel || '' })
        if (manual && !r.subscribed && r.channel) {
          if (SOLO) setSubMiss(true)
          else showToast('ПОДПИСКИ ПОКА НЕТ')
        }
        if (r.subscribed) setSubMiss(false)
      } catch {
        // сервер недоступен — не держим игрока у закрытой двери
        setSub((s) => ({ ...s, state: 'ok' }))
      }
    },
    [showToast],
  )

  // проверяем при входе и каждый раз, когда игрок возвращается в приложение (например, из канала)
  useEffect(() => {
    checkSub()
    const again = () => {
      if (!document.hidden) checkSub()
    }
    document.addEventListener('visibilitychange', again)
    tg?.onEvent?.('activated', again)
    return () => {
      document.removeEventListener('visibilitychange', again)
      tg?.offEvent?.('activated', again)
    }
  }, [checkSub])

  // баннеры для игры (в режиме одной игры меню с баннером нет — реклама живёт внутри «Перекупа»)
  const [gameAds, setGameAds] = useState<GameAd[]>([])
  useEffect(() => {
    if (!SOLO) return
    let alive = true
    api<{ ads?: GameAd[] }>(isAdmin ? 'ad?fresh=1' : 'ad')
      .then((r) => alive && setGameAds(Array.isArray(r.ads) ? r.ads : []))
      .catch(() => alive && setGameAds([]))
    return () => {
      alive = false
    }
  }, [isAdmin, adKey])

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
      if (ch) {
        setIncoming(ch)
        track({ e: 'ch_open', g: ch.g })
      }
      else showToast('ССЫЛКА НА ВЫЗОВ БИТАЯ')
    })
  }, [showToast])

  const play = (g: Game) => {
    if (g.soon) {
      showToast(`${g.title}: СКОРО`)
      return
    }
    haptic('medium')
    if (g.fresh) markSeen(g.id)
    track({ e: 'play', g: g.id })
    setGame({ game: g.id as GameId, mode: 'free' })
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
      if (!game) return
      const res = await createAndShare(game.game, r, nick)
      if (res !== 'failed' && res !== 'noauth' && res !== 'cancelled') track({ e: 'ch_create', g: game.game })
      const msg = SHARE_TOAST[res]
      if (msg) showToast(msg)
    },
    [game, nick, showToast],
  )

  if (SOLO) {
    return (
      <div className="screen solo">
        {/* игра грузится сразу; подписку проверяем фоном и закрываем гараж, только если сервер сказал «нет» */}
        <GameFrame
          launch={{ game: SOLO, mode: 'free' }}
          solo
          onExit={() => {}}
          onChallenge={() => {}}
          onResult={(r) => {
            reportRun(SOLO, r.kills)
            track({ e: 'result', g: SOLO, v: r.kills })
          }}
          ads={gameAds}
          admin={isAdmin}
          onAdminAds={() => setAdminOpen(true)}
        />
        {adminOpen && (
          <AdminModal
            onClose={() => {
              setAdminOpen(false)
              setAdKey((k) => k + 1)
            }}
            toast={showToast}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
        {(sub.state === 'need' || (sub.state === 'checking' && gateSeen.current) || (import.meta.env.DEV && location.search.includes('gate'))) && (
          <PaperGate channel={sub.channel || 'JoesGames'} checking={sub.state === 'checking'} miss={subMiss} onCheck={() => checkSub(true)} />
        )}
      </div>
    )
  }

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
        <button className="chip chip-btn" onClick={() => setWardrobeOpen(true)} aria-label="Монеты и гардероб">
          <span className="coin" /> {wallet.coins}
        </button>
        <button className="chip chip-btn chip-pass" onClick={() => setPassOpen(true)} aria-label="Пропуск">
          LVL {wallet.look.pass}
        </button>
        {isAdmin && (
          <button className="chip chip-admin" onClick={() => setAdminOpen(true)} aria-label="Админка">
            ⚙
          </button>
        )}
      </header>

      <section className="hero">
        <h1 className="logo">
          ИГРЫ <span>ДЖО</span>
        </h1>
        <p className="tagline">Бросай вызовы. Бей рекорды.</p>
      </section>

      <GameCarousel games={games} index={slide} onIndex={changeSlide} onPlay={play} best={best} lookKey={wallet.version} />

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
        <button className="btn btn-cyan btn-square" onClick={() => setWardrobeOpen(true)} aria-label="Гардероб">
          <PixelIcon name="shirt" size={24} color="#fff" />
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

      {wardrobeOpen && (
        <Wardrobe
          wallet={wallet}
          toast={showToast}
          onClose={() => setWardrobeOpen(false)}
          onOpenPass={() => {
            setWardrobeOpen(false)
            setPassOpen(true)
          }}
        />
      )}

      {passOpen && <PassModal wallet={wallet} toast={showToast} onClose={() => setPassOpen(false)} />}

      {adminOpen && (
        <AdminModal
          onClose={() => {
            setAdminOpen(false)
            setAdKey((k) => k + 1)
          }}
          toast={showToast}
        />
      )}

      {incoming && !game && sub.state === 'ok' && (
        <div className="modal-back" onClick={() => setIncoming(null)}>
          <div className="modal modal-pink" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <PixelIcon name="sword" size={56} />
            </div>
            <h2 className="modal-title pink">ВЫЗОВ!</h2>
            <p className="challenge-text">
              <b>{incoming.n.toUpperCase()}</b>
              <br />
              {GAME_TEXT[incoming.g].score(incoming.k)}
              <br />
              {GAME_TEXT[incoming.g].inGame}
            </p>
            <p className="challenge-sub">{({ duel: 'Те же бандиты.', train: 'Тот же поезд.', gold: 'То же золото и динамит.', tower: 'Тот же кран.', canyon: 'Те же столбы.', rodeo: 'Те же звери.' } as Record<string, string>)[incoming.g] ?? 'Те же враги.'} Побьёшь?</p>
            <div className="modal-actions">
              <button
                className="btn btn-main-sm"
                onClick={() => {
                  haptic('medium')
                  track({ e: 'ch_play', g: incoming.g })
                  track({ e: 'play', g: incoming.g })
                  setGame({ game: incoming.g, mode: 'challenge', ch: incoming })
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
          onExit={() => {
            setGame(null)
            wallet.refresh()
          }}
          onChallenge={onChallenge}
          onResult={(r) => {
            reportRun(game.game, r.kills)
            track({ e: 'result', g: game.game, v: r.kills })
          }}
        />
      )}

      {sub.state !== 'ok' && !game && (
        <SubscribeGate channel={sub.channel || 'JoesGames'} checking={sub.state === 'checking'} onCheck={() => checkSub(true)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
