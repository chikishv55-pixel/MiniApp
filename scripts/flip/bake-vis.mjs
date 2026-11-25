// Запекает маску видимости кузова: public/games/flip/pickup.glb → public/games/flip/pickup.vis.png
//   node scripts/flip/bake-vis.mjs
// Запускать после каждого изменения модели (scripts/flip/pickup.py).
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { GLTFLoader } from '../../public/games/vendor/three/GLTFLoader.js'
import { bakeCover } from '../../public/games/flip/vis.js'

const S = 512 // как в flip.html
const DIR = new URL('../../public/games/flip/', import.meta.url)
const buf = readFileSync(new URL('pickup.glb', DIR))
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

const t0 = Date.now()
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej))
const parts = []
let body
gltf.scene.updateMatrixWorld(true)
gltf.scene.traverse((o) => {
  if (!o.isMesh) return
  parts.push(o)
  if (o.name.startsWith('Body')) body = o
})
if (!body) throw new Error('в модели нет объекта Body')
const cover = bakeCover(body, parts, S)

writeFileSync(new URL('pickup.vis.png', DIR), png(cover, S))
let on = 0
for (const c of cover) on += c
console.log(`ok pickup.vis.png: ${on} видимых px из ${S * S}, ${Date.now() - t0} мс`)

// Минимальный PNG: 8-бит серый, 0/255.
function png(mask, s) {
  const raw = Buffer.alloc((s + 1) * s)
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) raw[y * (s + 1) + 1 + x] = mask[y * s + x] ? 255 : 0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function crc32(b) {
  let c = ~0
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) }
  return ~c >>> 0
}
