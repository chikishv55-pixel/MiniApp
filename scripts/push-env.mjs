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
  // есть переменная — меняем значение (update), нет — создаём (add). Ничего не удаляем.
  const args = ['-y', 'vercel@latest', 'env', 'update', key, '--environment', 'production', '--yes']
  let r = spawnSync(npx, args, { ...opts, input: value })
  let how = 'updated'
  if (r.status !== 0 && /not found|does not exist|no environment variable/i.test(`${r.stdout}${r.stderr}`)) {
    r = spawnSync(npx, ['-y', 'vercel@latest', 'env', 'add', key, '--environment', 'production'], { ...opts, input: value })
    how = 'added'
  }
  const ok = r.status === 0
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${key}${ok ? ` (${how})` : ''}`)
  if (!ok) console.log(`${r.stderr || ''}${r.stdout || ''}`.split(value).join('***').trim().split('\n').slice(-8).join('\n'))
}
