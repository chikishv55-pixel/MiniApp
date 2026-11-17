// Статистика в Upstash Redis (REST API, без SDK) — бесплатный тариф без карты.
//
// Приватность: Telegram ID в базу не попадает ни в каком читаемом виде. Вместо него — псевдоним (HMAC),
// а «сколько разных людей» считает HyperLogLog: из него нельзя достать, кто именно заходил.
// Имена и ники не храним.
//
// Ключи:
//   s:<день>  — хеш дневных счётчиков (opens, new, play:<игра>, res:<игра>, sum:<игра>, ch_*:<игра>, adv:<id>, adc:<id>, buys…)
//   s:all     — те же счётчики за всё время
//   u:all     — HLL всех, кто когда-либо открывал игру
//   u:<день>, p:<день>, gs:<день>, go:<день> — HLL за день: открыли, играли, увидели «подпишись», подписались
//   adu:<id>:<день> — HLL уникальных зрителей баннера за день
//   hist:<игра> — корзины результатов; best:<игра> — лучший результат за всё время (zset)
//   srcs — множество рекламных меток, заведённых админом (/link метка); src:s:<метка> / src:o:<метка> / src:p:<метка> —
//          HLL тех, кто нажал «Старт» по ссылке, открыл игру, сыграл. Метки заводит только админ (чужие метки не считаются).
//   shop — сколько раз купили каждую вещь; passlvl — сколько раз открывали уровни пропуска
// Дневные ключи живут 120 дней: срок ставит ежедневный cron (api/cron/digest.ts).
import { createHmac } from 'node:crypto'

const BASE = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
const TZ = Number(process.env.STATS_TZ ?? 3) // часовой пояс отчётов (по умолчанию UTC+3)

export const TTL_SECONDS = 120 * 86400
export const GAMES = ['joe', 'duel', 'train', 'gold', 'tower'] as const
export const GAME_NAMES: Record<string, string> = { joe: 'Меткий Джо', duel: 'Дуэль', train: 'Побег на поезде', gold: 'Золотая лихорадка', tower: 'Башня из бочек' }
export const statsReady = () => Boolean(BASE && TOKEN)

// рекламная метка: ссылка t.me/бот?start=ad_<метка>
export const SRC_RE = /^[a-z0-9]{1,16}$/
export const MAX_SRC = 100

export type Cmd = (string | number)[]

export async function redis(cmds: Cmd[]): Promise<any[]> {
  if (!cmds.length) return []
  const res = await fetch(`${BASE}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmds),
  })
  if (!res.ok) throw new Error(`redis ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const out = (await res.json()) as { result?: any; error?: string }[]
  return out.map((r) => {
    if (r.error) throw new Error(`redis: ${r.error}`)
    return r.result
  })
}

// день в часовом поясе отчётов: day(0) — сегодня, day(1) — вчера
export function day(back = 0, now = Date.now()): string {
  return new Date(now + TZ * 3600e3 - back * 86400e3).toISOString().slice(0, 10)
}

// псевдоним вместо Telegram ID
export function anon(id: number): string {
  const salt = process.env.TELEGRAM_WEBHOOK_SECRET || 'joe'
  return createHmac('sha256', `joe-stats/${salt}`).update(String(id)).digest('base64url').slice(0, 16)
}

// HGETALL отдаёт плоский массив [поле, значение, …] — превращаем в объект с числами
export function toMap(flat: unknown): Record<string, number> {
  const m: Record<string, number> = {}
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) m[String(flat[i])] = Number(flat[i + 1]) || 0
  return m
}

// админ заводит метку; возвращает false, если метка кривая или их уже слишком много
export async function registerSrc(tag: string): Promise<boolean> {
  if (!SRC_RE.test(tag)) return false
  const [known, count] = await redis([['SISMEMBER', 'srcs', tag], ['SCARD', 'srcs']])
  if (known !== 1 && Number(count) >= MAX_SRC) return false
  await redis([['SADD', 'srcs', tag]])
  return true
}

// человек нажал «Старт» по рекламной ссылке; чужие метки (не заведённые админом) молча игнорируем
export async function noteStart(tag: string, id: number): Promise<void> {
  if (!SRC_RE.test(tag)) return
  const [known] = await redis([['SISMEMBER', 'srcs', tag]])
  if (known === 1) await redis([['PFADD', `src:s:${tag}`, anon(id)]])
}
