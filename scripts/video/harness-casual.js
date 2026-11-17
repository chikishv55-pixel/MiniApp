// Ролики про «Золотую лихорадку» и «Башню из бочек» (~10 с). Играет автопилот, время ускорено — это подписано в кадре.
//   const h = await import('/scripts/video/harness-casual.js')
//   const qr = await (await fetch('/scripts/video/qr.json')).json()
//   h.startGold({ qr, sink: 'http://127.0.0.1:8811' })    // страница: /games/gold.html?mode=challenge&seed=<сид>&target=5
//   h.startTower({ qr, sink: 'http://127.0.0.1:8812' })   // страница: /games/tower.html?mode=challenge&seed=<сид>&target=5
// Прогресс: window.__vp. Игра идёт в manual-режиме: время двигаем мы, поэтому кадры ровные.
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
// (верх башни покачивается, поэтому предсказываем его сдвиг за время полёта).
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

const KINDS = {
  gold: {
    api: () => window.__gold,
    label: 'ЗОЛОТО',
    shift: 150, // картинку игры опускаем, чтобы плашка бота не закрывала верх
    sub: 33.3, // шаг симуляции, мс (игра сама ограничивает шаг 33 мс)
    speed: 8, // во сколько раз ускорено
    hook: ['БОТ ЛОВИТ ЗОЛОТО'],
    score: (s) => s.gold,
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
    after: (n) => [`${n} ${plural(n, 'ЭТАЖ', 'ЭТАЖА', 'ЭТАЖЕЙ')}`, 'СМОЖЕШЬ ВЫШЕ?'],
    color: ['#5cff5c', '#062a06'],
    bot: towerBot,
  },
}

export const startGold = (o) => launch('gold', o)
export const startTower = (o) => launch('tower', o)

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
  ;(0, eval)('D.best=1') // подсказки «как играть» не нужны, а запись рекорда в сейв не случится — автопилот не умирает
  g.start()
  const bot = K.bot(g)

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
  const perFrame = Math.max(1, Math.round((speed * 1000) / FPS / K.sub))
  const label = `автопилот · ускорено ×${String(speed).replace('.', ',')}`

  vp.phase = 'game'
  let freeze = false
  let frozenScore = 0
  for (let f = 0; f < frames; f++) {
    if (!freeze) {
      for (let k = 0; k < perFrame; k++) {
        bot()
        g.step(K.sub, k < perFrame - 1)
      }
      const s = g.info()
      // перед плашкой замираем: число на плашке должно совпасть со счётчиком
      if (f >= frames - plateF && (kind === 'gold' || s.state === 'hang')) {
        freeze = true
        frozenScore = K.score(s)
        // игровой баннер («ДАЛЬШЕ: …») не должен просвечивать из-под нашей плашки
        ;(0, eval)('banner=null')
        g.step(1, false)
      }
      if (s.state === 'dead') throw new Error('автопилот проиграл на кадре ' + f)
    }
    const s = g.info()
    // небо над опущенной картинкой: растягиваем верхние строки кадра игры
    c.drawImage(game, 0, 0, game.width, 2, 0, 0, OW, K.shift)
    c.drawImage(game, 0, 0, game.width, game.height, 0, K.shift, OW, OH)
    banner(c)
    text(c, label, OW / 2, 372, 30, 'rgba(255,255,255,.8)', '#14141f', 7)
    text(c, `${K.label} ${K.score(s)}`, OW / 2, 458, 72, '#fff', '#14141f', 16)
    if (kind === 'tower' && s.combo > 1) text(c, `ИДЕАЛЬНО ×${s.combo}`, OW / 2, 535, 56, '#5cff5c', '#14141f', 12)
    plate(c, K.hook, f, 54, '#ffc233', '#231700', -0.07, 1000)
    if (freeze) plate(c, K.after(frozenScore), f - (frames - plateF), 999, K.color[0], K.color[1], 0.05, 1040)
    await push()
  }
  vp.score = frozenScore
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
