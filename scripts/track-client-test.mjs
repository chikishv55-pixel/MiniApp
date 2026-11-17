// Проверка клиентской очереди событий (src/track.ts) без браузера.
// Запуск: npx tsc -p tsconfig.json --noEmit false --allowImportingTsExtensions false --outDir content/api-build --declaration false
//         node scripts/track-client-test.mjs
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const calls = []
const timers = []
const listeners = {}
globalThis.window = {
  Telegram: { WebApp: { initData: 'query_id=x&hash=y' } },
  setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length),
  clearTimeout: () => {},
  addEventListener: (n, fn) => (listeners['w:' + n] = fn),
}
globalThis.location = { search: '?src=PubA' }
const store = {}
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)) }
globalThis.document = { hidden: false, addEventListener: (n, fn) => (listeners['d:' + n] = fn) }
globalThis.fetch = async (url, init) => (calls.push({ url, init, body: JSON.parse(init.body) }), new Response('{}'))

// браузерный код импортирует без расширений (резолвит сборщик) — для Node подставляем .js во временной копии
import { readFileSync, writeFileSync } from 'node:fs'
const srcDir = resolve('content/api-build/src')
writeFileSync(resolve(srcDir, '_track_under_test.js'), readFileSync(resolve(srcDir, 'track.js'), 'utf8').replace("from './api'", "from './api.js'"))
const { track, flush } = await import(pathToFileURL(resolve(srcDir, '_track_under_test.js')).href)
let failed = 0
const check = (name, ok, extra = '') => (console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`), ok || failed++)

track({ e: 'open' })
track({ e: 'play', g: 'train' })
track({ e: 'play', g: 'train' })
track({ e: 'play', g: 'train' })
track({ e: 'play', g: 'joe' })
track({ e: 'result', g: 'train', v: 12 })
track({ e: 'result', g: 'train', v: 30 })
check('ничего не отправлено сразу (ждём паузу)', calls.length === 0)
check('таймер на 4 секунды заведён', timers.at(-1)?.ms === 4000)

flush()
check('одна пачка вместо шести запросов', calls.length === 1)
const ev = calls[0]?.body.ev || []
check('повторные запуски склеены: train×3', ev.some((x) => x.e === 'play' && x.g === 'train' && x.n === 3))
check('разные игры не склеены', ev.some((x) => x.e === 'play' && x.g === 'joe'))
check('результаты не склеены (нужна каждая цифра)', ev.filter((x) => x.e === 'result').length === 2)
check('метка источника (?src=PubA → puba) уходит с open и play', ev.filter((x) => x.e === 'open' || x.e === 'play').every((x) => x.src === 'puba'))
check('в result и прочих событиях метки нет', ev.filter((x) => x.e === 'result').every((x) => x.src === undefined))
check('метка первого захода сохранена на устройстве', store['joe-src'] === 'puba')
check('подпись Telegram уходит заголовком', calls[0]?.init.headers['x-init-data'] === 'query_id=x&hash=y')
check('keepalive для сворачивания приложения', calls[0]?.init.keepalive === true)
check('в запросе нет ни имён, ни ID', !/user|name|id"/i.test(JSON.stringify(calls[0].body)))

track({ e: 'ad_view', ad: 'abc123abc123' })
document.hidden = true
listeners['d:visibilitychange']?.()
check('при сворачивании очередь уходит сразу', calls.length === 2 && calls[1].body.ev[0].e === 'ad_view')

for (let i = 0; i < 30; i++) track({ e: 'result', g: 'joe', v: i })
check('30 накопленных событий уходят без ожидания', calls.length === 3)

console.log(failed ? `\nПРОВАЛЕНО проверок: ${failed}` : '\nВсе проверки пройдены')
process.exit(failed ? 1 : 0)
