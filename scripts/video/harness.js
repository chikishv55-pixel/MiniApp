// Рендер роликов «Игры Джо». Загружается в страницу games/train.html (dev-сервер, вкладка 540×960):
//   const h = await import('/scripts/video/harness.js')
//   await h.scan(seed)   — пробный прогон бота без отрисовки, ищет подходящий сид
//   h.start({...})       — рендерит ролик 1080×1920 и шлёт кадры на scripts/video/sink.mjs
// Игра прогоняется покадрово (manual-режим), поэтому кадры идеально ровные, без записи экрана.

import { OW, OH, FPS, banner, counter, plate, endCard } from './common.js'

const SINK = 'http://127.0.0.1:8799'

/* ---------- автопилот (тот же, что проверял проходимость поезда) ---------- */
export function makeBot(g, { dieAt = 1e9 } = {}) {
  let hold = 0
  return (s) => {
    const wx = s.dist + g.PX
    const front = wx + g.HW
    const sp = s.speed
    let c = null
    for (let k = Math.max(0, s.carsDone - 1); k < s.carsDone + 3; k++) {
      const cc = g.car(k)
      if (wx >= cc.x0 - g.HW && wx <= cc.x0 + cc.len + cc.gap) {
        c = cc
        break
      }
    }
    const hz = []
    if (c) {
      hz.push({ d: c.x0 + c.len - front, t: 'gap' })
      for (const o of c.obs) {
        if (!o.alive) continue
        const ox = c.x0 + o.x
        if (ox + o.w < wx - g.HW) continue
        hz.push({ d: ox - front, t: o.type })
      }
    }
    for (const f of s.fires) hz.push({ d: f - 30 - g.HW, t: 'fire' })
    for (const b of s.bombs) hz.push({ d: b - 30 - g.HW, t: 'fire' })
    for (const b of s.ebullets) if (b > -g.HW) hz.push({ d: b - g.HW, t: 'bullet' })
    hz.sort((a, b) => a.d - b.d)
    const near = hz.find((h) => h.d > -(h.t === 'tunnel' ? 9999 : 0))

    if (s.fireCD <= 0 && (s.heli || hz.some((h) => ['bandit', 'gunner', 'crate', 'stack', 'mover'].includes(h.t) && h.d > -20 && h.d < 480))) g.shoot()

    if (hold > 0) {
      hold -= 16
      if (hold <= 0 || (s.ground && hold < 380)) {
        hold = 0
        g.release()
      }
    } else if (s.carsDone < dieAt && s.ground && near) {
      const tall = ['stack', 'bandit', 'gunner'].includes(near.t)
      const low = ['barrel', 'crate', 'mover'].includes(near.t)
      if (near.t === 'tunnel') {
        if (near.d < sp * 0.12 + 10 && !s.duck) g.duck()
      } else if (near.t === 'bullet') {
        if (near.d < (sp + 520) * 0.16 && !s.duck) g.duck()
      } else if (near.d > 0) {
        const at = tall ? sp * 0.13 + 10 : low ? sp * 0.06 + 10 + (near.t === 'mover' ? 18 : 0) : sp * 0.05 + 10
        if (near.d < at) {
          g.press()
          hold = low ? 40 : 420
        }
      }
    }
  }
}

/* ---------- поиск сида: бот доживает до dieAt, видит вертолёт, потом ошибается ---------- */
export async function scan(seed, { from = 43, dieAt = 52 } = {}) {
  const fr = document.createElement('iframe')
  fr.style.cssText = 'position:fixed;left:-9999px;width:540px;height:960px'
  fr.src = `/games/train.html?mode=challenge&target=5&seed=${seed}&r=${Math.random()}`
  document.body.appendChild(fr)
  await new Promise((r) => (fr.onload = r))
  await new Promise((r) => setTimeout(r, 120))
  const g = fr.contentWindow.__train
  g.manual()
  g.press()
  g.release()
  g.skipTo(from)
  const bot = makeBot(g, { dieAt })
  let heliSeen = false
  let heliKill = false
  let tunnel = false
  let last = 0
  let steps = 0
  while (steps < 60 * 120) {
    const s = g.info()
    if (s.state !== 'run') break
    if (s.heli) heliSeen = true
    if (s.coins - last >= 20) heliKill = true
    last = s.coins
    const wx = s.dist + g.PX
    for (let k = s.carsDone; k < s.carsDone + 2; k++) if (g.car(k).obs.some((o) => o.type === 'tunnel' && g.car(k).x0 + o.x > wx - 100 && g.car(k).x0 + o.x < wx + 500)) tunnel = true
    bot(s)
    g.step(1000 / 60, true)
    steps++
  }
  const e = g.info()
  fr.remove()
  return { seed, to: e.carsDone, end: e.state === 'run' ? 'alive' : e.reason, heliSeen, heliKill, tunnel, sec: +(steps / 60).toFixed(1) }
}

/* ---------- рендер ---------- */
export function start(o) {
  window.__vp = { frames: 0, phase: 'init', done: false, err: null }
  run(o).catch((e) => {
    window.__vp.err = String((e && e.stack) || e)
    window.__vp.done = true
  })
  return 'started'
}

async function run(o) {
  const g = window.__train
  const vp = window.__vp
  // кадр 1080×1920 при devicePixelRatio=2 и окне 540×960
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
  window.dispatchEvent(new Event('resize'))
  await new Promise((r) => setTimeout(r, 100))
  const game = document.getElementById('c')
  vp.canvas = [game.width, game.height]

  g.manual()
  g.press()
  g.release()
  g.skipTo(o.from)
  const bot = makeBot(g, { dieAt: o.dieAt })

  const out = document.createElement('canvas')
  out.width = OW
  out.height = OH
  const c = out.getContext('2d')
  const snap = document.createElement('canvas')
  snap.width = OW
  snap.height = OH
  const sc = snap.getContext('2d')

  let i = 0
  const push = async () => {
    const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92))
    const res = await fetch(`${SINK}/f/${i}`, { method: 'POST', body: blob })
    if (!res.ok) throw new Error('sink ' + res.status)
    i++
    vp.frames = i
  }

  // фаза 1: игра
  vp.phase = 'game'
  let f = 0
  let deadF = -1
  const maxGame = FPS * 60
  while (f < maxGame) {
    let s = g.info()
    const dead = s.state !== 'run'
    if (dead && deadF < 0) deadF = f
    if (deadF >= 0 && f - deadF > o.afterDeath) break
    const slow = deadF >= 0 && f - deadF < o.slowFrames
    if (!dead) bot(s)
    g.step(1000 / 60, true)
    if (!slow) {
      if (!dead) {
        s = g.info()
        if (s.state === 'run') bot(s)
      }
      g.step(1000 / 60, false)
    } else g.step(1000 / 120, false)
    s = g.info()

    c.drawImage(game, 0, 0, game.width, game.height, 0, 0, OW, OH)
    banner(c)
    counter(c, s.carsDone)
    plate(c, o.hook, f, 70, '#ffc233', '#231700', -0.07, 860) // выше головы Джо
    if (deadF >= 0) plate(c, o.after, f - deadF - o.afterDelay, 999, '#ff3d9a', '#1a0010', 0.05, 900)
    await push()
    f++
  }
  vp.deathAt = deadF
  vp.gameFrames = f
  sc.drawImage(out, 0, 0)

  // фаза 2: плавный переход на финальный экран
  vp.phase = 'fade'
  for (let k = 0; k < 12; k++) {
    endCard(c, o, k / FPS)
    c.globalAlpha = 1 - (k + 1) / 12
    c.drawImage(snap, 0, 0)
    c.globalAlpha = 1
    await push()
  }
  // фаза 3: финальный экран с QR
  vp.phase = 'endcard'
  for (let k = 0; k < Math.round(FPS * o.endSec); k++) {
    endCard(c, o, (k + 12) / FPS)
    await push()
  }
  vp.phase = 'done'
  vp.done = true
}
