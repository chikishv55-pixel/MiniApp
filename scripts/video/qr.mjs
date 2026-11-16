// Делает scripts/video/qr.json — матрицу QR-кода на бота, чтобы рисовать её в кадрах роликов.
// Запуск: node scripts/video/qr.mjs [ссылка]   (по умолчанию — бот Игр Джо)
import QRCode from 'qrcode'
import { writeFileSync } from 'node:fs'

const url = process.argv[2] || 'https://t.me/JoeGame_Bot'
const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
const n = qr.modules.size
const rows = []
for (let y = 0; y < n; y++) {
  let r = ''
  for (let x = 0; x < n; x++) r += qr.modules.get(y, x) ? "1" : "0" // get(строка, столбец)
  rows.push(r)
}
writeFileSync(new URL('./qr.json', import.meta.url), JSON.stringify({ url, n, rows }))
console.log(`QR для ${url}: ${n}x${n} модулей`)
