// Ролики ~10 с про «Золотую лихорадку», «Башню из бочек» (ускоренные, подписано), «Каньон» и «Дикое родео» (В РЕАЛЬНОМ ВРЕМЕНИ).
//   const h = await import('/scripts/video/harness-casual.js')
//   const qr = await (await fetch('/scripts/video/qr.json')).json()
//   h.startCanyon({ qr, sink: 'http://127.0.0.1:8821', from: 18, noGun: true, linkText: 'ссылка — в профиле' })   // /games/canyon.html?mode=challenge&seed=<сид>&target=5
//   h.startRodeo({ qr, sink: 'http://127.0.0.1:8822', from: 10, noGun: true, linkText: 'ссылка — в профиле' })     // /games/rodeo.html?mode=challenge&seed=<сид>&target=5
// Прогресс: window.__vp. Игра идёт в manual-режиме: время двигаем мы, поэтому кадры ровные.
// ВАЖНО: вкладка браузера 540×960 и панель браузера ВИДНА, иначе страница работает ~1 кадр/с.
import { OW, OH, FPS, banner, endCard, plate, pushFrame, text } from './common.js'

const plural = (n, a, b, c) => {
  const x = n % 10
  const y = n % 100
  return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c
}

/* ---------- автопилоты ---------- */
// Золото: едет под ближайший самородок, уходит от динамита.
function goldBot(G) {
  return () => {
    const I = G.info()
    const ok = I.items.filter((i) => i.type !== 'dyn' && i.y < G.CATCH)
    const dyn = I.items.filter((i) => i.type === 'dyn' && i.y < G.CATCH && i.y > G.CATCH - 260)
    let tx = I.x
    const t = ok.sort((a, b) => (G.CATCH - a.y) / a.vy - (G.CATCH - b.y) / b.vy)[0]
    if (t) tx = t.x
    for (const d of dyn) if (Math.abs(d.x - tx) < G.HW + 30) tx = d.x + (d.x < G.W / 2 ? 1 : -1) * (G.HW + 60)
    G.setTarget(Math.max(50, Math.min(G.W - 50, tx)))
  }
}

// Башня: бросает бочку, когда крюк будет ровно над верхом башни В МОМЕНТ ПАДЕНИЯ
function towerBot(T) {
  ;(0, eval)('window.__swayPred = (dt) => swayAmp() * (Math.sin((time + dt) * 1.6) - Math.sin(time * 1.6))')
  return () => {
    const I = T.info()
    if (I.state !== 'hang') return
    const fall = Math.sqrt(Math.max(0, (2 * (I.topY - T.BH / 2 - (T.HOOK_Y + T.BH / 2 + 8))) / T.G))
    const e = I.hookX - (I.topX + window.__swayPred(fall))
    if (Math.abs(e) < 4) T.drop()
  }
}

// Каньон: между прыжками «думает» 0,15–0,25 с, держит ровно столько, чтобы приземлиться в центр (с учётом хода вагонетки).
function canyonBot(C) {
  const E = window.eval
  let want = -1
  let idle = 0.2
  let n = 0
  return (dt) => {
    const I = C.info()
    if (I.mode === 'stand') {
      if (want >= 0) return
      idle -= dt
      if (idle > 0) return
      const p = C.plat(E('cur') + 1)
      const t0 = E('time')
      let h = 0.3
      for (let k = 0; k < 5; k++) {
        const tl = t0 + h + C.JT
        const tx = p.x + (p.amp ? p.amp * Math.sin(tl * p.om + p.ph) : 0)
        h = Math.max(0.02, (tx - I.x) / C.SPEED)
      }
      want = h
      C.hold()
    } else if (I.mode === 'charge' && want >= 0 && I.holdT >= want) {
      C.release()
      want = -1
      idle = n++ % 2 ? 0.15 : 0.25
    }
  }
}

// Родео: решает бросок по траектории (сила и угол), ближайшего зверя берёт первым, скунса пропускает.
function rodeoBot(R) {
  let wait = 0.3
  const solve = (c) => {
    let best = null
    for (let ang = 0.2; ang <= 1.48; ang += 0.04)
      for (let v = R.VMIN; v <= R.VMAX; v += 20) {
        let x = R.HAND.x
        let y = R.HAND.y
        let vx = Math.cos(ang) * v
        let vy = -Math.sin(ang) * v
        let t = 0
        for (let k = 0; k < 240; k++) {
          const dt = 1 / 60
          vy += R.GRAV * dt
          x += vx * dt
          y += vy * dt
          t += dt
          const cx = c.x - c.v * t
          const cy = R.GROUND - c.h * 0.5
          if (Math.hypot(x - cx, y - cy) < R.CATCH_R * 0.6) {
            if (!best || t < best.t) best = { v, ang, t }
            break
          }
          if (y > R.GROUND) break
        }
      }
    return best
  }
  return (dt) => {
    const I = R.info()
    if (I.busy) return
    if (wait > 0) {
      wait -= dt
      return
    }
    const cand = I.critters.filter((c) => c.type !== 'skunk' && c.x < 520 && c.x > 60).sort((a, b) => a.x - b.x)
    for (const c of cand) {
      const s = solve(c)
      if (s) {
        R.throwAt(s.v, s.ang)
        wait = 0.3
        break
      }
    }
  }
}

function heart(c, x, y, on) {
  c.globalAlpha = on ? 1 : 0.28
  c.fillStyle = '#ff4d6d'
  c.beginPath()
  c.arc(x - 9, y - 4, 11, 0, 7)
  c.arc(x + 9, y - 4, 11, 0, 7)
  c.fill()
  c.beginPath()
  c.moveTo(x - 20, y)
  c.lineTo(x + 20, y)
  c.lineTo(x, y + 20)
  c.closePath()
  c.fill()
  c.globalAlpha = 1
}

const KINDS = {
  gold: {
    api: () => window.__gold,
    label: 'ЗОЛОТО',
    shift: 150,
    sub: 33.3,
    speed: 8,
    hook: ['БОТ ЛОВИТ ЗОЛОТО'],
    score: (s) => s.gold,
    ready: () => true,
    after: (n) => [`БОТ НАБРАЛ ${n}`, 'ПОБЕЙ!'],
    color: ['#ff3d9a', '#1a0010'],
    bot: goldBot,
  },
  tower: {
    api: () => window.__tower,
    label: 'ЭТАЖ',
    shift: 290,
    sub: 8,
    speed: 3.5,
    hook: ['ИДЕАЛЬНАЯ БАШНЯ'],
    score: (s) => s.floors,
    ready: (s) => s.state === 'hang',
    after: (n) => [`${n} ${plural(n, 'ЭТАЖ', 'ЭТАЖА', 'ЭТАЖЕЙ')}`, 'СМОЖЕШЬ ВЫШЕ?'],
    color: ['#5cff5c', '#062a06'],
    bot: towerBot,
    draw: (c, s) => s.combo > 1 && text(c, `ИДЕАЛЬНО ×${s.combo}`, OW / 2, 535, 56, '#5cff5c', '#14141f', 12),
  },
  canyon: {
    api: () => window.__canyon,
    label: 'ОЧКИ',
    shift: 0,
    sub: 1000 / 60,
    speed: 1, // реальное время
    keepRunning: true,
    hook: ['ДЕРЖИ — ОТПУСКАЙ'],
    score: (s) => s.score,
    ready: (s) => s.mode === 'stand',
    setup: (g, o) => g.skipTo(o.from ?? 18),
    plateY: 800, // Джо стоит внизу, плашка не должна его закрывать
    after: (n) => [`${n} ${plural(n, 'ОЧКО', 'ОЧКА', 'ОЧКОВ')}`, 'СМОЖЕШЬ ТАК?'],
    color: ['#ff9a3d', '#2a1206'],
    bot: canyonBot,
    draw: (c, s) => s.streak > 1 && text(c, `ИДЕАЛЬНО ×${s.streak}`, OW / 2, 535, 56, '#5cff5c', '#14141f', 12),
  },
  rodeo: {
    api: () => window.__rodeo,
    label: 'ОЧКИ',
    shift: 0,
    sub: 1000 / 60,
    speed: 1,
    keepRunning: true,
    hook: ['ЛОВИ ЛАССО'],
    score: (s) => s.score,
    ready: (s) => !s.busy,
    // прогреваем поле: к началу клипа первые звери уже на подходе, а не в 4 секундах от Джо
    setup: (g, o) => {
      g.skipTo(o.from ?? 10)
      for (let i = 0; i < Math.round(60 * (o.warm ?? 1.3)); i++) g.step(1000 / 60, true)
    },
    after: (n, s) => [`БОТ ПОЙМАЛ ${s.caught}`, 'СМОЖЕШЬ БОЛЬШЕ?'],
    color: ['#9bd36a', '#0c2a06'],
    bot: rodeoBot,
    draw: (c, s) => {
      for (let i = 0; i < 3; i++) heart(c, OW / 2 + (i - 1) * 56, 548, i < s.lives)
      if (s.combo >= 3) text(c, `СЕРИЯ ${s.combo}`, OW / 2, 625, 46, '#ffe066', '#14141f', 10)
    },
  },
}

export const startGold = (o) => launch('gold', o)
export const startTower = (o) => launch('tower', o)
export const startCanyon = (o) => launch('canyon', o)
export const startRodeo = (o) => launch('rodeo', o)

function launch(kind, o = {}) {
  window.__vp = { frames: 0, phase: 'init', done: false, err: null }
  run(kind, o).catch((e) => {
    window.__vp.err = String((e && e.stack) || e)
    window.__vp.done = true
  })
  return 'started'
}

async function run(kind, o) {
  const K = KINDS[kind]
  const g = K.api()
  const vp = window.__vp
  const speed = o.speed || K.speed
  const frames = o.frames || 240 // 8 с игры
  const plateF = o.plateFrames || 30 // последняя секунда — плашка «побей»
  const endSec = o.endSec || 2.0

  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
  window.dispatchEvent(new Event('resize'))
  await new Promise((r) => setTimeout(r, 100))
  const game = document.getElementById('c')
  vp.canvas = [game.width, game.height]

  g.manual()
  window.__video = true
  ;(0, eval)('D.best=1;D.runs=9') // подсказки «как играть» не нужны, а рекорд в сейв не пишется
  g.start()
  if (K.setup) K.setup(g, o)
  const bot = K.bot(g)

  const out = document.createElement('canvas')
  out.width = OW
  out.height = OH
  const c = out.getContext('2d')
  const snap = document.createElement('canvas')
  snap.width = OW
  snap.height = OH
  const sc = snap.getContext('2d')

  let i = o.startIndex || 0 // продолжаем нумерацию кадров после записи меню
  const push = async () => {
    await pushFrame(out, i, o.sink)
    i++
    vp.frames = i
  }
  const perFrame = Math.max(1, Math.round((speed * 1000) / FPS / K.sub))
  const label = speed === 1 ? 'играет автопилот' : `автопилот · ускорено ×${String(speed).replace('.', ',')}`

  vp.phase = 'game'
  let freeze = false
  let frozen = null
  for (let f = 0; f < frames; f++) {
    if (!freeze) {
      for (let k = 0; k < perFrame; k++) {
        bot(K.sub / 1000)
        g.step(K.sub, k < perFrame - 1)
      }
      const s = g.info()
      // перед плашкой автопилот перестаёт играть: число на плашке должно совпасть со счётчиком
      if (!o.noPlate && f >= frames - plateF && K.ready(s)) {
        freeze = true
        frozen = { n: K.score(s), s }
        ;(0, eval)('banner=null') // игровой баннер («ДАЛЬШЕ: …») не должен просвечивать из-под плашки
      }
      if (s.state === 'dead') throw new Error('автопилот проиграл на кадре ' + f)
    } else if (K.keepRunning) {
      // реальное время: сцена живёт дальше, но бот уже ничего не делает
      for (let k = 0; k < perFrame; k++) g.step(K.sub, k < perFrame - 1)
    }
    const s = g.info()
    // небо над опущенной картинкой: растягиваем верхние строки кадра игры
    if (K.shift) c.drawImage(game, 0, 0, game.width, 2, 0, 0, OW, K.shift)
    c.drawImage(game, 0, 0, game.width, game.height, 0, K.shift, OW, OH)
    banner(c)
    text(c, label, OW / 2, 372, 30, 'rgba(255,255,255,.8)', '#14141f', 7)
    text(c, `${K.label} ${K.score(s)}`, OW / 2, 458, 72, '#fff', '#14141f', 16)
    if (K.draw) K.draw(c, s)
    if (!o.noPlate) plate(c, K.hook, f, 54, '#ffc233', '#231700', -0.07, 1000)
    if (freeze) plate(c, K.after(frozen.n, frozen.s), f - (frames - plateF), 999, K.color[0], K.color[1], 0.05, K.plateY || 1040)
    await push()
  }
  vp.score = frozen ? frozen.n : null
  sc.drawImage(out, 0, 0)

  vp.phase = 'fade'
  for (let k = 0; k < 12; k++) {
    endCard(c, o, k / FPS)
    c.globalAlpha = 1 - (k + 1) / 12
    c.drawImage(snap, 0, 0)
    c.globalAlpha = 1
    await push()
  }
  vp.phase = 'endcard'
  for (let k = 0; k < Math.round(FPS * endSec); k++) {
    endCard(c, o, (k + 12) / FPS)
    await push()
  }
  vp.phase = 'done'
  vp.done = true
}
