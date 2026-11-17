// Рекламная карточка-прайс 1080×1350 для отправки рекламодателям (рисуется кодом игры: Джо с рупором, текст без ошибок).
// Загружается в страницу games/train.html (там есть drawDude/drawJoe/scenery):
//   const m = await import('/scripts/video/ad-card.js')
//   const cv = await m.renderCard({ contact: '@ник' })
//   await m.sendPng(cv, 'http://127.0.0.1:8804')   // приёмник: node scripts/video/sink.mjs content/card 8804
import { FONT, rr, text } from './common.js'

const W = 1080
const H = 1350

const DEFAULTS = {
  title: ['РЕКЛАМА', 'В ИГРАХ ДЖО'],
  subtitle: 'Ваш баннер в главном меню игры в Telegram',
  prices: [
    ['1 час', '50 ₽'],
    ['6 часов', '150 ₽'],
    ['24 часа', '300 ₽'],
    ['3 дня', '700 ₽'],
    ['7 дней', '1 200 ₽'],
    ['30 дней', '3 500 ₽'],
  ],
  barter: 'Бартер — обсудим',
  contact: '@ТВОЙ_НИК',
  bot: '@JoeGame_Bot',
  skin: 0, // фирменный жёлтый Джо, а не то, что выбрано в сейве браузера
}

// шрифт, подогнанный под ширину
function fitSize(c, t, size, maxW) {
  c.font = `900 ${size}px ${FONT}`
  return Math.min(size, (maxW / c.measureText(t).width) * size)
}

function megaphone(c, x, y, s, rot) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  c.scale(s, s)
  // ручка
  c.fillStyle = '#2a2a3d'
  c.fillRect(-4, -2, 14, 12)
  // корпус-конус
  c.fillStyle = '#e5334b'
  c.beginPath()
  c.moveTo(6, -7)
  c.lineTo(62, -26)
  c.lineTo(62, 26)
  c.lineTo(6, 7)
  c.closePath()
  c.fill()
  c.fillStyle = '#fff'
  c.beginPath()
  c.moveTo(26, -12.5)
  c.lineTo(34, -15)
  c.lineTo(34, 15)
  c.lineTo(26, 12.5)
  c.closePath()
  c.fill()
  // раструб
  c.fillStyle = '#b8243a'
  c.fillRect(62, -28, 8, 56)
  c.fillStyle = '#14141f'
  c.fillRect(66, -22, 5, 44)
  c.restore()
}

// волны звука из раструба
function waves(c, x, y, rot) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  c.lineCap = 'round'
  c.strokeStyle = '#ffc233'
  for (let i = 0; i < 2; i++) {
    c.globalAlpha = 1 - i * 0.3
    c.lineWidth = 11 - i * 2
    c.beginPath()
    c.arc(0, 0, 34 + i * 30, -0.6, 0.6)
    c.stroke()
  }
  c.restore()
}

export async function renderCard(opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')

  // фон: фиолетовый градиент, бледное солнце, силуэты кактусов
  const g = c.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#120b3a')
  g.addColorStop(1, '#6f5cff')
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  c.fillStyle = 'rgba(255,230,160,.16)'
  c.beginPath()
  c.arc(235, 880, 250, 0, 7)
  c.fill()
  const S = window.JoeScenery
  if (S) {
    c.globalAlpha = 0.5
    S.cactus(c, 60, H, 2.6, '#2a2270')
    S.cactus(c, 1030, H, 2.2, '#2a2270')
    S.cactus(c, 400, H, 1.4, '#2a2270')
    c.globalAlpha = 1
  }

  // заголовок
  const t1 = fitSize(c, o.title[0], 170, 900)
  text(c, o.title[0], W / 2 + 7, 190 + 7, t1, '#a45f00')
  text(c, o.title[0], W / 2, 190, t1, '#ffc233')
  const t2 = fitSize(c, o.title[1], 118, 900)
  text(c, o.title[1], W / 2 + 6, 310 + 6, t2, '#a45f00')
  text(c, o.title[1], W / 2, 310, t2, '#ffc233')
  const sub = fitSize(c, o.subtitle, 44, 940)
  text(c, o.subtitle, W / 2, 392, sub, '#fff')

  // Джо с рупором (в своём наряде из гардероба)
  const skin = o.skin
  const jx = 185
  const jy = 1100
  const js = 4.8
  window.drawDude(c, jx, jy, 1, js, (k) => window.drawJoe(k, skin), -1, 0, 0, 0)
  // рука и рупор в ней
  const hx = jx + js * 7
  const hy = jy - js * 24
  c.fillStyle = '#fff'
  c.fillRect(hx - 4 * js, hy - 3.5 * js, 7 * js, 7 * js)
  // рупор направлен вверх-вправо, чтобы не упираться в плашку с ценами
  const rot = -0.5
  const L = 72 * js * 0.6
  megaphone(c, hx, hy, js * 0.6, rot)
  waves(c, hx + L * Math.cos(rot), hy + L * Math.sin(rot), rot)

  // плашка с ценами
  const px = 470
  const pw = 540
  const py = 442
  const ph = 640
  c.save()
  c.shadowColor = 'rgba(0,0,0,.45)'
  c.shadowOffsetY = 12
  rr(c, px, py, pw, ph, 44)
  c.fillStyle = '#101830'
  c.fill()
  c.restore()
  rr(c, px, py, pw, ph, 44)
  c.lineWidth = 9
  c.strokeStyle = '#ffc233'
  c.stroke()
  text(c, 'ТАРИФЫ', px + pw / 2, py + 82, 46, '#cdd5ea')
  const rowH = 88
  const y0 = py + 112
  o.prices.forEach(([when, price], i) => {
    const y = y0 + i * rowH
    if (i > 0) {
      c.fillStyle = 'rgba(255,255,255,.14)'
      c.fillRect(px + 36, y - 20, pw - 72, 3)
    }
    c.font = `900 46px ${FONT}`
    c.textBaseline = 'alphabetic'
    c.textAlign = 'left'
    c.fillStyle = '#fff'
    c.fillText(when, px + 40, y + 46)
    c.textAlign = 'right'
    c.fillStyle = '#ffc233'
    c.fillText(price, px + pw - 40, y + 46)
  })

  // бартер
  const by = py + ph + 30
  rr(c, px, by, pw, 84, 28)
  c.fillStyle = '#5cff5c'
  c.fill()
  text(c, o.barter, px + pw / 2, by + 58, fitSize(c, o.barter, 46, pw - 50), '#0a2a0a')

  // контакты
  const cs = fitSize(c, 'Писать: ' + o.contact, 52, 900)
  text(c, 'Писать: ' + o.contact, W / 2, H - 92, cs, '#fff', '#14141f', 10)
  text(c, 'Игра: ' + o.bot, W / 2, H - 32, fitSize(c, 'Игра: ' + o.bot, 40, 800), '#ffc233', '#14141f', 8)
  return cv
}

export async function sendPng(cv, sink = 'http://127.0.0.1:8804', n = 0) {
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
  const res = await fetch(`${sink}/f/${n}`, { method: 'POST', body: blob })
  if (!res.ok) throw new Error('sink ' + res.status)
  return blob.size
}
