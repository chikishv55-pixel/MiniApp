import { useEffect, useRef } from 'react'
import { drawLookJoe } from './JoePreview'
import { box, drawDude, drawEnemy } from './joeArt.js'

// Мини-сцены для карточек в меню, нарисованные кодом самих игр:
// joe  — Джо целится во врага на ступеньке, прицел гуляет, как в «Меткий Джо»;
// duel — двое со стволами в землю, вспыхивает «!», Джо стреляет первым, как в «Дуэли».
// Скин и оружие — те, что игрок выбрал в магазине Джо.

const W = 220
const H = 110
const GUN_LEN = [32, 27, 30, 48, 38, 32, 52, 66, 58] // длина ствола каждого оружия, как в игре
const ENEMY = { col: '#ff4d6d', col2: '#22283a', hat: 1 }
const BANDIT = { col: '#35d6c9', col2: '#22283a', hat: 2 }

type Ctx = CanvasRenderingContext2D

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

function muzzle(x: number, y: number, dir: number, s: number, gun: number, a: number) {
  const len = GUN_LEN[gun]
  return {
    x: x + dir * s * (6 + len * Math.cos(a) - 5 * Math.sin(a)),
    y: y + s * (-22 - len * Math.sin(a) - 5 * Math.cos(a)),
  }
}

function makeJoe(skin: number, gun: number) {
  // Джо слева внизу, враг справа на ступеньку выше — как на лестнице в игре
  const px = 58, py = 94, ps = 1.15
  const ex = 172, ey = 70, es = 1.1
  const aimMax = Math.atan2(py - 22 * ps - (ey - 47 * es), ex - (px + 6 * ps)) + 0.35
  let aim = 0
  let dir = 1

  return (ctx: Ctx, dt: number) => {
    aim += dir * 1.1 * dt
    if (aim > aimMax) {
      aim = aimMax
      dir = -1
    } else if (aim < 0) {
      aim = 0
      dir = 1
    }

    box(ctx, '#2b2716', 0, py, 124, H - py)
    box(ctx, '#3a3420', 124, ey, W - 124, H - ey)
    box(ctx, '#3a3420', 110, py - 12, 14, 12)
    ctx.globalAlpha = 0.55
    box(ctx, '#ffd93d', 0, py, 110, 2)
    box(ctx, '#ffd93d', 110, py - 12, 14, 2)
    box(ctx, '#ffd93d', 124, ey, W - 124, 2)
    ctx.globalAlpha = 1

    drawDude(ctx, ex, ey, -1, es, (c) => drawEnemy(c, ENEMY), 0, 0.1, 0, 0)
    drawDude(ctx, px, py, 1, ps, (c) => drawLookJoe(c, skin), gun, aim, 0, 0)

    // пунктир прицела от дула, как в игре
    const m = muzzle(px, py, 1, ps, gun, aim)
    ctx.fillStyle = '#fff'
    for (let i = 1; i <= 7; i++) {
      ctx.globalAlpha = 1 - i / 8.5
      ctx.beginPath()
      ctx.arc(m.x + Math.cos(aim) * i * 11, m.y - Math.sin(aim) * i * 11, 3 - i * 0.25, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

function makeDuel(skin: number, gun: number) {
  const gy = 92, s = 1.15
  const px = 52, ex = 168
  const LOWER = -1.15
  const CYCLE = 3.2
  const aimHit = Math.atan2(gy - 22 * s - (gy - 47 * s), ex - (px + 6 * s))
  let t = 0

  return (ctx: Ctx, dt: number) => {
    t = (t + dt) % CYCLE
    const signal = t >= 2 && t < 2.25
    const shot = t >= 2.25
    const sway = Math.sin(t * 3) * 0.03

    box(ctx, '#1f3a1f', 0, gy, W, H - gy)
    ctx.globalAlpha = 0.55
    box(ctx, '#5cff5c', 0, gy, W, 2)
    ctx.globalAlpha = 1

    // бандит: после выстрела падает навзничь и проявляется к новому кругу
    if (!shot) drawDude(ctx, ex, gy, -1, s, (c) => drawEnemy(c, BANDIT), 0, LOWER - sway, 0, 0)
    else if (t < 3) {
      ctx.globalAlpha = Math.max(0, 1 - (t - 2.25) / 0.75)
      drawDude(ctx, ex + (t - 2.25) * 30, gy, -1, s, (c) => drawEnemy(c, BANDIT), -1, 0, 0, Math.min(1.4, (t - 2.25) * 6))
      ctx.globalAlpha = 1
    }

    const aim = shot ? aimHit : LOWER + sway
    drawDude(ctx, px, gy, 1, s, (c) => drawLookJoe(c, skin), gun, aim, shot && t < 2.4 ? 1 - (t - 2.25) / 0.15 : 0, 0)

    if (shot && t < 2.45) {
      const m = muzzle(px, gy, 1, s, gun, aim)
      ctx.strokeStyle = `rgba(255,240,170,${1 - (t - 2.25) / 0.2})`
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(m.x, m.y)
      ctx.lineTo(ex, gy - 47 * s)
      ctx.stroke()
    }

    // «...» пока ждут, «!» в момент сигнала
    ctx.textAlign = 'center'
    ctx.font = '900 22px "Arial Black","Segoe UI",sans-serif'
    if (signal) {
      box(ctx, '#ffc233', W / 2 - 16, 18, 32, 34, 6)
      ctx.fillStyle = '#231700'
      ctx.fillText('!', W / 2, 44)
    } else if (!shot) {
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      ctx.fillText('.'.repeat(1 + (Math.floor(t * 2) % 3)), W / 2, 44)
    }
  }
}

function makeTrain(skin: number, gun: number) {
  // Джо бежит по крыше вагона, раз в цикл перепрыгивает бочку; вагоны и столбы проносятся мимо
  const roof = 78, px = 52, s = 1.0
  const SPEED = 120
  const CAR = 170, GAP = 0 // вагоны сплошные — сцена должна читаться с первого взгляда
  let t = 0
  let scroll = 0

  return (ctx: Ctx, dt: number) => {
    t += dt
    scroll += SPEED * dt

    // столбы на фоне
    const po = (scroll * 1.6) % 90
    for (let x = -po; x < W + 10; x += 90) box(ctx, '#1d3b3b', x, 22, 3, roof - 22)

    // вагоны
    const off = scroll % (CAR + GAP)
    for (let x = -off; x < W + CAR; x += CAR + GAP) {
      box(ctx, '#245a5a', x + 2, roof, CAR - 4, 40, 4)
      box(ctx, '#3dffe0', x, roof - 3, CAR, 4, 2)
      for (let w = x + 12; w + 16 < x + CAR - 8; w += 26) box(ctx, '#0f2a2a', w, roof + 9, 16, 12, 2)
    }

    // бочка выезжает справа раз в 2.2 секунды
    const cycle = 2.2
    const ph = t % cycle
    const bx = W + 20 - ph * (W + 60) / cycle
    box(ctx, '#8a4b22', bx, roof - 22, 18, 22, 5)
    box(ctx, '#5c2f12', bx, roof - 17, 18, 3)
    box(ctx, '#5c2f12', bx, roof - 7, 18, 3)

    // прыжок: когда бочка подъезжает — дуга над ней
    const jumpStart = bx - px
    let lift = 0
    if (jumpStart < 46 && jumpStart > -40) {
      const k = (46 - jumpStart) / 86
      lift = Math.sin(Math.min(1, k) * Math.PI) * 34
    }
    const bob = lift ? 0 : Math.abs(Math.sin(t * 14)) * 2.5
    const rot = lift ? -0.12 : Math.sin(t * 14) * 0.04
    drawDude(ctx, px, roof - lift - bob, 1, s, (c) => drawLookJoe(c, skin), gun, -1.05, 0, rot)
  }
}

function makeGold(skin: number) {
  // Джо с корытом на голове бегает под падающими самородками; динамит пролетает мимо
  const gy = 98, s = 0.95
  const items = [
    { x: 40, y: -10, v: 70, dyn: false },
    { x: 120, y: -60, v: 80, dyn: true },
    { x: 180, y: -30, v: 75, dyn: false },
  ]
  let jx = 110
  return (ctx: Ctx, dt: number) => {
    box(ctx, '#3a2c10', 0, gy, W, H - gy)
    ctx.globalAlpha = 0.55
    box(ctx, '#ffc233', 0, gy, W, 2)
    ctx.globalAlpha = 1
    // цель — ближайший самородок
    const gold = items.filter((i) => !i.dyn).sort((a, b) => b.y - a.y)[0]
    jx += Math.max(-90 * dt, Math.min(90 * dt, gold.x - jx))
    const catchY = gy - 62 * s - 4
    for (const it of items) {
      it.y += it.v * dt
      const caught = !it.dyn && it.y > catchY && Math.abs(it.x - jx) < 26
      if (caught || it.y > gy + 10) {
        it.y = -20 - Math.random() * 30
        it.x = 20 + Math.random() * (W - 40)
      }
      if (it.dyn) {
        box(ctx, '#d6334a', it.x - 4, it.y - 8, 8, 16, 2)
        box(ctx, '#ffe066', it.x - 1, it.y - 13, 2, 5)
      } else {
        box(ctx, '#a45f00', it.x - 7, it.y - 5, 14, 11, 4)
        box(ctx, '#ffc233', it.x - 6, it.y - 6, 12, 9, 4)
      }
    }
    drawDude(ctx, jx, gy, 1, s, (c) => drawLookJoe(c, skin), -1, 0, 0, 0)
    box(ctx, '#8a5428', jx - 26, catchY - 6, 52, 8, 4)
    box(ctx, '#4a2c14', jx - 28, catchY, 56, 4, 2)
  }
}

function makeTower(skin: number) {
  // Джо на кране роняет бочку на башню; башня растёт и сбрасывается
  const BW = 30, BH = 20, ground = 106, beam = 18
  let t = 0
  let floors = 2
  let dropY = -1
  const barrel = (ctx: Ctx, x: number, y: number) => {
    box(ctx, '#5c2f12', x - BW / 2, y, BW, BH, 5)
    box(ctx, '#a8642e', x - BW / 2 + 1, y + 1, BW - 2, BH - 2, 5)
    box(ctx, '#454d5e', x - BW / 2, y + 4, BW, 2)
    box(ctx, '#454d5e', x - BW / 2, y + BH - 6, BW, 2)
  }
  return (ctx: Ctx, dt: number) => {
    t += dt
    const hx = W / 2 + Math.sin(t * 2.2) * 60
    box(ctx, '#2a2a3d', 0, beam, W, 5)
    box(ctx, '#ffc233', 0, beam, W, 1.5)
    box(ctx, '#3a3446', W / 2 - 24, ground - 4, 48, 4, 2)
    const shift = Math.max(0, floors - 3) * BH
    for (let i = 0; i < floors; i++) barrel(ctx, W / 2 + (i % 2 ? 2 : -2), ground - 4 - (i + 1) * BH + shift)
    drawDude(ctx, hx, beam, 1, 0.8, (c) => drawLookJoe(c, skin), -1, 0, 0, 0)
    box(ctx, '#1b1b28', hx - 0.5, beam + 5, 1, 12)
    const top = ground - 4 - floors * BH + shift
    if (dropY < 0) {
      barrel(ctx, hx, beam + 17)
      // бросает, когда крюк над башней
      if (Math.abs(hx - W / 2) < 3 && Math.cos(t * 2.2) > 0) dropY = beam + 17
    } else {
      dropY += 160 * dt
      barrel(ctx, W / 2, dropY)
      if (dropY + BH >= top) {
        dropY = -1
        floors = floors >= 6 ? 2 : floors + 1
      }
    }
  }
}

export default function JoeScene({ variant = 'joe' }: { variant?: 'joe' | 'duel' | 'train' | 'gold' | 'tower' }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const { skin, gun } = readLoadout()
    const scene =
      variant === 'duel'
        ? makeDuel(skin, gun)
        : variant === 'train'
          ? makeTrain(skin, gun)
          : variant === 'gold'
            ? makeGold(skin)
            : variant === 'tower'
              ? makeTower(skin)
              : makeJoe(skin, gun)

    const fit = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      cv.width = Math.max(1, Math.round(r.width * dpr))
      cv.height = Math.max(1, Math.round(r.height * dpr))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cv)

    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (document.hidden) return
      ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0)
      ctx.clearRect(0, 0, W, H)
      scene(ctx, dt)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [variant])

  return (
    <canvas
      ref={ref}
      className="joe-scene"
      role="img"
      aria-label={
        {
          joe: 'Меткий Джо целится во врага',
          duel: 'Дуэль: Джо стреляет первым',
          train: 'Джо бежит по крышам поезда',
          gold: 'Джо ловит падающее золото',
          tower: 'Джо строит башню из бочек',
        }[variant]
      }
    />
  )
}
