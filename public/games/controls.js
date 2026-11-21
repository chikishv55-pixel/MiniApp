// Управление в играх «Игры Джо»: «зоны» (тап по половинам экрана, свайпы) или «кнопки» (экранные кнопки/джойстик).
// Настройка общая для всех игр и меню: localStorage 'joe-controls' = 'zones' | 'buttons'.
// Подключается <script src="controls.js">, даёт window.JoeControls.
(function () {
  'use strict';
  var KEY = 'joe-controls';
  function mode() { try { return localStorage.getItem(KEY) === 'buttons' ? 'buttons' : 'zones'; } catch (e) { return 'zones'; } }
  function set(m) { try { localStorage.setItem(KEY, m === 'buttons' ? 'buttons' : 'zones'); } catch (e) { /* приватный режим */ } }

  // экранная кнопка в пиксельном стиле меню: цветной квадрат, чёрная рамка, жёсткая тень; нажатая «проваливается» в тень
  // b = { x, y, w, h, col, icon, label, fs?, ls? } — координаты сцены 540×960, центр кнопки
  function draw(c, b, down) {
    var x = b.x - b.w / 2, y = b.y - b.h / 2, o = down ? 6 : 0;
    c.save();
    c.globalAlpha = 0.9;
    c.fillStyle = '#000';
    c.fillRect(x + 8, y + 8, b.w, b.h);
    c.fillStyle = b.col;
    c.fillRect(x + o, y + o, b.w, b.h);
    c.lineWidth = 5;
    c.strokeStyle = '#000';
    c.strokeRect(x + o + 2.5, y + o + 2.5, b.w - 5, b.h - 5);
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = (b.fs || 34) + 'px "Press Start 2P",monospace';
    c.fillText(b.icon, b.x + o, b.y + o - (b.label ? 14 : 0));
    if (b.label) {
      c.font = (b.ls || 12) + 'px "Press Start 2P",monospace';
      c.fillText(b.label, b.x + o, b.y + o + 28);
    }
    c.restore();
  }
  // попадание с запасом 12 px — пальцем не надо целиться пиксель в пиксель
  function hit(b, x, y) { return Math.abs(x - b.x) <= b.w / 2 + 12 && Math.abs(y - b.y) <= b.h / 2 + 12; }
  // координаты события → координаты сцены 540×960
  function toStage(cv, ev) { var r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 540, y: (ev.clientY - r.top) / r.height * 960 }; }

  window.JoeControls = { KEY: KEY, mode: mode, set: set, draw: draw, hit: hit, toStage: toStage };
})();
