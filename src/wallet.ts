import { useCallback, useEffect, useState } from 'react'
import { track } from './track'

// Кошелёк и гардероб. Монеты, скины и оружие живут в сейве «Меткого Джо» (общий для всех игр),
// косметика и пропуск — в сейве look.js. Игры пишут туда же из iframe, а событие 'storage'
// сообщает меню об изменениях — монеты обновляются сами, как только игрок выходит из игры.

const JKEY = 'metkiy-joe-v1'

export const SKINS = [
  { n: 'Обычный', price: 0 },
  { n: 'Агент', price: 60 },
  { n: 'Камуфляж', price: 120 },
  { n: 'Ковбой', price: 200 },
  { n: 'Ниндзя', price: 300 },
  { n: 'Командос', price: 400 },
  { n: 'Бегун', price: 550 },
  { n: 'Снайпер', price: 700 },
  { n: 'Панк', price: 900 },
]

export const WEAPONS = [
  { n: 'Тихоня', price: 0, info: 'Урон 1 · бесшумный' },
  { n: 'Орёл', price: 80, info: 'Урон 2' },
  { n: 'Магнум', price: 200, info: 'Урон 3' },
  { n: 'АКМ', price: 400, info: 'Очередь ×3' },
  { n: 'АУГ', price: 650, info: 'Очередь ×4 · кучно' },
  { n: 'ЭВО-3', price: 900, info: 'Очередь ×6' },
  { n: 'Дробовик', price: 1200, info: '6 дробин веером' },
  { n: 'Скаут', price: 1600, info: 'Урон 8 · лазерный прицел' },
  { n: 'Пулемёт', price: 2200, info: 'Очередь ×10' },
]

type JoeSave = {
  coins: number
  level: number
  ownW: number[]
  ownS: number[]
  curW: number
  curS: number
  snd: number
  mus: number
  best: number
  [k: string]: unknown
}

const JDEF: JoeSave = { coins: 0, level: 1, ownW: [0], ownS: [0], curW: 0, curS: 0, snd: 1, mus: 1, best: 0 }

export function readJoe(): JoeSave {
  try {
    const r = JSON.parse(localStorage.getItem(JKEY) || 'null')
    if (r && typeof r === 'object' && Array.isArray(r.ownW) && Array.isArray(r.ownS)) return { ...JDEF, ...r }
  } catch {
    /* битый сейв */
  }
  return { ...JDEF }
}

function writeJoe(s: JoeSave) {
  try {
    localStorage.setItem(JKEY, JSON.stringify(s))
  } catch {
    /* приватный режим */
  }
}

export function readLook(): LookSave {
  return window.JoeLook ? window.JoeLook.read() : { equip: {}, owned: [], pass: 0 }
}

function writeLook(s: LookSave) {
  window.JoeLook?.write(s)
  window.JoeLook?.reload()
}

export type Result = { ok: true; msg?: string } | { ok: false; msg: string }

const noCoins = (need: number, have: number): Result => ({ ok: false, msg: `НЕ ХВАТАЕТ ${need - have} МОНЕТ` })

export function useWallet() {
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => {
    window.JoeLook?.reload()
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === JKEY || e.key === window.JoeLook?.KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const joe = readJoe()
  const look = readLook()

  // скин: купить, если нет, и надеть (костюм при этом снимается — иначе скин не видно)
  const pickSkin = (i: number): Result => {
    const s = readJoe()
    if (!s.ownS.includes(i)) {
      const price = SKINS[i]?.price ?? Infinity
      if (s.coins < price) return noCoins(price, s.coins)
      s.coins -= price
      s.ownS = [...s.ownS, i]
      track({ e: 'buy', item: `skin_${i}` })
    }
    s.curS = i
    writeJoe(s)
    const l = readLook()
    if (l.equip.suit) {
      delete l.equip.suit
      writeLook(l)
    }
    refresh()
    return { ok: true }
  }

  const pickWeapon = (i: number): Result => {
    const s = readJoe()
    if (!s.ownW.includes(i)) {
      const price = WEAPONS[i]?.price ?? Infinity
      if (s.coins < price) return noCoins(price, s.coins)
      s.coins -= price
      s.ownW = [...s.ownW, i]
      track({ e: 'buy', item: `gun_${i}` })
    }
    s.curW = i
    writeJoe(s)
    refresh()
    return { ok: true }
  }

  // косметика: своё — надеть/снять, чужое — купить и надеть; вещи пропуска не продаются
  const pickItem = (id: string): Result => {
    const it = window.JoeLook?.byId(id)
    if (!it) return { ok: false, msg: 'НЕТ ТАКОЙ ВЕЩИ' }
    const l = readLook()
    if (!l.owned.includes(id)) {
      if (it.pass) return { ok: false, msg: `ОТКРОЙ В ПРОПУСКЕ (УР. ${it.pass})` }
      const s = readJoe()
      const price = it.price ?? Infinity
      if (s.coins < price) return noCoins(price, s.coins)
      s.coins -= price
      writeJoe(s)
      l.owned = [...l.owned, id]
      l.equip[it.slot] = id
      writeLook(l)
      track({ e: 'buy', item: id })
      refresh()
      return { ok: true, msg: 'КУПЛЕНО!' }
    }
    if (l.equip[it.slot] === id) delete l.equip[it.slot]
    else l.equip[it.slot] = id
    writeLook(l)
    refresh()
    return { ok: true }
  }

  // пропуск: уровни открываются по очереди за монеты, на каждом — эксклюзивная вещь
  const buyPassLevel = (): Result & { item?: LookItem } => {
    const JL = window.JoeLook
    if (!JL) return { ok: false, msg: 'ПРОПУСК НЕДОСТУПЕН' }
    const l = readLook()
    const next = l.pass + 1
    const item = JL.PASS_LEVELS[next - 1]
    if (!item) return { ok: false, msg: 'ПРОПУСК ПРОЙДЕН!' }
    const price = JL.passPrice(next)
    const s = readJoe()
    if (s.coins < price) return noCoins(price, s.coins)
    s.coins -= price
    writeJoe(s)
    l.pass = next
    if (!l.owned.includes(item.id)) l.owned = [...l.owned, item.id]
    writeLook(l)
    track({ e: 'pass', v: next })
    refresh()
    return { ok: true, item }
  }

  const equipItem = (id: string) => {
    const it = window.JoeLook?.byId(id)
    const l = readLook()
    if (!it || !l.owned.includes(id)) return
    l.equip[it.slot] = id
    writeLook(l)
    refresh()
  }

  return { version, coins: joe.coins | 0, joe, look, refresh, pickSkin, pickWeapon, pickItem, buyPassLevel, equipItem }
}

export type Wallet = ReturnType<typeof useWallet>
