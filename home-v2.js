/* =====================================================================
   HOME v2 — скролл-механики. Подключается после main.js.
   Работает поверх существующего «тяжёлого» скролла main.js: тот двигает
   реальную позицию окна (window.scrollTo), поэтому здесь достаточно
   читать window.scrollY / getBoundingClientRect и ничего не перехватывать.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce) root.classList.add('hv2-rm');

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ------------------------------------------------------------------
     1. Появление блоков (IntersectionObserver, один раз)
  ------------------------------------------------------------------ */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-hv2-io],[data-hv2-split],[data-hv2-hero]'));
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* разбить текст на слова-маски для data-hv2-split */
  function initSplit() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-hv2-split]'), function (el) {
      var text = el.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      el.setAttribute('aria-label', text);
      el.innerHTML = text.split(' ').map(function (w, i) {
        return '<span class="hv2-word" aria-hidden="true"><span style="transition-delay:' + Math.min(i * 35, 700) + 'ms">' +
          w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></span>';
      }).join(' ');
    });
  }

  /* ------------------------------------------------------------------
     2. HERO: SVG-маска, формы раскрываются по мере скролла
        (геометрия фигур взята из референса, 1360×609)
  ------------------------------------------------------------------ */
  function initHero() {
    var hero = document.querySelector('[data-hv2-hero]');
    if (!hero || reduce) return;
    var media = hero.querySelector('.hv2-hero__media');
    var textLayer = hero.querySelector('[data-hv2-herotext]');
    var inter = hero.querySelector('[data-hv2-interlude]');
    var pA = document.getElementById('hv2ShapeA');
    var pB = document.getElementById('hv2ShapeB');
    var pC = document.getElementById('hv2ShapeC');
    if (!media || !pA || !pB || !pC) return;

    var D_A = 'M722.746 0C727.164 0 730.746 3.58172 730.746 8V194.985C730.746 199.404 727.164 202.985 722.746 202.985H531.074C528.953 202.985 526.918 203.828 525.418 205.328L124.134 606.612C122.634 608.112 120.599 608.955 118.477 608.955H8C3.58172 608.955 0 605.373 0 600.955V409.283C0 407.162 0.842855 405.127 2.34315 403.627L403.627 2.34316C405.127 0.842867 407.162 0 409.283 0H722.746Z';
    var D_B = 'M730.746 600.955C730.746 605.373 727.164 608.955 722.746 608.955H535.761C531.342 608.955 527.761 605.373 527.761 600.955V413.97C527.761 409.551 531.342 405.97 535.761 405.97H722.746C727.164 405.97 730.746 409.551 730.746 413.97V600.955Z';
    var D_C = 'M1352 0C1356.42 0.000262659 1360 3.58188 1360 8V304.478C1360 472.636 1223.68 608.955 1055.52 608.955C887.363 608.955 751.044 472.636 751.044 304.478C751.044 136.319 887.363 0.000223911 1055.52 0H1352Z';
    var CEN_A = [365, 304], CEN_B = [629, 507], CEN_C = [1055.52, 304.478], HOLE_R = 101.49;
    var SW = 1360, SH = 609;

    pA.setAttribute('d', D_A);
    pB.setAttribute('d', D_B);

    function holePath(cx, cy, r) {
      if (r < 0.5) return '';
      return 'M' + (cx - r) + ',' + cy + 'A' + r + ',' + r + ',0,1,1,' + (cx + r) + ',' + cy +
             'A' + r + ',' + r + ',0,1,1,' + (cx - r) + ',' + cy + 'Z';
    }

    var W = 0, H = 0, lastP = -1, ticking = false;

    function measure() { W = media.clientWidth; H = media.clientHeight; lastP = -1; apply(); }

    function progress() {
      var r = hero.getBoundingClientRect();
      var range = hero.offsetHeight - window.innerHeight;
      return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
    }

    function apply() {
      ticking = false;
      var p = progress();
      if (p === lastP) return;
      lastP = p;

      var pad = W < 750 ? 15 : 40;
      var u = (W - pad * 2) / SW;               // базовый масштаб композиции
      var tx = pad, ty = H - pad - SH * u;      // фигуры прижаты к низу-слева
      var d = Math.max(8, W / H * 6);           // насколько фигуры вырастают к концу
      var k = 1 + Math.pow(p, 3) * d;           // рост
      var m = Math.pow(1 - p, 2);               // сжатие «отверстия» сигмы

      function tf(c) {
        return 'translate(' + tx + ',' + ty + ') scale(' + u + ') translate(' + c[0] + ',' + c[1] + ') scale(' + k + ') translate(' + (-c[0]) + ',' + (-c[1]) + ')';
      }
      pA.setAttribute('transform', tf(CEN_A));
      pB.setAttribute('transform', tf(CEN_B));
      pC.setAttribute('transform', tf(CEN_C));
      pC.setAttribute('d', D_C + ' ' + holePath(CEN_C[0], CEN_C[1], HOLE_R * m / k));

      if (textLayer) {
        var a = clamp(1 - p * 2.4, 0, 1);
        textLayer.style.opacity = a;
        textLayer.style.transform = 'translateY(' + (-p * 60) + 'px)';
        textLayer.style.pointerEvents = a < .05 ? 'none' : '';
      }
      if (inter) {
        var b = clamp((p - 0.6) / 0.25, 0, 1);
        inter.style.opacity = b;
        inter.style.transform = 'translateY(' + ((1 - b) * 30) + 'px)';
        inter.style.pointerEvents = b > .5 ? 'auto' : 'none';
      }
    }

    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    measure();
  }

  /* ------------------------------------------------------------------
     3. INDUSTRIES: pinned-секция, карточки C. 01, C. 02… едут по горизонтали
        Высота секции = ход трека + высота экрана, прогресс берётся из
        положения секции (без ScrollTrigger).
  ------------------------------------------------------------------ */
  function initCards() {
    var sec = document.querySelector('[data-hv2-cards]');
    if (!sec) return;
    var sticky = sec.querySelector('.hv2-cards__sticky');
    var track = sec.querySelector('[data-hv2-track]');
    var bar = sec.querySelector('[data-hv2-bar]');
    var items = Array.prototype.slice.call(sec.querySelectorAll('.hv2-ci'));
    if (!sticky || !track) return;

    var maxX = 0, vh = 0, lastX = null, ticking = false;

    function measure() {
      vh = sticky.clientHeight || window.innerHeight;
      maxX = Math.max(0, track.scrollWidth - window.innerWidth);
      sec.style.height = (maxX + vh) + 'px';
      lastX = null; apply();
    }
    function apply() {
      ticking = false;
      var r = sec.getBoundingClientRect();
      var range = sec.offsetHeight - vh;
      var p = range > 0 ? clamp(-r.top / range, 0, 1) : 0;
      var x = Math.round(-maxX * p * 100) / 100;
      if (x === lastX) return;
      lastX = x;
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
    measure();

    /* видео в карточках: грузим и играем только то, что в кадре */
    if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = en.target.querySelector('video[data-hv2-video]');
          if (!v) return;
          if (en.isIntersecting) {
            if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
            var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
          } else if (!v.paused) { v.pause(); }
        });
      }, { threshold: 0.25 });
      items.forEach(function (it) { vio.observe(it); });
    }
  }

  /* ------------------------------------------------------------------
     4. Крупный заголовок «по ширине контейнера» (аналог data-fit-text)
  ------------------------------------------------------------------ */
  function initFit() {
    var spans = document.querySelectorAll('[data-hv2-fit]');
    if (!spans.length) return;
    function fit() {
      Array.prototype.forEach.call(spans, function (s) {
        var box = s.parentElement;
        s.style.fontSize = '100px';
        var w = s.getBoundingClientRect().width;
        if (w > 0) s.style.fontSize = (100 * box.clientWidth / w) + 'px';
      });
    }
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    fit();
  }

  function boot() {
    try {
      initSplit();
      initReveal();
      initHero();
      initCards();
      initFit();
    } catch (e) {
      /* при любой ошибке не оставляем скрытый контент */
      root.classList.add('hv2-rm');
      if (window.console) console.error('[home-v2]', e);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
