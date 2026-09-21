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
  var detail = $('#abDetail'), scroller = $('#abDetailScroll'), hero = $('#abDetailHero'), backBtn = $('#abBack');
  var nameEl = $('#abDetailName'), roleEl = $('#abDetailRole'), bioEl = $('#abDetailBio');
  var articles = Array.prototype.slice.call(document.querySelectorAll('.team-member'));
  if (!stageMain || !detail || !scroller || !hero || !backBtn || !articles.length) return;

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
    scroller.scrollTop = 0;
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function frame(r) { return { left: px(r.left), top: px(r.top), width: px(r.width), height: px(r.height) }; }
  function clearBox(el) { el.style.left = el.style.top = el.style.width = el.style.height = ''; }

  async function fly(photo, from, to) {
    if (reduceMotion) return;
    try {
      var a = photo.animate([frame(from), frame(to)], { duration: DURATION, easing: EASE, fill: 'both' });
      await a.finished;
      a.cancel();
    } catch (_) {}
  }

  /* brings a scrolled-down profile back to its first screen before the photo flies home */
  function scrollToTop(el, ms) {
    return new Promise(function (resolve) {
      var y0 = el.scrollTop;
      if (y0 < 2) { el.scrollTop = 0; resolve(); return; }
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        el.scrollTop = y0 * (1 - e);
        if (k < 1) requestAnimationFrame(step); else resolve();
      })(t0);
    });
  }

  async function openMember(article, opts) {
    opts = opts || {};
    if (cur || busy || !mq.matches) return;
    var photo = article.querySelector('.member-photo');
    if (!photo) return;
    busy = true; wantClose = false;

    var from = rectOf(photo);
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

    if (!opts.instant) await fly(photo, from, { left: 0, top: 0, width: innerWidth, height: innerHeight });

    /* land inside the scrolling layer (one task: no frame is painted in between) */
    clearBox(photo);
    detail.hidden = false;
    scroller.scrollTop = 0;
    hero.insertBefore(photo, hero.firstChild);
    photo.classList.remove('is-flying');
    photo.classList.add('is-in-detail');
    stageMain.style.visibility = 'hidden';              /* what shows behind the bio is the site's own background */
    root.classList.add('ab-detail-open');               /* …held fully in place (see CSS): main.js would otherwise slide it away for the hidden footer */

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
    if (!opts.instant && !reduceMotion) await Promise.all([scrollToTop(scroller, 320), wait(260)]);
    else scroller.scrollTop = 0;

    /* restore the page (and its scroll position) BEFORE measuring where the card is */
    if (window.__unlockBodyScroll) window.__unlockBodyScroll();
    stageMain.style.visibility = '';
    root.classList.remove('ab-detail-open');
    stageMain.inert = false;

    var from = rectOf(photo), to = rectOf(c.ph);
    document.body.appendChild(photo);                   /* lift out of the scrolling layer, same place on screen */
    photo.classList.remove('is-in-detail');
    photo.classList.add('is-flying');
    Object.assign(photo.style, frame(from));
    detail.hidden = true;
    if (!opts.instant) await fly(photo, from, to);

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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) requestClose(); });

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

/* =========================================================
   WEBGL WIREFRAME BACKGROUND
   Drawn into #abBgCanvas, inside the shared .site-bg-video layer
   (so it gets the same scrim and the same slide-away near the
   footer as the offer pages' particle background).
========================================================== */
(function () {
  var cv = document.getElementById('abBgCanvas');
  if (!cv) return;
  var root = cv.parentNode;                  /* .site-bg-video: the fixed, full-viewport layer */
  var gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return;

  var VS = [
    'precision highp float;',
    'attribute vec2 aG;',
    'uniform vec2 uExt; uniform float uZc, uT, uAsp, uF, uCamY, uAmp, uCx, uTilt;',
    'varying float vB;',
    'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}',
    'vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}',
    'vec4 tis(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g;',
    ' vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;',
    ' i=mod289(i);',
    ' vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));',
    ' vec3 ns=.142857142857*D.wyz-D.xzx;',
    ' vec4 j=p-49.*floor(p*ns.z*ns.z);',
    ' vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;',
    ' vec4 h=1.-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.;',
    ' vec4 sh=-step(h,vec4(0.));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 nm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=nm.x; p1*=nm.y; p2*=nm.z; p3*=nm.w;',
    ' vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;',
    ' return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',
    /* рельеф: доменное искажение + ridged fbm даёт острые складки, как на референсе */
    'float H(vec2 p){',
    ' vec2 w=vec2(snoise(vec3(p*.35,uT*.5)),snoise(vec3(p*.35+7.3,uT*.5)));',
    ' p+=w*.45;',
    ' float a=0.,amp=.42,f=1.;',
    ' for(int i=0;i<3;i++){',
    '  float ns=snoise(vec3(p*f,uT+float(i)*3.1));',
    '  float n=1.-sqrt(ns*ns+.05);', /* сглаженный "abs" — без острого излома в вершине гребня */
    '  a+=n*n*amp; amp*=.34; f*=1.9;',
    ' }',
    ' return clamp(a,0.,1.15);', /* ограничиваем пик высоты, чтобы не отрывался от соседей */
    '}',
    'void main(){',
    ' vec2 q=vec2((aG.x-.5)*uExt.x,(aG.y-.5)*uExt.y+uZc);',
    ' vec2 s=q*.55; float e=.03;',
    ' float h0=H(s),hx=H(s+vec2(e,0.)),hz=H(s+vec2(0.,e));',
    ' float g=length(vec2(hx-h0,hz-h0))/e;',
    ' vec3 r=vec3(q.x-uCx,(h0-.46)*uAmp-uCamY,q.y);',
    ' float ct=cos(uTilt),st=sin(uTilt);',
    ' float vy=r.y*st-r.z*ct, vz=r.y*ct+r.z*st;',
    ' gl_Position=vec4(r.x*uF/uAsp,vy*uF,0.,-vz);',
    ' vB=clamp(.10+.62*smoothstep(0.,1.8,g)+.30*smoothstep(.35,.75,h0),0.,1.);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying float vB;',
    'void main(){ float a=vB*.9; gl_FragColor=vec4(vec3(.86,.87,.90)*a,a); }'
  ].join('\n');

  function sh(type, src) {
    var o = gl.createShader(type);
    gl.shaderSource(o, src);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o));
    return o;
  }
  var pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);

  var U = {};
  ['uExt', 'uZc', 'uT', 'uAsp', 'uF', 'uCamY', 'uAmp', 'uCx', 'uTilt'].forEach(function (n) {
    U[n] = gl.getUniformLocation(pr, n);
  });
  var aG = gl.getAttribLocation(pr, 'aG');
  var vb = gl.createBuffer(), ib = gl.createBuffer(), count = 0;

  var EZ = 8.5, ZC = -0.95, asp = 1;

  function build() {
    var ex = asp * 7.2;
    var cell = window.innerWidth < 700 ? 0.058 : 0.05, cols, rows;
    for (;;) {
      cols = Math.ceil(ex / cell);
      rows = Math.ceil(EZ / cell);
      if ((cols + 1) * (rows + 1) <= 64000) break;
      cell *= 1.08;
    }
    var nv = (cols + 1) * (rows + 1);
    var pos = new Float32Array(nv * 2);
    var idx = new Uint16Array((cols * (rows + 1) + rows * (cols + 1)) * 2);
    var k = 0, n = 0, r, c, i;
    for (r = 0; r <= rows; r++) for (c = 0; c <= cols; c++) { pos[k++] = c / cols; pos[k++] = r / rows; }
    for (r = 0; r <= rows; r++) for (c = 0; c <= cols; c++) {
      i = r * (cols + 1) + c;
      if (c < cols) { idx[n++] = i; idx[n++] = i + 1; }
      if (r < rows) { idx[n++] = i; idx[n++] = i + cols + 1; }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aG);
    gl.vertexAttribPointer(aG, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    count = idx.length;
    gl.uniform2f(U.uExt, ex, EZ);
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
    asp = w / h;
    gl.uniform1f(U.uAsp, asp);
    build();
  }

  gl.uniform1f(U.uZc, ZC);
  gl.uniform1f(U.uF, 1.5);
  gl.uniform1f(U.uCamY, 3.3);
  gl.uniform1f(U.uAmp, 1.1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  var mx = 0, my = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', function (e) {
    tx = e.clientX / window.innerWidth - 0.5;
    ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function draw(ms) {
    var t = ms * 0.001;
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uT, t * 0.08 + 13.0);                       /* скорость движения складок */
    gl.uniform1f(U.uCx, mx * 0.6 + Math.sin(t * 0.07) * 0.25);  /* параллакс камеры */
    gl.uniform1f(U.uTilt, 0.28 + my * 0.1 + Math.sin(t * 0.05) * 0.03);
    gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, 0);
  }

  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(ms) { draw(ms); requestAnimationFrame(loop); }

  window.addEventListener('resize', function () { resize(); if (still) draw(4000); });
  resize();
  if (still) draw(4000); else requestAnimationFrame(loop);
})();
