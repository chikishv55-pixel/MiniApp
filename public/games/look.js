// Косметика Джо — общая для всех игр и меню «Игры Джо». Подключается <script src="look.js">, даёт window.JoeLook.
// Координаты как в отрисовке Джо: (0,0) — ступни, смотрит вправо;
// голова x −15…17, y −62…−31 (центр x≈1); глаза x 6…16, y −51…−44; тело x −13…13, y −32…0.
//
// Правила арта (чтобы вещи не выглядели «наклейками»):
//  • крупный силуэт — вещь меняет форму Джо и читается на 40 px;
//  • три тона: основа, тень, блик; палитра Дикого Запада;
//  • у дорогих и пропускных вещей — живая анимация (хвост, свет, дым, блеск).
(function () {
  'use strict';
  var KEY = 'joe-look-v1';
  var JKEY = 'metkiy-joe-v1';

  // ---------- примитивы ----------
  function R(c, col, x, y, w, h, r) {
    c.fillStyle = col;
    if (!r) { c.fillRect(x, y, w, h); return; }
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
  }
  function P(c, col, p) { c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fill(); }
  function D(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function E(c, col, x, y, rx, ry) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }
  function T() { return (window.performance ? performance.now() : Date.now()) / 1000; }
  function star(c, col, x, y, r) {
    var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    P(c, col, p);
  }
  function eyes(c, col) { R(c, col || '#1b1b28', 6, -51, 4, 7, 1); R(c, col || '#1b1b28', 12, -51, 4, 7, 1); }
  function head(c, col) { R(c, col || '#f4f4f4', -15, -62, 32, 31, 7); }
  // ковбойские поля: широкие, загнутые по краям
  function brim(c, col, dark, w, y) {
    w = w || 28; y = y || -62;
    E(c, dark, 1, y + 1, w, 5);
    E(c, col, 1, y, w - 1, 4);
    P(c, col, [-w + 1, y, -w - 2, y - 8, -w + 9, y - 2]);
    P(c, col, [w + 1, y, w + 4, y - 8, w - 7, y - 2]);
  }

  // ---------- каталог ----------
  // slot: suit (образ целиком, вместо скина) | hat | face | neck | back
  // price — цена в гардеробе; pass — уровень пропуска (такие вещи не продаются); back: true — рисуется за телом
  var ITEMS = [
    // ===== шляпы =====
    { id: 'hat_stetson', slot: 'hat', n: 'Стетсон', price: 80, draw: function (c) {
      brim(c, '#8a5428', '#5c3418');
      R(c, '#8a5428', -12, -82, 26, 20, 7); R(c, '#a8692f', -10, -80, 6, 16, 3);
      P(c, '#6b3f1d', [-3, -82, 1, -77, 5, -82]);
      R(c, '#3a2414', -12, -68, 26, 4); R(c, '#e9b23a', 7, -68, 4, 4, 1); } },
    { id: 'hat_black', slot: 'hat', n: 'Шляпа бандита', price: 120, draw: function (c) {
      E(c, '#0e0e14', 1, -61, 28, 5); E(c, '#1d1d26', 1, -62, 27, 4);
      R(c, '#22222c', -12, -81, 26, 19, 5); R(c, '#34343f', -10, -79, 5, 15, 2);
      R(c, '#7d8494', -12, -68, 26, 4); D(c, '#d9dde6', -6, -66, 1.8); D(c, '#d9dde6', 1, -66, 1.8); D(c, '#d9dde6', 8, -66, 1.8); } },
    { id: 'hat_white', slot: 'hat', n: 'Шляпа героя', price: 150, draw: function (c) {
      brim(c, '#efe6cf', '#c9bc98', 29);
      R(c, '#efe6cf', -12, -83, 26, 21, 8); R(c, '#fffaf0', -10, -81, 6, 16, 3);
      P(c, '#d6c9a3', [-3, -83, 1, -78, 5, -83]);
      R(c, '#2f7de1', -12, -68, 26, 5); R(c, '#9fd0ff', -12, -68, 26, 1.5); } },
    { id: 'hat_bowler', slot: 'hat', n: 'Котелок игрока', price: 160, draw: function (c) {
      E(c, '#14141c', 1, -60, 20, 3.5);
      c.beginPath(); c.fillStyle = '#26262f'; c.ellipse(1, -63, 14, 15, 0, Math.PI, 0); c.fill();
      R(c, '#5c1f2e', -13, -67, 28, 4); E(c, '#3a3a46', -5, -72, 3, 5);
      // карта за лентой
      c.save(); c.translate(11, -72); c.rotate(0.35);
      R(c, '#ffffff', -4, -9, 9, 12, 1.5); P(c, '#e5334b', [0.5, -6, 3, -3, 0.5, 0, -2, -3]);
      c.restore(); } },
    { id: 'hat_coonskin', slot: 'hat', n: 'Шапка следопыта', price: 220, draw: function (c) {
      // хвост качается
      var a = Math.sin(T() * 3.2) * 0.28;
      c.save(); c.translate(-13, -64); c.rotate(0.35 + a);
      for (var i = 0; i < 5; i++) R(c, i % 2 ? '#3a2818' : '#9a7650', -4.5, i * 7, 9, 8, 3.5);
      R(c, '#e8dcc4', -4, 34, 8, 6, 3); c.restore();
      R(c, '#8a6a4a', -16, -76, 34, 16, 8); R(c, '#a5845e', -12, -74, 10, 6, 3);
      for (var x = -12; x < 16; x += 5) R(c, '#6e5236', x, -63, 2, 4, 1); } },
    { id: 'hat_miner', slot: 'hat', n: 'Каска старателя', price: 260, draw: function (c) {
      // луч фонаря мерцает
      var a = 0.16 + Math.sin(T() * 7) * 0.05;
      P(c, 'rgba(255,240,170,' + a.toFixed(3) + ')', [19, -72, 54, -88, 54, -54, 19, -66]);
      E(c, '#c99010', 1, -61, 19, 3.5);
      c.beginPath(); c.fillStyle = '#ffc233'; c.ellipse(1, -63, 16, 15, 0, Math.PI, 0); c.fill();
      R(c, '#ffe37a', -9, -75, 5, 9, 2.5); R(c, '#d9a514', -1, -78, 4, 15, 2);
      R(c, '#dfe4ee', 11, -74, 9, 8, 2); D(c, '#fff6b0', 18, -70, 3); } },
    { id: 'hat_sombrero', slot: 'hat', n: 'Сомбреро', price: 300, draw: function (c) {
      var t = T();
      E(c, '#c9901a', 1, -61, 37, 7); E(c, '#e9b23a', 1, -63, 36, 6);
      R(c, '#e9b23a', -10, -88, 22, 26, 10); R(c, '#f6cf6a', -8, -86, 5, 20, 2.5);
      for (var i = 0; i < 5; i++) P(c, i % 2 ? '#2fd08c' : '#e5334b', [-10 + i * 4.4, -70, -7.8 + i * 4.4, -74, -5.6 + i * 4.4, -70]);
      R(c, '#e5334b', -10, -70, 22, 3);
      for (var x = -32; x <= 34; x += 9) D(c, ((x + 32) / 9) % 2 ? '#2fd08c' : '#e5334b', x, -57 + Math.sin(t * 6 + x) * 1.4, 2.4); } },

    // ===== лицо =====
    { id: 'face_mustache', slot: 'face', n: 'Усы-подкова', price: 90, draw: function (c) {
      P(c, '#3a2414', [3, -41, 11, -43, 19, -41, 20, -36, 18, -30, 16, -36, 11, -39, 6, -36, 4, -30, 2, -36]);
      R(c, '#5a3a22', 6, -42, 9, 1.5, 1); } },
    { id: 'face_shades', slot: 'face', n: 'Тёмные очки', price: 140, draw: function (c) {
      R(c, '#111117', -15, -51, 19, 2.5); R(c, '#111117', 3, -54, 16, 10, 3);
      // блик пробегает по стеклу
      var k = (T() * 0.6) % 1;
      c.save(); c.beginPath(); c.rect(3, -54, 16, 10); c.clip();
      c.globalAlpha = 0.55; P(c, '#ffffff', [3 + k * 24 - 6, -54, 3 + k * 24 - 2, -54, 3 + k * 24 - 8, -44, 3 + k * 24 - 12, -44]); c.restore();
      R(c, '#3a3a50', 5, -52, 4, 2, 1); } },
    { id: 'face_beard', slot: 'face', n: 'Борода старателя', price: 180, draw: function (c) {
      P(c, '#7a4a26', [-15, -44, -10, -42, 17, -42, 17, -34, 12, -26, 3, -22, -6, -25, -13, -31]);
      P(c, '#9a6234', [-6, -40, 12, -40, 9, -30, 2, -27, -3, -30]);
      R(c, '#5a3418', 6, -42, 11, 3, 1.5); R(c, '#f4f4f4', 9, -38, 5, 2, 1); } },
    { id: 'face_bandit', slot: 'face', n: 'Платок бандита', price: 200, draw: function (c) {
      var f = Math.sin(T() * 8) * 2;
      P(c, '#a8283a', [-15, -44, -19, -40 + f, -24, -36 + f, -17, -38]);
      P(c, '#a8283a', [-15, -42, -20, -34 - f, -24, -30 - f, -16, -35]);
      P(c, '#c8324a', [-15, -45, 17, -45, 17, -37, 4, -29, -15, -37]);
      for (var i = 0; i < 4; i++) D(c, '#fff', -9 + i * 6, -40 + (i % 2) * 3, 1.3); } },

    // ===== шея =====
    { id: 'neck_bandana', slot: 'neck', n: 'Шейный платок', price: 70, draw: function (c) {
      R(c, '#b8243a', -13, -34, 26, 5, 2);
      P(c, '#d6334a', [-11, -31, 13, -31, 3, -16]);
      D(c, '#fff', -2, -27, 1.2); D(c, '#fff', 6, -27, 1.2); D(c, '#fff', 2, -22, 1.2); D(c, '#b8243a', 1, -31, 3); } },
    { id: 'neck_lasso', slot: 'neck', n: 'Лассо на плече', price: 160, draw: function (c) {
      c.save(); c.lineWidth = 2.6;
      for (var i = 0; i < 3; i++) { c.strokeStyle = i % 2 ? '#c98f4f' : '#a8692f'; c.beginPath(); c.ellipse(-6 + i * 1.5, -20 + i, 9, 12, -0.5, 0, 7); c.stroke(); }
      c.restore(); R(c, '#8a5a2b', -14, -33, 26, 3, 1.5); } },

    // ===== образы целиком =====
    { id: 'suit_cowboy', slot: 'suit', n: 'Ковбой', price: 250, draw: function (c) {
      R(c, '#4f7fc4', -13, -32, 26, 32, 4); R(c, '#6c98d8', -4, -32, 8, 20);
      R(c, '#7a4a26', -13, -32, 8, 20, 3); R(c, '#7a4a26', 5, -32, 8, 20, 3);
      R(c, '#2f4f86', -13, -12, 26, 12, 3); R(c, '#24406e', -1, -10, 2, 10);
      R(c, '#3a2414', -13, -14, 26, 4); R(c, '#ffc233', -3, -15, 7, 6, 1.5); R(c, '#fff1a8', -2, -14, 2, 2);
      head(c); eyes(c); } },
    { id: 'suit_miner', slot: 'suit', n: 'Старатель', price: 300, draw: function (c) {
      R(c, '#b8322f', -13, -32, 26, 32, 4);
      for (var y = -30; y < -12; y += 6) R(c, '#8a2220', -13, y, 26, 2);
      for (var x = -9; x < 13; x += 7) R(c, '#8a2220', x, -32, 2, 20);
      R(c, '#3b5a9c', -13, -13, 26, 13, 3); R(c, '#2c4478', -1, -10, 2, 10); R(c, '#c9a36b', 3, -9, 7, 6, 1);
      R(c, '#3a2414', -10, -32, 4, 22); R(c, '#3a2414', 6, -32, 4, 22); D(c, '#e9b23a', -8, -14, 1.6); D(c, '#e9b23a', 8, -14, 1.6);
      head(c); eyes(c); } },
    { id: 'suit_bandit', slot: 'suit', n: 'Бандит', price: 350, back: false, draw: function (c) {
      // пыльник с полами ниже колен
      P(c, '#1a1a22', [-15, -32, 15, -32, 17, 2, 4, 2, 1, -8, -2, 2, -17, 2]);
      R(c, '#2a2a36', -15, -32, 30, 20, 4);
      P(c, '#8a2230', [-3, -32, 5, -32, 3, -14, -1, -14]);
      P(c, '#34343f', [-13, -32, -4, -32, -9, -22]); P(c, '#34343f', [15, -32, 6, -32, 11, -22]);
      R(c, '#7d8494', -13, -13, 26, 3); D(c, '#d9dde6', 1, -12, 2);
      head(c); eyes(c); } },
    { id: 'suit_gambler', slot: 'suit', n: 'Картёжник', price: 400, draw: function (c) {
      R(c, '#f2efe6', -13, -32, 26, 32, 4);
      R(c, '#6a3fa0', -13, -32, 9, 22, 3); R(c, '#6a3fa0', 4, -32, 9, 22, 3); R(c, '#8a5ac4', -12, -30, 3, 16, 1.5);
      D(c, '#ffc233', -7, -24, 1.4); D(c, '#ffc233', -7, -18, 1.4);
      c.save(); c.strokeStyle = '#ffc233'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-7, -20); c.quadraticCurveTo(0, -15, 8, -20); c.stroke(); c.restore();
      R(c, '#26262f', -13, -10, 26, 10, 3); R(c, '#14141c', -1, -9, 2, 9);
      P(c, '#d6334a', [1, -31, -6, -35, -6, -27]); P(c, '#d6334a', [1, -31, 8, -35, 8, -27]); D(c, '#9e1f33', 1, -31, 2);
      head(c); eyes(c); } },

    // ===== эксклюзивы пропуска (не продаются) =====
    { id: 'pass_sheriff', slot: 'hat', n: 'Шляпа шерифа', pass: 1, draw: function (c) {
      brim(c, '#c98a4b', '#8a5a2b', 29);
      R(c, '#c98a4b', -12, -83, 26, 21, 7); R(c, '#e0a868', -10, -81, 6, 16, 3);
      P(c, '#a06a34', [-3, -83, 1, -78, 5, -83]); R(c, '#6b3f1d', -12, -68, 26, 4);
      star(c, '#ffc233', 1, -75, 6.5); star(c, '#fff1a8', 0, -76, 2.6);
      var g = Math.max(0, Math.sin(T() * 2.5)); c.globalAlpha = g; star(c, '#ffffff', 5, -79, 2.2); c.globalAlpha = 1; } },
    { id: 'pass_vest', slot: 'suit', n: 'Шериф', pass: 2, draw: function (c) {
      R(c, '#d9b07a', -13, -32, 26, 32, 4);
      R(c, '#7a4a26', -13, -32, 9, 22, 3); R(c, '#7a4a26', 4, -32, 9, 22, 3);
      R(c, '#5c4a36', -13, -12, 26, 12, 3); R(c, '#3a2414', -13, -14, 26, 4); R(c, '#e9b23a', -3, -15, 7, 6, 1.5);
      star(c, '#ffc233', -8, -24, 6); star(c, '#fff1a8', -9, -25, 2.2);
      var g = Math.max(0, Math.sin(T() * 3 + 1)); c.globalAlpha = g; star(c, '#ffffff', -5, -28, 2); c.globalAlpha = 1;
      head(c); eyes(c); } },
    { id: 'pass_poncho', slot: 'neck', n: 'Пончо', pass: 3, draw: function (c) {
      P(c, '#c94a2a', [-17, -34, 17, -34, 21, -10, -21, -10]);
      R(c, '#ffc233', -18, -27, 36, 3); R(c, '#2fd08c', -19, -22, 38, 3); R(c, '#35d6c9', -20, -17, 40, 3);
      for (var x = -20; x < 21; x += 4) R(c, '#a83a1e', x, -10, 2, 5, 1);
      R(c, '#a83a1e', -6, -34, 14, 4, 2); } },
    { id: 'pass_magic', slot: 'hat', n: 'Цилиндр фокусника', pass: 4, draw: function (c) {
      // кролик выглядывает раз в несколько секунд
      var p = T() % 4.5, up = p < 1.2 ? Math.sin(p / 1.2 * Math.PI) * 13 : 0;
      if (up > 0.5) { R(c, '#f4f4f4', -6, -96 - up, 5, 14, 2.5); R(c, '#f4f4f4', 3, -97 - up, 5, 15, 2.5); R(c, '#ffb3c0', -5, -94 - up, 3, 9, 1.5); R(c, '#ffb3c0', 4, -95 - up, 3, 10, 1.5); }
      E(c, '#0e0e14', 1, -61, 22, 3.5);
      R(c, '#1b1b28', -12, -96, 26, 34, 2); R(c, '#2c2c3c', -10, -94, 5, 28, 1.5);
      R(c, '#7b3fe4', -12, -70, 26, 5); R(c, '#b388ff', -12, -70, 26, 1.5);
      var s = Math.max(0, Math.sin(T() * 4)); c.globalAlpha = s; star(c, '#fff3b0', 19, -90, 3); c.globalAlpha = 1 - s; star(c, '#fff3b0', -17, -80, 2.4); c.globalAlpha = 1; } },
    { id: 'pass_cactus', slot: 'suit', n: 'Кактус', pass: 5, draw: function (c) {
      R(c, '#3f9a4a', -13, -32, 26, 32, 7); R(c, '#2c7536', 5, -30, 6, 28, 3); R(c, '#6fd06b', -9, -28, 3, 22, 1.5);
      R(c, '#57b85c', -15, -64, 32, 33, 10); R(c, '#78d070', -11, -60, 4, 22, 2);
      for (var i = 0; i < 6; i++) { R(c, '#f4f8d8', -17, -56 + i * 9, 3, 1.5); R(c, '#f4f8d8', 16, -52 + i * 9, 3, 1.5); }
      D(c, '#ff6fa5', -3, -66, 4.5); D(c, '#ff6fa5', 5, -66, 4.5); D(c, '#ff6fa5', 1, -70, 4.5); D(c, '#ffd93d', 1, -66, 3);
      eyes(c, '#123d1a'); } },
    { id: 'pass_cape', slot: 'back', n: 'Плащ героя', pass: 6, back: true, draw: function (c) {
      var t = T(), w1 = Math.sin(t * 5) * 4, w2 = Math.sin(t * 5 + 1.4) * 5;
      P(c, '#9e1f33', [-11, -34, 9, -34, 4, -20, -12 + w1, 0, -26 + w2, 4, -30 + w2, -2]);
      P(c, '#d6334a', [-11, -34, 3, -34, -2, -22, -14 + w1, -2, -24 + w2, 1]);
      R(c, '#ffc233', -12, -36, 22, 4, 2); } },
    { id: 'pass_guitar', slot: 'back', n: 'Гитара', pass: 7, back: true, draw: function (c) {
      c.save(); c.translate(-12, -16); c.rotate(-0.55);
      R(c, '#5a3418', -2, -42, 4, 30, 1); R(c, '#3a2414', -3.5, -50, 7, 9, 2);
      E(c, '#b5651d', 0, -6, 10, 8); E(c, '#b5651d', 0, 6, 12, 10); E(c, '#e09550', -3, 4, 5, 4);
      D(c, '#2a1a0c', 0, -2, 3.2); R(c, '#2a1a0c', -4, 9, 8, 2); c.restore(); } },
    { id: 'pass_fire', slot: 'hat', n: 'Огненная шляпа', pass: 8, draw: function (c) {
      var t = T();
      for (var i = 0; i < 5; i++) {
        var x = -9 + i * 5, h = 10 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 12;
        P(c, i % 2 ? '#ffc233' : '#ff6b2a', [x - 4, -80, x, -80 - h, x + 4, -80]);
        P(c, '#fff3b0', [x - 1.5, -80, x, -80 - h * 0.45, x + 1.5, -80]);
      }
      brim(c, '#2a1a1a', '#140c0c', 28);
      R(c, '#3a2222', -12, -82, 26, 20, 7); R(c, '#ff6b2a', -12, -68, 26, 4); R(c, '#ffc233', -12, -68, 26, 1.5); } },
    { id: 'pass_ghost', slot: 'suit', n: 'Призрак прерий', pass: 9, draw: function (c) {
      var t = T(), fy = Math.sin(t * 3) * 2.5;
      c.save(); c.translate(0, fy); c.globalAlpha = 0.88;
      var pts = [-15, -50, -15, -2];
      for (var x = -15; x <= 17; x += 4) pts.push(x, -2 + (((x + 15) / 4) % 2 ? 4 : 0) + Math.sin(t * 6 + x) * 1.2);
      pts.push(17, -50);
      P(c, '#eef4ff', pts); R(c, '#eef4ff', -15, -64, 32, 22, 12);
      R(c, '#ffffff', -11, -60, 5, 30, 2.5);
      E(c, '#1b1b28', 9, -48, 2.6, 4); E(c, '#1b1b28', 15, -48, 2.6, 4); E(c, '#1b1b28', 12, -38, 2.4, 3);
      c.restore(); } },
    { id: 'pass_gold', slot: 'suit', n: 'Золотой Джо', pass: 10, draw: function (c) {
      R(c, '#e9a514', -13, -32, 26, 32, 4); R(c, '#ffc233', -13, -32, 20, 30, 4);
      R(c, '#ffd95c', -15, -62, 32, 31, 7); R(c, '#ffe896', -12, -59, 6, 22, 3);
      // блик пробегает по всему телу
      var k = ((T() * 0.45) % 1.6) - 0.3;
      c.save(); c.beginPath(); c.rect(-15, -62, 32, 62); c.clip(); c.globalAlpha = 0.7;
      P(c, '#ffffff', [-30 + k * 60, -64, -22 + k * 60, -64, -38 + k * 60, 2, -46 + k * 60, 2]); c.restore();
      eyes(c, '#6b4400'); } },
    { id: 'pass_eagle', slot: 'back', n: 'Орёл на плече', pass: 11, back: false, draw: function (c) {
      var p = T() % 5, flap = p < 0.8 ? Math.sin(p * 18) * 0.9 : 0;
      c.save(); c.translate(-9, -33);
      P(c, '#3a2818', [-2, 0, 8, 0, 7, -12, 0, -13]);
      c.save(); c.translate(1, -9); c.rotate(-0.4 - flap); P(c, '#5a3e26', [0, 0, -16, -4, -12, 3]); c.restore();
      R(c, '#f4f4f4', -1, -21, 10, 10, 4); P(c, '#ffc233', [8, -17, 13, -15, 8, -13]); D(c, '#1b1b28', 5, -17, 1.3);
      R(c, '#ffc233', 1, 0, 2, 3); R(c, '#ffc233', 5, 0, 2, 3); c.restore(); } },
    { id: 'pass_shadow', slot: 'suit', n: 'Тень', pass: 12, draw: function (c) {
      var t = T();
      // дым поднимается от плеч
      for (var i = 0; i < 4; i++) { var k = ((t * 0.5 + i * 0.25) % 1); c.globalAlpha = (1 - k) * 0.5; D(c, '#3a3450', -10 + i * 7 + Math.sin(t * 2 + i) * 3, -36 - k * 34, 3 + k * 5); }
      c.globalAlpha = 1;
      R(c, '#14141f', -13, -32, 26, 32, 4); R(c, '#1d1d2c', -15, -62, 32, 31, 7);
      R(c, '#2a2a40', -11, -58, 4, 20, 2);
      var g = 0.6 + Math.sin(t * 4) * 0.4;
      c.globalAlpha = 0.35 * g; D(c, '#ff3355', 8, -48, 6); D(c, '#ff3355', 14, -48, 6); c.globalAlpha = 1;
      R(c, '#ff3355', 6, -50, 4, 4, 1); R(c, '#ff3355', 12, -50, 4, 4, 1); } }
  ];

  var BY_ID = {}; ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  var SLOTS = ['suit', 'hat', 'glasses', 'face', 'neck', 'back', 'pants'];
  var PASS_LEVELS = ITEMS.filter(function (it) { return it.pass; }).sort(function (a, b) { return a.pass - b.pass; });
  function passPrice(level) { return 100 + 60 * level; }

  // старые вещи (первая коллекция) — при переходе на новую возвращаем их цену монетами
  var OLD_PRICE = { hat_cowboy: 80, hat_cap: 60, hat_beanie: 70, hat_bandana: 90, hat_top: 150, hat_ushanka: 180, hat_sombrero: 200,
    hat_propeller: 250, hat_viking: 300, gl_sun: 70, gl_eyepatch: 100, gl_aviator: 120, gl_3d: 130, gl_monocle: 150, gl_pixel: 200,
    pn_jeans: 60, pn_red: 80, pn_shorts: 90, pn_stripes: 100, pn_plaid: 110, pn_camo: 120, ex_mustache: 70, ex_bowtie: 90,
    ex_scarf: 110, ex_mask: 120, ex_backpack: 180, ex_chain: 250 };

  // ---------- сейв ----------
  function rawRead() { try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && typeof r === 'object' ? r : null; } catch (e) { return null; } }
  function read() {
    var s = { equip: {}, owned: [], pass: 0 };
    var r = rawRead();
    if (r) {
      if (r.equip && typeof r.equip === 'object') SLOTS.forEach(function (sl) { var id = r.equip[sl]; if (BY_ID[id] && BY_ID[id].slot === sl) s.equip[sl] = id; });
      if (Array.isArray(r.owned)) s.owned = r.owned.filter(function (id) { return BY_ID[id]; });
      if (Number.isInteger(r.pass) && r.pass >= 0) s.pass = Math.min(r.pass, PASS_LEVELS.length);
    }
    // открытые уровни пропуска — вещи этих уровней твои (даже если пропуск обновился)
    for (var i = 0; i < s.pass; i++) if (s.owned.indexOf(PASS_LEVELS[i].id) < 0) s.owned.push(PASS_LEVELS[i].id);
    SLOTS.forEach(function (sl) { if (s.equip[sl] && s.owned.indexOf(s.equip[sl]) < 0) delete s.equip[sl]; });
    return s;
  }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify({ equip: s.equip, owned: s.owned, pass: s.pass, v: 2 })); } catch (e) { /* приватный режим */ } }

  // один раз: вернуть монеты за вещи старой коллекции
  (function migrate() {
    var r = rawRead();
    if (!r || r.v === 2) return;
    var refund = 0;
    if (Array.isArray(r.owned)) r.owned.forEach(function (id) { if (!BY_ID[id] && OLD_PRICE[id]) refund += OLD_PRICE[id]; });
    if (refund > 0) {
      try {
        var j = JSON.parse(localStorage.getItem(JKEY) || 'null');
        if (j && typeof j === 'object') { j.coins = (j.coins | 0) + refund; localStorage.setItem(JKEY, JSON.stringify(j)); }
      } catch (e) { /* без сейва игры — нечего пополнять */ }
    }
    write(read());
  })();

  // ---------- отрисовка ----------
  function drawJoe(c, skinId, drawSkin, look) {
    look = look || current;
    var it;
    for (var i = 0; i < SLOTS.length; i++) { it = BY_ID[look[SLOTS[i]]]; if (it && it.back) it.draw(c); }
    it = BY_ID[look.suit];
    if (it) it.draw(c); else drawSkin(c, skinId);
    ['neck', 'face', 'hat', 'back'].forEach(function (sl) { var x = BY_ID[look[sl]]; if (x && !x.back) x.draw(c); });
  }

  var current = read().equip;
  window.JoeLook = {
    KEY: KEY, ITEMS: ITEMS, SLOTS: SLOTS, PASS_LEVELS: PASS_LEVELS, byId: function (id) { return BY_ID[id]; },
    passPrice: passPrice, read: read, write: write, drawJoe: drawJoe,
    reload: function () { current = read().equip; return current; }
  };
})();
