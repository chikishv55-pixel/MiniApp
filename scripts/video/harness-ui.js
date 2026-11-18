// Ролики-«запись экрана»: НАСТОЯЩЕЕ приложение (React-меню) в рамке телефона. Нажимаем кнопки, как игрок:
// гардероб → вкладка → покупка → превью Джо в новом наряде. Подписи шагов, круг-касание, плавные переходы.
// Кадры меню снимает html-to-image (страница → картинка), а живые canvas (Джо в превью, сценки на карточках) дорисовываем
// поверх каждым кадром — поэтому Джо в гардеробе покачивается, а не застывает.
//
//   1) подготовить сейв:   const u = await import('/scripts/video/harness-ui.js'); u.prepare({ coins: 450, pass: 0, equip: {} })
//   2) открыть '/' (вкладка 393×640, панель браузера видна!), затем:
//      u.startUi({ sink, steps: [...] })   // шаги — см. scripts/video/ui-videos.js
//   3) игровая часть и концовка — harness-casual.js на странице игры, с { startIndex: window.__vp.frames, noPlate: true, frames: 75 }
import { OW, OH, FPS, banner, rr, text, pushFrame } from './common.js'

export const VW = 393
export const VH = 680 // размер вкладки: телефонный экран Telegram с шапкой
const PW = 720 // ширина «телефона» в кадре
const PH = Math.round((PW * VH) / VW)
const PX = (OW - PW) / 2
const PY = 495
const S = PW / VW
const LIVE = ['.wr-preview canvas', '.slide-art canvas'] // анимированные canvas, которые рисуем поверх снимка

/* ---------- сейв ---------- */
export function prepare({ coins = 500, pass = 0, equip = {}, owned = [] } = {}) {
  const joe = { coins, level: 1, ownW: [0], ownS: [0], curW: 0, curS: 0, snd: 1, mus: 1, best: 0 }
  localStorage.setItem('metkiy-joe-v1', JSON.stringify(joe))
  localStorage.setItem('joe-look-v1', JSON.stringify({ equip, owned, pass, v: 2 }))
  localStorage.setItem('joe-seen', JSON.stringify(['canyon', 'rodeo'])) // без бейджей «НОВОЕ»
  return 'ok'
}

/* ---------- помощники для сценариев ---------- */
export const byText = (sel, txt) => () => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(txt))
  if (!el) throw new Error(`не найден ${sel} «${txt}»`)
  return el
}
export const item = (name) => () => {
  const el = [...document.querySelectorAll('.wr-item')].find((e) => e.querySelector('b')?.textContent.trim() === name)
  if (!el) throw new Error(`нет вещи «${name}» в текущей вкладке`)
  return el
}
export const tab = (name) => byText('.wr-tab', name)
// прокрутить так, чтобы строка уровня n оказалась в верхней трети окна (прокручивается ближайший родитель со скроллом — само окно)
export const scrollRow = (n) => () => {
  const row = document.querySelector('.pass-list').children[n - 1]
  let sc = row.parentElement
  while (sc && sc.scrollHeight <= sc.clientHeight + 2) sc = sc.parentElement
  sc.scrollTop += row.getBoundingClientRect().top - sc.getBoundingClientRect().top - 150
}

/* ---------- съёмка ---------- */
async function loadLib() {
  if (window.htmlToImage) return
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = '/scripts/video/node_modules/html-to-image/dist/html-to-image.js'
    s.onload = res
    s.onerror = () => rej(new Error('не загрузился html-to-image'))
    document.head.appendChild(s)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function startUi(o) {
  window.__vp = { frames: 0, phase: 'init', done: false, err: null }
  runUi(o).catch((e) => {
    window.__vp.err = String((e && e.stack) || e)
    window.__vp.done = true
  })
  return 'started'
}

async function runUi(o) {
  await loadLib()
  // полосы прокрутки в записи не нужны (на телефоне их нет)
  const st = document.createElement('style')
  st.textContent = '*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}'
  document.head.appendChild(st)
  const fontCSS = await window.htmlToImage.getFontEmbedCSS(document.body)
  // html-to-image не запоминает прокрутку внутри блоков: на время кадра «запекаем» её — сдвигаем детей на scrollTop и обнуляем scrollTop
  const shot = async () => {
    const undo = []
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) {
        const st = el.scrollTop
        for (const ch of el.children) {
          undo.push(() => (ch.style.transform = ch.dataset.tf || ''))
          ch.dataset.tf = ch.style.transform
          ch.style.transform = `translateY(${-st}px)${ch.style.transform ? ' ' + ch.style.transform : ''}`
        }
        undo.push(() => (el.scrollTop = st))
        el.scrollTop = 0
      }
    }
    try {
      return await window.htmlToImage.toCanvas(document.body, { pixelRatio: S, width: VW, height: VH, backgroundColor: '#0a0a0f', fontEmbedCSS: fontCSS, cacheBust: false })
    } finally {
      undo.reverse().forEach((f) => f())
    }
  }

  const out = document.createElement('canvas')
  out.width = OW
  out.height = OH
  const c = out.getContext('2d')
  let i = o.startIndex || 0
  const push = async () => {
    await pushFrame(out, i, o.sink)
    i++
    window.__vp.frames = i
  }

  const bg = c.createLinearGradient(0, 0, 0, OH)
  bg.addColorStop(0, '#120b3a')
  bg.addColorStop(1, '#6f5cff')

  // одна склейка кадра: фон, плашка с ботом, подпись, телефон со снимком (или переходом A→B), живые canvas, круг-касание
  const frame = (A, B, k, caption, ripple, live = true) => {
    c.fillStyle = bg
    c.fillRect(0, 0, OW, OH)
    banner(c)
    if (caption) {
      c.font = '900 52px "Arial Black","Segoe UI",sans-serif'
      const fs = Math.min(52, (940 / c.measureText(caption).width) * 52)
      text(c, caption, OW / 2, 440, fs, '#fff', '#14141f', 12)
    }
    c.save()
    c.shadowColor = 'rgba(0,0,0,.55)'
    c.shadowOffsetY = 14
    c.shadowBlur = 22
    rr(c, PX - 10, PY - 10, PW + 20, PH + 20, 30)
    c.fillStyle = '#0a0a0f'
    c.fill()
    c.restore()
    rr(c, PX - 10, PY - 10, PW + 20, PH + 20, 30)
    c.lineWidth = 7
    c.strokeStyle = '#ffc233'
    c.stroke()
    c.save()
    rr(c, PX, PY, PW, PH, 20)
    c.clip()
    c.drawImage(A, PX, PY, PW, PH)
    if (B) {
      c.globalAlpha = k
      c.drawImage(B, PX, PY, PW, PH)
      c.globalAlpha = 1
    }
    if (live && (!B || k >= 1)) {
      for (const sel of LIVE)
        for (const cv of document.querySelectorAll(sel)) {
          const r = cv.getBoundingClientRect()
          if (r.width < 4 || r.right < 0 || r.left > VW || r.bottom < 0 || r.top > VH) continue
          // рисуем только то, что реально видно сверху (карточка игры за окном гардероба — не рисуем)
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          if (top !== cv) continue
          c.drawImage(cv, PX + r.left * S, PY + r.top * S, r.width * S, r.height * S)
        }
    }
    if (ripple) {
      const { x, y, p } = ripple
      c.globalAlpha = 0.85 * (1 - p)
      c.strokeStyle = '#fff'
      c.lineWidth = 7
      c.beginPath()
      c.arc(PX + x * S, PY + y * S, 18 + p * 70, 0, 7)
      c.stroke()
      c.globalAlpha = 0.6 * (1 - p * 0.6)
      c.fillStyle = '#fff'
      c.beginPath()
      c.arc(PX + x * S, PY + y * S, 15, 0, 7)
      c.fill()
      c.globalAlpha = 1
    }
    c.restore()
  }

  window.__vp.phase = 'ui'
  await sleep(400)
  let prev = await shot()
  let caption = o.intro || ''
  const hold = async (img, sec) => {
    for (let k = 0; k < Math.round(sec * FPS); k++) {
      frame(img, null, 1, caption, null)
      await push()
    }
  }
  await hold(prev, o.introHold ?? 0.9)

  for (const s of o.steps) {
    if (s.say) caption = s.say
    let ripple = null
    if (s.tap) {
      const el = s.tap()
      const r = el.getBoundingClientRect()
      ripple = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      for (let k = 0; k < 9; k++) {
        frame(prev, null, 1, caption, { ...ripple, p: k / 9 })
        await push()
      }
      if (!s.noClick) el.click()
    } else if (s.act) s.act()
    await sleep(s.wait ?? 450)
    if (s.noClick) {
      await hold(prev, s.hold ?? 0.4)
      continue
    }
    const next = await shot()
    for (let k = 1; k <= 4; k++) {
      frame(prev, next, k / 4, caption, ripple && k < 3 ? { ...ripple, p: 0.9 } : null, false)
      await push()
    }
    prev = next
    await hold(prev, s.hold ?? 0.8)
  }
  window.__vp.phase = 'ui-done'
  window.__vp.done = true
}
