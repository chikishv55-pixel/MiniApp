// Заливает переменные из .env.local в Vercel (production), значения в консоль не выводятся.
// Запуск: node scripts/push-env.mjs KEY1 KEY2 ...
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const opts = {
  input: '',
  encoding: 'utf8',
  shell: process.platform === 'win32',
  env: { ...process.env, npm_config_registry: 'https://registry.npmjs.org' },
}

for (const key of process.argv.slice(2)) {
  const value = env[key]
  if (!value) {
    console.log(`SKIP ${key} — пусто в .env.local`)
    continue
  }
  // старое значение убираем, чтобы add не упал на дубликате
  spawnSync(npx, ['-y', 'vercel@latest', 'env', 'rm', key, 'production', '--yes'], opts)
  const r = spawnSync(npx, ['-y', 'vercel@latest', 'env', 'add', key, 'production'], { ...opts, input: value })
  const ok = r.status === 0
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${key}`)
  if (!ok) console.log((r.stderr || r.stdout || '').split(value).join('***').trim().split('\n').slice(-3).join('\n'))
}
