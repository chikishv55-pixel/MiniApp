import { useEffect, useMemo, useRef } from 'react'
import type { Challenge, GameId, RunInfo } from './challenge'
import { track } from './track'

// баннер для игры (плакат в гараже и реклама в «интернете» Перекупа)
export type GameAd = { id: string; image_url: string; link: string | null; title: string | null; until?: number | null }

export type GameLaunch = { game: GameId; mode: 'free' } | { game: GameId; mode: 'challenge'; ch: Challenge }

type Props = {
  launch: GameLaunch
  onExit: () => void
  onChallenge: (r: RunInfo) => void
  onResult: (r: RunInfo) => void
  solo?: boolean // игра — всё приложение: выйти некуда, кнопки «назад» нет
  ads?: GameAd[] // баннеры, которые игра может показать у себя
  admin?: boolean // админ: свежие баннеры, показы и клики не считаем, в игре есть вход в админку рекламы
  onAdminAds?: () => void
}

const FILES: Record<GameId, { file: string; title: string }> = {
  joe: { file: 'games/joe.html', title: 'Меткий Джо' },
  duel: { file: 'games/duel.html', title: 'Дуэль' },
  train: { file: 'games/train.html', title: 'Побег на поезде' },
  gold: { file: 'games/gold.html', title: 'Золотая лихорадка' },
  tower: { file: 'games/tower.html', title: 'Башня из бочек' },
  canyon: { file: 'games/canyon.html', title: 'Каньон' },
  rodeo: { file: 'games/rodeo.html', title: 'Дикое родео' },
  flip: { file: 'games/flip.html', title: 'Перекуп Джо' },
}

const tg = (window as any).Telegram?.WebApp

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : null)

// статистика из игры: только известные события и поля (сервер ещё раз всё проверит)
const STAT_EVENTS = new Set(['f_step', 'f_car', 'f_sale', 'f_shop'])
function readStat(d: any) {
  if (!STAT_EVENTS.has(d.e) || typeof d.item !== 'string' || d.item.length > 24) return null
  const ev: { e: string; item: string; v?: number; p?: number; m?: number } = { e: d.e, item: d.item }
  for (const k of ['v', 'p', 'm'] as const) {
    const x = num(d[k])
    if (x !== null) ev[k] = x
  }
  return ev
}

function readRun(d: any): RunInfo | null {
  const seed = num(d.seed)
  const level = num(d.level)
  const kills = num(d.kills)
  if (seed === null || level === null || kills === null || kills < 0) return null
  return { seed: seed >>> 0, level, kills }
}

export default function GameFrame({ launch, onExit, onChallenge, onResult, solo = false, ads = [], admin = false, onAdminAds }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const cb = useRef({ onExit, onChallenge, onResult, onAdminAds })
  cb.current = { onExit, onChallenge, onResult, onAdminAds }
  const adState = useRef({ ads, admin })
  adState.current = { ads, admin }

  // баннеры уходят в игру: когда она скажет «hello» и при каждом изменении списка
  const sendAds = () => {
    const live = adState.current.ads.filter((a) => !a.until || a.until > Date.now())
    try {
      frame.current?.contentWindow?.postMessage({ type: 'ads', ads: live, admin: adState.current.admin }, location.origin)
    } catch {
      /* игра ещё не загрузилась — пришлём по «hello» */
    }
  }
  useEffect(sendAds, [ads, admin])

  const src = useMemo(() => {
    const q = new URLSearchParams({ embed: '1' })
    if (solo) q.set('solo', '1')
    if (launch.mode === 'challenge') {
      q.set('mode', 'challenge')
      q.set('seed', String(launch.ch.s))
      q.set('level', String(launch.ch.l))
      q.set('target', String(launch.ch.k))
      q.set('from', launch.ch.n)
    }
    return `${import.meta.env.BASE_URL}${FILES[launch.game].file}?${q}`
  }, [launch, solo])

  // сообщения из игры: принимаем только от нашего iframe, нашего origin и запущенной игры
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return
      const d = e.data
      if (!d || d.src !== launch.game) return
      if (d.type === 'exit') cb.current.onExit()
      if (d.type === 'hello') sendAds()
      if (d.type === 'stat') {
        const ev = readStat(d)
        if (ev) track(ev)
      }
      if (d.type === 'admin_ads' && adState.current.admin) cb.current.onAdminAds?.()
      // показ/клик баннера: id сверяем со своим списком, ссылку берём из него же, а не из сообщения игры
      const ad = typeof d.id === 'string' ? adState.current.ads.find((a) => a.id === d.id) : undefined
      if (d.type === 'ad_view' && ad && !adState.current.admin) track({ e: 'ad_view', ad: ad.id })
      if (d.type === 'ad_click' && ad?.link) {
        if (!adState.current.admin) track({ e: 'ad_click', ad: ad.id })
        if (tg?.openLink) tg.openLink(ad.link)
        else window.open(ad.link, '_blank', 'noopener,noreferrer')
      }
      if (d.type === 'result') {
        const r = readRun(d)
        if (r) cb.current.onResult(r)
      }
      if (d.type === 'challenge') {
        const r = readRun(d)
        if (r && r.kills > 0) cb.current.onChallenge(r)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [launch.game])

  // системная кнопка «Назад» в Telegram
  useEffect(() => {
    const back = tg?.BackButton
    if (!back || solo) return
    const go = () => cb.current.onExit()
    back.onClick(go)
    back.show()
    return () => {
      back.offClick(go)
      back.hide()
    }
  }, [solo])

  return <iframe ref={frame} className="game-frame" src={src} title={FILES[launch.game].title} allow="autoplay" onLoad={sendAds} />
}
