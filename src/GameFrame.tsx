import { useEffect, useMemo, useRef } from 'react'
import type { Challenge, GameId, RunInfo } from './challenge'

export type GameLaunch = { game: GameId; mode: 'free' } | { game: GameId; mode: 'challenge'; ch: Challenge }

type Props = {
  launch: GameLaunch
  onExit: () => void
  onChallenge: (r: RunInfo) => void
  onResult: (r: RunInfo) => void
  solo?: boolean // игра — всё приложение: выйти некуда, кнопки «назад» нет
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

function readRun(d: any): RunInfo | null {
  const seed = num(d.seed)
  const level = num(d.level)
  const kills = num(d.kills)
  if (seed === null || level === null || kills === null || kills < 0) return null
  return { seed: seed >>> 0, level, kills }
}

export default function GameFrame({ launch, onExit, onChallenge, onResult, solo = false }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const cb = useRef({ onExit, onChallenge, onResult })
  cb.current = { onExit, onChallenge, onResult }

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

  return <iframe ref={frame} className="game-frame" src={src} title={FILES[launch.game].title} allow="autoplay" />
}
