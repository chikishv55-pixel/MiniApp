import { useEffect, useMemo, useRef } from 'react'
import type { Challenge, RunInfo } from './challenge'

export type GameLaunch = { mode: 'free' } | { mode: 'challenge'; ch: Challenge }

type Props = {
  launch: GameLaunch
  onExit: () => void
  onChallenge: (r: RunInfo) => void
  onResult: (r: RunInfo) => void
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

export default function GameFrame({ launch, onExit, onChallenge, onResult }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const cb = useRef({ onExit, onChallenge, onResult })
  cb.current = { onExit, onChallenge, onResult }

  const src = useMemo(() => {
    const q = new URLSearchParams({ embed: '1' })
    if (launch.mode === 'challenge') {
      q.set('mode', 'challenge')
      q.set('seed', String(launch.ch.s))
      q.set('level', String(launch.ch.l))
      q.set('target', String(launch.ch.k))
      q.set('from', launch.ch.n)
    }
    return `${import.meta.env.BASE_URL}games/joe.html?${q}`
  }, [launch])

  // сообщения из игры: принимаем только от нашего iframe и нашего origin
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return
      const d = e.data
      if (!d || d.src !== 'joe') return
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
  }, [])

  // системная кнопка «Назад» в Telegram
  useEffect(() => {
    const back = tg?.BackButton
    if (!back) return
    const go = () => cb.current.onExit()
    back.onClick(go)
    back.show()
    return () => {
      back.offClick(go)
      back.hide()
    }
  }, [])

  return <iframe ref={frame} className="game-frame" src={src} title="Меткий Джо" allow="autoplay" />
}
