// Пиксельные спрайты. Каждая строка — ряд пикселей, символ — цвет из PAL, '.' — пусто.
const PAL: Record<string, string> = {
  o: '#000000',
  h: '#ffffff',
  a: 'var(--accent, #ffffff)',
  b: 'color-mix(in srgb, var(--accent, #ffffff) 55%, #000000)',
  d: '#2a2a3d',
  s: '#c8c8d8',
  g: '#7a7a95',
  y: '#ffd93d',
  Y: '#c9a200',
}

const SPRITES = {
  bolt: [
    '......oooo..',
    '.....oahho..',
    '....oaaho...',
    '...oaaaho...',
    '..oaaaaaooo.',
    '..oaaaaaaao.',
    '..ooooaaabo.',
    '.....oaabo..',
    '....oaabo...',
    '....oabo....',
    '...oabo.....',
    '...ooo......',
  ],
  target: [
    '....aaaa....',
    '..aa....aa..',
    '.a...hh...a.',
    '.a...hh...a.',
    'a..........a',
    'a.hh.bb.hh.a',
    'a.hh.bb.hh.a',
    'a..........a',
    '.a...hh...a.',
    '.a...hh...a.',
    '..aa....aa..',
    '....aaaa....',
  ],
  memory: [
    'aaaaa..ddddd',
    'ahhaa..ddddd',
    'ahaaa..ddddd',
    'aaaaa..ddddd',
    'aaaaa..ddddd',
    '............',
    '............',
    'ddddd..aaaaa',
    'ddddd..ahhaa',
    'ddddd..ahaaa',
    'ddddd..aaaaa',
    'ddddd..aaaaa',
  ],
  cursor: [
    'o...........',
    'oo..........',
    'oao.........',
    'oaao........',
    'oaaao.......',
    'oaaaao......',
    'oaaaaao.....',
    'oaaaaaao....',
    'oaaaooooo...',
    'oaoaao......',
    'ooooaao.....',
    '....oaao....',
    '.....oo.....',
  ],
  lock: [
    '...oooooo...',
    '..osssssso..',
    '..os....so..',
    '..os....so..',
    '.oooooooooo.',
    '.oggggggggo.',
    '.ogggoogggo.',
    '.ogggoogggo.',
    '.oggggogggo.',
    '.oggggogggo.',
    '.oggggggggo.',
    '.oooooooooo.',
  ],
  sword: [
    '..........oo',
    '........ohso',
    '.......ohso.',
    '......ohso..',
    '.....ohso...',
    'o...ohso....',
    'yo.ohso.....',
    '.yooso......',
    '..yyo.......',
    '.oyyyo......',
    'oyo.oyo.....',
    'oo...oo.....',
  ],
  trophy: [
    '.oooooooooo.',
    '.oyhyyyyyyo.',
    'ooyhyyyyyyoo',
    'oyoyhyyyyoyo',
    '.ooyyyyyyoo.',
    '...oyyyyo...',
    '....oyyo....',
    '....oyyo....',
    '...oooooo...',
    '..oYYYYYYo..',
    '..oooooooo..',
  ],
} as const

export type IconName = keyof typeof SPRITES

type Props = {
  name: IconName
  size?: number
  color?: string
}

export default function PixelIcon({ name, size = 32, color }: Props) {
  const rows = SPRITES[name] as readonly string[]
  const w = Math.max(...rows.map((r) => r.length))
  const h = rows.length

  const rects: JSX.Element[] = []
  rows.forEach((row, y) => {
    const line = row.padEnd(w, '.')
    let x = 0
    while (x < w) {
      const c = line[x]
      if (c === '.') {
        x++
        continue
      }
      let end = x
      while (end + 1 < w && line[end + 1] === c) end++
      rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={end - x + 1} height={1} style={{ fill: PAL[c] }} />)
      x = end + 1
    }
  })

  return (
    <svg
      className="px-icon"
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      shapeRendering="crispEdges"
      style={color ? ({ ['--accent' as string]: color } as React.CSSProperties) : undefined}
      aria-hidden="true"
    >
      {rects}
    </svg>
  )
}
