import { useCallback, useRef } from 'react'
import JoeScene from './JoeScene'
import PixelIcon, { type IconName } from './PixelIcon'

export type Game = {
  id: string
  title: string
  desc: string
  icon: IconName
  color: string
  soon?: boolean
  art?: 'joe' | 'duel' | 'train' // вместо иконки — живая сцена из игры
}

type Props = {
  games: Game[]
  index: number
  onIndex: (i: number) => void
  onPlay: (g: Game) => void
  best: Record<string, number>
}

// Игры по одной, листаются свайпом (нативный scroll-snap — плавно и на телефоне, и мышкой)
export default function GameCarousel({ games, index, onIndex, onPlay, best }: Props) {
  const track = useRef<HTMLDivElement>(null)

  const onScroll = useCallback(() => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index && i >= 0 && i < games.length) onIndex(i)
  }, [index, games.length, onIndex])

  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const next = (i + games.length) % games.length
    // выбираем сразу, не дожидаясь конца прокрутки — PLAY и фон не отстают от тапа
    onIndex(next)
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="carousel">
      <div className="track" ref={track} onScroll={onScroll}>
        {games.map((g) => (
          <div className="slide" key={g.id}>
            <button
              className={`slide-card ${g.soon ? 'soon' : ''}`}
              style={{ ['--accent' as string]: g.color }}
              onClick={() => onPlay(g)}
            >
              {g.soon && <span className="badge">СКОРО</span>}
              {g.art ? (
                <span className="slide-art">
                  <JoeScene variant={g.art} />
                </span>
              ) : (
                <span className="slide-icon">
                  <PixelIcon name={g.icon} size={84} />
                </span>
              )}
              <span className="slide-title">{g.title}</span>
              <span className="slide-desc">{g.desc}</span>
              {!g.soon && (best[g.id] ?? 0) > 0 && (
                <span className="slide-best">
                  РЕКОРД: {best[g.id]}
                  {g.id === 'duel' ? ' ПОДРЯД' : g.id === 'train' ? ' ВАГ.' : ''}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="carousel-nav">
        <button className="nav-arrow" onClick={() => go(index - 1)} aria-label="Предыдущая игра">
          ◀
        </button>
        <div className="dots">
          {games.map((g, i) => (
            <button
              key={g.id}
              className={i === index ? 'on' : ''}
              style={{ ['--accent' as string]: g.color }}
              onClick={() => go(i)}
              aria-label={g.title}
            />
          ))}
        </div>
        <button className="nav-arrow" onClick={() => go(index + 1)} aria-label="Следующая игра">
          ▶
        </button>
      </div>
    </section>
  )
}
