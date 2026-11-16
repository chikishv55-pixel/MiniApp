// Рендер роликов про «Меткий Джо». Загружается в страницу games/joe.html?mode=challenge&seed=S&level=1&target=9
// (режим вызова — чтобы сид был задан, а уровень 1). Как и поезд: игра идёт покадрово, кадры 1080×1920 уходят
// на sink.mjs.
//   const h = await import('/scripts/video/harness-joe.js')
//   await h.scan(seed)  — сухой прогон бота-снайпера, ищет сид с серией хедшотов
//   h.start({...})      — рендер ролика

import { OW, OH, FPS, banner, counter, plate, endCard, pushFrame } from './common.js'

const HEAD_TOL = 0.0115 // 0.66°: шаг прицела при 60 Гц ≈ 1.17°, поэтому на каждом проходе есть кадр внутри допуска

// бот-снайпер: жмёт, когда прицел проходит через голову врага
export function makeJoeBot(g) {
  return (s) => {
    if (s.state === 'aim' && Math.abs(s.aim - s.aimTarget) < HEAD_TOL) g.tap()
  }
}

// сухой прогон: сколько секунд до конца уровня 1 и сколько подряд хедшотов
export async function scan(seed) {
  const fr = document.createElement('iframe')
  fr.style.cssText = 'position:fixed;left:-9999px;width:540px;height:960px'
  fr.src = `/games/joe.html?mode=challenge&seed=${seed}&level=1&target=9&r=${Math.random()}`
  document.body.appendChild(fr)
  await new Promise((r) => (fr.onload = r))
  await new Promise((r) => setTimeout(r, 120))
  const w = fr.contentWindow
  const g = w.__game
  g.manual()
  g.tap() // из меню — старт забега
  const bot = makeJoeBot(g)
  let steps = 0
  let maxCombo = 0
  let misses = 0
  let prevState = ''
  while (steps < 60 * 40) {
    const s = g.info()
    if (s.level >= 2 || s.state === 'dead') break
    maxCombo = Math.max(maxCombo, w.eval('combo'))
    if (prevState === 'shooting' && s.state === 'enemyTurn') misses++
    prevState = s.state
    bot(s)
    g.step(1000 / 60, true)
    steps++
  }
  const s = g.info()
  fr.remove()
  return { seed, level: s.level, runKills: s.runKills, maxCombo, misses, sec: +(steps / 60).toFixed(1), state: s.state }
}

export function start(o) {
  window.__vp = { frames: 0, phase: 'init', done: false, err: null }
  run(o).catch((e) => {
    window.__vp.err = String((e && e.stack) || e)
    window.__vp.done = true
  })
  return 'started'
}

async function run(o) {
  const g = window.__game
  const vp = window.__vp
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
  window.dispatchEvent(new Event('resize'))
  await new Promise((r) => setTimeout(r, 100))
  const game = document.getElementById('c')
  vp.canvas = [game.width, game.height]

  g.manual()
  g.tap()
  const bot = makeJoeBot(g)

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
    await pushFrame(out, i, o.sink)
    i++
    vp.frames = i
  }

  vp.phase = 'game'
  let f = 0
  let doneF = -1
  while (f < FPS * 30) {
    let s = g.info()
    if ((s.level >= 2 || s.state === 'dead') && doneF < 0) doneF = f
    if (doneF >= 0 && f - doneF > o.tailFrames) break
    for (let k = 0; k < 2; k++) {
      s = g.info()
      if (doneF < 0) bot(s)
      g.step(1000 / 60, k === 0)
    }
    s = g.info()
    c.drawImage(game, 0, 0, game.width, game.height, 0, 0, OW, OH)
    banner(c)
    counter(c, s.runKills, 'ВРАГОВ')
    plate(c, o.hook, f, 66, '#ffc233', '#231700', -0.07, 740) // выше врага на ступеньке
    if (doneF >= 0) plate(c, o.after, f - doneF - o.afterDelay, 999, '#ff3d9a', '#1a0010', 0.05, 900)
    await push()
    f++
  }
  vp.doneAt = doneF
  vp.gameFrames = f
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
  for (let k = 0; k < Math.round(FPS * o.endSec); k++) {
    endCard(c, o, (k + 12) / FPS)
    await push()
  }
  vp.phase = 'done'
  vp.done = true
}
