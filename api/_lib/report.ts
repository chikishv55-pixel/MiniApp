// Тексты отчётов для админа (команды бота /stats, /games, /funnel, /ads, /shop и утренняя сводка).
// Всё считается из счётчиков в Redis; уникальные люди — оценка HyperLogLog (погрешность около 1%).
import { isExpired, isLive, leftText, readAds } from './ads.js'
import { FLIP_BUCKETS, FLIP_STEPS, GAMES, GAME_NAMES, TTL_SECONDS, day, redis, toMap, type Cmd } from './stats.js'

const fmt = (x: number) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const days = (n: number, from = 0) => Array.from({ length: n }, (_, i) => day(from + i))
const usd = (x: number) => (x < 0 ? '−$' : '$') + fmt(Math.abs(x))
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
    `📊 Перекуп Джо — статистика (${d[0]})`,
    '',
    'Сегодня',
    `👥 зашли: ${fmt(uT)} · новых: ${fmt(m[0].new || 0)}`,
    `🎮 играли: ${fmt(pT)} (${pct(pT, uT)} от зашедших) · забегов: ${fmt(results(m[0]))}`,
    `🔧 куплено машин: ${fmt(m[0].f_buys || 0)} · продано: ${fmt(m[0].f_sales || 0)} · навар: ${usd(m[0].f_profit || 0)}`,
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
    `🔧 Перекуп: куплено машин ${fmt(m.reduce((s, x) => s + (x.f_buys || 0), 0))} · продано ${fmt(m.reduce((s, x) => s + (x.f_sales || 0), 0))} · навар ${usd(m.reduce((s, x) => s + (x.f_profit || 0), 0))}`,
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
    const unit = ({ joe: 'врагов', duel: 'побед подряд', train: 'вагонов', gold: 'золота', tower: 'этажей', canyon: 'очков', rodeo: 'очков', flip: '$ навара' } as Record<string, string>)[g] || ''
    lines.push(`${GAME_NAMES[g]}`)
    lines.push(`  запусков: ${fmt(plays)} · забегов: ${fmt(res)}`)
    lines.push(`  средний результат: ${avg.toFixed(1)} ${unit} · рекорд: ${best == null ? '—' : fmt(Number(best))}`)
    const total = Object.values(hist).reduce((s, v) => s + v, 0)
    const keys: readonly string[] = g === 'flip' ? FLIP_BUCKETS : order
    if (total) lines.push((g === 'flip' ? '  навар за сделку: ' : '  докуда доходят: ') + keys.map((k) => `${k}: ${pct(hist[k] || 0, total)}`).join(' · '))
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

// Перекуп: воронка новичка, экономика, машины и магазин
const STEP_NAMES: Record<string, string> = {
  bank: 'открыли счёт', buy: 'купили машину', wash: 'домыли', rust: 'убрали ржавчину', paint: 'покрасили',
  polish: 'отполировали', photo: 'сфотографировали', list: 'выставили', sell: 'продали',
}
const CAR_NAMES: Record<string, string> = {
  shiva: 'Shiva', torollah: 'Torolla хэтч', torolla: 'Torolla', iaz: 'IaZ', vazel: 'Vazel', coupe: 'Купе',
  dmw3: 'DMW 3', sheroki: 'Sheroki', ranger: 'Ranger', dmw5: 'DMW 5',
}
const PAINT_NAMES: Record<string, string> = {
  b3261e: 'Вишня', d9641e: 'Апельсин', e0a21b: 'Горчица', '2f6b3a': 'Хаки', '1f4e8c': 'Синяя ночь',
  a9adb3: 'Серебро', '4a4f55': 'Мокрый асфальт', ece6d6: 'Белая ночь', '1b1b1d': 'Чёрный',
}
const GEAR_NAMES: Record<string, string> = { washer: 'мойка', drill: 'дрель', gun: 'краскопульт', polisher: 'полировальная машинка' }
function shopName(k: string): string {
  const [kind, v] = [k.slice(0, k.indexOf('_')), k.slice(k.indexOf('_') + 1)]
  if (kind === 'paint') return 'краска ' + (PAINT_NAMES[v] || v)
  if (kind === 'gear') return GEAR_NAMES[v] || v
  if (kind === 'tint') return v === '2' ? 'тонировка в ноль' : 'тонировка лёгкая'
  if (kind === 'low') return v === '2' ? 'занижение −8 см' : 'занижение −4 см'
  return k
}
const top = (m: Record<string, number>, n: number, name: (k: string) => string) =>
  Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${name(k)} ${fmt(v)}`).join(' · ')

export async function reportFlip(): Promise<string> {
  const d7 = days(7)
  const cmds: Cmd[] = [
    ...d7.map((x): Cmd => ['HGETALL', `s:${x}`]), // 0..6
    ['HGETALL', 's:all'], // 7
    ['HGETALL', 'f:buy'], ['HGETALL', 'f:sell'], ['HGETALL', 'f:hist'], ['HGETALL', 'f:shop'], // 8..11
    ['ZSCORE', 'f:best', 'all'], // 12
    ['PFCOUNT', ...d7.map((x) => `u:${x}`)], // 13
  ]
  for (const st of FLIP_STEPS) cmds.push(['PFCOUNT', `fs:${st}:${d7[0]}`], ['PFCOUNT', ...d7.map((x) => `fs:${st}:${x}`)], ['PFCOUNT', `fs:${st}:all`])
  const r = await redis(cmds)
  const m7 = r.slice(0, 7).map(toMap)
  const all = toMap(r[7])
  const [buy, sell, hist, shop] = r.slice(8, 12).map(toMap)
  const best = r[12]
  const u7 = Number(r[13]) || 0
  const step = (i: number) => ({ t: Number(r[14 + i * 3]) || 0, w: Number(r[15 + i * 3]) || 0, a: Number(r[16 + i * 3]) || 0 })
  const week = (k: string) => m7.reduce((s, x) => s + (x[k] || 0), 0)
  const sales7 = week('f_sales')
  const total = Object.values(hist).reduce((s, v) => s + v, 0)

  const lines = ['🔧 Перекуп Джо', '', `Воронка новичка, людей (сегодня / 7 дней / всё время). Открыли игру за 7 дней: ${fmt(u7)}`]
  let prev = u7
  FLIP_STEPS.forEach((st, i) => {
    const s = step(i)
    lines.push(`  ${STEP_NAMES[st]}: ${fmt(s.t)} / ${fmt(s.w)} / ${fmt(s.a)}${prev ? `  (${pct(s.w, prev)} от прошлого шага)` : ''}`)
    prev = s.w
  })
  lines.push(
    '',
    'Экономика за 7 дней',
    `  куплено машин: ${fmt(week('f_buys'))} на ${usd(week('f_spent'))}`,
    `  продано: ${fmt(sales7)} на ${usd(week('f_revenue'))} · навар ${usd(week('f_profit'))}` + (sales7 ? ` (в среднем ${usd(week('f_profit') / sales7)})` : ''),
    `  сделка от покупки до продажи: ${week('f_timed') ? fmt(week('f_minutes') / week('f_timed')) + ' мин в среднем' : '—'}`,
    `  в магазине потрачено: ${usd(week('f_shop_spent'))} (${fmt(week('f_shop'))} покупок)`,
    '',
    'За всё время',
    `  продано машин: ${fmt(all.f_sales || 0)} · лучший навар: ${best == null ? '—' : usd(Number(best))}`,
    total ? '  навар за сделку: ' + FLIP_BUCKETS.map((k) => `${k}: ${pct(hist[k] || 0, total)}`).join(' · ') : '  продаж пока нет',
    Object.keys(buy).length ? '  покупают: ' + top(buy, 6, (k) => CAR_NAMES[k] || k) : '',
    Object.keys(sell).length ? '  продают: ' + top(sell, 6, (k) => CAR_NAMES[k] || k) : '',
    Object.keys(shop).length ? '  магазин: ' + top(shop, 10, shopName) : '',
    '',
    'Шаги считаются по людям: «покрасили» — сколько разных людей хоть раз докрасили машину.',
  )
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim()
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
    `🔧 Перекуп: куплено ${fmt(m.f_buys || 0)} · продано ${fmt(m.f_sales || 0)} · навар ${usd(m.f_profit || 0)} · в магазине потрачено ${usd(m.f_shop_spent || 0)}`,
    `🛒 покупок в гардеробе: ${fmt(m.buys || 0)}`,
    `Всего людей: ${fmt(all)}`,
    '',
    'Подробнее: /flip /stats /funnel /ads /src'
  ].join('\n')
}

// срок жизни дневных ключей: чтобы старые данные удалялись сами
export async function setTtls(): Promise<void> {
  const y = day(1)
  const keys = [`s:${y}`, `u:${y}`, `p:${y}`, `gs:${y}`, `go:${y}`, ...FLIP_STEPS.map((st) => `fs:${st}:${y}`)]
  try {
    const ads = await readAds(true)
    for (const a of ads) keys.push(`adu:${a.id}:${y}`)
  } catch {
    /* без баннеров — только основные ключи */
  }
  await redis(keys.map((k): Cmd => ['EXPIRE', k, TTL_SECONDS]))
}

// откуда пришли люди: по каждой рекламной метке — нажали «Старт» → открыли игру → сыграли
export async function reportSources(): Promise<string> {
  const tags = ((await redis([['SMEMBERS', 'srcs']]))[0] as string[] | null) || []
  if (!tags.length) {
    return '🔗 Рекламных ссылок пока нет.\nСделай метку командой /link и дай ссылку в рекламу, например:\n/link pub1'
  }
  const r = await redis(tags.flatMap((t): Cmd[] => [['PFCOUNT', `src:s:${t}`], ['PFCOUNT', `src:o:${t}`], ['PFCOUNT', `src:p:${t}`]]))
  const rows = tags
    .map((t, i) => ({ t, s: r[i * 3] as number, o: r[i * 3 + 1] as number, p: r[i * 3 + 2] as number }))
    .sort((a, b) => b.s + b.o - (a.s + a.o))
  const lines = ['🔗 Откуда пришли (по рекламным ссылкам, за всё время)', '']
  for (const x of rows) {
    lines.push(`• ${x.t}`)
    lines.push(`  нажали «Старт»: ${fmt(x.s)} · открыли игру: ${fmt(x.o)} · сыграли: ${fmt(x.p)} (${pct(x.p, Math.max(x.s, x.o))})`)
  }
  lines.push('', 'Считаются только те, кто пришёл по ссылке с меткой (первый заход). Люди без ссылки сюда не попадают.')
  return lines.join('\n')
}
