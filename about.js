/* =========================================================
   ABOUT PAGE — intro hero, shared-element video flight,
   and the WebGL wireframe background.

   Loaded only by tpl_about.html, AFTER main.js. main.js already
   handles everything the page shares with the rest of the site, so
   none of it is repeated here:
     · mobile drawer + body-scroll lock      · .reveal blocks
     · h2 / h3 zipper                        · footer + drawer contact bursts
     · weighted wheel scroll                 · [data-parallax] photo windows
     · sliding the background away as the footer approaches
       (it re-measures on every scroll/resize event)

   Only what is unique to /about is here:
     1. hero -> overview flight of the single <video> + logo
     2. the overview text sequence (breadcrumb -> title -> subtitle)
     3. parallax for the landed video window
     4. the WebGL wireframe drawn into #abBgCanvas
========================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var stageMain = $('#abStageMain');
  var shared = $('#abShared'), vid = $('#abVideo'), heroLogo = $('#abLogo');
  var slotMain = $('#abSlotMain');
  if (!stageMain || !shared || !vid || !slotMain) return;

  /* 'hero' while the intro is showing, 'about' once the page is shown */
  var stage = root.classList.contains('about-intro') ? 'hero' : 'about';
  var busy = false;                    /* true while the video is flying */

  /* same figures as the parallax block in main.js */
  var STRENGTH = 60, SCALE = 1.12;

  /* ---------- Text engines (same technique as main.js) ---------- */
  var EB_DIRS = [ {x:-120,y:0}, {x:120,y:0}, {x:0,y:-90}, {x:0,y:90}, {x:-100,y:-60}, {x:100,y:60} ];

  function edgeSplitWords(el) {
    el.innerHTML = el.textContent.split(' ').map(function (w) {
      return '<span data-eb style="display:inline-block;">' + w + '</span>';
    }).join(' ');
    return Array.prototype.slice.call(el.querySelectorAll('[data-eb]'));
  }
  function prepareEdgeBurstRandom(spans, maxDelay) {
    spans.forEach(function (span) {
      var d = EB_DIRS[Math.floor(Math.random() * EB_DIRS.length)];
      span.style.setProperty('--ex', (d.x + (Math.random() * 40 - 20)).toFixed(0) + 'px');
      span.style.setProperty('--ey', (d.y + (Math.random() * 30 - 15)).toFixed(0) + 'px');
      span.style.animationDelay = (Math.random() * maxDelay).toFixed(0) + 'ms';
    });
  }
  function zipSplit(el, segmentSelector) {
    var lines = el.querySelectorAll(segmentSelector || '.hero-line');
    var source = lines.length ? Array.prototype.slice.call(lines) : [el];
    var counter = 0;
    source.forEach(function (line) {
      line.innerHTML = line.textContent.split(' ').map(function (word) {
        var w = '';
        for (var i = 0; i < word.length; i++) { w += '<span data-zip style="--zi:' + counter + '">' + word.charAt(i) + '</span>'; counter++; }
        return '<span class="zip-word">' + w + '</span>';
      }).join(' ');
    });
    el.setAttribute('data-zip-ready', '1');
    return counter;
  }
  function playZip(el)   { el.classList.remove('zip-play'); void el.offsetWidth; el.classList.add('zip-play'); }
  function playBurst(el) { el.classList.remove('eb-play');  void el.offsetWidth; el.classList.add('eb-play'); }
  function resetBurst(el){ el.classList.remove('eb-play'); }

  /* ---------- Overview text: breadcrumb -> title -> subtitle ---------- */
  var introEl = $('#abIntro'), titleEl = $('#abTitle'), subEl = $('#abSub'), crumbEl = $('#abCrumb');
  var titleDuration = 850, textTimers = [];

  if (!reduceMotion) {
    if (crumbEl) {
      Array.prototype.slice.call(crumbEl.children).forEach(function (ch) { ch.classList.add('zip-segment'); });
      zipSplit(crumbEl, '.zip-segment');
    }
    if (titleEl) titleDuration = zipSplit(titleEl) * 22 + 700 + 150;
    if (subEl)   prepareEdgeBurstRandom(edgeSplitWords(subEl), 220);
  }

  function playAboutText() {
    if (introEl) introEl.classList.add('is-visible');
    if (reduceMotion) return;
    textTimers.forEach(clearTimeout); textTimers = [];
    if (crumbEl) playZip(crumbEl);
    if (titleEl) playZip(titleEl);
    if (subEl) { resetBurst(subEl); textTimers.push(setTimeout(function () { playBurst(subEl); }, titleDuration)); }
  }

  /* =====================================================================
     SHARED-ELEMENT TRANSITION
       1. the hero video loops; HERO_MS after playback starts the flight begins
       2. lift(): the wrapper (video + logo) goes position:fixed exactly over the hero
       3. hero overlay (breadcrumb, scrim, corners) fades out;
          the logo stays inside the wrapper and shrinks with it
       4. swap(): intro hidden, page shown underneath the video
       5. the wrapper animates left/top/width/height to #abSlotMain
          (the <video> also eases into the parallax scale/offset, so there is
          no jump when the parallax loop takes over)
       6. land(): the wrapper drops into the slot; same <video>, playback continues
     ===================================================================== */
  var EASE = 'cubic-bezier(.76, 0, .24, 1)';
  var EASE_IN = 'cubic-bezier(.5, 0, .75, 0)';
  var HERO_MS = 7000;                              /* intro time before the shrink */
  var flightMs = function () { return innerWidth >= 1000 ? 1200 : 1000; };
  var px = function (n) { return n + 'px'; };
  var heroItems = Array.prototype.slice.call(document.querySelectorAll('#abStageHero [data-out]'));

  if (heroLogo) heroLogo.addEventListener('animationend', function () { heroLogo.style.animation = 'none'; });

  /* Logo width -> % of the video window, so it scales with the window during the flight
     (offsetWidth ignores the intro animation's transform) */
  function fixLogoRatio() {
    var w = shared.offsetWidth;
    if (heroLogo && w) heroLogo.style.width = (heroLogo.offsetWidth / w * 100).toFixed(3) + '%';
    if (heroLogo) heroLogo.style.animation = 'none';
  }

  function moveNode(node, parent) {
    var moved = false;
    if (typeof parent.moveBefore === 'function') { try { parent.moveBefore(node, null); moved = true; } catch (_) {} }
    if (!moved) parent.appendChild(node);
    setTimeout(function () { if (vid.paused && !vid.ended) vid.play().catch(function () {}); }, 0);
  }
  function animOut() {
    return Promise.all(heroItems.map(function (el, i) {
      return el.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 340, delay: Math.min(i, 6) * 28, easing: EASE_IN, fill: 'forwards' }
      ).finished.catch(function () {});
    }));
  }
  function lift() {
    fixLogoRatio();
    var rect = shared.getBoundingClientRect();
    moveNode(shared, document.body);
    Object.assign(shared.style, {
      position: 'fixed', inset: 'auto',
      left: px(rect.left), top: px(rect.top), width: px(rect.width), height: px(rect.height),
      zIndex: 2, pointerEvents: 'none'
    });
    return rect;
  }
  function land() {
    moveNode(shared, slotMain);
    shared.getAnimations().forEach(function (a) { a.cancel(); });
    shared.removeAttribute('style');
    stageMain.classList.add('is-landed');
  }
  function swap() {
    heroItems.forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
    root.classList.remove('about-intro');
    stage = 'about';
    window.scrollTo(0, 0);
    /* main.js repositions the page background from scroll/resize events */
    window.dispatchEvent(new Event('scroll'));
  }
  /* playback is never restarted: the same <video> just keeps going */
  function keepPlaying() {
    vid.loop = true;
    if (vid.paused) vid.play().catch(function () {});
  }
  function parallaxEnd(rect) {
    var off = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
    return 'translateY(' + (-off * STRENGTH).toFixed(2) + 'px) scale(' + SCALE + ')';
  }

  async function goAbout() {
    if (busy || stage !== 'hero') return;
    busy = true;
    clearTimeout(heroTimer);
    try {
      if (reduceMotion) { fixLogoRatio(); swap(); land(); keepPlaying(); playAboutText(); return; }

      var first = lift();
      await animOut();
      swap();
      var last = slotMain.getBoundingClientRect();
      var dur = flightMs();
      var endT = parallaxEnd(last);

      keepPlaying();
      var flight = shared.animate([
        { left: px(first.left), top: px(first.top), width: px(first.width), height: px(first.height) },
        { left: px(last.left),  top: px(last.top),  width: px(last.width),  height: px(last.height) }
      ], { duration: dur, easing: EASE, fill: 'both' });
      var vFlight = vid.animate([
        { transform: 'translateY(0px) scale(1)' }, { transform: endT }
      ], { duration: dur, easing: EASE, fill: 'both' });

      setTimeout(playAboutText, dur * 0.5);      /* text enters at mid-flight */
      await flight.finished;

      vid.style.transform = endT;                /* hand over to the parallax loop below */
      vFlight.cancel();
      land();
    } catch (err) {
      console.error(err);
      if (stage !== 'about') swap();
      land(); keepPlaying(); playAboutText();
    } finally {
      busy = false;
    }
  }

  /* intro -> page triggers: HERO_MS after playback starts, or the visitor scrolls / swipes / presses ↓ */
  var heroTimer = null;
  function armHeroTimer() { if (!heroTimer && stage === 'hero') heroTimer = setTimeout(goAbout, HERO_MS); }
  vid.addEventListener('playing', armHeroTimer, { once: true });
  setTimeout(armHeroTimer, 4000);            /* autoplay blocked / very slow start: don't wait forever */
  vid.addEventListener('error', goAbout);
  window.addEventListener('wheel', function (e) { if (stage === 'hero' && e.deltaY > 4) goAbout(); }, { passive: true });

  /* while the video is flying, swallow wheel input BEFORE main.js's weighted-scroll handler sees it */
  window.addEventListener('wheel', function (e) {
    if (busy) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, { passive: false, capture: true });

  var touchY0 = null;
  window.addEventListener('touchstart', function (e) { touchY0 = e.touches.length ? e.touches[0].clientY : null; }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (busy) { e.preventDefault(); return; }
    if (stage === 'hero' && touchY0 !== null && e.touches.length && touchY0 - e.touches[0].clientY > 28) { touchY0 = null; goAbout(); }
  }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (stage === 'hero' && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'End')) { e.preventDefault(); goAbout(); }
    else if (busy && (e.key === ' ' || e.key.indexOf('Arrow') === 0 || e.key.indexOf('Page') === 0)) e.preventDefault();
  });
  window.addEventListener('scroll', function () { if (busy && window.scrollY > 0) window.scrollTo(0, 0); }, { passive: true });
  /* autoplay blocked (e.g. low-power mode): first touch starts the video */
  window.addEventListener('pointerdown', function () { if (stage === 'hero' && vid.paused && !vid.ended) vid.play().catch(function () {}); }, { passive: true });
  vid.play().catch(function () {});

  /* ---------- Start state ---------- */
  if (stage === 'about') {
    /* no intro (reduced motion / #anchor): the page is already showing, so land the video straight
       into its window. The logo ratio is measured against the intro layout, which is display:none
       in this mode — show it for one synchronous measurement (no paint happens in between). */
    var y0 = window.pageYOffset || 0;
    root.classList.add('about-intro');
    fixLogoRatio();
    root.classList.remove('about-intro');
    if (y0) window.scrollTo({ top: y0, left: 0, behavior: 'instant' });

    land(); keepPlaying(); playAboutText();

    var hashTarget = null;
    try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch (_) {}
    if (hashTarget) setTimeout(function () { hashTarget.scrollIntoView({ behavior: 'instant' }); }, 0);
  }

  /* ---------- Parallax for the landed video window ----------
     main.js parallaxes the team photos ([data-parallax]); this window is empty at load
     (the video arrives by flight), so it gets its own small loop. */
  (function () {
    if (reduceMotion) return;
    var visible = false, raf = null;
    function tick() {
      if (vid.parentNode === slotMain) {
        var rect = slotMain.getBoundingClientRect();
        var offset = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
        vid.style.willChange = 'transform';
        vid.style.transform = 'translateY(' + (-offset * STRENGTH).toFixed(2) + 'px) scale(' + SCALE + ')';
      }
      raf = visible ? requestAnimationFrame(tick) : null;
    }
    function ensureLoop() { if (visible && raf === null) raf = requestAnimationFrame(tick); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        ensureLoop();
      }, { rootMargin: '20% 0px' }).observe(slotMain);
    } else { visible = true; ensureLoop(); }
    window.addEventListener('resize', ensureLoop);
  })();
})();

/* =========================================================
   TEAM — mobile profile cards <-> full-screen profile
   (≤900px only; on wider screens the profiles stay as blocks)

   Tap a card: the photo lifts out of the grid (position:fixed, same
   size/place) and its left/top/width/height animate to the full
   viewport — the same technique as the intro video shrinking into the
   overview window, run in the other direction. It then lands inside a
   scrolling layer: first screen = the photo with name + role at the
   bottom; scrolling carries the photo up and the page background with
   the bio and the Back button comes in below.
   Back (button, Android back, Escape) reverses it. The tap also adds a
   history entry, so the system Back returns to the grid instead of
   leaving the page.
========================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var mq = window.matchMedia ? window.matchMedia('(max-width: 900px)') : { matches: false };

  var stageMain = $('#abStageMain');
  var detail = $('#abDetail'), scroller = $('#abDetailScroll'), track = $('#abDetailTrack'), hero = $('#abDetailHero'), backBtn = $('#abBack');
  var nameEl = $('#abDetailName'), roleEl = $('#abDetailRole'), bioEl = $('#abDetailBio');
  var articles = Array.prototype.slice.call(document.querySelectorAll('.team-member'));
  if (!stageMain || !detail || !scroller || !track || !hero || !backBtn || !articles.length) return;

  var EASE = 'cubic-bezier(.76, 0, .24, 1)';           /* same curve as the intro flight */
  var DURATION = 900;
  var px = function (n) { return n + 'px'; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var cur = null;          /* { article, photo, ph, btn, pushed } while a profile is open */
  var busy = false;        /* true while a photo is flying */
  var wantClose = false;   /* Back pressed mid-flight: close as soon as it lands */

  function fill(article) {
    var name = article.getAttribute('data-name') || '';
    nameEl.textContent = name;
    roleEl.textContent = article.getAttribute('data-role') || '';
    roleEl.hidden = !roleEl.textContent;
    bioEl.textContent = '';
    Array.prototype.forEach.call(article.querySelectorAll('.member-bio p'), function (p) {
      var n = document.createElement('p'); n.textContent = p.textContent; bioEl.appendChild(n);
    });
    detail.setAttribute('aria-label', name);
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function frame(r) { return { left: px(r.left), top: px(r.top), width: px(r.width), height: px(r.height) }; }
  function clearBox(el) { el.style.left = el.style.top = el.style.width = el.style.height = ''; }

  /* Same numbers as main.js's photo parallax (the card photos use it): the image inside the box is
     scaled up a little and shifted by how far the box sits from the screen centre. */
  var STRENGTH = 60, SCALE = 1.12;
  function parallaxAt(rect) {
    var off = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
    return 'translateY(' + (-off * STRENGTH).toFixed(2) + 'px) scale(' + SCALE + ')';
  }

  /* Flies the box AND eases the image inside it between its two transforms, so the picture never
     snaps (card: parallax-scaled 1.12x  <->  full screen: plain fit) when the box changes state. */
  async function fly(photo, from, to, imgFrom, imgTo) {
    if (reduceMotion) return;
    try {
      var opts = { duration: DURATION, easing: EASE, fill: 'both' };
      var img = photo.querySelector('img');
      var a = photo.animate([frame(from), frame(to)], opts);
      var b = img ? img.animate([{ transform: imgFrom }, { transform: imgTo }], opts) : null;
      await Promise.all([a.finished, b ? b.finished : null]);
      a.cancel(); if (b) b.cancel();
    } catch (_) {}
  }

  /* ---------- Viscous scroll for the open profile ----------
     The layer isn't natively scrollable. Like the reference file, touch / wheel / keys only move a
     TARGET position and the layer trails it with exponential easing — heavy and soft, with no
     stepping when the finger stops. Stickier than the reference (0.04 per 60 fps frame vs 0.05).
     Easing is frame-rate independent, and the position is snapped to whole device pixels so text
     never shimmers as it settles. */
  var EASE_60 = reduceMotion ? 1 : 0.04;               /* share of the remaining distance covered per 60 fps frame */
  var TOUCH_GAIN = 1.6;                                /* finger px -> target px */
  var WHEEL_GAIN = 1;
  var FLING_MS = 240, FLING_MIN = 0.12, FLING_MAX = 900;   /* release velocity (px/ms) carries the target a little further */

  var sc = { target: 0, current: 0, max: 0, raf: 0, last: 0, touching: false, y: 0, t: 0, v: 0 };

  function clampY(v) { return Math.min(Math.max(0, v), sc.max); }
  function measure() {
    sc.max = Math.max(0, track.offsetHeight - scroller.clientHeight);
    sc.target = clampY(sc.target);
    if (sc.current > sc.max) sc.current = sc.max;
  }
  function paint() {
    var dpr = window.devicePixelRatio || 1;
    var y = Math.round(sc.current * dpr) / dpr;
    track.style.transform = 'translate3d(0,' + (-y) + 'px,0)';
  }
  function tick(now) {
    sc.raf = 0;
    var dt = sc.last ? Math.min(50, now - sc.last) : 16.667;
    sc.last = now;
    var k = 1 - Math.pow(1 - EASE_60, dt / 16.667);
    var d = sc.target - sc.current;
    if (Math.abs(d) < 0.1) sc.current = sc.target; else sc.current += d * k;
    paint();
    if (sc.current !== sc.target) sc.raf = requestAnimationFrame(tick); else sc.last = 0;
  }
  function kick() { if (!sc.raf) { sc.last = 0; sc.raf = requestAnimationFrame(tick); } }
  function resetScroll() {
    if (sc.raf) { cancelAnimationFrame(sc.raf); sc.raf = 0; }
    sc.target = sc.current = 0; sc.last = 0; sc.touching = false;
    paint();
  }
  /* short, firm glide back to the first screen before the photo flies home (the viscous easing would take seconds) */
  function glideToTop(ms) {
    return new Promise(function (resolve) {
      if (sc.raf) { cancelAnimationFrame(sc.raf); sc.raf = 0; }
      sc.touching = false;
      var y0 = sc.current;
      if (y0 < 2) { resetScroll(); resolve(); return; }
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        sc.current = sc.target = y0 * (1 - e);
        paint();
        if (k < 1) requestAnimationFrame(step); else { resetScroll(); resolve(); }
      })(t0);
    });
  }
  function live() { return cur && !busy; }

  scroller.addEventListener('wheel', function (e) {
    if (!live()) return;
    e.preventDefault(); e.stopPropagation();           /* .member-detail is also excluded in main.js's own engine — this is belt-and-braces */
    measure();
    sc.target = clampY(sc.target + e.deltaY * WHEEL_GAIN);
    kick();
  }, { passive: false });

  scroller.addEventListener('touchstart', function (e) {
    if (!live() || !e.touches.length) return;
    e.stopPropagation();
    measure();
    sc.touching = true; sc.y = e.touches[0].clientY; sc.t = performance.now(); sc.v = 0;
  }, { passive: true });

  scroller.addEventListener('touchmove', function (e) {
    if (!live() || !sc.touching || !e.touches.length) return;
    e.preventDefault(); e.stopPropagation();
    var y = e.touches[0].clientY, now = performance.now();
    var dy = (sc.y - y) * TOUCH_GAIN, dt = Math.max(1, now - sc.t);
    sc.v = sc.v * 0.7 + (dy / dt) * 0.3;               /* smoothed release velocity, px/ms */
    sc.y = y; sc.t = now;
    sc.target = clampY(sc.target + dy);
    kick();
  }, { passive: false });

  function touchEnd() {
    if (!sc.touching) return;
    sc.touching = false;
    var v = (performance.now() - sc.t > 80) ? 0 : sc.v;  /* finger rested before lifting: no fling */
    if (Math.abs(v) > FLING_MIN) sc.target = clampY(sc.target + Math.max(-FLING_MAX, Math.min(FLING_MAX, v * FLING_MS)));
    kick();
  }
  scroller.addEventListener('touchend', function (e) { e.stopPropagation(); touchEnd(); }, { passive: true });
  scroller.addEventListener('touchcancel', function (e) { e.stopPropagation(); touchEnd(); }, { passive: true });

  function onKey(e) {
    if (!live()) return false;
    var page = scroller.clientHeight * 0.85, d = null;
    if (e.key === 'ArrowDown') d = 90;
    else if (e.key === 'ArrowUp') d = -90;
    else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) d = page;
    else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) d = -page;
    else if (e.key === 'End') d = sc.max;
    else if (e.key === 'Home') d = -sc.max;
    if (d === null) return false;
    if (document.activeElement === backBtn && (e.key === ' ')) return false;   /* Space presses the focused Back button */
    e.preventDefault(); measure();
    sc.target = clampY(sc.target + d); kick();
    return true;
  }

  async function openMember(article, opts) {
    opts = opts || {};
    if (cur || busy || !mq.matches) return;
    var photo = article.querySelector('.member-photo');
    if (!photo) return;
    busy = true; wantClose = false;

    var from = rectOf(photo);
    var photoImg = photo.querySelector('img');
    var imgFrom = photoImg ? getComputedStyle(photoImg).transform : 'none';   /* what the card shows right now */
    var ph = document.createElement('div');
    ph.className = 'member-photo-ph';
    ph.style.width = px(from.width); ph.style.height = px(from.height);
    photo.parentNode.insertBefore(ph, photo);

    cur = { article: article, photo: photo, ph: ph, btn: article.querySelector('.member-open'), pushed: false };

    fill(article);
    document.body.appendChild(photo);
    photo.classList.add('is-flying');
    Object.assign(photo.style, frame(from));
    stageMain.inert = true;
    if (window.__lockBodyScroll) window.__lockBodyScroll();

    if (!opts.instant) {
      try { history.pushState({ abMember: article.id }, '', '#' + article.id); cur.pushed = true; } catch (_) {}
    }

    if (!opts.instant) await fly(photo, from, { left: 0, top: 0, width: innerWidth, height: innerHeight }, imgFrom, 'none');

    /* land inside the scrolling layer (one task: no frame is painted in between) */
    clearBox(photo);
    detail.hidden = false;
    detail.style.setProperty('--ab-h', scroller.clientHeight + 'px');
    resetScroll();
    hero.insertBefore(photo, hero.firstChild);
    photo.classList.remove('is-flying');
    photo.classList.add('is-in-detail');
    stageMain.style.visibility = 'hidden';              /* what shows behind the bio is the site's own background */
    root.classList.add('ab-detail-open');               /* …held fully in place (see CSS): main.js would otherwise slide it away for the hidden footer */

    measure();
    void detail.offsetWidth;                            /* let the fade-in transitions run */
    detail.classList.add('is-open');
    scroller.focus({ preventScroll: true });
    busy = false;
    if (wantClose) closeMember();
  }

  async function closeMember(opts) {
    opts = opts || {};
    if (!cur) return;
    if (busy) { wantClose = true; return; }
    busy = true;
    var c = cur, photo = c.photo;

    detail.classList.remove('is-open');
    if (!opts.instant && !reduceMotion) await Promise.all([glideToTop(320), wait(260)]);
    else resetScroll();

    /* restore the page (and its scroll position) BEFORE measuring where the card is */
    if (window.__unlockBodyScroll) window.__unlockBodyScroll();
    stageMain.style.visibility = '';
    root.classList.remove('ab-detail-open');
    stageMain.inert = false;

    var from = rectOf(photo), to = rectOf(c.ph);
    var closeImg = photo.querySelector('img');
    var imgFrom = closeImg ? getComputedStyle(closeImg).transform : 'none';   /* plain fit while it's full screen */
    document.body.appendChild(photo);                   /* lift out of the scrolling layer, same place on screen */
    photo.classList.remove('is-in-detail');
    photo.classList.add('is-flying');
    Object.assign(photo.style, frame(from));
    detail.hidden = true;
    if (!opts.instant) await fly(photo, from, to, imgFrom, parallaxAt(to));

    c.ph.replaceWith(photo);                            /* same <img>, back in its card */
    photo.classList.remove('is-flying');
    clearBox(photo);
    cur = null; busy = false;
    if (c.btn) c.btn.focus({ preventScroll: true });
  }

  /* ---------- Wiring ---------- */
  articles.forEach(function (article) {
    var btn = article.querySelector('.member-open');
    if (btn) btn.addEventListener('click', function () { openMember(article); });
  });

  /* Back: go through history when we pushed an entry, so the URL and the system Back stay in sync */
  function requestClose() {
    if (!cur) return;
    if (cur.pushed) {
      cur.pushed = false;
      history.back();                                   /* popstate below performs the close */
      setTimeout(function () { if (cur && !busy) closeMember(); }, 500);   /* safety net */
    } else {
      try { if (location.hash.indexOf('#member-') === 0) history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
      closeMember();
    }
  }
  backBtn.addEventListener('click', requestClose);
  window.addEventListener('popstate', function (e) {
    if (cur && !(e.state && e.state.abMember)) { cur.pushed = false; closeMember(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cur) requestClose();
    else onKey(e);
  });
  window.addEventListener('resize', function () {
    if (!cur || busy) return;
    detail.style.setProperty('--ab-h', scroller.clientHeight + 'px');
    measure(); paint();
  });

  /* rotating / resizing past the breakpoint: put the photo back at once */
  var onBreakpoint = function () { if (!mq.matches && cur) closeMember({ instant: true }); };
  if (mq.addEventListener) mq.addEventListener('change', onBreakpoint);
  else if (mq.addListener) mq.addListener(onBreakpoint);

  /* Deep link (#member-…) on a phone: open that profile straight away (no intro is played for links with a hash) */
  if (!root.classList.contains('about-intro') && mq.matches && location.hash.indexOf('#member-') === 0) {
    var target = null;
    try { target = document.querySelector(location.hash); } catch (_) {}
    if (target && target.classList.contains('team-member')) {
      setTimeout(function () { openMember(target, { instant: true }); }, 80);
    }
  }
})();

/* WEBGL WIREFRAME BACKGROUND MOVED OUT OF THIS FILE.
   It now lives as its own standalone file, published at:
     https://github.com/Ramashery/Mavic/blob/main/animations/an-about.html
   and is loaded into .site-bg-video via an <iframe> (see tpl_about.html /
   styles.css) instead of running as inline JS here. */
