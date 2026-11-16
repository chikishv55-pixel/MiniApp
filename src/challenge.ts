import { api, hasAuth } from './api'

// Вызов целиком живёт в ссылке, но подписан сервером: t.me/бот?start=c3...
// Поменять сид или счёт в ссылке нельзя — сервер не примет подпись.
export type Challenge = {
  s: number // сид
  l: number // стартовый уровень
  k: number // сколько врагов убил вызвавший
  n: string // ник вызвавшего
}

export type RunInfo = { seed: number; level: number; kills: number }

const CODE_RE = /^c3[A-Za-z0-9_-]{22,55}$/
const BOT = import.meta.env.VITE_BOT_USERNAME
const APP = import.meta.env.VITE_APP_SHORTNAME
const tg = (window as any).Telegram?.WebApp

// Telegram кладёт ?startapp=... в start_param; кнопка бота передаёт его в адресе
export function readIncomingCode(): string | null {
  const raw: string = tg?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('startapp') || ''
  return CODE_RE.test(raw) ? raw : null
}

// подпись проверяет сервер: поддельная или битая ссылка вернёт null
export async function verifyChallenge(code: string): Promise<Challenge | null> {
  try {
    return (await api<{ challenge: Challenge }>(`challenge?code=${encodeURIComponent(code)}`)).challenge
  } catch {
    return null
  }
}

export function plural(n: number): string {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return 'враг'
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'врага'
  return 'врагов'
}

export type ShareResult = 'telegram' | 'shared' | 'copied' | 'cancelled' | 'failed' | 'noauth'

export async function createAndShare(run: RunInfo, nick: string): Promise<ShareResult> {
  if (!hasAuth) return 'noauth'
  let code: string
  try {
    code = (await api<{ code: string }>('challenge', { body: { ...run, nick } })).code
  } catch {
    return 'failed'
  }

  // t.me/бот/app?startapp= открывает мини-апп сразу; t.me/бот?start= идёт через бота,
  // который отвечает кнопкой «Принять вызов» (работает и без /newapp)
  const link = BOT && APP
    ? `https://t.me/${BOT}/${APP}?startapp=${code}`
    : BOT
      ? `https://t.me/${BOT}?start=${code}`
      : `${location.origin}${location.pathname}?startapp=${code}`
  const text = `Вызов от ${nick}: ${run.kills} ${plural(run.kills)} в «Метком Джо». Побьёшь?`

  if (tg?.openTelegramLink && BOT) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`)
    return 'telegram'
  }
  if (navigator.share) {
    try {
      await navigator.share({ text, url: link })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
