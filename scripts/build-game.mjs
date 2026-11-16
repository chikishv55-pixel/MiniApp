// Собирает игру из шаблона + дословных кусков joe.html (стили, база, палитры, отрисовка Джо):
//   node scripts/build-game.mjs public/games/joe.html scripts/duel/duel.template.html public/games/duel.html
//   node scripts/build-game.mjs public/games/joe.html scripts/train/train.template.html public/games/train.html
import { readFileSync, writeFileSync } from 'node:fs'

const [, , joePath, tplPath, outPath] = process.argv
const joe = readFileSync(joePath, 'utf8').split(/\r?\n/)
const find = (re, from = 0) => {
  const i = joe.findIndex((l, n) => n >= from && re.test(l))
  if (i < 0) throw new Error('marker not found: ' + re)
  return i
}
const slice = (a, b) => joe.slice(a, b + 1).join('\n')

const css = slice(find(/^<style>/) + 1, find(/^<\/style>/) - 1)
const wLine = find(/^const W=540/)
const helpers = slice(wLine, find(/^const hsh=/))
  // дуэли не нужны константы лестницы — оставляем только W, H, DEG
  .replace(/^const W=540,H=960,[^\n]*$/m, 'const W=540,H=960,DEG=Math.PI/180;')
const data = slice(find(/^const PALS=/), find(/^const ECOL=/))
const art = slice(find(/РИСОВАНИЕ: ПРИМИТИВЫ/), find(/МИР: ЛЕСТНИЦА/) - 1)

const out = readFileSync(tplPath, 'utf8')
  .replace('@@CSS@@', () => css)
  .replace('@@HELPERS@@', () => helpers)
  .replace('@@DATA@@', () => data)
  .replace('@@ART@@', () => art)
if (out.includes('@@')) throw new Error('unreplaced marker')
writeFileSync(outPath, out)
console.log('ok', outPath, out.split('\n').length, 'lines')
