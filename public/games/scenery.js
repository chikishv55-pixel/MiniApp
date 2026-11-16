// Декорации фона — общие для всех игр «Игры Джо». Подключается <script src="scenery.js"> → window.JoeScenery.
// Всё плоское, силуэтами, в цветах палитры игры — как остальная графика Джо.
(function () {
  'use strict';
  function R(c, col, x, y, w, h, r) {
    c.fillStyle = col;
    if (!r) { c.fillRect(x, y, w, h); return; }
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
  }
  function P(c, col, p) { c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fill(); }
  var hsh = function (i) { var x = Math.sin(i * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- отдельные силуэты: (x, y) — середина основания ----------
  function cactus(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    R(c, col, -6, -62, 12, 62, 6); R(c, col, -21, -46, 9, 20, 4); R(c, col, -21, -31, 18, 8, 3); R(c, col, 10, -54, 9, 22, 4); R(c, col, 3, -38, 16, 8, 3);
    c.restore();
  }
  function house(c, x, y, w, h, col, win, broken, k) {
    var l = x - w / 2;
    if (broken) {
      // разрушенный дом: рваный верх, пустые окна, балки
      P(c, col, [l, y, l, y - h * 0.7, l + w * 0.25, y - h * (0.85 + hsh(k) * 0.15), l + w * 0.45, y - h * 0.6, l + w * 0.7, y - h * (0.9 + hsh(k + 1) * 0.1), l + w, y - h * 0.5, l + w, y]);
      R(c, win, l + w * 0.2, y - h * 0.45, w * 0.18, h * 0.18); R(c, win, l + w * 0.58, y - h * 0.4, w * 0.16, h * 0.22);
      c.save(); c.translate(l + w * 0.5, y - h * 0.62); c.rotate(-0.5); R(c, col, -2, -h * 0.3, 4, h * 0.3); c.restore();
      return;
    }
    R(c, col, l, y - h, w, h);
    P(c, col, [l - 6, y - h, l + w / 2, y - h - h * 0.45, l + w + 6, y - h]);
    var cols = Math.max(1, Math.floor(w / 26)), rows = Math.max(1, Math.floor(h / 30));
    for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
      if (hsh(k * 7 + i * 3 + j) < 0.35) continue;
      R(c, win, l + 8 + i * ((w - 16) / cols), y - h + 10 + j * 30, Math.min(12, (w - 16) / cols - 6), 14);
    }
  }
  function tree(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    R(c, col, -3, -16, 6, 16);
    P(c, col, [-22, -14, 0, -46, 22, -14]); P(c, col, [-18, -32, 0, -64, 18, -32]); P(c, col, [-13, -50, 0, -80, 13, -50]);
    c.restore();
  }
  function rock(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    P(c, col, [-40, 0, -34, -48, -18, -70, 6, -62, 26, -86, 40, -50, 44, 0]);
    c.restore();
  }
  function peak(c, x, y, w, h, col, snow) {
    P(c, col, [x - w / 2, y, x, y - h, x + w / 2, y]);
    if (snow) P(c, snow, [x - w * 0.14, y - h * 0.72, x, y - h, x + w * 0.14, y - h * 0.72, x + w * 0.06, y - h * 0.66, x - w * 0.04, y - h * 0.74]);
  }
  function tower(c, x, y, w, h, col, win, k) {
    R(c, col, x - w / 2, y - h, w, h);
    R(c, col, x - 2, y - h - 18, 4, 18);
    for (var j = 0; j < Math.floor(h / 22); j++) for (var i = 0; i < Math.floor(w / 14); i++)
      if (hsh(k * 13 + i * 5 + j) > 0.5) R(c, win, x - w / 2 + 4 + i * 14, y - h + 8 + j * 22, 6, 9);
  }

  // ---------- полоса фона одного биома ----------
  // biome: desert | town | ruins | forest | canyon | snow | city
  // off — сдвиг параллакса, base — линия земли, col — цвет силуэтов, win — цвет окон/дыр
  var BIOMES = ['desert', 'town', 'forest', 'ruins', 'canyon', 'snow', 'city'];
  var NAMES = { desert: 'ПУСТЫНЯ', town: 'ГОРОДОК', forest: 'ЛЕС', ruins: 'РУИНЫ', canyon: 'КАНЬОН', snow: 'ГОРЫ', city: 'ГОРОД' };
  function layer(c, biome, off, base, col, win, W) {
    var step = { desert: 210, town: 120, forest: 70, ruins: 130, canyon: 190, snow: 230, city: 90 }[biome] || 150;
    var first = Math.floor(off / step) - 1;
    for (var i = first; i < first + Math.ceil(W / step) + 3; i++) {
      var x = i * step - off + hsh(i) * step * 0.4, r = hsh(i + 31), k = i;
      if (biome === 'desert') { if (r > 0.3) cactus(c, x, base, 0.7 + r * 0.6, col); else rock(c, x, base, 0.5 + r, col); }
      else if (biome === 'town') house(c, x, base, 70 + r * 40, 60 + hsh(i + 7) * 50, col, win, false, k);
      else if (biome === 'ruins') house(c, x, base, 70 + r * 40, 60 + hsh(i + 7) * 60, col, win, hsh(i + 3) > 0.25, k);
      else if (biome === 'forest') tree(c, x, base, 0.8 + r * 0.9, col);
      else if (biome === 'canyon') rock(c, x, base, 1.1 + r * 1.2, col);
      else if (biome === 'snow') peak(c, x, base, 220 + r * 120, 140 + r * 120, col, win);
      else if (biome === 'city') tower(c, x, base, 50 + r * 30, 110 + hsh(i + 9) * 120, col, win, k);
    }
  }

  window.JoeScenery = {
    BIOMES: BIOMES, NAMES: NAMES, layer: layer,
    cactus: cactus, house: house, tree: tree, rock: rock, peak: peak, tower: tower,
    // биом по номеру этапа (уровень, раунд, десяток вагонов) — по кругу
    biomeAt: function (n) { return BIOMES[((n % BIOMES.length) + BIOMES.length) % BIOMES.length]; }
  };
})();
