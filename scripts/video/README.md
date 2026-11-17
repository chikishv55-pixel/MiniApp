# Ролики для Shorts / TikTok

Игры прогоняются покадрово прямо в браузере (manual-режим), кадры 1080×1920 уходят на локальный
приёмник, ffmpeg склеивает их в mp4. Записи экрана нет — картинка идеально ровная, 30 кадров/с.

## Что нужно один раз
- ffmpeg в `tools/ffmpeg/` (в git не попадает): официальная сборка с gyan.dev, хэш проверен.
- `cd scripts/video && npm install --registry=https://registry.npmjs.org` — QR и проверка QR.
- `node scripts/video/qr.mjs` — матрица QR на бота (`qr.json`).

## Устройство
- `common.js` — общее для всех роликов: плашка с ботом сверху, плашки-крючки, финальный экран с QR, отправка кадра.
- `harness.js` — ролик про поезд (бот-бегун, вертолёт, динамит).
- `harness-joe.js` — ролик про «Меткий Джо» (бот-снайпер: жмёт, когда прицел проходит через голову).
  Игра открывается как `/games/joe.html?mode=challenge&seed=<сид>&level=1&target=9`; для Джо подходит почти любой сид,
  с Магнумом бот укладывает 4 хедшота и босса за ~9 с.
- В игре есть настоящая случайность (искры, разброс очереди), поэтому кадры при повторном рендере совпадают не побитно;
  оверлеи и финальный экран совпадают точно.

## Рекламная карточка-прайс
`scripts/video/ad-card.js` рисует карточку 1080×1350 для рекламодателей (Джо с рупором, тарифы, бартер, контакты). Грузится в games/train.html:
`const m = await import('/scripts/video/ad-card.js'); const cv = await m.renderCard({ contact: '@ник', prices: [...] }); await m.sendPng(cv, 'http://127.0.0.1:8804')`
(приёмник: `node scripts/video/sink.mjs content/card 8804`; в файл попадают PNG-байты — сохранить как .png).

## Короткие ролики (~10 с)
- Поезд: `h.scanClip(seed,{from,until})` ищет сид, где бот проходит от вагона from до until; рендер с `untilCars: until` (без смерти),
  `slowFrames: 0`. Например туннели: from 14 → until 17, сид 322; вертолёт: from 44 → until 47, сид 927.
- Джо: `h.scan(seed,{preKills:1})` и `h.start({preKills:1, hideHead:true, ...})` — старт с уже убитым врагом и без слов про голову (мягкие формулировки против 18+).
- Концовка рассчитана на телефон: крупное «ищи в Telegram: @JoeGame_Bot», фраза про ссылку в шапке канала (должна быть там на самом деле!),
  QR маленький для компьютера (модуль 9 px, целые координаты — проверено декодером).
- Каждый ролик шлёт кадры на свой приёмник: `node scripts/video/sink.mjs content/frames_c1 8801` и `sink: 'http://127.0.0.1:8801'` в параметрах.

## Как снять ролик (на примере поезда)
1. Приёмник кадров: `node scripts/video/sink.mjs content/frames_test`
2. Dev-сервер на :5173, вкладка браузера 540×960 открыта на
   `/games/train.html?mode=challenge&target=5&seed=<сид>`.
3. В консоли страницы:
   ```js
   const h = await import('/scripts/video/harness.js')
   const qr = await (await fetch('/scripts/video/qr.json')).json()
   h.scan(114)   // найти сид: бот доходит до вагона dieAt, видит и сбивает вертолёт, потом ошибается
   h.start({ from: 43, dieAt: 52, hook: ['ДОБЕЖИШЬ', 'ДО 55 ВАГОНА?'], after: ['ПОБЕЙ МОЙ', 'РЕКОРД: 52'],
             afterDelay: 18, afterDeath: 70, slowFrames: 36, endSec: 3.5, qr })
   // прогресс: window.__vp
   ```
4. Сборка (цветовой диапазон tv — иначе часть плееров показывает блёклые цвета):
   ```
   ffmpeg -framerate 30 -i content/frames_test/%05d.jpg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -shortest \
     -vf "scale=in_range=pc:out_range=tv:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 17 -profile:v high \
     -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart -c:a aac -b:a 96k out.mp4
   ```
5. ОБЯЗАТЕЛЬНО проверить QR на готовом видео: вытащить кадры из последних секунд и прогнать через jsqr.
   Координаты QR должны быть целыми, иначе между модулями появляются щели и сканер не читает.

Выходные файлы лежат в `content/out/` (в git не попадают).
