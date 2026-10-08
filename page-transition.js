/*!
 * TOPSCAN — page-transition.js
 * Отдельный модуль анимации перехода между страницами: четыре шторки + логотип.
 *
 * Как подключается: generate_site.py автоматически вставляет в <head> каждой
 * страницы  <script src="/page-transition.js?v=…" data-logo="…"></script>
 * (шаблоны править не нужно). Скрипт должен стоять в <head> и без defer/async:
 * на странице-«приёмнике» он обязан закрыть экран до первой отрисовки.
 *
 * Как заменить анимацию: весь визуал собран в блоке «ЭФФЕКТ» ниже
 * (build / playCover / playLift). Остальное — логика (перехват ссылок, ожидание
 * готовности страницы, prefetch, защита от зависаний) — менять не нужно.
 * Контракт эффекта:
 *   build()          -> DOM-элемент оверлея (добавляется в <html>)
 *   playCover(o)     -> Promise, когда экран полностью закрыт
 *   playLift(o,ctx)  -> Promise, когда оверлей полностью открыл страницу;
 *                       ctx.onStart() нужно вызвать в момент, когда страница
 *                       начинает открываться (по нему стартуют интро-анимации).
 *
 * Публичное API:  window.PT.go(url) · PT.cover() · PT.reveal() · PT.onReveal(fn)
 * Событие:        document 'pt:reveal' — страница начала открываться.
 * Отключить на ссылке:  <a data-no-transition>
 */
(function () {
  'use strict';

  /* ═════════════ НАСТРОЙКИ ═════════════ */
  var CFG = {
    logo:        'https://raw.githubusercontent.com/Ramashery/Topscan/main/images/topscan_logo.png', // запасной; обычно берётся из data-logo
    size:        'min(46vw, 240px)',            // ширина логотипа
    color:       '#000',                        // цвет шторок
    columns:     4,                             // количество шторок
    durIn:       560,                           // ход шторки при закрытии, мс
    durOut:      640,                           // ход шторки при открытии, мс
    stagger:     60,                            // сдвиг между шторками, мс
    ease:        'cubic-bezier(.76,0,.24,1)',
    soft:        'cubic-bezier(.22,1,.36,1)',
    logoOut:     240,                           // уход логотипа перед подъёмом шторок, мс
    logoGap:     120,                           // пауза до старта шторок после ухода логотипа, мс
    minShow:     300,                           // минимум показа логотипа после смыкания (с учётом загрузки), мс
    readyMax:    1200,                          // максимум ожидания шрифтов / главного видео-картинки, мс
    ttl:         10000,                         // флаг перехода старше этого времени игнорируется, мс
    giveUp:      6000,                          // если переход не состоялся (скачивание, отмена) — открываем старую страницу, мс
    key:         'pt-nav',
    heroExclude: '#navDrawer, footer',          // видео/картинки отсюда не считаются «главными»
    holdIntro:   true,                          // откладывать IntersectionObserver-анимации страницы до открытия шторок
    keepNativeMorph: true                       // пару services <-> offer оставить нативному морфингу видео (View Transitions)
  };

  var script = document.currentScript;
  var LOGO = (script && script.getAttribute('data-logo')) || CFG.logo;
  var Z = 2147483000;

  var de = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ov = null, busy = false, giveTimer = 0;
  var paused = [];

  function noop() {}
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function an(el, kf, dur, delay, ease) {
    return new Promise(function (r) {
      var a = el.animate(kf, { duration: dur, delay: delay || 0, easing: ease || CFG.ease, fill: 'both' });
      a.onfinish = r; a.oncancel = r;
    });
  }
  function cols(o) { return [].slice.call(o.querySelectorAll('.c')); }

  /* ═════════════ ЭФФЕКТ (можно заменить целиком) ═════════════ */
  var bg = reduce ? '' :
    'background-image:url("' + LOGO + '");background-position:center;background-size:' + CFG.size + ' auto;background-repeat:no-repeat';

  var st = document.createElement('style');
  st.textContent =
    'html.pt-arrive::before{content:"";position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;background-color:' + CFG.color + ';' + bg + '}' +
    '.pt{position:fixed;inset:0;z-index:' + Z + ';overflow:hidden}' +
    '.pt.pt-open{pointer-events:none}' +
    '.pt i{position:absolute;display:block}' +
    '.pt .c{top:0;bottom:0;background:' + CFG.color + ';transform:translateY(100%);will-change:transform}' +
    '.pt .lg{inset:0;' + bg + '}' +
    '.pt .ln{left:50%;width:min(30vw,120px);margin-left:calc(min(30vw,120px) / -2);bottom:calc(env(safe-area-inset-bottom,0px) + 9vh);height:1px;background:rgba(255,255,255,.6);transform:scaleX(0);transform-origin:0 50%}';
  document.head.appendChild(st);

  function build() {
    var d = document.createElement('div'), h = '', N = CFG.columns;
    d.className = 'pt';
    d.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < N; i++) // +1px перекрытия, чтобы между шторками не было швов
      h += '<i class="c" style="left:' + (100 / N * i) + '%;width:calc(' + (100 / N) + '% + 1px)"></i>';
    d.innerHTML = h + '<i class="lg"></i><i class="ln"></i>';
    de.appendChild(d); // в <html>, а не в <body>: стили/блокировка скролла body не влияют на оверлей
    if (reduce) cols(d).forEach(function (c) { c.style.transform = 'translateY(0)'; });
    return d;
  }

  // Шторки по очереди поднимаются снизу и смыкаются, логотип мягко проявляется к концу.
  // При reduced-motion вместо шторок — короткое затемнение.
  function playCover(o) {
    if (reduce) return an(o, [{ opacity: 0 }, { opacity: 1 }], 160, 0, 'ease-out');
    var all = cols(o).map(function (c, i) {
      return an(c, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], CFG.durIn, i * CFG.stagger);
    });
    var t = CFG.durIn + (CFG.columns - 1) * CFG.stagger;
    all.push(an(o.querySelector('.lg'), [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], t * .55, t * .45, CFG.soft));
    return Promise.all(all);
  }

  // Пауза с тонкой линией-прогрессом (если страница быстрая — паузы нет), затем:
  // логотип уходит, шторки по очереди поднимаются вверх.
  function playLift(o, ctx) {
    o.classList.add('pt-open'); // дальше оверлей не перехватывает клики
    if (reduce) {
      ctx.onStart();
      return an(o, [{ opacity: 1 }, { opacity: 0 }], 200, 0, 'ease-out');
    }
    var hold = ctx.hold > 120
      ? Promise.all([an(o.querySelector('.ln'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], ctx.hold, 0, 'ease-in-out'), wait(ctx.hold)])
      : Promise.resolve();
    return hold.then(function () {
      setTimeout(ctx.onStart, CFG.logoGap); // интро страницы стартует вместе с первой шторкой
      var all = cols(o).map(function (c, i) {
        return an(c, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], CFG.durOut, CFG.logoGap + i * CFG.stagger);
      });
      all.push(an(o.querySelector('.lg'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px)' }], CFG.logoOut, 0, 'ease-in'));
      all.push(an(o.querySelector('.ln'), [{ opacity: 1 }, { opacity: 0 }], 200));
      return Promise.all(all);
    });
  }
  /* ═════════════ КОНЕЦ БЛОКА «ЭФФЕКТ» ═════════════ */

  // Логотип нужен раньше всего остального: просим браузер загрузить его заранее
  var img = null;
  if (!reduce) {
    var pl = document.createElement('link');
    pl.rel = 'preload'; pl.as = 'image'; pl.href = LOGO;
    document.head.appendChild(pl);
    img = new Image(); img.src = LOGO;
  }
  function logoReady() {
    return new Promise(function (r) {
      if (!img || img.complete) return r();
      img.onload = img.onerror = r; setTimeout(r, 800);
    });
  }

  /* ───────── Готовность новой страницы ───────── */
  function heroEl() {
    var h = document.querySelector('[data-pt-hero]');
    if (h) return h;
    var v = document.querySelectorAll('video'), i;
    for (i = 0; i < v.length; i++) {
      if (v[i].closest(CFG.heroExclude)) continue;
      if (v[i].currentSrc || v[i].getAttribute('src')) return v[i];
    }
    var m = document.querySelectorAll('img:not([loading="lazy"])');
    for (i = 0; i < m.length; i++) if (!m[i].closest(CFG.heroExclude)) return m[i];
    return null;
  }
  function videoReady(v) {
    return new Promise(function (r) {
      if (v.readyState >= 2) return r(); // есть первый кадр
      v.addEventListener('loadeddata', r, { once: true });
      v.addEventListener('error', r, { once: true });
    });
  }
  // Страница готова, когда загрузились шрифты и первый кадр главного видео / картинка (но не дольше readyMax)
  function pageReady() {
    var jobs = [], hero = heroEl();
    if (document.fonts && document.fonts.ready) jobs.push(document.fonts.ready.catch(noop));
    if (hero) {
      if (hero.tagName === 'VIDEO') jobs.push(videoReady(hero));
      else if (hero.decode) jobs.push(hero.decode().catch(noop));
    }
    return Promise.race([Promise.all(jobs), wait(CFG.readyMax)]);
  }

  /* ───────── Откладывание интро-анимаций страницы ─────────
     Пока шторки закрыты, анимации появления текста пропали бы впустую.
     Поэтому на странице-«приёмнике» колбэки IntersectionObserver (на них
     построены интро и .reveal в main.js) ждут, пока шторки начнут открываться.
     На обычной загрузке (без перехода) ничего не подменяется. */
  var covered = false, queue = [], NativeIO = window.IntersectionObserver;

  function holdObservers() {
    if (!NativeIO) return;
    function Held(cb, opts) {
      return new NativeIO(function (entries, obs) {
        if (covered) queue.push(function () { cb.call(obs, entries, obs); });
        else cb.call(obs, entries, obs);
      }, opts);
    }
    Held.prototype = NativeIO.prototype;
    window.IntersectionObserver = Held;
  }
  function release() {
    if (!covered) return;
    covered = false;
    if (NativeIO) window.IntersectionObserver = NativeIO; // оригинал возвращается, дальше накладных расходов нет
    var q = queue; queue = [];
    q.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } });
    try { document.dispatchEvent(new Event('pt:reveal')); } catch (e) {}
  }
  // Выполнить fn, когда страница начнёт открываться (сразу, если шторок нет)
  function onReveal(fn) { if (covered) queue.push(fn); else fn(); }

  /* ───────── Пауза видео на уходящей странице ───────── */
  function pauseMedia() {
    [].forEach.call(document.querySelectorAll('video'), function (v) {
      if (!v.paused) { v.pause(); paused.push(v); }
    });
  }
  function resumeMedia() {
    paused.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(noop); });
    paused = [];
  }

  /* ───────── Закрыть / открыть ───────── */
  function cover() {
    ov = ov || build();
    return playCover(ov);
  }
  // since: момент, когда шторки сомкнулись. Логотип держится минимум minShow от него,
  // поэтому на быстрых страницах лишней паузы нет.
  function reveal(since) {
    var o = ov;
    if (!o) { release(); return Promise.resolve(); }
    since = since || Date.now();
    return Promise.all([logoReady(), pageReady()]).then(function () {
      return playLift(o, { hold: CFG.minShow - (Date.now() - since), onStart: release });
    }).then(function () {
      o.remove(); if (ov === o) ov = null;
      release(); resumeMedia();
    });
  }

  function go(url) {
    if (busy || !document.body) return; busy = true;
    prefetch(url); // сеть работает, пока шторки закрываются
    cover().then(function () {
      pauseMedia(); // освобождаем декодер и процессор для загрузки следующей страницы
      try { sessionStorage.setItem(CFG.key, String(Date.now())); } catch (e) {}
      location.href = url;
      // Страховка: если страница не сменилась (скачивание файла, отмена), возвращаем всё как было
      giveTimer = setTimeout(function () {
        busy = false;
        try { sessionStorage.removeItem(CFG.key); } catch (e) {}
        reveal();
      }, CFG.giveUp);
    });
  }

  /* ───────── Приезд на новую страницу ───────── */
  var since = 0;
  try { since = +sessionStorage.getItem(CFG.key) || 0; sessionStorage.removeItem(CFG.key); } catch (e) {}
  if (since && Date.now() - since < CFG.ttl) {
    covered = true;
    if (CFG.holdIntro) holdObservers();
    de.classList.add('pt-arrive');
    setTimeout(function () { de.classList.remove('pt-arrive'); release(); }, 5000); // страховка
    var start = function () {
      ov = build();
      if (!reduce) cols(ov).forEach(function (c) { c.style.transform = 'translateY(0)'; });
      de.classList.remove('pt-arrive');
      reveal(since);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  /* ───────── Перехват ссылок ───────── */
  var RE_OFFER = /\/services\/[^\/?#]+\/?$/;
  var RE_CATALOG = /\/services\/?$/;
  function kind(p) { return RE_OFFER.test(p) ? 'offer' : RE_CATALOG.test(p) ? 'catalog' : null; }
  // Пара services <-> offer: в Chrome/Edge/Safari видео «перетекает» нативным View Transition
  // (см. main.js и styles.css). Шторки его бы перекрыли — отдаём эту пару браузеру.
  // Условие должно совпадать с isEligible() в main.js.
  function nativeMorph(from, to) {
    if (!CFG.keepNativeMorph || reduce || !('onpagereveal' in window)) return false;
    var a = kind(from), b = kind(to);
    return !!a && !!b && a !== b;
  }

  // Подходит ли ссылка для перехода со шторками
  function target(a) {
    if (!a || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return null;
    if (a.target && a.target !== '_self') return null;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return null;
    if (u.pathname === location.pathname && u.search === location.search) return null;      // якоря и та же страница
    if (/\.(?!html?$)[a-z0-9]{2,5}$/i.test(u.pathname)) return null;                          // pdf, zip, изображения и т. п.
    return u;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    var u = target(a);
    if (!u || nativeMorph(location.pathname, u.pathname)) return;
    e.preventDefault(); go(u.href);
  });

  /* ───────── Prefetch ───────── */
  var pf = {}, hoverTimer = 0;
  var canPrefetch = (function () {
    var l = document.createElement('link');
    return !!(l.relList && l.relList.supports && l.relList.supports('prefetch'));
  })();
  function prefetch(href) {
    var c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return; // экономия трафика
    if (pf[href]) return; pf[href] = 1;
    if (canPrefetch) {
      var l = document.createElement('link');
      l.rel = 'prefetch'; l.href = href;
      document.head.appendChild(l);
    } else if (window.fetch) {
      fetch(href, { credentials: 'same-origin' }).catch(noop); // Safari: прогрев HTTP-кэша
    }
  }
  function linkOf(e) { var a = e.target.closest && e.target.closest('a[href]'); return target(a); }
  ['pointerdown', 'touchstart'].forEach(function (t) {
    document.addEventListener(t, function (e) { var u = linkOf(e); if (u) prefetch(u.href); }, { passive: true, capture: true });
  });
  document.addEventListener('mouseover', function (e) {   // на десктопе — после небольшой задержки наведения
    var u = linkOf(e); clearTimeout(hoverTimer);
    if (u) hoverTimer = setTimeout(function () { prefetch(u.href); }, 80);
  }, { passive: true, capture: true });
  document.addEventListener('mouseout', function () { clearTimeout(hoverTimer); }, { passive: true, capture: true });

  // Возврат кнопкой «назад» из кэша браузера: страница заморожена под сомкнутыми шторками — открываем их
  addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    clearTimeout(giveTimer); busy = false;
    try { sessionStorage.removeItem(CFG.key); } catch (er) {}
    de.classList.remove('pt-arrive');
    resumeMedia();
    if (ov) reveal(Date.now() - CFG.minShow);
  });

  window.PT = { cover: cover, reveal: reveal, go: go, onReveal: onReveal };
})();
