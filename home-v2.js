/* =====================================================================
   HOME v2 — сцена как на странице services:
   hero (лого по центру, видео внутри него; скролл разворачивает лого)
   -> industries (выезжает снизу, текст по шагам) -> equipment (выезжает справа, текст по шагам) -> футер.
   Подключается после main.js. main.js двигает реальную позицию окна, поэтому здесь
   достаточно читать getBoundingClientRect, ничего не перехватывая.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var animated = root.classList.contains('svs-on');   // false при prefers-reduced-motion
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function $(s) { return document.querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ------------------------------------------------------------------
     1. Деление абзацев на строки (.ln > .ln-in [+ .ln-mask]) — как на services
  ------------------------------------------------------------------ */
  function splitLines(el) {
    var src = el.getAttribute('data-src');
    if (src === null) { src = el.textContent.replace(/\s+/g, ' ').trim(); el.setAttribute('data-src', src); }
    if (!src) return;
    var wipe = el.getAttribute('data-split') === 'wipe';
    var tail = el.getAttribute('data-tail');
    el.innerHTML = src.split(' ').map(function (w) { return '<span class="hv2-w">' + esc(w) + '</span>'; }).join(' ');
    var lines = [], last = null, cur = null;
    $$('.hv2-w', el).forEach(function (w) {
      var top = Math.round(w.offsetTop);
      if (last === null || Math.abs(top - last) > 3) { cur = []; lines.push(cur); last = top; }
      cur.push(w.textContent);
    });
    if (tail) lines.push([tail]);
    el.innerHTML = lines.map(function (ws, i) {
      return '<span class="ln" style="--i:' + i + '"><span class="ln-in">' + esc(ws.join(' ')) + '</span>' +
             (wipe ? '<span class="ln-mask"></span>' : '') + '</span>';
    }).join('');
    el.setAttribute('aria-label', src + (tail ? ' ' + tail : ''));
    el.classList.add('is-split');
  }
  function initSplit() {
    var els = $$('[data-lines="auto"]');
    els.forEach(splitLines);
    var w = window.innerWidth, t = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === w) return;       // только смена ширины (не адресная строка на телефоне)
      w = window.innerWidth; clearTimeout(t);
      t = setTimeout(function () { els.forEach(splitLines); }, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { els.forEach(splitLines); });
  }

  /* ------------------------------------------------------------------
     2. HERO: лого как маска видео.
        Читаем картинку лого, находим её габариты и самую «толстую» точку (центр вписанного круга);
        скролл увеличивает лого вокруг этой точки, пока видео не заполнит экран.
        Если картинку нельзя прочитать (CORS) — маска не включается, видео показывается целиком.
  ------------------------------------------------------------------ */
  function analyzeLogo(img) {
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var res = { nw: nw, nh: nh, bx0: 0, by0: 0, bx1: nw, by1: nh, px: nw / 2, py: nh / 2, r: Math.min(nw, nh) * 0.1, lum: false };
    var sc = 160 / Math.max(nw, nh), cw = Math.max(8, Math.round(nw * sc)), ch = Math.max(8, Math.round(nh * sc));
    var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cw, ch);
    var d = cx.getImageData(0, 0, cw, ch).data;      // бросает исключение, если картинка с другого домена без CORS
    var n = cw * ch, i, opaque = 0;
    for (i = 0; i < n; i++) if (d[i * 4 + 3] > 40) opaque++;
    var lum = opaque / n > 0.95;                     // у лого нет прозрачности: форма задана яркостью
    var inside = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      inside[i] = lum ? ((d[i*4] * .3 + d[i*4+1] * .59 + d[i*4+2] * .11) > 60 ? 1 : 0) : (d[i * 4 + 3] > 40 ? 1 : 0);
    }
    var x0 = cw, y0 = ch, x1 = 0, y1 = 0, x, y;
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) if (inside[y * cw + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 <= x0 || y1 <= y0) return res;
    /* расстояние до края формы (двухпроходный chamfer) */
    var dist = new Float32Array(n), BIG = 1e6, a, b;
    for (i = 0; i < n; i++) dist[i] = inside[i] ? BIG : 0;
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      i = y * cw + x; if (!dist[i]) continue;
      a = x > 0 ? dist[i - 1] + 1 : 1; b = y > 0 ? dist[i - cw] + 1 : 1;
      dist[i] = Math.min(dist[i], a, b, (x > 0 && y > 0) ? dist[i - cw - 1] + 1.414 : 1.414, (x < cw - 1 && y > 0) ? dist[i - cw + 1] + 1.414 : 1.414);
    }
    for (y = ch - 1; y >= 0; y--) for (x = cw - 1; x >= 0; x--) {
      i = y * cw + x; if (!dist[i]) continue;
      a = x < cw - 1 ? dist[i + 1] + 1 : 1; b = y < ch - 1 ? dist[i + cw] + 1 : 1;
      dist[i] = Math.min(dist[i], a, b, (x < cw - 1 && y < ch - 1) ? dist[i + cw + 1] + 1.414 : 1.414, (x > 0 && y < ch - 1) ? dist[i + cw - 1] + 1.414 : 1.414);
    }
    var best = 0, bi = 0;
    for (i = 0; i < n; i++) if (dist[i] > best) { best = dist[i]; bi = i; }
    res.bx0 = x0 / sc; res.by0 = y0 / sc; res.bx1 = (x1 + 1) / sc; res.by1 = (y1 + 1) / sc;
    res.px = ((bi % cw) + .5) / sc; res.py = (Math.floor(bi / cw) + .5) / sc; res.r = Math.max(best, 2) / sc; res.lum = lum;
    return res;
  }

  function makeMask() {
    var media = $('#hv2Media');
    var noop = { apply: function () {} };
    if (!media) return noop;
    var url = media.getAttribute('data-logo');
    var st = { ready: false, p: 0, W: 0, H: 0, u: 1, pp: [0, 0], S: 10, g: null };
    function ready() { root.classList.add('hv2-mask-ready'); }
    if (!url) { ready(); return noop; }

    function measure() {
      if (!st.g) return;
      var g = st.g;
      st.W = media.clientWidth; st.H = media.clientHeight;
      var bw = g.bx1 - g.bx0, bh = g.by1 - g.by0;
      st.u = Math.min(st.H * 0.85 / bh, st.W * 0.85 / bw);           // лого занимает центр экрана
      var bcx = (g.bx0 + g.bx1) / 2, bcy = (g.by0 + g.by1) / 2;
      st.pp = [st.W / 2 + st.u * (g.px - bcx), st.H / 2 + st.u * (g.py - bcy)];
      var dx = Math.max(st.pp[0], st.W - st.pp[0]), dy = Math.max(st.pp[1], st.H - st.pp[1]);
      st.S = 1.2 * Math.sqrt(dx * dx + dy * dy) / (st.u * g.r);      // во сколько раз вырасти, чтобы закрыть экран
      render();
    }
    function setMask(css) {
      media.style.webkitMaskImage = css.img; media.style.maskImage = css.img;
      media.style.webkitMaskSize = css.size; media.style.maskSize = css.size;
      media.style.webkitMaskPosition = css.pos; media.style.maskPosition = css.pos;
    }
    function render() {
      if (!st.ready) return;
      var p = st.p, g = st.g;
      if (p >= 0.999) { setMask({ img: 'none', size: 'auto', pos: '0 0' }); return; }
      var k = st.u * Math.pow(st.S, p);
      setMask({
        img: 'url("' + url + '")',
        size: (g.nw * k).toFixed(1) + 'px ' + (g.nh * k).toFixed(1) + 'px',
        pos: (st.pp[0] - g.px * k).toFixed(1) + 'px ' + (st.pp[1] - g.py * k).toFixed(1) + 'px'
      });
    }

    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try { st.g = analyzeLogo(img); } catch (e) { st.g = null; }
      if (st.g) {
        if (st.g.lum) { media.style.maskMode = 'luminance'; media.style.webkitMaskSourceType = 'luminance'; }
        st.ready = true; measure();
      }
      ready();
    };
    img.onerror = ready;     // нет лого — просто показываем видео
    img.src = url;
    setTimeout(ready, 2500);
    window.addEventListener('resize', measure);
    return { apply: function (p) { st.p = p; render(); } };
  }

  /* ------------------------------------------------------------------
     3. Сцена: прогресс скролла трека -> CSS-переменные и шаги текста.
        t — положение в «экранах» от начала трека.
  ------------------------------------------------------------------ */
  var TL = {
    MASK_END: 1.0,                 // лого полностью развёрнуто
    INFO_ON: 0.85,                 // появляются описание и контакты (progress маски)
    AB_START: 1.5, AB_END: 2.4,    // экран industries выезжает снизу
    S: [2.9, 3.5, 4.1],            // шаги industries: 01, 02, 03 (шаг 0 — общий блок — появляется вместе с панелью)
    BR_START: 4.7, BR_END: 5.6,    // экран equipment выезжает справа
    F: [6.1, 6.7, 7.3]             // шаги equipment: преимущества 01, 02, 03
  };

  function makeSteps(nodes) {
    var cur = -2, timers = [];
    return function (idx) {
      if (idx === cur) return;
      cur = idx;
      nodes.forEach(function (n, k) {
        if (k === idx) {
          clearTimeout(timers[k]); n.classList.remove('is-out'); n.classList.add('is-in');
        } else if (n.classList.contains('is-in')) {
          n.classList.remove('is-in'); n.classList.add('is-out');
          clearTimeout(timers[k]);
          timers[k] = setTimeout(function () { n.classList.remove('is-out'); }, 520);
        }
      });
    };
  }

  function initScene() {
    var track = $('#hv2Track'), stage = $('#hv2Stage');
    if (!track || !stage) return;
    var title = $('#hv2Title'), info = $('#hv2Info'), brands = $('#hv2Brands');
    var applyMask = makeMask();
    var aboutSteps = makeSteps($$('#hv2About .hv2-step'));
    var featSteps = makeSteps($$('#hv2Brands .hv2-step'));
    var items = $$('#hv2Brands .svb-item'), lis = $$('#hv2Brands .hv2-li'), layers = $$('#hv2Brands .svb-layer');
    var K = parseFloat(getComputedStyle(track).getPropertyValue('--svs-k')) || 7.9;
    var ticking = false, lastSel = -2;

    function setIn(el, on) { if (el && el.classList.contains('is-in') !== on) el.classList.toggle('is-in', on); }

    function update() {
      ticking = false;
      var r = track.getBoundingClientRect(), vh = window.innerHeight;
      var t = clamp(-r.top / vh, 0, 99);

      /* hero: лого разворачивается, заголовок растворяется, затем появляются описание и контакты */
      var p = clamp(t / TL.MASK_END, 0, 1);
      applyMask.apply(p);
      if (title) {
        var a = 1 - clamp(p / 0.45, 0, 1);
        title.style.opacity = a.toFixed(3);
        title.style.filter = a < 1 ? 'blur(' + ((1 - a) * 6).toFixed(1) + 'px)' : '';
      }
      if (p >= TL.INFO_ON) setIn(info, true); else if (p < 0.55) setIn(info, false);

      /* панели */
      var ay = 100 * (1 - clamp((t - TL.AB_START) / (TL.AB_END - TL.AB_START), 0, 1));
      var bx = 100 * (1 - clamp((t - TL.BR_START) / (TL.BR_END - TL.BR_START), 0, 1));
      stage.style.setProperty('--ay', ay.toFixed(2));
      stage.style.setProperty('--bx', bx.toFixed(2));
      stage.style.setProperty('--bp', (1 - bx / 100).toFixed(4));
      stage.setAttribute('data-cover', bx < 1 ? '1' : '0');

      /* industries: общий блок -> 01 -> 02 -> 03 */
      var ai = -1;
      if (ay < 70) ai = t >= TL.S[2] ? 3 : t >= TL.S[1] ? 2 : t >= TL.S[0] ? 1 : 0;
      aboutSteps(ai);

      /* equipment: заголовок+абзац, затем преимущества по одному */
      setIn(brands, bx < 70);
      var fi = -1;
      if (bx < 70) fi = t >= TL.F[2] ? 2 : t >= TL.F[1] ? 1 : t >= TL.F[0] ? 0 : -1;
      featSteps(fi);
      lis.forEach(function (li, k) { li.classList.toggle('on', k <= fi); });
      layers.forEach(function (l, k) { l.classList.toggle('on', k === Math.max(fi, 0)); });
      if (fi !== lastSel) {
        lastSel = fi;
        items.forEach(function (it, k) { it.classList.toggle('selected', k === fi); if (k !== fi) it.style.setProperty('--p', 0); });
      }
      if (fi >= 0 && items[fi]) {
        var end = fi < 2 ? TL.F[fi + 1] : K;
        items[fi].style.setProperty('--p', clamp((t - TL.F[fi]) / (end - TL.F[fi]), 0, 1).toFixed(4));
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    /* заголовок hero: анимация «wipe» при открытии страницы (после загрузки шрифта) */
    function intro() { requestAnimationFrame(function () { setIn(title, true); }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(intro); else intro();
    setTimeout(intro, 1200);   // страховка, если шрифты не подгрузились

    update();
  }

  function boot() {
    try {
      initSplit();
      if (animated) initScene();
    } catch (e) {
      /* при любой ошибке не оставляем скрытый контент: выключаем сцену и показываем всё стопкой */
      root.classList.remove('svs-on');
      root.classList.add('hv2-mask-ready');
      $$('[data-lines]').forEach(function (n) { n.classList.add('is-split'); });
      if (window.console) console.error('[home-v2]', e);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
