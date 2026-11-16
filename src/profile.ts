import { useCallback, useState } from 'react'
import type { GameId } from './challenge'

const KEY = 'pixel-arena:profile'
const BEST_KEY = 'pixel-arena:best'

// avatar: 'tg' — фото из Telegram, 'px:<seed>' — пиксельный аватар
type Stored = { nick?: string; avatar?: string }

export const NICK_MAX = 12
export const AVATAR_SEEDS = ['fox', 'cat', 'bot', 'ghost', 'frog', 'owl']

const tg = (window as any).Telegram?.WebApp
const tgUser = tg?.initDataUnsafe?.user as
  | { first_name?: string; username?: string; photo_url?: string }
  | undefined

export const tgPhoto: string | undefined = tgUser?.photo_url
const tgNick: string = (tgUser?.username || tgUser?.first_name || 'PLAYER').slice(0, NICK_MAX)

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

export function cleanNick(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim()).slice(0, NICK_MAX).join('')
}

// Профиль и рекорд хранятся на устройстве (без базы)
export function useProfile() {
  const [stored, setStored] = useState<Stored>(() => read<Stored>(KEY, {}))
  // рекорды по играм; раньше хранилось одно число (рекорд Джо) — подхватываем его
  const [best, setBestState] = useState<Record<GameId, number>>(() => {
    const v = read<unknown>(BEST_KEY, {})
    const num = (x: unknown) => (typeof x === 'number' && x >= 0 ? Math.floor(x) : 0)
    if (typeof v === 'number') return { joe: num(v), duel: 0, train: 0 }
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
    return { joe: num(o.joe), duel: num(o.duel), train: num(o.train) }
  })

  const nick = stored.nick || tgNick
  const avatar = stored.avatar || (tgPhoto ? 'tg' : `px:${nick}`)

  // пустое значение = вернуть то, что пришло из Telegram
  const save = useCallback((next: Stored) => {
    const clean: Stored = {
      nick: next.nick ? cleanNick(next.nick) || undefined : undefined,
      avatar: next.avatar || undefined,
    }
    write(KEY, clean)
    setStored(clean)
  }, [])

  const reportRun = useCallback((game: GameId, kills: number) => {
    setBestState((prev) => {
      if (kills <= prev[game]) return prev
      const next = { ...prev, [game]: kills }
      write(BEST_KEY, next)
      return next
    })
  }, [])

  return { nick, avatar, save, tgNick, best, reportRun }
}
