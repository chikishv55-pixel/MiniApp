import { useEffect, useRef } from 'react'
import { box, drawDude, drawEnemy, drawSkin } from './joeArt.js'

// Мини-сцена из «Меткого Джо» для карточки в меню: Джо целится во врага на ступеньке,
// прицел гуляет, как в самой игре. Скин и оружие — те, что игрок выбрал в магазине Джо.

const W = 220
const H = 110
const GUN_LEN = [32, 27, 30, 48, 38, 32, 52, 66, 58] // длина ствола каждого оружия, как в игре
const ENEMY = { col: '#ff4d6d', col2: '#22283a', hat: 1 }

// игра хранит сейв в localStorage того же сайта — читаем выбранный скин и оружие
function readLoadout(): { skin: number; gun: number } {
  try {
    const s = JSON.parse(localStorage.getItem('metkiy-joe-v1') || 'null')
    const ok = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 8
    return { skin: ok(s?.curS) ? s.curS : 0, gun: ok(s?.curW) ? s.curW : 0 }
  } catch {
    return { skin: 0, gun: 0 }
  }
}

export default function JoeScene() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const { skin, gun } = readLoadout()

    const fit = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      cv.width = Math.max(1, Math.round(r.width * dpr))
      cv.height = Math.max(1, Math.round(r.height * dpr))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cv)

    // Джо слева внизу, враг справа на ступеньку выше — как на лестнице в игре
    const px = 58, py = 94, ps = 1.15
    const ex = 172, ey = 70, es = 1.1
    const target = Math.atan2(py - 22 * ps - (ey - 47 * es), ex - (px + 6 * ps))
    const aimMax = target + 0.35

    let aim = 0
    let dir = 1
    let last = performance.now()
    let raf = 0

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      if (document.hidden) return

      aim += dir * 1.1 * dt
      if (aim > aimMax) {
        aim = aimMax
        dir = -1
      } else if (aim < 0) {
        aim = 0
        dir = 1
      }

      ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // ступеньки
      box(ctx, '#2b2716', 0, py, 124, H - py)
      box(ctx, '#3a3420', 124, ey, W - 124, H - ey)
      box(ctx, '#3a3420', 110, py - 12, 14, 12)
      ctx.globalAlpha = 0.55
      box(ctx, '#ffd93d', 0, py, 110, 2)
      box(ctx, '#ffd93d', 110, py - 12, 14, 2)
      box(ctx, '#ffd93d', 124, ey, W - 124, 2)
      ctx.globalAlpha = 1

      drawDude(ctx, ex, ey, -1, es, (c) => drawEnemy(c, ENEMY), 0, 0.1, 0, 0)
      drawDude(ctx, px, py, 1, ps, (c) => drawSkin(c, skin), gun, aim, 0, 0)

      // пунктир прицела от дула, как в игре
      const len = GUN_LEN[gun]
      const mx = px + ps * (6 + len * Math.cos(aim) - 5 * Math.sin(aim))
      const my = py + ps * (-22 - len * Math.sin(aim) - 5 * Math.cos(aim))
      ctx.fillStyle = '#fff'
      for (let i = 1; i <= 7; i++) {
        ctx.globalAlpha = 1 - i / 8.5
        ctx.beginPath()
        ctx.arc(mx + Math.cos(aim) * i * 11, my - Math.sin(aim) * i * 11, 3 - i * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="joe-scene" role="img" aria-label="Меткий Джо целится во врага" />
}
