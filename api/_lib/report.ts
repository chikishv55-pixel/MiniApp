// Тексты отчётов для админа (команды бота /stats, /games, /funnel, /ads, /shop и утренняя сводка).
// Всё считается из счётчиков в Redis; уникальные люди — оценка HyperLogLog (погрешность около 1%).
import { isExpired, isLive, leftText, readAds } from './ads.js'
import { GAMES, GAME_NAMES, TTL_SECONDS, day, redis, toMap, type Cmd } from './stats.js'

const fmt = (x: number) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const days = (n: number, from = 0) => Array.from({ length: n }, (_, i) => day(from + i))
const sumBy = (m: Record<string, number>, prefix: string) =>
  Object.entries(m).reduce((s, [k, v]) => (k.startsWith(prefix) ? s + v : s), 0)

export async function reportStats(): Promise<string> {
  const d = days(7)
  const cmds: Cmd[] = [
    ...d.map((x) => ['HGETALL', `s:${x}`]), // 0..6
    ['PFCOUNT', `u:${d[0]}`], // 7  зашли сегодня
    ['PFCOUNT', `u:${d[1]}`], // 8  зашли вчера
    ['PFCOUNT', `u:${d[0]}`, `u:${d[1]}`], // 9  объединение — для «вернулись»
    ['PFCOUNT', `p:${d[0]}`], // 10 играли сегодня
    ['PFCOUNT', `p:${d[1]}`], // 11 играли вчера
    ['PFCOUNT', ...d.map((x) => `u:${x}`)], // 12 зашли за 7 дней
    ['PFCOUNT', ...d.map((x) => `p:${x}`)], // 13 играли за 7 дней
    ['PFCOUNT', 'u:all'], // 14 всего людей
  ]
  const r = await redis(cmds)
  const m = r.slice(0, 7).map(toMap)
  const [uT, uY, uTY, pT, pY, u7, p7, uAll] = r.slice(7) as number[]
  const plays = (x: Record<string, number>) => sumBy(x, 'play:')
  const results = (x: Record<string, number>) => sumBy(x, 'res:')
  const week = (prefix: string) => m.reduce((s, x) => s + sumBy(x, prefix), 0)
  const returned = Math.max(0, uY + uT - uTY)

  return [
    `📊 Игры Джо — статистика (${d[0]})`,
    '',
    'Сегодня',
    `👥 зашли: ${fmt(uT)} · новых: ${fmt(m[0].new || 0)}`,
    `🎮 играли: ${fmt(pT)} (${pct(pT, uT)} от зашедших) · забегов: ${fmt(results(m[0]))}`,
    '',
    'Вчера',
    `👥 зашли: ${fmt(uY)} · новых: ${fmt(m[1].new || 0)}`,
    `🎮 играли: ${fmt(pY)} · забегов: ${fmt(results(m[1]))}`,
    `↩️ из вчерашних сегодня вернулись: ${fmt(returned)} из ${fmt(uY)} (${pct(returned, uY)})`,
    '',
    '7 дней',
    `👥 уникальных: ${fmt(u7)} · играли: ${fmt(p7)}`,
    `🎮 запусков игр: ${fmt(m.reduce((s, x) => s + plays(x), 0))} · забегов: ${fmt(m.reduce((s, x) => s + results(x), 0))}`,
    `⚔ вызовы: создано ${fmt(week('ch_create:'))} · открыто ${fmt(week('ch_open:'))} · сыграно ${fmt(week('ch_play:'))}`,
    '',
    `Всего людей за всё время: ${fmt(uAll)}`,
    'Уникальные считаются приблизительно (±1%). Твои заходы тоже учитываются.',
  ].join('\n')
}

export async function reportGames(): Promise<string> {
  const cmds: Cmd[] = [['HGETALL', 's:all']]
  for (const g of GAMES) cmds.push(['HGETALL', `hist:${g}`], ['ZSCORE', `best:${g}`, 'all'])
  const r = await redis(cmds)
  const all = toMap(r[0])
  const order = ['0-4', '5-9', '10-19', '20-29', '30-49', '50+']
  const lines = ['🎮 По играм (за всё время)', '']
  GAMES.forEach((g, i) => {
    const hist = toMap(r[1 + i * 2])
    const best = r[2 + i * 2]
    const plays = all[`play:${g}`] || 0
    const res = all[`res:${g}`] || 0
    const avg = res ? (all[`sum:${g}`] || 0) / res : 0
    const unit = ({ joe: 'врагов', duel: 'побед подряд', train: 'вагонов', gold: 'золота', tower: 'этажей' } as Record<string, string>)[g] || ''
    lines.push(`${GAME_NAMES[g]}`)
    lines.push(`  запусков: ${fmt(plays)} · забегов: ${fmt(res)}`)
    lines.push(`  средний результат: ${avg.toFixed(1)} ${unit} · рекорд: ${best == null ? '—' : fmt(Number(best))}`)
    const total = Object.values(hist).reduce((s, v) => s + v, 0)
    if (total) lines.push('  докуда доходят: ' + order.map((k) => `${k}: ${pct(hist[k] || 0, total)}`).join(' · '))
    lines.push('')
  })
  return lines.join('\n').trim()
}

export async function reportFunnel(): Promise<string> {
  const d7 = days(7)
  const one = (p: string): Cmd => ['PFCOUNT', `${p}:${d7[0]}`]
  const week = (p: string): Cmd => ['PFCOUNT', ...d7.map((x) => `${p}:${x}`)]
  const r = (await redis([one('u'), week('u'), one('gs'), week('gs'), one('go'), week('go'), one('p'), week('p')])) as number[]
  const [u1, u7, gs1, gs7, go1, go7, p1, p7] = r
  return [
    '🔻 Воронка (сегодня / 7 дней)',
    '',
    `Открыли игру: ${fmt(u1)} / ${fmt(u7)}`,
    `Увидели «подпишись на канал»: ${fmt(gs1)} / ${fmt(gs7)}`,
    `  подписались и пошли дальше: ${fmt(go1)} / ${fmt(go7)}  (${pct(go1, gs1)} / ${pct(go7, gs7)})`,
    `Сыграли хотя бы раз: ${fmt(p1)} / ${fmt(p7)}  (${pct(p1, u1)} / ${pct(p7, u7)} от открывших)`,
    '',
    'Если «подписались» сильно меньше «увидели» — экран подписки отпугивает: можно пускать в первый забег до подписки.',
  ].join('\n')
}

export async function reportAds(): Promise<string> {
  let ads: Awaited<ReturnType<typeof readAds>> = []
  try {
    ads = await readAds(true)
  } catch {
    /* нет хранилища баннеров — покажем, что есть в счётчиках */
  }
  if (!ads.length) return '📢 Баннеров пока нет. Загрузи первый в админке игры (⚙).'
  const d7 = days(7)
  const cmds: Cmd[] = [['HGETALL', 's:all']]
  for (const a of ads) cmds.push(['PFCOUNT', ...d7.map((x) => `adu:${a.id}:${x}`)])
  const r = await redis(cmds)
  const all = toMap(r[0])
  const lines = ['📢 Реклама (показы и клики за всё время)', '']
  ads.forEach((a, i) => {
    const v = all[`adv:${a.id}`] || 0
    const c = all[`adc:${a.id}`] || 0
    const live = isLive(a)
    lines.push(`${live ? '🟢' : isExpired(a) ? '⏰' : '⚪'} ${a.title || a.id}`)
    lines.push(`  ${live ? `идёт · осталось: ${leftText(a)}` : isExpired(a) ? 'срок вышел' : 'выключен'}`)
    lines.push(`  показов: ${fmt(v)} · уникальных за 7 дней: ${fmt(r[1 + i] as number)}`)
    lines.push(`  кликов: ${fmt(c)} · CTR: ${pct(c, v)}`)
    lines.push('')
  })
  lines.push('Показ считается один раз за заход на баннер. Это можно показывать рекламодателям.')
  return lines.join('\n')
}

export async function reportShop(): Promise<string> {
  const [shop, pass, all] = (await redis([['HGETALL', 'shop'], ['HGETALL', 'passlvl'], ['HGETALL', 's:all']])).map(toMap)
  const top = Object.entries(shop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
  const lvls = Object.entries(pass).sort((a, b) => Number(a[0]) - Number(b[0]))
  return [
    '🛒 Магазин и пропуск',
    '',
    `Покупок в гардеробе: ${fmt(all.buys || 0)} · уровней пропуска открыто: ${fmt(all.pass_buys || 0)}`,
    '',
    top.length ? 'Популярное:\n' + top.map(([k, v]) => `  ${k}: ${fmt(v)}`).join('\n') : 'Покупок пока нет.',
    '',
    lvls.length ? 'Уровни пропуска:\n' + lvls.map(([k, v]) => `  ур. ${k}: ${fmt(v)}`).join('\n') : '',
    '',
    'skin_N — скины, gun_N — оружие, остальное — косметика.',
  ]
    .join('\n')
    .trim()
}

// утренняя сводка за вчера
export async function digestText(): Promise<string> {
  const y = day(1)
  const r = await redis([
    ['HGETALL', `s:${y}`],
    ['PFCOUNT', `u:${y}`],
    ['PFCOUNT', `p:${y}`],
    ['PFCOUNT', `gs:${y}`],
    ['PFCOUNT', `go:${y}`],
    ['PFCOUNT', 'u:all'],
  ])
  const m = toMap(r[0])
  const [u, p, gs, go, all] = r.slice(1) as number[]
  return [
    `☀️ Сводка за ${y}`,
    `👥 зашли: ${fmt(u)} (новых ${fmt(m.new || 0)}) · играли: ${fmt(p)} (${pct(p, u)})`,
    `🎮 забегов: ${fmt(sumBy(m, 'res:'))} · запусков: ${fmt(sumBy(m, 'play:'))}`,
    `🔻 подписка: увидели ${fmt(gs)} → прошли ${fmt(go)} (${pct(go, gs)})`,
    `⚔ вызовы: создано ${fmt(sumBy(m, 'ch_create:'))} · открыто ${fmt(sumBy(m, 'ch_open:'))}`,
    `🛒 покупок: ${fmt(m.buys || 0)}`,
    `Всего людей: ${fmt(all)}`,
    '',
    'Подробнее: /stats /games /funnel /ads /shop',
  ].join('\n')
}

// срок жизни дневных ключей: чтобы старые данные удалялись сами
export async function setTtls(): Promise<void> {
  const y = day(1)
  const keys = [`s:${y}`, `u:${y}`, `p:${y}`, `gs:${y}`, `go:${y}`]
  try {
    const ads = await readAds(true)
    for (const a of ads) keys.push(`adu:${a.id}:${y}`)
  } catch {
    /* без баннеров — только основные ключи */
  }
  await redis(keys.map((k): Cmd => ['EXPIRE', k, TTL_SECONDS]))
}
