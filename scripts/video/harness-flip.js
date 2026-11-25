// Ролики про «Перекуп Джо»: игра крутится по кадрам (/games/flip.html?manual=1), кадры 1080×1920 уходят на sink.mjs.
// Работу делает автопилот: водит инструментом по кузову, а «доводка» — настоящая анимация игры, когда этап сделан на 80%.
// Время ускорено — в кадре честная подпись. Подробности и запуск — в README.md рядом.
import { OW, OH, FPS, BOT, rr, pushFrame } from './common.js'

const F = window.flip
const step = (ms = 1000 / FPS) => window.__flipStep(ms)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const money = (v) => '$' + Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ')
const ease = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3)
const lerp = (a, b, p) => a + (b - a) * p

const out = document.createElement('canvas')
out.width = OW
out.height = OH
const c = out.getContext('2d')
const avatar = new Image()
avatar.src = '/bot/avatar.jpg'

/* ---------- подготовка сейва: машина в гараже, весь инструмент куплен ---------- */
export function prepare({ id, rust, seed, paid, paint }) {
  localStorage.setItem('flip-v1', JSON.stringify({ cash: 9000, sold: 3, issue: 4, best: 900, tut: 'done', gear: ['washer', 'drill', 'gun', 'polisher'],
    bank: { open: true, num: '4081 7810 0000 0001', hist: [] } }))
  localStorage.setItem('flip-job-v1', JSON.stringify({ job: { id, paid, rust, seed, livery: null, stage: 0, color: paint, paint, v: 2, tint: 0, low: 0, done: false, photos: [], listing: null } }))
  localStorage.setItem('flip-sound', '0')
}

/* ---------- автопилот: точки кузова на экране и проход змейкой ---------- */
function bodyPoints(kinds, box = [0, 0, innerWidth, innerHeight], gap = 9) {
  const pts = []
  for (let y = box[1]; y < box[3]; y += gap) {
    const row = []
    for (let x = box[0]; x < box[2]; x += gap) if (kinds.includes(F.kindAt(x, y))) row.push([x, y])
    if ((y / gap) & 1) row.reverse()
    pts.push(...row)
  }
  return pts
}
// за кадр трём кусок змейки; инструмент остаётся на последней точке
function rubSome(path, from, n) {
  for (let i = from; i < Math.min(path.length, from + n); i++) F.rub(path[i][0], path[i][1])
}

/* ---------- кадр: игра + частицы + подписи ---------- */
const state = { plate: null, label: null, price: false, paid: 0, sped: true, before: null, wipe: -1 }
function compose(t) {
  c.drawImage(F.canvas, 0, 0, OW, OH)
  c.drawImage(F.fx, 0, 0, OW, OH)
  if (state.before && state.wipe >= 0) { // «до» слева от шторки
    const x = Math.round(state.wipe * OW)
    c.save(); c.beginPath(); c.rect(0, 0, x, OH); c.clip(); c.drawImage(state.before, 0, 0); c.restore()
    c.fillStyle = '#fff'; c.fillRect(x - 4, 0, 8, OH)
    tag('ДО', Math.max(120, x - 150), 760, '#1f1f24', '#f3e6c8', -0.05, state.wipe > 0.15 ? 1 : state.wipe / 0.15)
    tag('ПОСЛЕ', Math.min(OW - 150, x + 170), 760, '#a8231b', '#fff', 0.04, state.wipe < 0.85 ? 1 : (1 - state.wipe) / 0.15)
  }
  // затемнение сверху и снизу — подписи читаются на любом фоне
  let g = c.createLinearGradient(0, 0, 0, 560)
  g.addColorStop(0, 'rgba(10,6,3,.72)'); g.addColorStop(1, 'rgba(10,6,3,0)')
  c.fillStyle = g; c.fillRect(0, 0, OW, 560)
  g = c.createLinearGradient(0, OH - 520, 0, OH)
  g.addColorStop(0, 'rgba(10,6,3,0)'); g.addColorStop(1, 'rgba(10,6,3,.7)')
  c.fillStyle = g; c.fillRect(0, OH - 520, OW, 520)
  brand()
  if (state.plate) plate(state.plate, t)
  if (state.price && F.job) priceTag(F.value())
  if (state.label) stageLabel(state.label, t)
  if (state.sped) {
    c.font = '500 30px Oswald, sans-serif'; c.textAlign = 'right'; c.fillStyle = 'rgba(243,230,200,.75)'
    c.fillText('геймплей · ускорено', OW - 40, OH - 44)
  }
}
function brand() {
  c.save()
  c.translate(54, 150)
  c.rotate(-0.03)
  c.font = '700 64px Oswald, sans-serif'
  const w = c.measureText('ПЕРЕКУП ДЖО').width
  c.fillStyle = '#e8daa2'; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowOffsetY = 6
  c.fillRect(-22, -64, w + 44, 86)
  c.shadowColor = 'transparent'
  c.fillStyle = '#26211c'; c.textAlign = 'left'; c.fillText('ПЕРЕКУП ДЖО', 0, 0)
  c.restore()
  c.font = '500 34px Oswald, sans-serif'; c.textAlign = 'left'; c.fillStyle = 'rgba(243,230,200,.9)'
  c.fillText('игра в Telegram · ' + BOT, 54, 232)
}
// плашка-крючок: { lines, f0, col, ink } — выпрыгивает с пружинкой
function plate(p, t) {
  const f = t - p.f0
  if (f < 0) return
  const s = 0.6 + 0.4 * ease(f / 7) + (f < 10 ? Math.sin(f / 10 * Math.PI) * 0.06 : 0)
  const fs = p.size || 92
  c.save()
  c.translate(OW / 2, p.y || 400)
  c.rotate(p.rot ?? -0.04)
  c.scale(s, s)
  c.font = `700 ${fs}px Oswald, sans-serif`
  const w = Math.min(980, Math.max(...p.lines.map((l) => c.measureText(l).width)) + 90)
  const h = p.lines.length * fs * 1.08 + 46
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowOffsetY = 12
  rr(c, -w / 2, -h / 2, w, h, 26); c.fillStyle = p.col || '#e8daa2'; c.fill()
  c.shadowColor = 'transparent'
  c.fillStyle = p.ink || '#26211c'; c.textAlign = 'center'; c.textBaseline = 'middle'
  p.lines.forEach((l, i) => {
    c.font = `700 ${fs}px Oswald, sans-serif`
    const k = Math.min(1, (w - 70) / c.measureText(l).width)
    c.font = `700 ${fs * k}px Oswald, sans-serif`
    c.fillText(l, 0, -h / 2 + 23 + fs * 1.08 * (i + 0.5))
  })
  c.restore()
}
function tag(txt, x, y, bg, ink, rot, a) {
  c.save(); c.globalAlpha = Math.max(0, a); c.translate(x, y); c.rotate(rot)
  c.font = '700 70px Oswald, sans-serif'
  const w = c.measureText(txt).width + 56
  rr(c, -w / 2, -52, w, 96, 18); c.fillStyle = bg; c.fill()
  c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 0)
  c.restore()
}
// ценник машины: растёт вместе с работой
function priceTag(v) {
  c.save()
  c.translate(OW - 60, 640)
  c.rotate(0.06)
  c.font = '700 76px Oswald, sans-serif'
  const t = money(v), w = Math.max(300, c.measureText(t).width + 60)
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowOffsetY = 10
  c.beginPath(); c.moveTo(-w - 40, 0); c.lineTo(-w, -66); c.lineTo(0, -66); c.lineTo(0, 66); c.lineTo(-w, 66); c.closePath()
  c.fillStyle = '#f1e7cf'; c.fill()
  c.shadowColor = 'transparent'
  c.fillStyle = '#26211c'; c.beginPath(); c.arc(-w - 6, 0, 9, 0, 7); c.fill()
  c.font = '500 26px Oswald, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.fillText('ЦЕНА МАШИНЫ', -26, -26)
  c.font = '700 76px Oswald, sans-serif'; c.fillStyle = v > state.paid * 1.05 ? '#2f7d43' : '#26211c'; c.fillText(t, -26, 50)
  c.restore()
}
function stageLabel(l, t) {
  const f = t - l.f0
  if (f < 0) return
  const a = Math.min(1, f / 5)
  c.save(); c.globalAlpha = a
  c.font = '600 128px Caveat, cursive'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.lineJoin = 'round'; c.lineWidth = 14; c.strokeStyle = 'rgba(0,0,0,.6)'
  const y = OH - 230 + (1 - ease(f / 6)) * 30
  c.strokeText(l.text, OW / 2, y)
  c.fillStyle = '#f3e6c8'; c.fillText(l.text, OW / 2, y)
  if (l.sub) { c.font = '500 40px Oswald, sans-serif'; c.lineWidth = 8; c.strokeText(l.sub, OW / 2, y + 66); c.fillStyle = '#e8b04a'; c.fillText(l.sub, OW / 2, y + 66) }
  c.restore()
}
// финальный экран: гараж в дымке, иконка игры, куда идти
function endCard(f, bg, qr) {
  c.drawImage(bg, 0, 0)
  c.fillStyle = `rgba(14,9,5,${0.25 + 0.55 * ease(f / 8)})`; c.fillRect(0, 0, OW, OH)
  const a = ease(f / 8)
  c.save(); c.globalAlpha = a
  const s = 470, ax = (OW - s) / 2, ay = 330 - (1 - a) * 40
  c.save(); rr(c, ax, ay, s, s, 96); c.clip(); c.drawImage(avatar, ax, ay, s, s); c.restore()
  rr(c, ax, ay, s, s, 96); c.lineWidth = 10; c.strokeStyle = '#e8daa2'; c.stroke()
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.font = '700 132px Oswald, sans-serif'; c.fillStyle = '#e8daa2'; c.fillText('ПЕРЕКУП ДЖО', OW / 2, 960)
  c.font = '600 74px Caveat, cursive'; c.fillStyle = '#f3e6c8'; c.fillText('купи ведро — продай конфетку', OW / 2, 1050)
  rr(c, 90, 1120, OW - 180, 300, 44); c.fillStyle = '#a8231b'; c.fill()
  c.font = '500 50px Oswald, sans-serif'; c.fillStyle = '#ffe2d6'; c.fillText('ИГРАЙ БЕСПЛАТНО В TELEGRAM', OW / 2, 1200)
  c.font = '700 112px Oswald, sans-serif'; c.fillStyle = '#fff'; c.fillText(BOT, OW / 2, 1340)
  // QR для тех, кто смотрит с компьютера (целые координаты, модуль 9 px — проверено декодером)
  const quiet = 4, mod = 9, size = mod * (qr.n + quiet * 2), qx = Math.round((OW - size) / 2), qy = 1480
  rr(c, qx - 14, qy - 14, size + 28, size + 28, 26); c.fillStyle = '#fff'; c.fill()
  c.fillStyle = '#000'
  for (let y = 0; y < qr.n; y++) for (let x = 0; x < qr.n; x++) if (qr.rows[y][x] === '1') c.fillRect(qx + (x + quiet) * mod, qy + (y + quiet) * mod, mod, mod)
  c.restore()
}

/* ---------- съёмка ---------- */
let frame = 0, sinkUrl = ''
const events = []
async function shoot() {
  compose(frame)
  await pushFrame(out, frame, sinkUrl)
  frame++
  window.__vp = { frame, events }
}
// чистый кадр игры без подписей — для шторки «до/после»
const rawShot = () => { const b = document.createElement('canvas'); b.width = OW; b.height = OH; const g = b.getContext('2d'); g.drawImage(F.canvas, 0, 0, OW, OH); return b }
const snapshot = () => { const b = document.createElement('canvas'); b.width = OW; b.height = OH; b.getContext('2d').drawImage(out, 0, 0); return b }
const note = (kind, extra = {}) => events.push({ kind, t: +(frame / FPS).toFixed(3), ...extra })

// камера: плавный переход между позами за n кадров (снимаем каждый кадр)
async function move(to, n, each) {
  const v = F.view, from = { ...v }
  for (let i = 1; i <= n; i++) {
    const p = ease(i / n)
    for (const k of Object.keys(to)) v[k] = lerp(from[k], to[k], p)
    each && each(i)
    step(); await shoot()
  }
}
function pose(to) { Object.assign(F.view, to); step() }

// один этап: n кадров трём змейкой, потом «доводка» игры до следующего этапа
async function work(stage, n, { kinds = ['Body'], box, orbit = 0, perFrame } = {}) {
  const path = bodyPoints(kinds, box)
  const k = perFrame || Math.max(3, Math.ceil(path.length / n))
  note('tool', { stage, on: true })
  for (let i = 0; i < n; i++) {
    rubSome(path, i * k, k)
    if (orbit) F.view.yaw += orbit
    step(); await shoot()
  }
  F.lift()
  note('tool', { stage, on: false })
}
async function finishStage(capture = true) {
  const st = F.stage()
  F.finish()
  for (let i = 0; i < 40 && F.stage() === st && !F.job.done; i++) {
    step()
    if (capture) await shoot()
    await wait(capture ? 0 : 60) // следующий этап игра включает через setTimeout
  }
  await wait(80); step()
}
async function quietStage() { // этап «за кадром»: без съёмки
  await finishStage(false)
}

/* ---------- ролик 1: из ведра в конфетку (полный цикл, ценник растёт) ---------- */
export async function videoBucket({ sink, qr, paid }) {
  sinkUrl = sink; frame = 0; events.length = 0
  state.paid = paid; state.price = true; state.sped = true
  F.lift(); pose({ yaw: -0.95, pitch: 0.28, ty: F.view.ty, dist: F.view.dist })
  const far = { ...F.view }
  state.plate = { lines: ['КУПИЛ ВЕДРО', 'ЗА ' + money(paid)], f0: 0, y: 360 }
  note('door')
  await move({ yaw: -0.7, dist: far.dist * 0.92 }, 30)
  state.plate = null
  const near = { yaw: -0.62, pitch: 0.24, dist: far.dist * 0.82, ty: far.ty }
  const stages = [
    ['wash', 'Мойка', 'мойка высокого давления', { yaw: -0.62 }],
    ['rust', 'Ржавчина', 'дрель со щёткой', { yaw: -0.4 }],
    ['paint', 'Покраска', 'краскопульт', { yaw: -0.85 }],
    ['polish', 'Полировка', 'полировальная машинка', { yaw: -0.55 }],
  ]
  for (const [id, label, sub, cam] of stages) {
    pose({ ...near, ...cam })
    state.label = { text: label, sub, f0: frame }
    await work(id, 28, { kinds: id === 'wash' ? ['Body', 'Glass'] : ['Body'], orbit: 0.004 })
    await finishStage(true)
  }
  state.label = null
  // тюнинг: тонировка в ноль и занижение — машина садится на колёса
  F.job.tint = 2; F.job.low = 2
  F.applyTune(true)
  note('drop')
  note('coins')
  state.label = { text: 'Тюнинг', sub: 'тонировка в ноль · занижение −8 см', f0: frame }
  const v = F.value()
  state.plate = { lines: ['БЫЛО ' + money(paid), 'СТАЛО ' + money(v)], f0: frame, y: 360, col: '#2f7d43', ink: '#fff' }
  await move({ yaw: 0.35, pitch: 0.2, dist: far.dist * 0.95 }, 44)
  const bg = snapshot()
  state.plate = null; state.label = null
  for (let f = 0; f < 46; f++) { endCard(f, bg, qr); await pushFrame(out, frame, sinkUrl); frame++; window.__vp = { frame, events } }
  return { frames: frame, events }
}

/* ---------- ролик 2: до/после + тюнинг (крупные планы и шторка) ---------- */
export async function videoBeforeAfter({ sink, qr, paid }) {
  sinkUrl = sink; frame = 0; events.length = 0
  state.paid = paid; state.price = false; state.sped = true
  F.lift()
  // кадр «до» — с той же точки, откуда потом покажем «после»
  const wide = { yaw: -0.8, pitch: 0.27, dist: F.view.dist * 0.86, ty: F.view.ty }
  pose(wide)
  const before = rawShot()
  // крупно: мойка полосами
  pose({ yaw: -1.3, pitch: 0.2, dist: wide.dist * 0.62, ty: wide.ty * 0.85 })
  state.plate = { lines: ['СМОТРИ, КАК', 'СЛЕЗАЕТ ГРЯЗЬ'], f0: 0, y: 430 }
  state.label = { text: 'Мойка', sub: 'мойка высокого давления', f0: 0 }
  await work('wash', 72, { kinds: ['Body', 'Glass'], box: [30, 330, innerWidth - 30, innerHeight - 240] })
  await quietStage()
  // крупно: ржавчина до металла
  pose({ yaw: -0.35, pitch: 0.26, dist: wide.dist * 0.6, ty: wide.ty })
  state.plate = { lines: ['РЖАВЧИНУ —', 'ДО МЕТАЛЛА'], f0: frame, y: 430, col: '#a8231b', ink: '#fff' }
  state.label = { text: 'Ржавчина', sub: 'дрель со щёткой', f0: frame }
  await work('rust', 62, { box: [30, 330, innerWidth - 30, innerHeight - 240] })
  state.plate = null; state.label = null
  await quietStage(); await quietStage(); await quietStage() // ржавчина, покраска, полировка — за кадром
  // после: шторка ДО|ПОСЛЕ на общем плане
  pose(wide)
  state.before = before
  for (let f = 0; f <= 46; f++) {
    state.wipe = 1 - ease(f / 46)
    if (f === 0) note('wipe')
    step(); await shoot()
  }
  state.wipe = -1; state.before = null
  // тюнинг: «в ноль» и −8 см
  F.job.tint = 2; F.job.low = 2
  F.applyTune(true)
  note('drop')
  state.plate = { lines: ['ТОНИРОВКА В НОЛЬ', 'И МИНУС 8 СМ'], f0: frame, y: 430 }
  state.label = { text: 'Тюнинг', sub: 'тонировка · занижение', f0: frame }
  await move({ yaw: -1.1, pitch: 0.2, dist: wide.dist * 0.92 }, 40)
  const v = F.value()
  state.plate = { lines: ['ВЗЯЛ ЗА ' + money(paid), 'ТЕПЕРЬ СТОИТ ' + money(v)], f0: frame, y: 430, col: '#2f7d43', ink: '#fff' }
  note('coins')
  await move({ yaw: -1.25, dist: wide.dist * 0.88 }, 30)
  const bg = snapshot()
  state.plate = null; state.label = null
  for (let f = 0; f < 42; f++) { endCard(f, bg, qr); await pushFrame(out, frame, sinkUrl); frame++; window.__vp = { frame, events } }
  return { frames: frame, events }
}
