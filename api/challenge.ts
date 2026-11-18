// Вызовы без базы: сервер подписывает данные вызова секретом, и вся информация живёт в ссылке.
// POST /api/challenge { game, seed, level, kills, nick } → { code }  (нужен initData)
// GET  /api/challenge?code=c4...                       → { challenge } или 400, если подпись не сходится
//
// Формат c4: base64url( игра 1 | сид 4 | уровень 2 | счёт 3 | ник UTF-8 ≤24 | HMAC 8 ) — максимум 58 символов,
// влезает в лимит Telegram на t.me/бот?start= (64). Поменял хоть байт — подпись не сойдётся.
// Старые ссылки c3 (без поля игры) по-прежнему открываются как «Меткий Джо».
import { createHmac, timingSafeEqual } from 'node:crypto'
import { authUser, cleanNick, fail, isInt, json, readJson, tgNickOf } from './_lib/http.js'

// порядок важен: номер игры зашит в ссылку — новые только в конец
const GAMES = ['joe', 'duel', 'train', 'gold', 'tower', 'canyon', 'rodeo'] as const
type GameId = (typeof GAMES)[number]

const HEAD = 9 // сид 4 | уровень 2 | счёт 3
const NICK_BYTES = 24
const SIG = 8
const CODE_RE = /^c[34][A-Za-z0-9_-]{22,56}$/
// потолок правдоподобного счёта за один забег — отсекает самые тупые накрутки
const MAX_KILLS = 1000

function key(): Buffer {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set')
  return createHmac('sha256', 'pixel-arena/challenge/v1').update(secret).digest()
}

// c3 подписывал только тело; c4 подписывает префикс + тело (форматы не подменить друг другом)
const sign = (prefix: string, body: Buffer) =>
  createHmac('sha256', key())
    .update(prefix === 'c3' ? body : Buffer.concat([Buffer.from(prefix), body]))
    .digest()
    .subarray(0, SIG)

function nickBytes(n: string): Buffer {
  let chars = Array.from(n)
  let b = Buffer.from(n, 'utf8')
  while (b.length > NICK_BYTES && chars.length) {
    chars = chars.slice(0, -1)
    b = Buffer.from(chars.join(''), 'utf8')
  }
  return b
}

function encode(game: GameId, seed: number, level: number, kills: number, nick: string): string {
  const nb = nickBytes(nick)
  const body = Buffer.alloc(1 + HEAD + nb.length)
  body.writeUInt8(GAMES.indexOf(game), 0)
  body.writeUInt32BE(seed >>> 0, 1)
  body.writeUInt16BE(level, 5)
  body.writeUIntBE(kills, 7, 3)
  nb.copy(body, 1 + HEAD)
  return 'c4' + Buffer.concat([body, sign('c4', body)]).toString('base64url')
}

function decode(code: string) {
  if (!CODE_RE.test(code)) return null
  const prefix = code.slice(0, 2)
  const all = Buffer.from(code.slice(2), 'base64url')
  const off = prefix === 'c4' ? 1 : 0
  if (all.length < off + HEAD + SIG || all.length > off + HEAD + NICK_BYTES + SIG) return null
  const body = all.subarray(0, all.length - SIG)
  if (!timingSafeEqual(all.subarray(all.length - SIG), sign(prefix, body))) return null

  const g = off ? GAMES[body.readUInt8(0)] : 'joe'
  if (!g) return null
  const l = body.readUInt16BE(off + 4)
  const k = body.readUIntBE(off + 6, 3)
  if (l < 1 || l > 999 || k < 1 || k > MAX_KILLS) return null
  const n = cleanNick(body.subarray(off + HEAD).toString('utf8')) || 'ДРУГ'
  return { g, s: body.readUInt32BE(off), l, k, n }
}

export async function POST(req: Request): Promise<Response> {
  const user = authUser(req)
  if (!user) return fail(401, 'unauthorized')
  const { game = 'joe', seed, level, kills, nick } = await readJson(req)
  if (!GAMES.includes(game as GameId)) return fail(400, 'bad game')
  if (!isInt(seed, 0, 0xffffffff) || !isInt(level, 1, 999) || !isInt(kills, 1, MAX_KILLS)) {
    return fail(400, 'bad params')
  }
  try {
    return json({ code: encode(game as GameId, seed, level, kills, cleanNick(nick) || tgNickOf(user)) })
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
