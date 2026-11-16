// Общие куски роликов «Игры Джо»: размеры кадра, плашка с ботом, плашки-крючки, финальный экран с QR.
// Подключается из harness*.js (поезд, Меткий Джо). Всё рисуется на canvas 2D.

export const OW = 1080
export const OH = 1920
export const FPS = 30
export const BOT = '@JoeGame_Bot'
export const FONT = '"Arial Black","Segoe UI",sans-serif'

/* ---------- рисование оверлеев ---------- */
export function rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}
export function text(c, t, x, y, size, fill, stroke, sw) {
  c.font = `900 ${size}px ${FONT}`
  c.textAlign = 'center'
  c.textBaseline = 'alphabetic'
  c.lineJoin = 'round'
  if (stroke) {
    c.lineWidth = sw
    c.strokeStyle = stroke
    c.strokeText(t, x, y)
  }
  c.fillStyle = fill
  c.fillText(t, x, y)
}

// плашка с ботом — сверху по центру, на весь ролик
export function banner(c) {
  const w = 800
  const h = 132
  const x = (OW - w) / 2
  const y = 205
  c.save()
  c.shadowColor = 'rgba(0,0,0,.5)'
  c.shadowOffsetY = 8
  rr(c, x, y, w, h, 30)
  c.fillStyle = 'rgba(16,24,48,.94)'
  c.fill()
  c.restore()
  rr(c, x, y, w, h, 30)
  c.lineWidth = 7
  c.strokeStyle = '#ffc233'
  c.stroke()
  text(c, 'ИГРАЙ В TELEGRAM', OW / 2, y + 50, 34, '#cdd5ea')
  text(c, BOT, OW / 2, y + 108, 62, '#ffc233')
}

export function counter(c, n, label = 'ВАГОН') {
  text(c, label + ' ' + n, OW / 2, 430, 72, '#fff', '#14141f', 16)
}

export function plate(c, lines, f, total, color, ink, rot = -0.07, y = 1000) {
  if (f < 0 || f >= total) return
  const pop = Math.min(1, f / 8)
  const s = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3))
  const a = f > total - 8 ? (total - f) / 8 : 1
  const h = 70 + lines.length * 96
  c.save()
  c.globalAlpha = a
  c.translate(OW / 2, y)
  c.rotate(rot)
  c.scale(s, s)
  rr(c, -450, -h / 2, 900, h, 40)
  c.fillStyle = color
  c.fill()
  // шрифт подгоняем под ширину плашки, чтобы длинная строка не вылезала
  const fit = (t) => {
    c.font = `900 84px ${FONT}`
    return Math.min(84, (820 / c.measureText(t).width) * 84)
  }
  lines.forEach((t, i) => text(c, t, 0, -h / 2 + 30 + 80 + i * 96 - 12, fit(t), ink))
  c.restore()
}

export function endCard(c, o, t) {
  const g = c.createLinearGradient(0, 0, 0, OH)
  g.addColorStop(0, '#120b3a')
  g.addColorStop(1, '#6f5cff')
  c.fillStyle = g
  c.fillRect(0, 0, OW, OH)
  c.fillStyle = 'rgba(255,230,160,.18)'
  c.beginPath()
  c.arc(OW - 200, 420, 230, 0, 7)
  c.fill()
  // заголовок
  text(c, 'ИГРЫ ДЖО', OW / 2 + 8, 308, 150, '#a45f00')
  text(c, 'ИГРЫ ДЖО', OW / 2, 300, 150, '#ffc233')
  // Джо в своём наряде
  const joe = JSON.parse(localStorage.getItem('metkiy-joe-v1') || '{}')
  const skin = Number.isInteger(joe.curS) ? joe.curS : 0
  const gun = Number.isInteger(joe.curW) ? joe.curW : 0
  const bob = Math.sin(t * 5) * 6
  window.drawDude(c, OW / 2 - 330, 690 + bob, 1, 3.6, (k) => window.drawJoe(k, skin), gun, 0.25, 0, 0)
  window.drawDude(c, OW / 2 + 330, 690 - bob, -1, 3.6, (k) => window.drawJoe(k, skin), gun, 0.25, 0, 0)
  // QR на белой плашке с полем — так он читается любой камерой
  const q = o.qr
  const quiet = 4
  const mod = Math.floor(640 / (q.n + quiet * 2))
  const size = mod * (q.n + quiet * 2)
  const px = Math.round((OW - size) / 2) // целые координаты: на дробных между модулями появляются светлые щели
  const py = 760
  c.save()
  c.shadowColor = 'rgba(0,0,0,.45)'
  c.shadowOffsetY = 14
  rr(c, px - 22, py - 22, size + 44, size + 44, 36)
  c.fillStyle = '#fff'
  c.fill()
  c.restore()
  c.fillStyle = '#fff'
  c.fillRect(px, py, size, size)
  c.fillStyle = '#000'
  for (let y = 0; y < q.n; y++) for (let x = 0; x < q.n; x++) if (q.rows[y][x] === '1') c.fillRect(px + (x + quiet) * mod, py + (y + quiet) * mod, mod, mod)
  // ссылка текстом и призыв
  text(c, BOT, OW / 2, py + size + 130, 96, '#fff', '#14141f', 14)
  text(c, 'Играй прямо в Telegram', OW / 2, py + size + 215, 46, '#e9e6ff')
  text(c, 'и кидай вызовы друзьям', OW / 2, py + size + 275, 46, '#e9e6ff')
}

// отправка кадра на приёмник (sink.mjs); i — номер кадра
export async function pushFrame(out, i, sink = 'http://127.0.0.1:8799') {
  const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92))
  const res = await fetch(`${sink}/f/${i}`, { method: 'POST', body: blob })
  if (!res.ok) throw new Error('sink ' + res.status)
}
