// Косметика Джо — общая для всех игр и меню «Игры Джо».
// Подключается обычным <script src="look.js"> и даёт window.JoeLook.
// Координаты как в отрисовке Джо: (0,0) — ступни, смотрит вправо;
// голова x −15…17, y −62…−31; глаза около x 6…16, y −51…−44; тело x −13…13, y −32…0.
(function () {
  'use strict';
  var KEY = 'joe-look-v1';

  // ---------- примитивы (свои, чтобы не зависеть от кода игры) ----------
  function R(c, col, x, y, w, h, r) {
    c.fillStyle = col;
    if (!r) { c.fillRect(x, y, w, h); return; }
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
  }
  function P(c, col, p) { c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fill(); }
  function D(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function E(c, col, x, y, rx, ry) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }
  function eyes(c, col) { R(c, col || '#1b1b28', 6, -51, 4, 7, 1); R(c, col || '#1b1b28', 12, -51, 4, 7, 1); }
  function base(c, body, head) { R(c, body, -13, -32, 26, 32, 4); R(c, head, -15, -62, 32, 31, 7); }

  // ---------- каталог ----------
  // slot: suit (костюм целиком, вместо скина) | hat | glasses | face (лицо) | neck (шея) | back (спина) | pants
  // price — цена в гардеробе; pass — уровень пропуска (такие вещи не продаются)
  // back: true — рисуется за телом (плащ, рюкзак, крылья)
  var ITEMS = [
    // ===== шляпы =====
    { id: 'hat_cowboy', slot: 'hat', n: 'Ковбойская', price: 80, draw: function (c) {
      R(c, '#6b3f1d', -25, -65, 50, 5, 2); R(c, '#6b3f1d', -12, -78, 25, 15, 5); R(c, '#e9b23a', -12, -69, 25, 3); } },
    { id: 'hat_cap', slot: 'hat', n: 'Кепка', price: 60, draw: function (c) {
      R(c, '#e5334b', -15, -70, 32, 10, 5); R(c, '#b8243a', 10, -63, 15, 4, 2); D(c, '#fff', 1, -70, 2); } },
    { id: 'hat_beanie', slot: 'hat', n: 'Шапка', price: 70, draw: function (c) {
      R(c, '#35d6c9', -16, -72, 34, 14, 7); R(c, '#1f8f86', -16, -62, 34, 5, 2); D(c, '#fff', 1, -74, 4); } },
    { id: 'hat_bandana', slot: 'hat', n: 'Бандана', price: 90, draw: function (c) {
      R(c, '#2f7de1', -15, -62, 32, 8, 3); P(c, '#2f7de1', [-15, -60, -26, -64, -24, -54, -15, -56]);
      D(c, '#fff', -4, -58, 1.3); D(c, '#fff', 4, -58, 1.3); D(c, '#fff', 12, -58, 1.3); } },
    { id: 'hat_top', slot: 'hat', n: 'Цилиндр', price: 150, draw: function (c) {
      R(c, '#1b1b28', -21, -64, 44, 4, 2); R(c, '#1b1b28', -12, -90, 26, 27, 2); R(c, '#e5334b', -12, -70, 26, 4); } },
    { id: 'hat_ushanka', slot: 'hat', n: 'Ушанка', price: 180, draw: function (c) {
      R(c, '#6b4a2f', -18, -73, 38, 14, 6); R(c, '#c9b29a', -18, -65, 38, 6, 3);
      R(c, '#c9b29a', -20, -60, 7, 15, 3); R(c, '#c9b29a', 15, -60, 7, 15, 3); D(c, '#e9b23a', 1, -67, 2.5); } },
    { id: 'hat_sombrero', slot: 'hat', n: 'Сомбреро', price: 200, draw: function (c) {
      E(c, '#e9b23a', 1, -64, 36, 6); R(c, '#e9b23a', -11, -83, 24, 20, 9); R(c, '#e5334b', -11, -70, 24, 4);
      D(c, '#2fd08c', -5, -68, 1.5); D(c, '#2fd08c', 1, -68, 1.5); D(c, '#2fd08c', 7, -68, 1.5); } },
    { id: 'hat_propeller', slot: 'hat', n: 'Пропеллер', price: 250, draw: function (c) {
      R(c, '#ffd93d', -14, -69, 15, 9, 4); R(c, '#e5334b', 1, -69, 15, 9, 4); R(c, '#2f7de1', -14, -63, 30, 3);
      R(c, '#555', 0, -76, 2, 7); R(c, '#2fd08c', -10, -78, 22, 3, 1); } },
    { id: 'hat_viking', slot: 'hat', n: 'Викинг', price: 300, draw: function (c) {
      P(c, '#f4f4f4', [-14, -66, -27, -84, -9, -70]); P(c, '#f4f4f4', [16, -66, 29, -84, 11, -70]);
      R(c, '#8792a8', -16, -72, 34, 12, 7); R(c, '#5d6880', -16, -63, 34, 3); R(c, '#5d6880', -1, -72, 4, 10); } },

    // ===== очки =====
    { id: 'gl_sun', slot: 'glasses', n: 'Тёмные очки', price: 70, draw: function (c) {
      R(c, '#111', -15, -50, 18, 2); R(c, '#111', 3, -52, 16, 8, 2); R(c, '#3a3a50', 5, -51, 4, 2); } },
    { id: 'gl_eyepatch', slot: 'glasses', n: 'Повязка', price: 100, draw: function (c) {
      R(c, '#111', -15, -57, 32, 2); R(c, '#111', 10, -54, 8, 10, 3); } },
    { id: 'gl_aviator', slot: 'glasses', n: 'Авиаторы', price: 120, draw: function (c) {
      R(c, '#e9b23a', -15, -51, 18, 2); R(c, '#e9b23a', 3, -54, 8, 10, 4); R(c, '#e9b23a', 11, -54, 8, 10, 4);
      R(c, '#3a4a7a', 4, -53, 6, 8, 3); R(c, '#3a4a7a', 12, -53, 6, 8, 3); R(c, '#8fa5d9', 5, -52, 2, 3); } },
    { id: 'gl_3d', slot: 'glasses', n: '3D-очки', price: 130, draw: function (c) {
      R(c, '#fff', -15, -50, 18, 2); R(c, '#fff', 3, -53, 16, 9, 1); R(c, '#e5334b', 4, -52, 6, 6); R(c, '#2f7de1', 12, -52, 6, 6); } },
    { id: 'gl_monocle', slot: 'glasses', n: 'Монокль', price: 150, draw: function (c) {
      D(c, '#e9b23a', 14, -48, 6); D(c, '#cfe8ff', 14, -48, 4.3); R(c, '#1b1b28', 12, -51, 4, 7, 1); R(c, '#e9b23a', 13, -42, 2, 12); } },
    { id: 'gl_pixel', slot: 'glasses', n: 'Пиксельные', price: 200, draw: function (c) {
      R(c, '#111', -15, -51, 34, 3); R(c, '#111', 3, -51, 7, 6); R(c, '#111', 11, -51, 7, 6);
      R(c, '#fff', 4, -50, 2, 2); R(c, '#fff', 12, -50, 2, 2); } },

    // ===== штаны =====
    { id: 'pn_jeans', slot: 'pants', n: 'Джинсы', price: 60, draw: function (c) {
      R(c, '#3b5a9c', -13, -12, 26, 12, 3); R(c, '#5c2f12', -13, -13, 26, 3); R(c, '#e9b23a', -2, -13, 4, 3); R(c, '#2c4478', -1, -9, 2, 9); } },
    { id: 'pn_red', slot: 'pants', n: 'Красные', price: 80, draw: function (c) {
      R(c, '#d6334a', -13, -12, 26, 12, 3); R(c, '#9e1f33', -13, -12, 26, 3); R(c, '#9e1f33', -1, -9, 2, 9); } },
    { id: 'pn_shorts', slot: 'pants', n: 'Шорты', price: 90, draw: function (c) {
      R(c, '#c9a36b', -13, -13, 26, 8, 2); R(c, '#8a6a3a', -13, -13, 26, 2); R(c, '#8a6a3a', -1, -11, 2, 6); } },
    { id: 'pn_stripes', slot: 'pants', n: 'Полоски', price: 100, draw: function (c) {
      R(c, '#f4f4f4', -13, -12, 26, 12, 3); for (var i = -11; i < 13; i += 6) R(c, '#2f7de1', i, -12, 3, 12); } },
    { id: 'pn_plaid', slot: 'pants', n: 'Клетка', price: 110, draw: function (c) {
      R(c, '#8a3b2a', -13, -12, 26, 12, 3); R(c, '#e9b23a', -13, -8, 26, 2); R(c, '#e9b23a', -6, -12, 2, 12); R(c, '#e9b23a', 5, -12, 2, 12); } },
    { id: 'pn_camo', slot: 'pants', n: 'Камуфляж', price: 120, draw: function (c) {
      R(c, '#5f7d3b', -13, -12, 26, 12, 3); R(c, '#3f5a28', -10, -10, 8, 5, 2); R(c, '#7d9a4b', 2, -7, 8, 5, 2); R(c, '#3f5a28', 4, -12, 6, 3, 1); } },

    // ===== лицо, шея, спина =====
    { id: 'ex_mustache', slot: 'face', n: 'Усы', price: 70, draw: function (c) {
      R(c, '#3a2414', 7, -42, 12, 3, 1); R(c, '#3a2414', 5, -41, 3, 4, 1); R(c, '#3a2414', 18, -41, 3, 4, 1); } },
    { id: 'ex_bowtie', slot: 'neck', n: 'Бабочка', price: 90, draw: function (c) {
      P(c, '#e5334b', [-1, -31, -8, -35, -8, -27]); P(c, '#e5334b', [3, -31, 10, -35, 10, -27]); D(c, '#9e1f33', 1, -31, 2.2); } },
    { id: 'ex_scarf', slot: 'neck', n: 'Шарф', price: 110, draw: function (c) {
      R(c, '#e5334b', -14, -35, 28, 6, 3); R(c, '#e5334b', -14, -32, 5, 12, 2); R(c, '#fff', -14, -26, 5, 2); } },
    { id: 'ex_mask', slot: 'face', n: 'Платок на лицо', price: 120, draw: function (c) {
      P(c, '#b23a48', [-15, -43, 17, -43, 17, -36, 6, -31, -15, -36]); D(c, '#fff', 3, -39, 1.2); D(c, '#fff', 11, -39, 1.2); } },
    { id: 'ex_backpack', slot: 'back', n: 'Рюкзак', price: 180, back: true, draw: function (c) {
      R(c, '#8a4b22', -21, -30, 10, 22, 3); R(c, '#5c2f12', -21, -22, 10, 3); R(c, '#e9b23a', -18, -18, 4, 3); } },
    { id: 'ex_chain', slot: 'neck', n: 'Золотая цепь', price: 250, draw: function (c) {
      for (var i = -9; i <= 9; i += 3) D(c, '#e9b23a', i, -30 + Math.abs(i) * -0.35 + 4, 1.6); D(c, '#ffd93d', 0, -22, 3.5); D(c, '#a87b10', 0, -22, 1.5); } },

    // ===== эксклюзивы пропуска (не продаются) =====
    { id: 'pass_sheriff', slot: 'hat', n: 'Шериф', pass: 1, draw: function (c) {
      R(c, '#c98a4b', -25, -65, 50, 5, 2); R(c, '#c98a4b', -12, -79, 25, 16, 5); R(c, '#6b3f1d', -12, -69, 25, 3);
      P(c, '#ffd93d', [0, -77, 2, -73, 6, -73, 3, -70, 4, -66, 0, -68, -4, -66, -3, -70, -6, -73, -2, -73]); } },
    { id: 'pass_dollar', slot: 'glasses', n: 'Долларовые', pass: 2, draw: function (c) {
      R(c, '#2fd08c', -15, -50, 18, 2); R(c, '#2fd08c', 3, -54, 8, 10, 2); R(c, '#2fd08c', 11, -54, 8, 10, 2);
      R(c, '#0b3d26', 4, -53, 6, 8, 1); R(c, '#0b3d26', 12, -53, 6, 8, 1); R(c, '#ffd93d', 6, -53, 2, 8); R(c, '#ffd93d', 14, -53, 2, 8); } },
    { id: 'pass_goldpants', slot: 'pants', n: 'Золотые', pass: 3, draw: function (c) {
      R(c, '#ffc233', -13, -12, 26, 12, 3); R(c, '#c98a10', -13, -12, 26, 3); R(c, '#fff1a8', -9, -9, 3, 7, 1); R(c, '#c98a10', -1, -9, 2, 9); } },
    { id: 'pass_robot', slot: 'suit', n: 'Робот', pass: 4, draw: function (c) {
      base(c, '#8792a8', '#b9c2d4'); R(c, '#5d6880', -13, -20, 26, 3); R(c, '#e5334b', -6, -28, 4, 4, 1); R(c, '#35d6c9', 2, -28, 4, 4, 1);
      R(c, '#1b1b28', 4, -53, 14, 9, 2); R(c, '#35d6c9', 6, -51, 4, 5); R(c, '#35d6c9', 12, -51, 4, 5); R(c, '#5d6880', 0, -70, 2, 8); D(c, '#e5334b', 1, -71, 3); } },
    { id: 'pass_crown', slot: 'hat', n: 'Корона', pass: 5, draw: function (c) {
      P(c, '#ffc233', [-14, -61, -14, -76, -7, -67, 1, -80, 9, -67, 16, -76, 16, -61]); R(c, '#c98a10', -14, -64, 30, 3);
      D(c, '#e5334b', 1, -69, 2.5); D(c, '#35d6c9', -8, -66, 1.8); D(c, '#35d6c9', 10, -66, 1.8); } },
    { id: 'pass_cape', slot: 'back', n: 'Плащ героя', pass: 6, back: true, draw: function (c) {
      P(c, '#d6334a', [-11, -34, 9, -34, 6, -28, -14, 2, -30, 4]); P(c, '#9e1f33', [-11, -34, -6, -34, -24, 2, -30, 4]); } },
    { id: 'pass_skeleton', slot: 'suit', n: 'Скелет', pass: 7, draw: function (c) {
      base(c, '#1b1b28', '#f4f4f4'); for (var y = -28; y < -6; y += 6) R(c, '#f4f4f4', -9, y, 18, 2, 1); R(c, '#f4f4f4', -1, -30, 2, 26);
      D(c, '#1b1b28', 8, -47, 3.5); D(c, '#1b1b28', 14, -47, 3.5); P(c, '#1b1b28', [10, -42, 12, -42, 11, -39]); R(c, '#1b1b28', 6, -36, 11, 1); } },
    { id: 'pass_laser', slot: 'glasses', n: 'Лазер', pass: 8, draw: function (c) {
      c.globalAlpha = 0.35; R(c, '#ff3355', -2, -56, 26, 14, 6); c.globalAlpha = 1;
      R(c, '#1b1b28', -15, -51, 18, 3); R(c, '#ff3355', 2, -53, 18, 8, 3); R(c, '#ffb3c0', 4, -51, 12, 2); } },
    { id: 'pass_halo', slot: 'hat', n: 'Нимб', pass: 9, draw: function (c) {
      c.save(); c.lineWidth = 7; c.strokeStyle = 'rgba(255,243,176,.3)'; c.beginPath(); c.ellipse(1, -74, 13, 4, 0, 0, 7); c.stroke();
      c.lineWidth = 3.5; c.strokeStyle = '#ffd93d'; c.beginPath(); c.ellipse(1, -74, 13, 4, 0, 0, 7); c.stroke(); c.restore(); } },
    { id: 'pass_gold', slot: 'suit', n: 'Золотой Джо', pass: 10, draw: function (c) {
      base(c, '#ffc233', '#ffe680'); R(c, '#fff8d0', -12, -60, 5, 14, 2); R(c, '#c98a10', -13, -6, 26, 6, 3); eyes(c, '#5c3a00'); } },
    { id: 'pass_wings', slot: 'back', n: 'Крылья', pass: 11, back: true, draw: function (c) {
      P(c, '#f4f4f4', [-8, -28, -34, -48, -40, -30, -30, -24, -36, -14, -10, -18]); P(c, '#cfd8e8', [-10, -22, -32, -26, -36, -14, -10, -18]); } },
    { id: 'pass_shadow', slot: 'suit', n: 'Тень', pass: 12, draw: function (c) {
      base(c, '#14141f', '#14141f'); R(c, '#d6334a', -15, -58, 32, 4); P(c, '#d6334a', [-15, -58, -27, -60, -25, -52]);
      R(c, '#ff3355', 6, -50, 4, 4, 1); R(c, '#ff3355', 12, -50, 4, 4, 1); R(c, '#2a2a3d', -13, -14, 26, 2); } }
  ];

  var BY_ID = {}; ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  var SLOTS = ['suit', 'hat', 'glasses', 'face', 'neck', 'back', 'pants'];
  var PASS_LEVELS = ITEMS.filter(function (it) { return it.pass; }).sort(function (a, b) { return a.pass - b.pass; });
  // цена уровня пропуска: растёт от уровня к уровню
  function passPrice(level) { return 100 + 60 * level; }

  // ---------- сейв ----------
  function read() {
    var s = { equip: {}, owned: [], pass: 0 };
    try {
      var r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && typeof r === 'object') {
        if (r.equip && typeof r.equip === 'object') SLOTS.forEach(function (sl) { var id = r.equip[sl]; if (BY_ID[id] && BY_ID[id].slot === sl) s.equip[sl] = id; });
        if (Array.isArray(r.owned)) s.owned = r.owned.filter(function (id) { return BY_ID[id]; });
        if (Number.isInteger(r.pass) && r.pass >= 0) s.pass = Math.min(r.pass, PASS_LEVELS.length);
      }
    } catch (e) { /* битый сейв — начинаем с чистого */ }
    // экипировать можно только своё
    SLOTS.forEach(function (sl) { if (s.equip[sl] && s.owned.indexOf(s.equip[sl]) < 0) delete s.equip[sl]; });
    return s;
  }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* приватный режим */ } }

  // ---------- отрисовка ----------
  // look — { suit, hat, glasses, pants, extra } (id предметов); drawSkin(c, id) — функция игры
  function drawJoe(c, skinId, drawSkin, look) {
    look = look || current;
    var it;
    for (var i = 0; i < SLOTS.length; i++) { it = BY_ID[look[SLOTS[i]]]; if (it && it.back) it.draw(c); }
    it = BY_ID[look.suit];
    if (it) it.draw(c); else drawSkin(c, skinId);
    ['pants', 'neck', 'face', 'glasses', 'hat'].forEach(function (sl) { var x = BY_ID[look[sl]]; if (x && !x.back) x.draw(c); });
  }

  var current = read().equip;
  window.JoeLook = {
    KEY: KEY, ITEMS: ITEMS, SLOTS: SLOTS, PASS_LEVELS: PASS_LEVELS, byId: function (id) { return BY_ID[id]; },
    passPrice: passPrice, read: read, write: write, drawJoe: drawJoe,
    reload: function () { current = read().equip; return current; }
  };
})();
