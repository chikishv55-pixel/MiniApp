import { api, hasAuth } from './api'

export type GameId = 'joe' | 'duel' | 'train' | 'gold' | 'tower'

// Вызов целиком живёт в ссылке, но подписан сервером: t.me/бот?start=c4...
// Поменять игру, сид или счёт в ссылке нельзя — сервер не примет подпись.
export type Challenge = {
  g: GameId // игра
  s: number // сид
  l: number // стартовый уровень
  k: number // счёт вызвавшего (врагов в Джо / побед подряд в дуэли)
  n: string // ник вызвавшего
}

export type RunInfo = { seed: number; level: number; kills: number }

const CODE_RE = /^c[34][A-Za-z0-9_-]{22,56}$/
const BOT = import.meta.env.VITE_BOT_USERNAME
const APP = import.meta.env.VITE_APP_SHORTNAME
const tg = (window as any).Telegram?.WebApp

function pluralRu(n: number, one: string, few: string, many: string): string {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

// как называть игру и счёт в текстах вызова
export const GAME_TEXT: Record<GameId, { title: string; inGame: string; score: (k: number) => string }> = {
  joe: { title: 'МЕТКИЙ ДЖО', inGame: 'в «Метком Джо»', score: (k) => `${k} ${pluralRu(k, 'враг', 'врага', 'врагов')}` },
  duel: {
    title: 'ДУЭЛЬ',
    inGame: 'в «Дуэли»',
    score: (k) => `${k} ${pluralRu(k, 'победа', 'победы', 'побед')} подряд`,
  },
  train: {
    title: 'ПОБЕГ НА ПОЕЗДЕ',
    inGame: 'в «Побеге на поезде»',
    score: (k) => `${k} ${pluralRu(k, 'вагон', 'вагона', 'вагонов')}`,
  },
  gold: { title: 'ЗОЛОТАЯ ЛИХОРАДКА', inGame: 'в «Золотой лихорадке»', score: (k) => `${k} золота` },
  tower: {
    title: 'БАШНЯ ИЗ БОЧЕК',
    inGame: 'в «Башне из бочек»',
    score: (k) => `${k} ${pluralRu(k, 'этаж', 'этажа', 'этажей')}`,
  },
}

// Telegram кладёт ?startapp=... в start_param; кнопка бота передаёт его в адресе
export function readIncomingCode(): string | null {
  const raw: string = tg?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('startapp') || ''
  return CODE_RE.test(raw) ? raw : null
}

// подпись проверяет сервер: поддельная или битая ссылка вернёт null
export async function verifyChallenge(code: string): Promise<Challenge | null> {
  try {
    const ch = (await api<{ challenge: Challenge }>(`challenge?code=${encodeURIComponent(code)}`)).challenge
    return ch && ch.g in GAME_TEXT ? ch : null
  } catch {
    return null
  }
}

export type ShareResult = 'telegram' | 'shared' | 'copied' | 'cancelled' | 'failed' | 'noauth'

export async function createAndShare(game: GameId, run: RunInfo, nick: string): Promise<ShareResult> {
  if (!hasAuth) return 'noauth'
  let code: string
  try {
    code = (await api<{ code: string }>('challenge', { body: { game, ...run, nick } })).code
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
  const t = GAME_TEXT[game]
  const text = `Вызов от ${nick}: ${t.score(run.kills)} ${t.inGame}. Побьёшь?`

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
