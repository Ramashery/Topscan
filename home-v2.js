/* =====================================================================
   HOME v2 — сцена как на странице services:
   hero (видео в маске «t») -> industries (выезжает снизу) -> equipment (выезжает справа) -> футер.
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
     2. HERO: контур буквы «t» как маска видео. Скролл разворачивает её,
        пока видео не заполнит весь экран.
        Координаты — в системе 661×661 исходной картинки.
  ------------------------------------------------------------------ */
  var T_PATH = 'M273 82H360Q368 82 368 90V197H520Q530 197 530 207V258Q530 268 520 268H368V460A55 55 0 0 0 423 515H512Q520 515 520 523V582Q520 590 512 590H345A80 80 0 0 1 265 510V268H188Q180 268 180 260V207Q180 197 190 197H265V90Q265 82 273 82Z';
  var T_BBOX = { cx: 355, cy: 336, w: 350, h: 508 };   // габариты буквы
  var T_PIVOT = [316, 350], T_PIVOT_R = 52;            // точка внутри ножки и радиус вписанного круга

  function makeMask() {
    var media = $('#hv2Media'), path = $('#hv2ShapeT');
    if (!media || !path || !root.classList.contains('hv2-mask')) return function () {};
    path.setAttribute('d', T_PATH);
    var W = 0, H = 0, u = 1, pp = [0, 0], S = 10;
    function measure() {
      W = media.clientWidth; H = media.clientHeight;
      u = Math.min(H * 0.9 / T_BBOX.h, W * 0.9 / T_BBOX.w);      // «почти на весь экран»
      pp = [W / 2 + u * (T_PIVOT[0] - T_BBOX.cx), H / 2 + u * (T_PIVOT[1] - T_BBOX.cy)];
      var dx = Math.max(pp[0], W - pp[0]), dy = Math.max(pp[1], H - pp[1]);
      S = 1.2 * Math.sqrt(dx * dx + dy * dy) / (u * T_PIVOT_R);   // во сколько раз вырасти, чтобы закрыть экран
    }
    measure();
    window.addEventListener('resize', measure);
    return function (p) {
      var s = Math.pow(S, p);
      path.setAttribute('transform', 'translate(' + pp[0] + ',' + pp[1] + ') scale(' + (u * s) + ') translate(' + (-T_PIVOT[0]) + ',' + (-T_PIVOT[1]) + ')');
      media.classList.toggle('is-open', p >= 0.999);
    };
  }

  /* ------------------------------------------------------------------
     3. Сцена: прогресс скролла трека -> CSS-переменные и классы is-in
        t — положение в «экранах» от начала трека
  ------------------------------------------------------------------ */
  function initScene() {
    var track = $('#hv2Track'), stage = $('#hv2Stage');
    if (!track || !stage) return;
    var title = $('#hv2Title'), desc = $('#hv2Desc'), about = $('#hv2About'), brands = $('#hv2Brands');
    var applyMask = makeMask();

    /* тайминг (в экранах): маска 0–1, industries 1–2, пауза, equipment 2.4–3.4, пауза, футер */
    var MASK_END = 1.0, AB_START = 1.0, AB_END = 2.0, BR_START = 2.4, BR_END = 3.4;
    var ticking = false, brandsOn = false;

    function setIn(el, on) { if (el && el.classList.contains('is-in') !== on) el.classList.toggle('is-in', on); }

    function update() {
      ticking = false;
      var r = track.getBoundingClientRect(), vh = window.innerHeight;
      var t = clamp(-r.top / vh, 0, 99);

      var p = clamp(t / MASK_END, 0, 1);
      applyMask(p);
      /* описание появляется, когда маска раскрылась (с гистерезисом, чтобы не мигало) */
      if (p >= 0.85) setIn(desc, true); else if (p < 0.55) setIn(desc, false);

      var ay = 100 * (1 - clamp((t - AB_START) / (AB_END - AB_START), 0, 1));
      var bx = 100 * (1 - clamp((t - BR_START) / (BR_END - BR_START), 0, 1));
      stage.style.setProperty('--ay', ay.toFixed(2));
      stage.style.setProperty('--bx', bx.toFixed(2));
      stage.style.setProperty('--bp', (1 - bx / 100).toFixed(4));
      stage.style.setProperty('--lf', (1 - clamp((t - (AB_START + .35)) / .6, 0, 1)).toFixed(4));
      stage.setAttribute('data-cover', bx < 1 ? '1' : '0');

      if (ay < 70) setIn(about, true); else if (ay > 95) setIn(about, false);
      if (bx < 70) setIn(brands, true); else if (bx > 95) setIn(brands, false);
      var on = brands && brands.classList.contains('is-in');
      if (on !== brandsOn) { brandsOn = on; brandsRotate.toggle(on); }
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

  /* ------------------------------------------------------------------
     4. Equipment: смена фона и подсветка строки списка (автоход + наведение)
  ------------------------------------------------------------------ */
  var brandsRotate = (function () {
    var items = [], layers = [], cur = 0, start = 0, raf = 0, hover = false, running = false, DUR = 5000;
    function select(i) {
      cur = i; start = performance.now();
      items.forEach(function (e, k) { e.classList.toggle('selected', k === i); e.style.setProperty('--p', 0); });
      layers.forEach(function (e, k) { e.classList.toggle('on', k === i); });
    }
    function tick(now) {
      if (!running) return;
      if (!hover && items.length > 1) {
        var p = clamp((now - start) / DUR, 0, 1);
        items[cur].style.setProperty('--p', p.toFixed(4));
        if (p >= 1) select((cur + 1) % items.length);
      } else { start = now - (parseFloat(items[cur] && items[cur].style.getPropertyValue('--p')) || 0) * DUR; }
      raf = requestAnimationFrame(tick);
    }
    function init() {
      items = $$('.svb-item'); layers = $$('.svb-layer');
      items.forEach(function (e, i) {
        e.addEventListener('pointerenter', function () { hover = true; select(i); });
        e.addEventListener('pointerleave', function () { hover = false; });
        e.addEventListener('click', function () { select(i); });
        e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(i); } });
      });
      start = performance.now();
    }
    return {
      init: init,
      toggle: function (on) {
        if (on === running) return;
        running = on;
        if (on) { start = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
      }
    };
  })();

  function boot() {
    try {
      initSplit();
      brandsRotate.init();
      if (animated) initScene();
    } catch (e) {
      /* при любой ошибке не оставляем скрытый контент: выключаем сцену и показываем всё стопкой */
      root.classList.remove('svs-on', 'hv2-mask');
      $$('.is-split, [data-lines]').forEach(function (n) { n.classList.add('is-split'); });
      if (window.console) console.error('[home-v2]', e);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
