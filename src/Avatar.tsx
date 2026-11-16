import { useState } from 'react'
import { tgPhoto } from './profile'

const COLORS = ['#ffd93d', '#3dffe0', '#ff3d9a', '#5cff5c', '#ff8a3d', '#8a7dff']

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// симметричный 5x5 «идентикон»: одна и та же строка всегда даёт один и тот же аватар
function Identicon({ seed }: { seed: string }) {
  const h = hash(seed)
  const color = COLORS[h % COLORS.length]
  const cells: JSX.Element[] = []
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((h >> (y * 3 + x + 3)) & 1) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />)
        if (x < 2) cells.push(<rect key={`m${x}-${y}`} x={4 - x} y={y} width={1} height={1} fill={color} />)
      }
    }
  }
  return (
    <svg viewBox="-1 -1 7 7" shapeRendering="crispEdges" className="avatar-svg">
      <rect x={-1} y={-1} width={7} height={7} fill="#14141f" />
      {cells}
    </svg>
  )
}

type Props = {
  value: string // 'tg' | 'px:<seed>'
  size?: number
}

export default function Avatar({ value, size = 36 }: Props) {
  const [broken, setBroken] = useState(false)
  const showPhoto = value === 'tg' && tgPhoto && !broken
  const seed = value.startsWith('px:') ? value.slice(3) : 'player'

  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {showPhoto ? (
        <img src={tgPhoto} alt="" onError={() => setBroken(true)} />
      ) : (
        <Identicon seed={seed} />
      )}
    </span>
  )
}
