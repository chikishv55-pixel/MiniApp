// Склейка роликов «Перекуп Джо»: кадры + звуки игры по событиям из harness-flip.js.
// node scripts/video/mux-flip.mjs <папка кадров> <выход.mp4> '<json событий>'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const [dir, out, evJson] = process.argv.slice(2)
const FF = 'tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe'
const SND = 'public/games/flip/snd/'
const frames = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length
const dur = frames / 30
const events = JSON.parse(evJson)

// какой звук у инструмента на каком этапе (как в игре: мойка/краскопульт шипят, дрель/машинка жужжат)
const TOOL = { wash: 'spray', rust: 'polish', paint: 'spray', polish: 'polish' }
const clips = [] // { file, at, len, vol, loop }
const on = {}
for (const e of events) {
  if (e.kind === 'tool' && e.on) on[e.stage] = e.t
  if (e.kind === 'tool' && !e.on) {
    clips.push({ file: TOOL[e.stage], at: on[e.stage], len: e.t - on[e.stage] + 0.15, vol: 0.55, loop: true })
    clips.push({ file: 'coins', at: e.t + 0.55, len: 1.2, vol: 0.35 }) // этап готов — «дзынь», как в игре
  }
  if (e.kind === 'door') clips.push({ file: 'door', at: e.t, len: 1.5, vol: 0.8 })
  if (e.kind === 'drop') clips.push({ file: 'door', at: e.t + 0.25, len: 1.2, vol: 0.55 })
  if (e.kind === 'wipe') clips.push({ file: 'paper', at: e.t, len: 1.2, vol: 0.7 })
  if (e.kind === 'coins') clips.push({ file: 'coins', at: e.t + 0.3, len: 2, vol: 0.9 })
}

const args = ['-y', '-loglevel', 'error', '-framerate', '30', '-start_number', '0', '-i', `${dir}/%05d.jpg`]
clips.forEach((c) => { if (c.loop) args.push('-stream_loop', '-1'); args.push('-i', SND + c.file + '.mp3') })
args.push('-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
const parts = clips.map((c, i) => {
  const ms = Math.round(c.at * 1000)
  return `[${i + 1}:a]atrim=0:${c.len.toFixed(3)},afade=t=out:st=${Math.max(0, c.len - 0.12).toFixed(3)}:d=0.12,volume=${c.vol},aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[a${i}]`
})
const silent = clips.length + 1
const mix = `${clips.map((_, i) => `[a${i}]`).join('')}[${silent}:a]amix=inputs=${clips.length + 1}:normalize=0:duration=longest,volume=2.2,alimiter=limit=0.9,atrim=0:${dur.toFixed(3)}[aout]`
args.push('-filter_complex', [...parts, mix].join(';'), '-map', '0:v', '-map', '[aout]',
  '-vf', 'scale=in_range=pc:out_range=tv:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k', '-t', dur.toFixed(3), out)
const r = spawnSync(FF, args, { stdio: 'inherit' })
console.log(r.status === 0 ? `ok: ${out} · ${frames} кадров · ${dur.toFixed(2)} с · ${clips.length} звуков` : 'ffmpeg failed')
process.exit(r.status ?? 1)
