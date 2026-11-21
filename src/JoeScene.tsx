import { useEffect, useRef } from 'react'
import { drawLookJoe } from './JoePreview'
import { box, drawDude, drawEnemy } from './joeArt.js'

// Мини-сцены для карточек в меню, нарисованные кодом самих игр:
// joe  — Джо целится во врага на ступеньке, прицел гуляет, как в «Меткий Джо»;
// duel — двое со стволами в землю, вспыхивает «!», Джо стреляет первым, как в «Дуэли».
// Скин и оружие — те, что игрок выбрал в магазине Джо.

const W = 220
const H = 110 // высота самой сцены; сверху над ней рисуем небо
const CH = 220 // полная высота постера
const OFF = CH - H
const GUN_LEN = [32, 27, 30, 48, 38, 32, 52, 66, 58] // длина ствола каждого оружия, как в игре
const ENEMY = { col: '#ff4d6d', col2: '#22283a', hat: 1 }
const BANDIT = { col: '#35d6c9', col2: '#22283a', hat: 2 }

type Ctx = CanvasRenderingContext2D
type Variant = 'joe' | 'duel' | 'train' | 'gold' | 'tower' | 'canyon' | 'rodeo'

// небо каждой игры: верх и низ градиента
const SKY: Record<Variant, [string, string]> = {
  joe: ['#120b3a', '#6f5cff'],
  duel: ['#062a22', '#2fd08c'],
  train: ['#04222b', '#1fb6c9'],
  gold: ['#2a1206', '#ffa531'],
  tower: ['#2b0d1c', '#ff6b5e'],
  canyon: ['#2a1206', '#ff8a3d'],
  rodeo: ['#062a22', '#7fd36a'],
}

function backdrop(ctx: Ctx, variant: Variant, t: number) {
  const [top, bot] = SKY[variant]
  const g = ctx.createLinearGradient(0, 0, 0, CH)
  g.addColorStop(0, top)
  g.addColorStop(1, bot)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, CH)
  // звёзды (мерцают)
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 1.4 + i * 1.7))
    ctx.fillRect(((i * 53 + 17) % 200) + 8, ((i * 37 + 9) % 70) + 6, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5)
  }
  // солнце / луна с ореолом
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#fff3c4'
  ctx.beginPath()
  ctx.arc(166, 54, 36, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#fff3c4'
  ctx.beginPath()
  ctx.arc(166, 54, 21, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // облака плывут
  for (let i = 0; i < 3; i++) {
    const x = ((t * (6 + i * 3) + i * 90) % (W + 80)) - 50
    const y = 34 + i * 22
    ctx.globalAlpha = 0.16
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, y, 46, 9)
    ctx.fillRect(x + 10, y - 6, 26, 9)
  }
  ctx.globalAlpha = 1
  // два слоя гор
  for (const [base, amp, ph, a] of [
    [132, 20, 1.3, 0.2],
    [152, 16, 4.1, 0.26],
  ] as const) {
    ctx.fillStyle = `rgba(0,0,0,${a})`
    ctx.beginPath()
    ctx.moveTo(0, CH)
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, base - (Math.sin(x * 0.045 + ph) * 0.6 + Math.sin(x * 0.11 + ph * 2) * 0.4 + 1) * (amp / 2))
    ctx.lineTo(W, CH)
    ctx.closePath()
    ctx.fill()
  }
}

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

function makeCanyon(skin: number) {
  // Джо прыгает с сальто между скальными столбами
  const A = { x: 52, top: 66, w: 34 }
  const B = { x: 168, top: 60, w: 30 }
  let t = 0
  const rock = (ctx: Ctx, p: { x: number; top: number; w: number }) => {
    box(ctx, '#c4703e', p.x - p.w / 2, p.top, p.w, 120)
    box(ctx, '#8f4a26', p.x + p.w * 0.15, p.top, p.w * 0.35, 120)
    for (let y = p.top + 10; y < 110; y += 12) box(ctx, '#a95a30', p.x - p.w / 2, y, p.w, 2)
    box(ctx, '#f0b270', p.x - p.w / 2 - 3, p.top, p.w + 6, 5, 2)
  }
  return (ctx: Ctx, dt: number) => {
    t = (t + dt) % 2.6
    box(ctx, '#3f8fc9', 0, 100, W, 10)
    box(ctx, '#bfe6ff', 20 + ((t * 30) % 60), 103, 16, 1.5)
    box(ctx, '#bfe6ff', 120 + ((t * 30) % 60), 106, 16, 1.5)
    rock(ctx, A)
    rock(ctx, B)
    const charge = t < 0.9 ? Math.min(1, t / 0.9) : 0
    if (t < 0.9) {
      ctx.save()
      ctx.translate(A.x, A.top + charge * 2)
      ctx.scale(1 + charge * 0.25, 1 - charge * 0.28)
      drawDude(ctx, 0, 0, 1, 0.8, (c) => drawLookJoe(c, skin), -1, 0, 0, 0)
      ctx.restore()
    } else if (t < 1.45) {
      const k = (t - 0.9) / 0.55
      const x = A.x + (B.x - A.x) * k
      const y = A.top + (B.top - A.top) * k - 46 * 4 * k * (1 - k)
      ctx.save()
      ctx.translate(x, y - 24)
      ctx.rotate(Math.PI * 2 * k)
      ctx.translate(0, 24)
      drawDude(ctx, 0, 0, 1, 0.8, (c) => drawLookJoe(c, skin), -1, 0, 0, 0)
      ctx.restore()
    } else {
      const s = t < 1.6 ? 1 - (t - 1.45) * 1.2 : 1
      ctx.save()
      ctx.translate(B.x, B.top)
      ctx.scale(2 - s, s)
      drawDude(ctx, 0, 0, 1, 0.8, (c) => drawLookJoe(c, skin), -1, 0, 0, 0)
      ctx.restore()
      if (t < 1.9) {
        ctx.globalAlpha = Math.max(0, 1 - (t - 1.45) * 2.2)
        ctx.strokeStyle = '#5cff5c'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(B.x, B.top, 10 + (t - 1.45) * 60, 3 + (t - 1.45) * 14, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }
}

function makeRodeo(skin: number) {
  // Джо со стога бросает лассо на бегущего телёнка
  const gy = 104
  let t = 0
  const calf = (ctx: Ctx, x: number, run: boolean) => {
    const a = run ? Math.sin(t * 22) * 2 : 0
    for (const [dx, s] of [[-9, 1], [-3, -1], [5, 1], [10, -1]] as const) box(ctx, '#d9d2c4', x + dx + a * s, gy - 6, 3, 6, 1)
    box(ctx, '#f4f1ea', x - 10, gy - 18, 24, 13, 6)
    box(ctx, '#2b2b35', x + 1, gy - 17, 7, 5, 2)
    box(ctx, '#f4f1ea', x - 16, gy - 22, 11, 10, 4)
    box(ctx, '#ffb3c0', x - 18, gy - 17, 5, 5, 2)
    box(ctx, '#1b1b28', x - 13, gy - 20, 2, 2, 1)
  }
  return (ctx: Ctx, dt: number) => {
    t = (t + dt) % 3
    box(ctx, '#6fae4a', 0, gy, W, 10)
    for (let x = 60; x < W; x += 34) box(ctx, '#7a5236', x, gy - 22, 3, 22)
    box(ctx, '#7a5236', 56, gy - 17, W, 2.5)
    box(ctx, '#7a5236', 56, gy - 8, W, 2.5)
    box(ctx, '#e8c25a', 18, 76, 46, 30, 6)
    box(ctx, '#c99a30', 18, 86, 46, 2)
    drawDude(ctx, 40, 76, 1, 0.75, (c) => drawLookJoe(c, skin), -1, 0, 0, 0)
    const hx = 50, hy = 50
    let cx = 230 - t * 70
    const throwT = 1.0
    const fly = 0.6
    if (t > throwT + fly) cx = Math.max(64, 230 - (throwT + fly) * 70 - (t - throwT - fly) * 160)
    const rope = (x: number, y: number) => {
      ctx.strokeStyle = '#8a5a2b'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(hx, hy)
      ctx.quadraticCurveTo((hx + x) / 2, Math.max(hy, y) + 10, x, y)
      ctx.stroke()
    }
    const loop = (x: number, y: number, r: number, sq: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, sq)
      ctx.strokeStyle = '#c98f4f'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    if (t < throwT) loop(hx - 4, 34, 8, 0.35 + Math.sin(t * 14) * 0.06)
    else if (t < throwT + fly) {
      const k = (t - throwT) / fly
      const tx = 230 - (throwT + fly) * 70
      const x = hx + (tx - hx) * k
      const y = hy + (gy - 14 - hy) * k - 40 * 4 * k * (1 - k)
      rope(x, y)
      loop(x, y, 9, 0.45)
    } else {
      rope(cx, gy - 12)
      loop(cx, gy - 12, 7, 0.5)
    }
    if (cx > 64) calf(ctx, cx, t < throwT + fly)
    if (t > throwT + fly && t < throwT + fly + 0.6) {
      ctx.fillStyle = '#ffe066'
      ctx.font = '900 11px "Arial Black",sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('ЙИ-ХА!', 130, 40 - (t - throwT - fly) * 20)
    }
  }
}

export default function JoeScene({ variant = 'joe' }: { variant?: Variant }) {
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
              : variant === 'canyon'
                ? makeCanyon(skin)
                : variant === 'rodeo'
                  ? makeRodeo(skin)
                  : makeJoe(skin, gun)

    const fit = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1) // ×3 не видно глазу, а рисовать в 2,25 раза дороже
      cv.width = Math.max(1, Math.round(r.width * dpr))
      cv.height = Math.max(1, Math.round(r.height * dpr))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    // рисуем только видимый постер: в карусели на экране один из пяти
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(cv)

    let last = performance.now()
    let raf = 0
    let t = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // пока открыта игра, меню под ней не рисуем (раньше телефон рисовал две картинки сразу)
      if (document.hidden || !visible || document.body.classList.contains('playing')) return
      t += dt
      ctx.setTransform(cv.width / W, 0, 0, cv.height / CH, 0, 0)
      ctx.clearRect(0, 0, W, CH)
      backdrop(ctx, variant, t)
      ctx.save()
      ctx.translate(0, OFF)
      scene(ctx, dt)
      ctx.restore()
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
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
          canyon: 'Джо прыгает с сальто через каньон',
          rodeo: 'Джо ловит телёнка лассо',
        }[variant]
      }
    />
  )
}
