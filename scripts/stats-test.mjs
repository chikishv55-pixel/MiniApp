// Проверка статистики настоящими обработчиками на локальном двойнике Redis (без интернета и без базы).
// Запуск:  npx tsc -p tsconfig.json --noEmit false --allowImportingTsExtensions false --outDir content/api-build --declaration false
//          node scripts/stats-test.mjs
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/* ---------- двойник Upstash Redis: только команды, которые использует код ---------- */
const hashes = new Map()
const sets = new Map()
const zsets = new Map()
const ttls = new Map()
const plain = new Map() // обычные множества (SADD/SISMEMBER)
const log = []

function run(cmd) {
  const [c, ...a] = cmd
  switch (String(c).toUpperCase()) {
    case 'HINCRBY': {
      const h = hashes.get(a[0]) || hashes.set(a[0], new Map()).get(a[0])
      const v = (Number(h.get(String(a[1]))) || 0) + Number(a[2])
      h.set(String(a[1]), v)
      return v
    }
    case 'HGETALL':
      return [...(hashes.get(a[0]) || new Map()).entries()].flat().map(String)
    case 'PFADD': {
      const s = sets.get(a[0]) || sets.set(a[0], new Set()).get(a[0])
      const before = s.size
      for (const m of a.slice(1)) s.add(String(m))
      return s.size > before ? 1 : 0
    }
    case 'PFCOUNT': {
      const u = new Set()
      for (const k of a) for (const m of sets.get(k) || []) u.add(m)
      return u.size
    }
    case 'ZADD': {
      const z = zsets.get(a[0]) || zsets.set(a[0], new Map()).get(a[0])
      const gt = String(a[1]).toUpperCase() === 'GT'
      const [score, member] = gt ? [Number(a[2]), a[3]] : [Number(a[1]), a[2]]
      const cur = z.get(member)
      if (cur === undefined || (gt ? score > cur : true)) {
        z.set(member, score)
        return cur === undefined ? 1 : 0
      }
      return 0
    }
    case 'ZSCORE': {
      const v = (zsets.get(a[0]) || new Map()).get(a[1])
      return v === undefined ? null : String(v)
    }
    case 'SADD': {
      const s = plain.get(a[0]) || plain.set(a[0], new Set()).get(a[0])
      const before = s.size
      for (const m of a.slice(1)) s.add(String(m))
      return s.size - before
    }
    case 'SISMEMBER':
      return (plain.get(a[0]) || new Set()).has(String(a[1])) ? 1 : 0
    case 'SCARD':
      return (plain.get(a[0]) || new Set()).size
    case 'SMEMBERS':
      return [...(plain.get(a[0]) || new Set())]
    case 'EXPIRE':
      ttls.set(a[0], Number(a[1]))
      return 1
    default:
      throw new Error('mock: неизвестная команда ' + c)
  }
}

const srv = createServer((req, res) => {
  const chunks = []
  req.on('data', (d) => chunks.push(d))
  req.on('end', () => {
    try {
      const cmds = JSON.parse(Buffer.concat(chunks).toString())
      log.push(...cmds)
      const out = cmds.map((c) => {
        try {
          return { result: run(c) }
        } catch (e) {
          return { error: String(e.message) }
        }
      })
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out))
    } catch {
      res.writeHead(400).end()
    }
  })
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const PORT = srv.address().port

/* ---------- окружение: ставим ДО импорта обработчиков ---------- */
const TOKEN = '123456:TEST_TOKEN_abcdefghijklmnopqrstuvwxyz'
Object.assign(process.env, {
  KV_REST_API_URL: `http://127.0.0.1:${PORT}`,
  KV_REST_API_TOKEN: 'test',
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(64),
  ADMIN_IDS: '777001001',
  CRON_SECRET: 'cron-secret',
  WEBAPP_URL: 'https://example.test',
  CHANNEL_USERNAME: 'JoesGames',
  STATS_TZ: '3',
})

// перехват обращений к Telegram: запоминаем, что бот «отправил»
const sent = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.telegram.org/')) {
    sent.push({ method: String(url).split('/').pop(), body: JSON.parse(init.body) })
    return new Response('{"ok":true}', { status: 200 })
  }
  return realFetch(url, init)
}

const load = (p) => import(pathToFileURL(resolve('content/api-build/api', p)).href)
const track = await load('track.js')
const bot = await load('bot.js')
const cron = await load('cron/digest.js')

/* ---------- подпись initData, как делает Telegram ---------- */
function initData(id) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'T' + id }) })
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n')
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(dcs).digest('hex'))
  return p.toString()
}
const post = (uid, ev) =>
  track.POST(new Request('http://x/api/track', { method: 'POST', headers: { 'x-init-data': initData(uid), 'content-type': 'application/json' }, body: JSON.stringify({ ev }) }))

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

/* ---------- сценарий ---------- */
const U = [777001001, 777001002, 777001003, 777001004, 777001005] // первый — админ
for (const id of U) await post(id, [{ e: 'open' }])
await post(U[0], [{ e: 'open' }]) // повторное открытие тем же человеком — уникальных не прибавит
await post(U[1], [{ e: 'gate_shown' }])
await post(U[1], [{ e: 'gate_passed' }])
await post(U[2], [{ e: 'gate_shown' }]) // не прошёл
for (const id of U.slice(0, 4)) await post(id, [{ e: 'play', g: 'joe' }, { e: 'result', g: 'joe', v: 4 }])
await post(U[0], [{ e: 'play', g: 'train', n: 3 }, { e: 'result', g: 'train', v: 12 }, { e: 'result', g: 'train', v: 52 }, { e: 'result', g: 'train', v: 30 }])
await post(U[3], [{ e: 'play', g: 'duel' }, { e: 'result', g: 'duel', v: 7 }])
await post(U[0], [{ e: 'ch_create', g: 'train' }])
await post(U[1], [{ e: 'ch_open', g: 'train' }, { e: 'ch_play', g: 'train' }])
await post(U[1], [{ e: 'ad_view', ad: 'abc123abc123' }])
await post(U[2], [{ e: 'ad_view', ad: 'abc123abc123' }, { e: 'ad_click', ad: 'abc123abc123' }])
await post(U[3], [{ e: 'buy', item: 'hat_cowboy' }, { e: 'buy', item: 'gun_2' }, { e: 'pass', v: 1 }])

// защита входа
const noAuth = await track.POST(new Request('http://x', { method: 'POST', body: '{"ev":[{"e":"open"}]}' }))
check('без подписи Telegram → 401', noAuth.status === 401)
const forged = await track.POST(new Request('http://x', { method: 'POST', headers: { 'x-init-data': initData(1).replace(/hash=[0-9a-f]/, 'hash=0') }, body: '{"ev":[{"e":"open"}]}' }))
check('подделанная подпись → 401', forged.status === 401)
const junk = await post(U[0], [{ e: 'hack', g: 'joe' }, { e: 'result', g: 'joe', v: 99999 }, { e: 'result', g: 'nope', v: 1 }, { e: 'ad_view', ad: '../etc' }, { e: 'buy', item: 'A B' }])
check('мусорные события отброшены (400)', junk.status === 400)

// отчёты через команды бота от админа
const secretHeader = { 'x-telegram-bot-api-secret-token': 'a'.repeat(64), 'content-type': 'application/json' }
const say = async (fromId, text, chatType = 'private') => {
  sent.length = 0
  const r = await bot.POST(new Request('http://x/api/bot', { method: 'POST', headers: secretHeader, body: JSON.stringify({ message: { chat: { id: fromId, type: chatType }, from: { id: fromId }, text } }) }))
  return { status: r.status, out: sent.map((s) => s.body) }
}

const st = await say(U[0], '/stats')
const stText = st.out[0]?.text || ''
check('/stats: зашли сегодня 5, новых 5', /зашли: 5 · новых: 5/.test(stText), stText.split('\n')[3])
check('/stats: играли 4 из 5 (80%)', /играли: 4 \(80%/.test(stText))
check('/stats: забегов 8 (4 Джо + 3 поезд + 1 дуэль)', /забегов: 8/.test(stText), stText.split('\n')[4])
check('/stats: вызовы создано 1 · открыто 1 · сыграно 1', /создано 1 · открыто 1 · сыграно 1/.test(stText))

const gm = (await say(U[0], '/games')).out[0]?.text || ''
check('/games: рекорд поезда 52, средний (12+52+30)/3=31.3', /рекорд: 52/.test(gm) && /31\.3/.test(gm))
check('/games: запусков поезда 3', /Побег на поезде\n\s+запусков: 3/.test(gm))

const fn = (await say(U[0], '/funnel')).out[0]?.text || ''
check('/funnel: увидели подписку 2, прошли 1 (50%)', /Увидели «подпишись на канал»: 2 \/ 2/.test(fn) && /1 \/ 1  \(50% \/ 50%\)/.test(fn), fn.split('\n').slice(4, 6).join(' | '))

const ad = (await say(U[0], '/ads')).out[0]?.text || ''
check('/ads: без хранилища баннеров отвечает по-человечески', /Баннеров пока нет/.test(ad))

const sh = (await say(U[0], '/shop')).out[0]?.text || ''
check('/shop: покупок 2 и уровень пропуска 1', /Покупок в гардеробе: 2/.test(sh) && /ур\. 1: 1/.test(sh))

// кто может видеть отчёты
const stranger = await say(U[2], '/stats')
check('чужому /stats не отвечает вообще', stranger.status === 200 && stranger.out.length === 0)
const group = await say(U[0], '/stats', 'group')
check('в группе админские команды молчат', group.out.length === 0)

// обычные команды
const start = await say(U[2], '/start')
const kb = start.out[0]?.reply_markup?.inline_keyboard
check('/start: кнопки «Играть», «Канал», «Позвать друга»', kb?.[0]?.[0]?.web_app?.url === 'https://example.test' && kb?.[1]?.length === 2, JSON.stringify(kb?.[1]?.map((b) => b.text)))
const help = await say(U[2], '/help')
check('/help отвечает', /Как играть/.test(help.out[0]?.text || ''))
const priv = await say(U[2], '/privacy')
check('/privacy отвечает и честно говорит про хранение', /не сохраняем/.test(priv.out[0]?.text || ''))
const bad = await bot.POST(new Request('http://x/api/bot', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'wrong' }, body: '{}' }))
check('вебхук с чужим секретом → 403', bad.status === 403)

// cron
const noCron = await cron.GET(new Request('http://x/api/cron/digest'))
check('cron без секрета → 403', noCron.status === 403)
sent.length = 0
const okCron = await cron.GET(new Request('http://x/api/cron/digest', { headers: { authorization: 'Bearer cron-secret' } }))
check('cron с секретом → 200 и сводка админу', okCron.status === 200 && sent.some((s) => s.body.chat_id === 777001001 && /Сводка за/.test(s.body.text)))
check('cron ставит срок жизни вчерашним ключам', [...ttls.keys()].some((k) => k.startsWith('u:')) && [...ttls.values()].every((v) => v === 120 * 86400))

// баннеры: показы, клики и уникальные зрители (список баннеров лежит в другом хранилище, поэтому смотрим сырые счётчики)
const all = hashes.get('s:all')
check('баннер: 2 показа, 1 клик', all.get('adv:abc123abc123') === 2 && all.get('adc:abc123abc123') === 1)
check('баннер: 2 уникальных зрителя', [...sets.entries()].some(([k, s]) => k.startsWith('adu:abc123abc123:') && s.size === 2))

// ---- рекламные ссылки с метками ----
const empty = (await say(U[0], '/src')).out[0]?.text || ''
check('/src без меток подсказывает, что делать', /Рекламных ссылок пока нет/.test(empty) && /\/link pub1/.test(empty))
const lk = (await say(U[0], '/link PubA')).out[0]?.text || ''
check('/link заводит метку и отдаёт ссылку (метка в нижнем регистре)', lk.includes('https://t.me/JoeGame_Bot?start=ad_puba'), lk.split('\n')[1])
check('/link без метки или с кривой — подсказка', /Напиши метку/.test((await say(U[0], '/link')).out[0]?.text || '') && /Напиши метку/.test((await say(U[0], '/link a-b!')).out[0]?.text || ''))
const strangerLink = await say(U[2], '/link hack')
check('чужому /link не отвечает и метку не заводит', strangerLink.out.length === 0 && !(plain.get('srcs') || new Set()).has('hack'))
await say(U[0], '/link pubb') // вторая метка, по ней никто не придёт

// «Старт» по ссылке: кнопка открывает игру с ?src=, метка считается
const s1 = await say(U[3], '/start ad_puba')
const url1 = s1.out[0]?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url
check('/start ad_puba: кнопка «Играть» открывает игру с ?src=puba', url1 === 'https://example.test/?src=puba', url1)
await say(U[4], '/start ad_PubA') // другой человек, метка в другом регистре
await say(U[4], '/start ad_puba') // тот же человек второй раз — уникальных не прибавит
const unk = await say(U[1], '/start ad_unknownx')
check('/start с чужой меткой: игра открывается, метка не заводится', unk.out[0]?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url === 'https://example.test/?src=unknownx' && ![...(sets.keys())].some((k) => k.includes('unknownx')))
const ch = await say(U[1], '/start c4' + 'A'.repeat(30))
check('вызов (c4…) по-прежнему открывает ?startapp=', /startapp=c4/.test(ch.out[0]?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url || ''))

// клиент пришёл с меткой: open + play
await post(U[3], [{ e: 'open', src: 'puba' }, { e: 'play', g: 'gold', src: 'puba' }])
await post(U[4], [{ e: 'open', src: 'puba' }])
await post(U[2], [{ e: 'open', src: 'zzzz' }, { e: 'play', g: 'joe', src: 'zzzz' }]) // метка, которую админ не заводил
await post(U[1], [{ e: 'open', src: '../x' }]) // мусор вместо метки — просто обычный заход
check('метка не заведена админом — игнорируется', ![...sets.keys()].some((k) => k.includes(':zzzz')))
check('мусорная метка не создаёт ключей', ![...sets.keys(), ...hashes.keys()].some((k) => k.includes('..')))

const src = (await say(U[0], '/src')).out[0]?.text || ''
check('/src: puba — нажали «Старт» 2, открыли 2, сыграли 1 (50%)', /puba\n\s+нажали «Старт»: 2 · открыли игру: 2 · сыграли: 1 \(50%\)/.test(src), src.split('\n').slice(2, 4).join(' | '))
check('/src: pubb есть в списке с нулями', /pubb\n\s+нажали «Старт»: 0 · открыли игру: 0 · сыграли: 0/.test(src))
check('/src: чужой не видит', (await say(U[2], '/src')).out.length === 0)
check('общая статистика не сломалась: открыли сегодня всё ещё считаются', /зашли: 5/.test((await say(U[0], '/stats')).out[0]?.text || ''))

// приватность: в «базе» нет ни одного Telegram ID
const dump = JSON.stringify({ hashes: [...hashes], sets: [...sets], zsets: [...zsets], log })
check('приватность: ни одного Telegram ID в базе и в командах', !U.some((id) => dump.includes(String(id))))
check('приватность: людей считают HLL-множества без имён', [...sets.keys()].every((k) => /^(u|p|gs|go|adu|src:[sop]):/.test(k)))
check('приватность: в списке меток только метки', [...(plain.get('srcs') || [])].every((t) => /^[a-z0-9]{1,16}$/.test(t)))

console.log(failed ? `\nПРОВАЛЕНО проверок: ${failed}` : '\nВсе проверки пройдены')
srv.close()
process.exit(failed ? 1 : 0)
