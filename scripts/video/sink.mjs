// Приёмник кадров для роликов: принимает JPEG от страницы с игрой и кладёт в папку.
// Запуск: node scripts/video/sink.mjs <папка> [порт]
// Слушает только 127.0.0.1; имя файла — только цифры, чтобы нельзя было писать куда попало.
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dir = resolve(process.argv[2] || 'content/frames')
const port = Number(process.argv[3]) || 8799
mkdirSync(dir, { recursive: true })

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': '*',
}
let count = 0

createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
  const m = req.method === 'POST' && req.url?.match(/^\/f\/(\d{1,6})$/)
  if (!m) return res.writeHead(404, cors).end()
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    writeFileSync(join(dir, `${m[1].padStart(5, '0')}.jpg`), Buffer.concat(chunks))
    count++
    res.writeHead(200, cors).end('ok')
  })
}).listen(port, '127.0.0.1', () => console.log(`sink: ${dir} на 127.0.0.1:${port}`))

process.on('SIGINT', () => {
  console.log(`принято кадров: ${count}`)
  process.exit(0)
})
