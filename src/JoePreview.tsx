import { useEffect, useRef } from 'react'
import { drawDude, drawGun, drawSkin } from './joeArt.js'

type Props = {
  skin: number
  gun: number
  look: LookEquip
  // joe — Джо целиком; gun — только оружие крупно
  mode?: 'joe' | 'gun'
  width: number
  height: number
  className?: string
  animate?: boolean
}

const GUN_LEN = [32, 27, 30, 48, 38, 32, 52, 66, 58]

export function drawLookJoe(c: CanvasRenderingContext2D, skin: number, look?: LookEquip) {
  if (window.JoeLook) window.JoeLook.drawJoe(c, skin, drawSkin, look)
  else drawSkin(c, skin)
}

// Превью Джо в выбранном наряде. Рисует кодом игры, поэтому выглядит ровно как в играх.
export default function JoePreview({ skin, gun, look, mode = 'joe', width, height, className, animate }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const lookKey = JSON.stringify(look)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    cv.width = Math.round(width * dpr)
    cv.height = Math.round(height * dpr)
    const lk = JSON.parse(lookKey) as LookEquip

    const paint = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      if (mode === 'gun') {
        const s = Math.min(width / 80, height / 30)
        const L = GUN_LEN[gun] ?? 32
        ctx.translate(width / 2 - ((L - 22) / 2) * s + 4, height / 2 + 6 * s)
        ctx.scale(s, s)
        drawGun(ctx, gun)
        return
      }
      // Джо: ступни внизу, запас сверху под высокие шляпы
      const s = Math.min(width / 74, height / 116) // запас сверху под высокие шляпы
      const sway = animate ? Math.sin(t / 500) * 0.04 : 0
      drawDude(ctx, width / 2 - 2 * s, height - 6 * s, 1, s, (c) => drawLookJoe(c, skin, lk), gun, 0.15 + sway, 0, 0)
    }

    if (!animate) {
      paint(0)
      return
    }
    let raf = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (!document.hidden) paint(t)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [skin, gun, lookKey, mode, width, height, animate])

  return <canvas ref={ref} className={className} style={{ width, height }} aria-hidden="true" />
}
