// Вызовы без базы: сервер подписывает данные вызова секретом, и вся информация живёт в ссылке.
// POST /api/challenge { seed, level, kills, nick } → { code }  (нужен initData)
// GET  /api/challenge?code=c3...                 → { challenge } или 400, если подпись не сходится
//
// Формат: c3 + base64url( сид 4 | уровень 2 | счёт 3 | ник UTF-8 ≤24 | HMAC 8 ) — максимум 57 символов,
// влезает в лимит Telegram на t.me/бот?start= (64). Поменял хоть байт — подпись не сойдётся.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { authUser, cleanNick, fail, isInt, json, readJson, tgNickOf } from './_lib/http.js'

const PREFIX = 'c3'
const HEAD = 9
const NICK_BYTES = 24
const SIG = 8
const CODE_RE = /^c3[A-Za-z0-9_-]{22,55}$/
// потолок правдоподобного счёта за один забег — отсекает самые тупые накрутки
const MAX_KILLS = 1000

function key(): Buffer {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set')
  return createHmac('sha256', 'pixel-arena/challenge/v1').update(secret).digest()
}

const sign = (body: Buffer) => createHmac('sha256', key()).update(body).digest().subarray(0, SIG)

function nickBytes(n: string): Buffer {
  let chars = Array.from(n)
  let b = Buffer.from(n, 'utf8')
  while (b.length > NICK_BYTES && chars.length) {
    chars = chars.slice(0, -1)
    b = Buffer.from(chars.join(''), 'utf8')
  }
  return b
}

function encode(seed: number, level: number, kills: number, nick: string): string {
  const nb = nickBytes(nick)
  const body = Buffer.alloc(HEAD + nb.length)
  body.writeUInt32BE(seed >>> 0, 0)
  body.writeUInt16BE(level, 4)
  body.writeUIntBE(kills, 6, 3)
  nb.copy(body, HEAD)
  return PREFIX + Buffer.concat([body, sign(body)]).toString('base64url')
}

function decode(code: string) {
  if (!CODE_RE.test(code)) return null
  const all = Buffer.from(code.slice(PREFIX.length), 'base64url')
  if (all.length < HEAD + SIG || all.length > HEAD + NICK_BYTES + SIG) return null
  const body = all.subarray(0, all.length - SIG)
  const sig = all.subarray(all.length - SIG)
  if (!timingSafeEqual(sig, sign(body))) return null
  const l = body.readUInt16BE(4)
  const k = body.readUIntBE(6, 3)
  if (l < 1 || l > 999 || k < 1 || k > MAX_KILLS) return null
  return { s: body.readUInt32BE(0), l, k, n: cleanNick(body.subarray(HEAD).toString('utf8')) || 'ДРУГ' }
}

export async function POST(req: Request): Promise<Response> {
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  const { seed, level, kills, nick } = await readJson(req)
  if (!isInt(seed, 0, 0xffffffff) || !isInt(level, 1, 999) || !isInt(kills, 1, MAX_KILLS)) {
    return fail(400, 'bad params')
  }
  try {
    return json({ code: encode(seed, level, kills, cleanNick(nick) || tgNickOf(user)) })
  } catch (e) {
    console.error(e)
    return fail(500, 'not configured')
  }
}

export async function GET(req: Request): Promise<Response> {
  const code = new URL(req.url).searchParams.get('code') || ''
  try {
    const challenge = decode(code)
    return challenge ? json({ challenge }) : fail(400, 'invalid challenge')
  } catch (e) {
    console.error(e)
    return fail(500, 'not configured')
  }
}
