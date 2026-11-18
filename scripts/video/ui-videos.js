// Сценарии роликов про одежду (запись экрана настоящего меню). Запуск и порядок кадров — см. harness-ui.js.
//   ролики 1–2: покупка образов в гардеробе; ролики 3–5: весь пропуск Джо порциями по 4 уровня.
import { byText, item, scrollRow, tab } from './harness-ui.js'

const q = (sel) => () => document.querySelector(sel)
const wardrobe = q('.btn-cyan')
const passChip = q('.chip-pass')
const buyLevel = q('.wr-actions .btn-main-sm')
const done = byText('.wr-actions .btn', 'ГОТОВО')
const closePass = byText('.wr-actions .btn', 'ЗАКРЫТЬ')
const play = { say: 'ЖМИ PLAY — И ИГРАЙ В НОВОМ ОБРАЗЕ', tap: q('.btn-main'), noClick: true, hold: 0.4 }

// уровни пропуска (цена уровня n = 100 + 60·n, названия — как в игре)
const LEVELS = {
  1: 'ШЛЯПА ШЕРИФА', 2: 'ОБРАЗ ШЕРИФА', 3: 'ПОНЧО', 4: 'ЦИЛИНДР ФОКУСНИКА', 5: 'КАКТУС', 6: 'ПЛАЩ ГЕРОЯ',
  7: 'ГИТАРА', 8: 'ОГНЕННАЯ ШЛЯПА', 9: 'ПРИЗРАК ПРЕРИЙ', 10: 'ЗОЛОТОЙ ДЖО', 11: 'ОРЁЛ НА ПЛЕЧЕ', 12: 'ТЕНЬ',
}

function passVideo(from, to, coins, intro) {
  const steps = [{ say: 'ОТКРОЙ ПРОПУСК ДЖО', tap: passChip, hold: 0.9 }]
  for (let n = from; n <= to; n++) {
    steps.push({ say: `УРОВЕНЬ ${n} — ${LEVELS[n]}`, act: scrollRow(n), hold: 0.25, wait: 250 })
    steps.push({ say: `УРОВЕНЬ ${n} — ${LEVELS[n]}`, tap: buyLevel, hold: 0.85 })
  }
  steps.push({ say: 'ЗАКРОЙ ПРОПУСК', tap: closePass, hold: 0.5 })
  steps.push({ say: 'ВСЁ ЭТО УЖЕ НА ДЖО', tap: wardrobe, hold: 1.6 })
  steps.push({ say: 'ГОТОВО!', tap: done, hold: 0.6 })
  steps.push(play)
  return { save: { coins, pass: from - 1, equip: {} }, intro, steps }
}

export const VIDEOS = {
  cowboy: {
    game: 'canyon',
    save: { coins: 450, pass: 0, equip: {} },
    intro: 'ОДЕВАЕМ ДЖО: КОВБОЙ',
    steps: [
      { say: 'ОТКРОЙ ГАРДЕРОБ', tap: wardrobe, hold: 0.9 },
      { say: 'ВКЛАДКА «ОБРАЗЫ»', tap: tab('ОБРАЗЫ'), hold: 0.7 },
      { say: 'КОВБОЙ — 250 МОНЕТ', tap: item('Ковбой'), hold: 1.1 },
      { say: 'ДОБАВЬ ШЛЯПУ', tap: tab('ШЛЯПЫ'), hold: 0.6 },
      { say: 'СТЕТСОН — 80 МОНЕТ', tap: item('Стетсон'), hold: 1.1 },
      { say: 'И ПЛАТОК НА ШЕЮ', tap: tab('ШЕЯ'), hold: 0.6 },
      { say: 'ПЛАТОК — 70 МОНЕТ', tap: item('Шейный платок'), hold: 1.3 },
      { say: 'ГОТОВО!', tap: done, hold: 0.7 },
      play,
    ],
  },
  bandit: {
    game: 'rodeo',
    save: { coins: 700, pass: 0, equip: {} },
    intro: 'ОДЕВАЕМ ДЖО: БАНДИТ',
    steps: [
      { say: 'ОТКРОЙ ГАРДЕРОБ', tap: wardrobe, hold: 0.9 },
      { say: 'ВКЛАДКА «ОБРАЗЫ»', tap: tab('ОБРАЗЫ'), hold: 0.7 },
      { say: 'БАНДИТ — 350 МОНЕТ', tap: item('Бандит'), hold: 1.1 },
      { say: 'ЧЁРНАЯ ШЛЯПА', tap: tab('ШЛЯПЫ'), hold: 0.6 },
      { say: 'ШЛЯПА БАНДИТА — 120', tap: item('Шляпа бандита'), hold: 1.1 },
      { say: 'И ПЛАТОК НА ЛИЦО', tap: tab('ЛИЦО'), hold: 0.6 },
      { say: 'ПЛАТОК БАНДИТА — 200', tap: item('Платок бандита'), hold: 1.3 },
      { say: 'ГОТОВО!', tap: done, hold: 0.7 },
      play,
    ],
  },
  pass1: { game: 'canyon', ...passVideo(1, 4, 1100, 'ПРОПУСК ДЖО: УРОВНИ 1–4') },
  pass2: { game: 'rodeo', ...passVideo(5, 8, 2300, 'ПРОПУСК ДЖО: УРОВНИ 5–8') },
  pass3: { game: 'canyon', ...passVideo(9, 12, 3300, 'ПРОПУСК ДЖО: УРОВНИ 9–12') },
}
