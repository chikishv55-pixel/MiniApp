// Проверка баннеров со сроком настоящими обработчиками на подставном Vercel Blob (в памяти, без интернета).
// Запуск:  npx tsc -p tsconfig.json --noEmit false --allowImportingTsExtensions false --outDir content/api-build --declaration false
//          node scripts/ads-test.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/* ---------- подставной @vercel/blob: лежит рядом с собранным кодом и перекрывает настоящий ---------- */
const stubDir = resolve('content/api-build/node_modules/@vercel/blob')
mkdirSync(stubDir, { recursive: true })
writeFileSync(resolve(stubDir, 'package.json'), JSON.stringify({ name: '@vercel/blob', type: 'module', main: 'index.js', exports: './index.js' }))
writeFileSync(
  resolve(stubDir, 'index.js'),
  `const store = (globalThis.__blob = globalThis.__blob || new Map())
export async function put(pathname, body, opts = {}) {
  const text = typeof body === 'string' ? body : Buffer.from(await body.arrayBuffer()).toString('base64')
  const url = 'https://stub.blob/' + pathname + (opts.addRandomSuffix ? '-' + Math.random().toString(36).slice(2, 8) : '')
  store.set(pathname === 'ads/index.json' ? pathname : url, text)
  return { url }
}
export async function get(pathname) {
  if (!store.has(pathname)) return null
  return { statusCode: 200, stream: new Response(store.get(pathname)).body }
}
export async function del(url) { store.delete(url) }
`,
)

/* ---------- окружение и обработчики ---------- */
const TOKEN = '123456:TEST_TOKEN_abcdefghijklmnopqrstuvwxyz'
Object.assign(process.env, { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(64), ADMIN_IDS: '777001001', BLOB_READ_WRITE_TOKEN: 'stub' })
const load = (p) => import(pathToFileURL(resolve('content/api-build/api', p)).href)
const adPublic = await load('ad.js')
const adAdmin = await load('admin/ads.js')
const lib = await load('_lib/ads.js')

function initData(id) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'T' }) })
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n')
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(dcs).digest('hex'))
  return p.toString()
}
const ADMIN = initData(777001001)
const STRANGER = initData(777001002)
const H = (auth) => ({ 'x-init-data': auth })
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAAASUVORK5CYII=', 'base64')

const upload = async (hours, auth = ADMIN, title = 'тест') => {
  const f = new FormData()
  f.append('image', new File([PNG], 'a.png', { type: 'image/png' }))
  f.append('title', title)
  if (hours !== undefined) f.append('hours', String(hours))
  const r = await adAdmin.POST(new Request('http://x/api/admin/ads', { method: 'POST', headers: H(auth), body: f }))
  return { status: r.status, data: await r.json() }
}
const patch = async (body, auth = ADMIN) => {
  const r = await adAdmin.PATCH(new Request('http://x/api/admin/ads', { method: 'PATCH', headers: { ...H(auth), 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  return { status: r.status, data: await r.json() }
}
const publicAds = async () => (await (await adPublic.GET(new Request('http://x/api/ad'))).json()).ads
const hoursLeft = (iso) => (Date.parse(iso) - Date.now()) / 3600e3

let failed = 0
const check = (n, ok, x = '') => (console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`), ok || failed++)

/* ---------- сценарий ---------- */
const a1 = await upload(1, ADMIN, 'на час')
check('загрузка на 1 час: срок ≈ через час', a1.status === 200 && Math.abs(hoursLeft(a1.data.ad.expires_at) - 1) < 0.01, a1.data.ad?.expires_at)
const a2 = await upload(0, ADMIN, 'без срока')
check('«без срока» (0): expires_at = null', a2.status === 200 && a2.data.ad.expires_at === null)
const a3 = await upload(24, ADMIN, 'сутки')
check('загрузка на 24 часа', Math.abs(hoursLeft(a3.data.ad.expires_at) - 24) < 0.01)
const a4 = await upload(undefined, ADMIN, 'без поля hours')
check('без поля hours (старый клиент) — бессрочно', a4.status === 200 && a4.data.ad.expires_at === null)

let pub = await publicAds()
check('публично видны все 4, у срочных есть until', pub.length === 4 && pub.filter((a) => a.until).length === 2 && pub.filter((a) => a.until === null).length === 2)

// мусор и чужие
check('hours=5000 (> 90 дней) → 400', (await upload(5000)).status === 400)
check('hours=-1 → 400', (await upload(-1)).status === 400)
check('hours=abc → 400', (await upload('abc')).status === 400)
check('hours=1.5 → 400', (await upload('1.5')).status === 400)
check('чужой не может загружать → 403', (await upload(24, STRANGER)).status === 403)
check('чужой не может менять → 403', (await patch({ id: a1.data.ad.id, active: false }, STRANGER)).status === 403)

// истёкший баннер: в хранилище вручную отодвигаем срок в прошлое
const store = globalThis.__blob
const idx = JSON.parse(store.get('ads/index.json'))
idx.find((a) => a.id === a3.data.ad.id).expires_at = new Date(Date.now() - 60_000).toISOString()
store.set('ads/index.json', JSON.stringify(idx))
pub = await publicAds()
check('просроченный баннер пропал из публичной выдачи сам', pub.length === 3 && !pub.some((a) => a.id === a3.data.ad.id))
const adminList = await (await adAdmin.GET(new Request('http://x', { headers: H(ADMIN) }))).json()
check('в админке просроченный остаётся (его можно включить заново)', adminList.ads.length === 4)

const bare = await patch({ id: a3.data.ad.id, active: true })
check('включить просроченный без нового срока нельзя → 400', bare.status === 400)
const re = await patch({ id: a3.data.ad.id, hours: 6 })
check('включить просроченный на 6 часов → снова идёт', re.status === 200 && Math.abs(hoursLeft(re.data.ad.expires_at) - 6) < 0.01 && (await publicAds()).some((a) => a.id === a3.data.ad.id))

const ext = await patch({ id: a1.data.ad.id, extend: 24 })
check('продление на +24 ч от конца срока: 1ч → 25ч', ext.status === 200 && Math.abs(hoursLeft(ext.data.ad.expires_at) - 25) < 0.01)
const extForever = await patch({ id: a2.data.ad.id, extend: 24 })
check('продлевать бессрочный нельзя → 400', extForever.status === 400)
const unlimited = await patch({ id: a1.data.ad.id, hours: 0 })
check('снять срок (hours: 0) → бессрочно', unlimited.status === 200 && unlimited.data.ad.expires_at === null)

// продление уже вышедшего срока считается от «сейчас», а не от прошлого
const idx2 = JSON.parse(store.get('ads/index.json'))
idx2.find((a) => a.id === a3.data.ad.id).expires_at = new Date(Date.now() - 5 * 3600e3).toISOString()
store.set('ads/index.json', JSON.stringify(idx2))
const extOver = await patch({ id: a3.data.ad.id, extend: 3 })
check('продление после просрочки идёт от «сейчас» (≈ 3 ч)', Math.abs(hoursLeft(extOver.data.ad.expires_at) - 3) < 0.01)

const off = await patch({ id: a2.data.ad.id, active: false })
check('ручное выключение работает', off.status === 200 && !(await publicAds()).some((a) => a.id === a2.data.ad.id))
check('PATCH без изменений → 400', (await patch({ id: a2.data.ad.id })).status === 400)
check('PATCH с мусорным extend → 400', (await patch({ id: a2.data.ad.id, extend: 0 })).status === 400)
check('PATCH с несуществующим id → 404', (await patch({ id: 'aaaaaaaaaaaa', active: true })).status === 404)

// старый баннер из прошлой версии (без поля expires_at) продолжает идти
const idx3 = JSON.parse(store.get('ads/index.json'))
idx3.push({ id: 'bbbbbbbbbbbb', image_url: 'https://stub.blob/old.png', link: null, title: 'старый', active: true, created_at: new Date().toISOString() })
store.set('ads/index.json', JSON.stringify(idx3))
check('старый баннер без expires_at по-прежнему показывается', (await publicAds()).some((a) => a.id === 'bbbbbbbbbbbb' && a.until === null))

// подписи «осталось»
const T = Date.now()
const mk = (ms) => ({ expires_at: new Date(T + ms).toISOString() })
check('leftText: 5ч 12м', lib.leftText(mk(5 * 3600e3 + 12 * 60e3 + 5000), T) === '5ч 12м', lib.leftText(mk(5 * 3600e3 + 12 * 60e3 + 5000), T))
check('leftText: 2д 4ч', lib.leftText(mk(52 * 3600e3 + 5000), T) === '2д 4ч')
check('leftText: 40м / истёк / без срока', lib.leftText(mk(40 * 60e3 + 5000), T) === '40м' && lib.leftText(mk(-1000), T) === 'истёк' && lib.leftText({}, T) === 'без срока')

console.log(failed ? `\nПРОВАЛЕНО проверок: ${failed}` : '\nВсе проверки пройдены')
process.exit(failed ? 1 : 0)
