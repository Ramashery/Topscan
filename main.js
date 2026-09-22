/* =========================================================
   Shared body-scroll lock for the mobile nav drawer.
   Exposed on window because main.js concatenates several
   independent per-page IIFEs below, each with its own copy of
   the nav-drawer open/close logic — this one lock implementation
   is shared by all of them.
   `overflow:hidden` on <body> alone does not stop iOS Safari's
   background rubber-band/bounce scroll while a fixed-position
   drawer is open — that bounce is exactly what showed the page
   through the bottom edge of the drawer. Pinning the body with
   position:fixed at its current scroll offset stops the bounce
   entirely; scroll position is restored on unlock.
========================================================== */
/* =========================================================
   SHARED-ELEMENT PAGE TRANSITION — services <-> offer
   Cross-document View Transition (native browser API, Chrome/Edge
   126+; everywhere else this block simply does nothing and normal
   navigation happens). styles.css turns it on globally for every
   same-origin link via `@view-transition { navigation: auto; }` —
   here we narrow that down to only the services-catalog <-> offer
   pair, which is the only place a matching view-transition-name
   (shared-hero-video, set on .sv-slide-video and .service-hero-visual
   video) exists on both ends, so it's the only pair where a morph
   actually makes sense. Every other navigation gets skipTransition(),
   i.e. behaves exactly as before this feature was added.
========================================================== */
(function () {
  if (!('onpageswap' in window) && !('onpagereveal' in window)) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Matches ".../services" (catalog) but not ".../services/{slug}" (offer).
  var RE_CATALOG = /\/services\/?(?:[?#].*)?$/;
  // Matches ".../services/{slug}" (offer).
  var RE_OFFER = /\/services\/[^\/?#]+\/?(?:[?#].*)?$/;

  function stripQueryHash(url) {
    try { return new URL(url, location.href).pathname; } catch (e) { return null; }
  }

  function pageType(url) {
    var path = stripQueryHash(url);
    if (!path) return null;
    if (RE_OFFER.test(path)) return 'offer';
    if (RE_CATALOG.test(path)) return 'catalog';
    return null;
  }

  function isEligible(fromURL, toURL) {
    if (reduceMotion || !fromURL || !toURL) return false;
    var a = pageType(fromURL), b = pageType(toURL);
    return !!a && !!b && a !== b;
  }

  // Fired on the page being navigated AWAY from, right before unload.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var to = (e.activation && e.activation.entry) ? e.activation.entry.url : null;
    if (!isEligible(location.href, to)) e.viewTransition.skipTransition();
  });

  // Fired on the page being navigated TO, right before it's shown.
  // (PageRevealEvent carries no "from" info itself — read it off the
  // Navigation API, which is available in every browser that fires
  // this event; document.referrer is the fallback.)
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var from = document.referrer;
    if (window.navigation && navigation.activation && navigation.activation.from) {
      from = navigation.activation.from.url || from;
    }
    if (!isEligible(from, location.href)) e.viewTransition.skipTransition();
  });
})();

(function () {
  window.__lockBodyScroll = function () {
    if (document.body.classList.contains('nav-locked')) return;
    var y = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.scrollLockY = String(y);
    document.body.style.top = (-y) + 'px';
    document.body.classList.add('nav-locked');
  };
  window.__unlockBodyScroll = function () {
    if (!document.body.classList.contains('nav-locked')) return;
    var y = parseInt(document.body.dataset.scrollLockY || '0', 10);
    document.body.classList.remove('nav-locked');
    document.body.style.top = '';
    delete document.body.dataset.scrollLockY;
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  };
})();

(function () {

  /* =========================================================
     HERO BACKGROUND VIDEO CROSSFADE
  ========================================================== */
  var videos = Array.prototype.slice.call(document.querySelectorAll('.bg-video'));
  var FADE_DURATION = 1.2;
  var PAUSE_DURATION = 1000;
  var currentIndex = 0;
  var fadeStarted = false;

  function startVideo(index) {
    var v = videos[index];
    v.currentTime = 0;
    v.classList.add('bg-video-active');
    v.play().catch(function(){});
  }

  videos.forEach(function (v, i) {
    v.addEventListener('timeupdate', function () {
      if (i !== currentIndex || !v.duration) return;
      var timeLeft = v.duration - v.currentTime;
      if (timeLeft <= FADE_DURATION && timeLeft > 0 && !fadeStarted) {
        fadeStarted = true;
        v.classList.remove('bg-video-active');
      }
    });
    v.addEventListener('ended', function () {
      if (i !== currentIndex) return;
      v.pause();
      v.classList.remove('bg-video-active');
      var nextIndex = (currentIndex + 1) % videos.length;
      currentIndex = nextIndex;
      fadeStarted = false;
      setTimeout(function () { startVideo(nextIndex); }, PAUSE_DURATION);
    });
  });

  if (videos.length) startVideo(currentIndex);

  /* =========================================================
     RTK COORDS TICKER
  ========================================================== */
  var coordsEl = document.getElementById('rtkCoords');
  if (coordsEl) {
    var baseLat = 41.7151, baseLng = 44.8271;
    setInterval(function () {
      var lat = (baseLat + (Math.random() - 0.5) * 0.0004).toFixed(4);
      var lng = (baseLng + (Math.random() - 0.5) * 0.0004).toFixed(4);
      var alt = (488 + Math.random() * 4).toFixed(0);
      coordsEl.textContent = 'X: ' + lat + '°   Y: ' + lng + '°   ALT: ' + alt + 'M';
    }, 1800);
  }

  /* =========================================================
     EQUIPMENT IMAGE SLIDESHOW (soft crossfade)
  ========================================================== */
  var slideshow = document.getElementById('equipSlideshow');
  if (slideshow) {
    var slides = Array.prototype.slice.call(slideshow.querySelectorAll('img'));
    var slideIndex = 0;
    if (slides.length > 1) {
      setInterval(function () {
        slides[slideIndex].classList.remove('slide-active');
        slideIndex = (slideIndex + 1) % slides.length;
        slides[slideIndex].classList.add('slide-active');
      }, 4200);
    }
  }

  /* =========================================================
     TERRAIN PREVIEW — LOOPED VIDEO CROSSFADE
  ========================================================== */
  var terrainWrap = document.getElementById('terrainVideoWrap');
  if (terrainWrap) {
    var terrainSources = [
      "https://cdn.jsdelivr.net/gh/Ramashery/Mavic@main/video/d6.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/1cb03af0-d384-4949-946e-69e561805c21.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/92501ffa-a51c-4081-b921-c5c0ce26d7d7.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/c29db051-38af-4ffc-b264-62e7f46ddb12.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/b9cc6b7d-eb42-49a8-ac14-595a8edab4c4.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/5370bbdf-4d83-4e4e-9dde-c85dd20c4d2d.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/9902db40-42fd-4f6e-b146-c458469ac39f.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/96bf0536-4449-40b2-ac2f-018eb595bb72.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/5e5b14c4-e952-47ae-9a74-e101d617e100.mp4"
    ];

    var tv = [];
    terrainSources.forEach(function (src, i) {
      var v = document.createElement('video');
      v.src = src;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      if (i === 0) v.classList.add('tv-active');
      terrainWrap.appendChild(v);
      tv.push(v);
    });

    var tvCurrent = 0;
    var tvTotal = tv.length;
    var tvSwitching = false;

    function tvSwitchNext() {
      if (tvSwitching || tvTotal <= 1) return;
      tvSwitching = true;
      var cur = tv[tvCurrent];
      var next = (tvCurrent + 1) % tvTotal;
      var nv = tv[next];
      nv.currentTime = 0;
      nv.play().catch(function(){});
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          cur.classList.remove('tv-active');
          nv.classList.add('tv-active');
          tvCurrent = next;
          tvSwitching = false;
        });
      });
    }

    tv[0].loop = false;
    tv[0].addEventListener('loadeddata', function () { tv[0].play().catch(function(){}); });

    function startCarousel() {
      setInterval(tvSwitchNext, 4800);
    }

    function onFirstVideoEnded() {
      tv[0].removeEventListener('ended', onFirstVideoEnded);
      tvSwitchNext();
      startCarousel();
    }
    tv[0].addEventListener('ended', onFirstVideoEnded);

    setTimeout(function () {
      if (tv[0].paused) tv[0].play().catch(function(){});
    }, 800);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        var cur = tv[tvCurrent];
        if (cur && cur.paused) cur.play().catch(function(){});
      }
    });
  }

  /* =========================================================
     LEAD FORM SUBMISSION (Web3Forms)
  ========================================================== */
  var leadForm = document.getElementById('leadForm');
  if (leadForm) {
    var leadStatus = document.getElementById('leadFormStatus');
    var leadSubmitBtn = leadForm.querySelector('.submit-btn');
    var leadOriginalLabel = leadSubmitBtn ? leadSubmitBtn.textContent : '';

    var statusMessages = {
      sending: 'Sending…',
      ok:      'Thank you! Your request has been sent, we will reply within one business day.',
      err:     'Something went wrong. Please try again or email info@topscan.ge'
    };

    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      leadStatus.className = 'form-status';
      leadStatus.textContent = statusMessages.sending;
      leadStatus.style.display = 'block';
      leadStatus.style.color = 'var(--text-dim)';
      if (leadSubmitBtn) { leadSubmitBtn.disabled = true; }

      var formData = new FormData(leadForm);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            leadStatus.className = 'form-status ok';
            leadStatus.textContent = statusMessages.ok;
            leadForm.reset();
          } else {
            leadStatus.className = 'form-status err';
            leadStatus.textContent = statusMessages.err;
          }
        })
        .catch(function () {
          leadStatus.className = 'form-status err';
          leadStatus.textContent = statusMessages.err;
        })
        .finally(function () {
          if (leadSubmitBtn) { leadSubmitBtn.disabled = false; leadSubmitBtn.textContent = leadOriginalLabel; }
        });
    });
  }

  /* =========================================================
     EDGE BURST ENGINE (mobile menu + hero subtitle)
     Letters fly in from screen edges (left/right/top/bottom/
     diagonals) and settle into place, staggered but concurrent.
  ========================================================== */
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var EB_DIRS = [
    { x: -120, y: 0 },
    { x: 120, y: 0 },
    { x: 0, y: -90 },
    { x: 0, y: 90 },
    { x: -100, y: -60 },
    { x: 100, y: 60 }
  ];

  function edgeSplit(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (word) {
      var w = '';
      for (var i = 0; i < word.length; i++) {
        w += '<span data-eb>' + word.charAt(i) + '</span>';
      }
      /* whole word wrapped + nowrap: guarantees the browser can
         only ever break between words, never inside one */
      return '<span class="eb-word">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
    return Array.prototype.slice.call(el.querySelectorAll('[data-eb]'));
  }

  function prepareEdgeBurst(spans, stagger) {
    spans.forEach(function (span, i) {
      var d = EB_DIRS[i % EB_DIRS.length];
      span.style.setProperty('--ex', (d.x + (Math.random() * 40 - 20)).toFixed(0) + 'px');
      span.style.setProperty('--ey', (d.y + (Math.random() * 30 - 15)).toFixed(0) + 'px');
      span.style.animationDelay = (i * stagger) + 'ms';
    });
  }

  /* Word-level split + randomized delay: makes every line burst in
     together instead of a top-to-bottom sweep. */
  function edgeSplitWords(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (w) {
      return '<span data-eb style="display:inline-block;">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
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

  /* =========================================================
     ZIPPER SLIDE (hero title + all h2/h3) + EDGE BURST
     (hero subtitle + hero contacts). Replays every time the
     element enters the viewport, scrolling either direction.
  ========================================================== */
  var heroTitle = document.getElementById('heroTitle');
  var heroSub = document.getElementById('heroSub');
  var heroContacts = document.querySelector('.hero-contact-links');

  function zipSplit(el, segmentSelector) {
    var lines = el.querySelectorAll(segmentSelector || '.hero-line');
    var source = lines.length ? Array.prototype.slice.call(lines) : [el];
    var counter = 0;
    source.forEach(function (line) {
      var text = line.textContent;
      var words = text.split(' ');
      var html = words.map(function (word) {
        var w = '';
        for (var i = 0; i < word.length; i++) {
          w += '<span data-zip style="--zi:' + counter + '">' + word.charAt(i) + '</span>';
          counter++;
        }
        /* whole word wrapped + nowrap: guarantees the browser can
           only ever break between words, never inside one */
        return '<span class="zip-word">' + w + '</span>';
      }).join(' ');
      line.innerHTML = html;
    });
    el.setAttribute('data-zip-ready', '1');
    return counter;
  }

  function playZip(el) {
    el.classList.remove('zip-play');
    void el.offsetWidth; /* force reflow so the animation can restart */
    el.classList.add('zip-play');
  }
  function resetZip(el) {
    el.classList.remove('zip-play');
  }
  function playBurst(el) {
    el.classList.remove('eb-play');
    void el.offsetWidth;
    el.classList.add('eb-play');
  }
  function resetBurst(el) {
    el.classList.remove('eb-play');
  }

  if (!prefersReducedMotion) {
    /* ---- Hero: title -> subtitle -> contacts, chained, replaying on every viewport entry ---- */
    var titleDuration = 850;
    var subDuration = 800 + 220;

    if (heroTitle) {
      var zipCount = zipSplit(heroTitle);
      titleDuration = zipCount * 22 + 700 + 150;
    }
    if (heroSub) {
      var subSpans = edgeSplitWords(heroSub);
      prepareEdgeBurstRandom(subSpans, 220);
    }
    if (heroContacts) {
      /* animate like the hero title (zipper), not the subtitle burst */
      Array.prototype.slice.call(heroContacts.children).forEach(function (ch) {
        ch.classList.add('zip-segment');
      });
      zipSplit(heroContacts, '.zip-segment');
    }

    var heroTimers = [];
    function playHeroSequence() {
      heroTimers.forEach(function (t) { clearTimeout(t); });
      heroTimers = [];
      if (heroTitle) { playZip(heroTitle); }
      if (heroSub) { resetBurst(heroSub); }
      if (heroContacts) { resetZip(heroContacts); }
      if (heroSub) {
        heroTimers.push(setTimeout(function () { playBurst(heroSub); }, titleDuration));
      }
      if (heroContacts) {
        heroTimers.push(setTimeout(function () { playZip(heroContacts); }, titleDuration + subDuration));
      }
    }
    function resetHeroSequence() {
      heroTimers.forEach(function (t) { clearTimeout(t); });
      heroTimers = [];
      if (heroTitle) { resetZip(heroTitle); }
      if (heroSub) { resetBurst(heroSub); }
      if (heroContacts) { resetZip(heroContacts); }
    }

    if (heroTitle) {
      if ('IntersectionObserver' in window) {
        var heroIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playHeroSequence(); } else { resetHeroSequence(); }
          });
        }, { threshold: 0.3 });
        heroIO.observe(heroTitle);
      } else {
        playHeroSequence();
      }
    }

    /* ---- All h2 / h3: same zipper animation, replaying on every viewport entry ---- */
    var headingTargets = Array.prototype.slice.call(document.querySelectorAll('h2, h3'));
    headingTargets.forEach(function (h) { zipSplit(h); });

    if (headingTargets.length) {
      if ('IntersectionObserver' in window) {
        var headingIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playZip(entry.target); } else { resetZip(entry.target); }
          });
        }, { threshold: 0.3 });
        headingTargets.forEach(function (h) { headingIO.observe(h); });
      } else {
        headingTargets.forEach(function (h) { h.classList.add('zip-play'); });
      }
    }
  }

  /* =========================================================
     MOBILE NAV DRAWER
  ========================================================== */
  var menuToggle = document.getElementById('menuToggle');
  var navDrawer = document.getElementById('navDrawer');
  var navOverlay = document.getElementById('navOverlay');
  var navDrawerClose = document.getElementById('navDrawerClose');
  var navDrawerVideo = navDrawer ? navDrawer.querySelector('.nav-drawer-media video') : null;
  var navLinksList = navDrawer ? navDrawer.querySelector('.nav-drawer-links') : null;

  /* ---- панель мобильного меню использует ту же зернистость, что и
     вся страница — единый .g_grain_overlay (см. разметку и стили
     выше). Отдельный canvas-шум панели удалён. ---- */

  if (navLinksList && !prefersReducedMotion) {
    var menuLinks = Array.prototype.slice.call(navLinksList.querySelectorAll('a'));
    var menuSpans = [];
    menuLinks.forEach(function (a) {
      menuSpans = menuSpans.concat(edgeSplit(a));
    });
    prepareEdgeBurst(menuSpans, 26);
  }

  function playMenuEdgeBurst() {
    if (prefersReducedMotion || !navLinksList) return;
    navLinksList.classList.remove('eb-play');
    void navLinksList.offsetWidth; /* force reflow so the animation can restart */
    navLinksList.classList.add('eb-play');
  }
  function resetMenuEdgeBurst() {
    if (navLinksList) { navLinksList.classList.remove('eb-play'); }
  }

  function openDrawer() {
    navDrawer.classList.add('is-open');
    navOverlay.classList.add('is-open');
    menuToggle.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    window.__lockBodyScroll();
    if (navDrawerVideo && navDrawerVideo.paused) { navDrawerVideo.play().catch(function () {}); }
    playMenuEdgeBurst();
  }
  function closeDrawer() {
    navDrawer.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    menuToggle.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    window.__unlockBodyScroll();
    resetMenuEdgeBurst();
  }
  if (menuToggle && navDrawer && navOverlay) {
    menuToggle.addEventListener('click', function () {
      if (navDrawer.classList.contains('is-open')) { closeDrawer(); } else { openDrawer(); }
    });
    navOverlay.addEventListener('click', closeDrawer);
    if (navDrawerClose) { navDrawerClose.addEventListener('click', closeDrawer); }
    navDrawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); }
    });
  }

  /* =========================================================
     SCROLL REVEAL
  ========================================================== */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();

/* ---- next block ---- */

(function () {

  /* =========================================================
     HERO BACKGROUND VIDEO CROSSFADE
  ========================================================== */
  var videos = Array.prototype.slice.call(document.querySelectorAll('.bg-video'));
  var FADE_DURATION = 1.2;
  var PAUSE_DURATION = 1000;
  var currentIndex = 0;
  var fadeStarted = false;

  function startVideo(index) {
    var v = videos[index];
    v.currentTime = 0;
    v.classList.add('bg-video-active');
    v.play().catch(function(){});
  }

  videos.forEach(function (v, i) {
    v.addEventListener('timeupdate', function () {
      if (i !== currentIndex || !v.duration) return;
      var timeLeft = v.duration - v.currentTime;
      if (timeLeft <= FADE_DURATION && timeLeft > 0 && !fadeStarted) {
        fadeStarted = true;
        v.classList.remove('bg-video-active');
      }
    });
    v.addEventListener('ended', function () {
      if (i !== currentIndex) return;
      v.pause();
      v.classList.remove('bg-video-active');
      var nextIndex = (currentIndex + 1) % videos.length;
      currentIndex = nextIndex;
      fadeStarted = false;
      setTimeout(function () { startVideo(nextIndex); }, PAUSE_DURATION);
    });
  });

  if (videos.length) startVideo(currentIndex);

  /* =========================================================
     RTK COORDS TICKER
  ========================================================== */
  var coordsEl = document.getElementById('rtkCoords');
  if (coordsEl) {
    var baseLat = 41.7151, baseLng = 44.8271;
    setInterval(function () {
      var lat = (baseLat + (Math.random() - 0.5) * 0.0004).toFixed(4);
      var lng = (baseLng + (Math.random() - 0.5) * 0.0004).toFixed(4);
      var alt = (488 + Math.random() * 4).toFixed(0);
      coordsEl.textContent = 'X: ' + lat + '°   Y: ' + lng + '°   ALT: ' + alt + 'M';
    }, 1800);
  }

  /* =========================================================
     EQUIPMENT IMAGE SLIDESHOW (soft crossfade)
  ========================================================== */
  var slideshow = document.getElementById('equipSlideshow');
  if (slideshow) {
    var slides = Array.prototype.slice.call(slideshow.querySelectorAll('img'));
    var slideIndex = 0;
    if (slides.length > 1) {
      setInterval(function () {
        slides[slideIndex].classList.remove('slide-active');
        slideIndex = (slideIndex + 1) % slides.length;
        slides[slideIndex].classList.add('slide-active');
      }, 4200);
    }
  }

  /* =========================================================
     TERRAIN PREVIEW — LOOPED VIDEO CROSSFADE
  ========================================================== */
  var terrainWrap = document.getElementById('terrainVideoWrap');
  if (terrainWrap) {
    var terrainSources = [
      "https://cdn.jsdelivr.net/gh/Ramashery/Mavic@main/video/d6.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/1cb03af0-d384-4949-946e-69e561805c21.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/92501ffa-a51c-4081-b921-c5c0ce26d7d7.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/c29db051-38af-4ffc-b264-62e7f46ddb12.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/b9cc6b7d-eb42-49a8-ac14-595a8edab4c4.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/5370bbdf-4d83-4e4e-9dde-c85dd20c4d2d.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/9902db40-42fd-4f6e-b146-c458469ac39f.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/96bf0536-4449-40b2-ac2f-018eb595bb72.mp4",
      "https://www-cdn.djiits.com/reactor/assets/_next/static/videos/5e5b14c4-e952-47ae-9a74-e101d617e100.mp4"
    ];

    var tv = [];
    terrainSources.forEach(function (src, i) {
      var v = document.createElement('video');
      v.src = src;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      if (i === 0) v.classList.add('tv-active');
      terrainWrap.appendChild(v);
      tv.push(v);
    });

    var tvCurrent = 0;
    var tvTotal = tv.length;
    var tvSwitching = false;

    function tvSwitchNext() {
      if (tvSwitching || tvTotal <= 1) return;
      tvSwitching = true;
      var cur = tv[tvCurrent];
      var next = (tvCurrent + 1) % tvTotal;
      var nv = tv[next];
      nv.currentTime = 0;
      nv.play().catch(function(){});
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          cur.classList.remove('tv-active');
          nv.classList.add('tv-active');
          tvCurrent = next;
          tvSwitching = false;
        });
      });
    }

    tv[0].loop = false;
    tv[0].addEventListener('loadeddata', function () { tv[0].play().catch(function(){}); });

    function startCarousel() {
      setInterval(tvSwitchNext, 4800);
    }

    function onFirstVideoEnded() {
      tv[0].removeEventListener('ended', onFirstVideoEnded);
      tvSwitchNext();
      startCarousel();
    }
    tv[0].addEventListener('ended', onFirstVideoEnded);

    setTimeout(function () {
      if (tv[0].paused) tv[0].play().catch(function(){});
    }, 800);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        var cur = tv[tvCurrent];
        if (cur && cur.paused) cur.play().catch(function(){});
      }
    });
  }


  /* =========================================================
     LEAD FORM SUBMISSION (Web3Forms)
  ========================================================== */
  var leadForm = document.getElementById('leadForm');
  if (leadForm) {
    var leadStatus = document.getElementById('leadFormStatus');
    var leadSubmitBtn = leadForm.querySelector('.submit-btn');
    var leadOriginalLabel = leadSubmitBtn ? leadSubmitBtn.textContent : '';

    var statusMessages = {
      sending: 'Sending…',
      ok:      'Thank you! Your request has been sent, we will reply within one business day.',
      err:     'Something went wrong. Please try again or email info@topscan.ge'
    };

    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      leadStatus.className = 'form-status';
      leadStatus.textContent = statusMessages.sending;
      leadStatus.style.display = 'block';
      leadStatus.style.color = 'var(--text-dim)';
      if (leadSubmitBtn) { leadSubmitBtn.disabled = true; }

      var formData = new FormData(leadForm);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            leadStatus.className = 'form-status ok';
            leadStatus.textContent = statusMessages.ok;
            leadForm.reset();
          } else {
            leadStatus.className = 'form-status err';
            leadStatus.textContent = statusMessages.err;
          }
        })
        .catch(function () {
          leadStatus.className = 'form-status err';
          leadStatus.textContent = statusMessages.err;
        })
        .finally(function () {
          if (leadSubmitBtn) { leadSubmitBtn.disabled = false; leadSubmitBtn.textContent = leadOriginalLabel; }
        });
    });
  }

  /* =========================================================
     EDGE BURST ENGINE (mobile menu + hero subtitle)
     Letters fly in from screen edges (left/right/top/bottom/
     diagonals) and settle into place, staggered but concurrent.
  ========================================================== */
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var EB_DIRS = [
    { x: -120, y: 0 },
    { x: 120, y: 0 },
    { x: 0, y: -90 },
    { x: 0, y: 90 },
    { x: -100, y: -60 },
    { x: 100, y: 60 }
  ];

  function edgeSplit(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (word) {
      var w = '';
      for (var i = 0; i < word.length; i++) {
        w += '<span data-eb>' + word.charAt(i) + '</span>';
      }
      /* whole word wrapped + nowrap: guarantees the browser can
         only ever break between words, never inside one */
      return '<span class="eb-word">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
    return Array.prototype.slice.call(el.querySelectorAll('[data-eb]'));
  }

  function prepareEdgeBurst(spans, stagger) {
    spans.forEach(function (span, i) {
      var d = EB_DIRS[i % EB_DIRS.length];
      span.style.setProperty('--ex', (d.x + (Math.random() * 40 - 20)).toFixed(0) + 'px');
      span.style.setProperty('--ey', (d.y + (Math.random() * 30 - 15)).toFixed(0) + 'px');
      span.style.animationDelay = (i * stagger) + 'ms';
    });
  }

  /* Word-level split + randomized delay: makes every line burst in
     together instead of a top-to-bottom sweep. */
  function edgeSplitWords(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (w) {
      return '<span data-eb style="display:inline-block;">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
    return Array.prototype.slice.call(el.querySelectorAll('[data-eb]'));
  }

  /* Same word-level split as edgeSplitWords, but splits each <li> on its
     own so the list markup (and the — bullet marks) survives untouched. */
  function edgeSplitListWords(listEl) {
    var spans = [];
    Array.prototype.slice.call(listEl.children).forEach(function (li) {
      var words = li.textContent.split(' ');
      li.innerHTML = words.map(function (w) {
        return '<span data-eb style="display:inline-block;">' + w + '</span>';
      }).join(' ');
      spans = spans.concat(Array.prototype.slice.call(li.querySelectorAll('[data-eb]')));
    });
    return spans;
  }

  function prepareEdgeBurstRandom(spans, maxDelay) {
    spans.forEach(function (span) {
      var d = EB_DIRS[Math.floor(Math.random() * EB_DIRS.length)];
      span.style.setProperty('--ex', (d.x + (Math.random() * 40 - 20)).toFixed(0) + 'px');
      span.style.setProperty('--ey', (d.y + (Math.random() * 30 - 15)).toFixed(0) + 'px');
      span.style.animationDelay = (Math.random() * maxDelay).toFixed(0) + 'ms';
    });
  }

  /* =========================================================
     ZIPPER SLIDE (hero title + all h2/h3) + EDGE BURST
     (hero subtitle + hero contacts). Replays every time the
     element enters the viewport, scrolling either direction.
  ========================================================== */
  var heroTitle = document.getElementById('heroTitle');
  var heroSub = document.getElementById('heroSub');
  var heroContacts = document.querySelector('.hero-contact-links');

  function zipSplit(el, segmentSelector) {
    var lines = el.querySelectorAll(segmentSelector || '.hero-line');
    var source = lines.length ? Array.prototype.slice.call(lines) : [el];
    var counter = 0;
    source.forEach(function (line) {
      var text = line.textContent;
      var words = text.split(' ');
      var html = words.map(function (word) {
        var w = '';
        for (var i = 0; i < word.length; i++) {
          w += '<span data-zip style="--zi:' + counter + '">' + word.charAt(i) + '</span>';
          counter++;
        }
        /* whole word wrapped + nowrap: guarantees the browser can
           only ever break between words, never inside one */
        return '<span class="zip-word">' + w + '</span>';
      }).join(' ');
      line.innerHTML = html;
    });
    el.setAttribute('data-zip-ready', '1');
    return counter;
  }

  function playZip(el) {
    el.classList.remove('zip-play');
    void el.offsetWidth; /* force reflow so the animation can restart */
    el.classList.add('zip-play');
  }
  function resetZip(el) {
    el.classList.remove('zip-play');
  }
  function playBurst(el) {
    el.classList.remove('eb-play');
    void el.offsetWidth;
    el.classList.add('eb-play');
  }
  function resetBurst(el) {
    el.classList.remove('eb-play');
  }

  if (!prefersReducedMotion) {
    /* ---- Hero: title -> subtitle -> contacts, chained, replaying on every viewport entry ---- */
    var titleDuration = 850;
    var subDuration = 800 + 220;

    if (heroTitle) {
      var zipCount = zipSplit(heroTitle);
      titleDuration = zipCount * 22 + 700 + 150;
    }
    if (heroSub) {
      var subSpans = edgeSplitWords(heroSub);
      prepareEdgeBurstRandom(subSpans, 220);
    }
    if (heroContacts) {
      /* animate like the hero title (zipper), not the subtitle burst */
      Array.prototype.slice.call(heroContacts.children).forEach(function (ch) {
        ch.classList.add('zip-segment');
      });
      zipSplit(heroContacts, '.zip-segment');
    }

    var heroTimers = [];
    function playHeroSequence() {
      heroTimers.forEach(function (t) { clearTimeout(t); });
      heroTimers = [];
      if (heroTitle) { playZip(heroTitle); }
      if (heroSub) { resetBurst(heroSub); }
      if (heroContacts) { resetZip(heroContacts); }
      if (heroSub) {
        heroTimers.push(setTimeout(function () { playBurst(heroSub); }, titleDuration));
      }
      if (heroContacts) {
        heroTimers.push(setTimeout(function () { playZip(heroContacts); }, titleDuration + subDuration));
      }
    }
    function resetHeroSequence() {
      heroTimers.forEach(function (t) { clearTimeout(t); });
      heroTimers = [];
      if (heroTitle) { resetZip(heroTitle); }
      if (heroSub) { resetBurst(heroSub); }
      if (heroContacts) { resetZip(heroContacts); }
    }

    if (heroTitle) {
      if ('IntersectionObserver' in window) {
        var heroIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playHeroSequence(); } else { resetHeroSequence(); }
          });
        }, { threshold: 0.3 });
        heroIO.observe(heroTitle);
      } else {
        playHeroSequence();
      }
    }

    /* ---- All h2 / h3: same zipper animation, replaying on every viewport entry ---- */
    var headingTargets = Array.prototype.slice.call(document.querySelectorAll('h2, h3'));
    headingTargets.forEach(function (h) { zipSplit(h); });

    if (headingTargets.length) {
      if ('IntersectionObserver' in window) {
        var headingIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playZip(entry.target); } else { resetZip(entry.target); }
          });
        }, { threshold: 0.3 });
        headingTargets.forEach(function (h) { headingIO.observe(h); });
      } else {
        headingTargets.forEach(function (h) { h.classList.add('zip-play'); });
      }
    }
  }

  /* =========================================================
     SERVICES HERO SLIDER — video crossfade + content swap
     Text intro sequence (title -> subtitle -> breadcrumb) reuses
     the same zipper / edge-burst engine as the homepage hero,
     replaying on every slide change.
  ========================================================== */
  var svHero = document.getElementById('servicesSlider');
  if (svHero) {
    // Data is injected by the page template (tpl_services.html) as
    // window.TOPSCAN_DATA.services — built server-side from Firestore for
    // the current language, in display order. See generate_site.py.
    var svSlides = (window.TOPSCAN_DATA && window.TOPSCAN_DATA.services) || [];

    var svWraps  = [document.getElementById('svSlideA'), document.getElementById('svSlideB')];
    var svLayers = [document.getElementById('svVideoA'), document.getElementById('svVideoB')];
    var svActive = 0;
    var svCurrent = 0;
    var svTransitioning = false;
    var svTimer = null;
    var svReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    /* distortion amounts — same figures hero.html uses for its vertical
       slider (scaleY 1.5 / scaleX 2 / rotate 20°); TRANSITION_MS mirrors
       the 1.75s duration set on .sv-slide / .sv-slide-video in styles.css */
    var SV_TRANSITION_MS = 1750;
    var SV_SCALE_X = 2;
    var SV_SCALE_Y = 1.5;
    var SV_ROTATE  = 20;   // degrees
    var SV_OUTER_OFFSET = 100; // %, how far a layer sits off-screen before/after entering
    var SV_INNER_OFFSET = 35;  // %, the inner "overshoot" hero.html adds on top of the outer move
    var svCROSSFADE = SV_TRANSITION_MS;
    var svAUTOPLAY = 6200;

    /* ---- shared-element page transition (services <-> offer) ----
       Whichever slide is currently on screen "owns" the shared
       view-transition-name — the browser needs it on exactly one
       element per document. See styles.css and the pageswap/
       pagereveal listener near the top of this file. */
    function svSetSharedVideoName(activeIdx) {
      try {
        svLayers[activeIdx].style.viewTransitionName = 'shared-hero-video';
        svLayers[1 - activeIdx].style.viewTransitionName = '';
      } catch (e) {}
    }

    /* Arriving here via the "back" transition from an offer page
       (see tpl_offer.html's breadcrumb, which links to
       .../services#{slug}) should land on that same service's slide
       rather than always resetting to the first one — otherwise the
       shared video would visibly jump to a different clip the instant
       it lands. */
    function svIndexFromHash() {
      if (!location.hash) return 0;
      var slug = decodeURIComponent(location.hash.slice(1)).split('?')[0];
      for (var i = 0; i < svSlides.length; i++) {
        var href = svSlides[i] && svSlides[i].href;
        if (href && href.replace(/\/$/, '').split('/').pop() === slug) return i;
      }
      return 0;
    }

    var svContent = document.getElementById('svContent');
    var svCat = document.getElementById('svCat');
    var svTitleEl = document.getElementById('svTitle');
    var svDescEl = document.getElementById('svDesc');
    var svBullets = document.getElementById('svBullets');
    var svLink = document.getElementById('svLink');
    var svBreadcrumb = svHero.querySelector('.breadcrumb');
    var svNums = Array.prototype.slice.call(document.querySelectorAll('.sv-num'));

    /* ---- services index menu (desktop sidebar / mobile bottom sheet) ---- */
    var svMenu = document.getElementById('svMenu');
    var svMenuList = document.getElementById('svMenuList');
    var svMenuToggle = document.getElementById('svMenuToggle');
    var svMenuOverlay = document.getElementById('svMenuOverlay');
    var svMenuItems = [];

    function svOpenMenu() {
      if (!svMenu) return;
      svMenu.classList.add('is-open');
      if (svMenuOverlay) svMenuOverlay.classList.add('is-open');
      if (svMenuToggle) svMenuToggle.setAttribute('aria-expanded', 'true');
    }
    function svCloseMenu() {
      if (!svMenu) return;
      svMenu.classList.remove('is-open');
      if (svMenuOverlay) svMenuOverlay.classList.remove('is-open');
      if (svMenuToggle) svMenuToggle.setAttribute('aria-expanded', 'false');
    }

    if (svMenuList) {
      svMenuList.innerHTML = svSlides.map(function (s, i) {
        return '<button class="sv-menu-item" data-i="' + i + '" type="button">' + s.title + '</button>';
      }).join('');
      svMenuItems = Array.prototype.slice.call(svMenuList.querySelectorAll('.sv-menu-item'));
      svMenuItems.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.getAttribute('data-i'), 10);
          svCrossfadeTo(i);
          svResetAutoplay();
          svCloseMenu();
        });
      });
    }
    if (svMenuToggle) {
      svMenuToggle.addEventListener('click', function () {
        if (svMenu && svMenu.classList.contains('is-open')) { svCloseMenu(); } else { svOpenMenu(); }
      });
    }
    if (svMenuOverlay) svMenuOverlay.addEventListener('click', svCloseMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') svCloseMenu();
    });

    /* one-time setup: split the breadcrumb into letters, its text
       never changes between slides so we only need to do this once */
    if (svBreadcrumb && !svReducedMotion) {
      Array.prototype.slice.call(svBreadcrumb.children).forEach(function (ch) {
        ch.classList.add('zip-segment');
      });
      zipSplit(svBreadcrumb, '.zip-segment');
    }

    var svSeqTimers = [];
    function svPlayIntroSequence() {
      svSeqTimers.forEach(function (t) { clearTimeout(t); });
      svSeqTimers = [];

      if (svReducedMotion) return; /* plain text stays fully visible, no animation */

      var titleCount = svTitleEl ? zipSplit(svTitleEl) : 0;
      var titleDuration = titleCount * 22 + 700 + 150;

      if (svDescEl) {
        var descSpans = edgeSplitWords(svDescEl);
        prepareEdgeBurstRandom(descSpans, 220);
      }
      if (svBullets) {
        var bulletSpans = edgeSplitListWords(svBullets);
        prepareEdgeBurstRandom(bulletSpans, 220);
      }

      if (svTitleEl) resetZip(svTitleEl);
      if (svBreadcrumb) resetZip(svBreadcrumb);
      if (svDescEl) resetBurst(svDescEl);
      if (svBullets) resetBurst(svBullets);

      /* breadcrumb fires together with the title */
      if (svTitleEl) playZip(svTitleEl);
      if (svBreadcrumb) playZip(svBreadcrumb);

      /* the bullet list (mini description) fires together with the
         description (subtitle), using the same burst effect */
      if (svDescEl || svBullets) {
        svSeqTimers.push(setTimeout(function () {
          if (svDescEl) playBurst(svDescEl);
          if (svBullets) playBurst(svBullets);
        }, titleDuration));
      }
    }

    function svRenderContent(i) {
      var s = svSlides[i];
      svContent.classList.remove('is-visible');
      void svContent.offsetWidth; /* force reflow to replay transition */
      svCat.textContent = s.cat;
      svTitleEl.textContent = s.title;
      svDescEl.textContent = s.desc;
      svBullets.innerHTML = s.bullets.map(function (b) { return '<li>' + b + '</li>'; }).join('');
      svLink.href = s.href;
      svNums.forEach(function (n, ni) { n.classList.toggle('is-active', ni === i); });
      svMenuItems.forEach(function (m, mi) { m.classList.toggle('is-active', mi === i); });
      requestAnimationFrame(function () { svContent.classList.add('is-visible'); });
      svPlayIntroSequence();
    }

    /* applies one layer's position/warp state via CSS custom properties;
       state.oy/state.iy are percentages (numbers), state.rot degrees */
    function svApplyState(idx, state) {
      svWraps[idx].style.setProperty('--sv-oy', state.oy + '%');
      svLayers[idx].style.setProperty('--sv-iy', state.iy + '%');
      svLayers[idx].style.setProperty('--sv-sx', state.sx);
      svLayers[idx].style.setProperty('--sv-sy', state.sy);
      svLayers[idx].style.setProperty('--sv-rot', state.rot + 'deg');
      svLayers[idx].style.setProperty('--sv-op', state.op);
    }

    function svCrossfadeTo(i, dir) {
      if (svTransitioning || i === svCurrent) return;
      svTransitioning = true;
      if (dir !== 1 && dir !== -1) dir = (i > svCurrent) ? 1 : -1;

      var fromIdx = svActive, toIdx = 1 - svActive;
      var toEl = svLayers[toIdx], fromEl = svLayers[fromIdx];
      var toWrap = svWraps[toIdx], fromWrap = svWraps[fromIdx];

      toEl.pause();
      toEl.src = svSlides[i].video;
      toEl.currentTime = 0;
      var p = toEl.play();
      if (p && p.catch) p.catch(function () {});

      if (svReducedMotion) {
        /* instant swap, no slide/warp animation */
        fromWrap.classList.remove('is-active');
        fromEl.pause();
        svApplyState(fromIdx, { oy: 0, iy: 0, sx: 1, sy: 1, rot: 0, op: 0 });
        toWrap.classList.add('is-active');
        svApplyState(toIdx, { oy: 0, iy: 0, sx: 1, sy: 1, rot: 0, op: 1 });
        svActive = toIdx;
        svSetSharedVideoName(svActive);
        svTransitioning = false;
        svCurrent = i;
        svRenderContent(i);
        return;
      }

      toWrap.classList.add('is-active');

      /* 1) drop the incoming layer off-screen (above/below, per dir),
         pre-warped, with transitions off so the jump is instant —
         mirrors hero.html's gsap.fromTo starting values */
      toWrap.classList.add('is-instant');
      svApplyState(toIdx, {
        oy: SV_OUTER_OFFSET * dir,
        iy: -SV_INNER_OFFSET * dir,
        sx: SV_SCALE_X, sy: SV_SCALE_Y, rot: SV_ROTATE, op: .5
      });
      void toWrap.offsetWidth; /* flush the instant jump before re-enabling the transition */

      requestAnimationFrame(function () {
        toWrap.classList.remove('is-instant');
        /* incoming layer settles into place */
        svApplyState(toIdx, { oy: 0, iy: 0, sx: 1, sy: 1, rot: 0, op: 1 });
        /* outgoing layer exits with the same overshoot/warp */
        svApplyState(fromIdx, {
          oy: -SV_OUTER_OFFSET * dir,
          iy: SV_INNER_OFFSET * dir,
          sx: SV_SCALE_X, sy: SV_SCALE_Y, rot: -SV_ROTATE, op: .5
        });
        fromWrap.classList.remove('is-active');
      });

      setTimeout(function () {
        fromEl.pause();
        fromWrap.classList.add('is-instant');
        svApplyState(fromIdx, { oy: 0, iy: 0, sx: 1, sy: 1, rot: 0, op: 0 });
        void fromWrap.offsetWidth;
        fromWrap.classList.remove('is-instant');
        svActive = toIdx;
        svSetSharedVideoName(svActive);
        svTransitioning = false;
      }, svCROSSFADE);

      svCurrent = i;
      svRenderContent(i);
    }

    function svResetAutoplay() {
      if (svTimer) clearInterval(svTimer);
      if (svReducedMotion) return;
      svTimer = setInterval(function () {
        svCrossfadeTo((svCurrent + 1) % svSlides.length, 1);
      }, svAUTOPLAY);
    }

    function svNext() { svCrossfadeTo((svCurrent + 1) % svSlides.length, 1); svResetAutoplay(); }
    function svPrev() { svCrossfadeTo((svCurrent - 1 + svSlides.length) % svSlides.length, -1); svResetAutoplay(); }

    var svNextBtn = document.getElementById('svNext');
    var svPrevBtn = document.getElementById('svPrev');
    if (svNextBtn) svNextBtn.addEventListener('click', svNext);
    if (svPrevBtn) svPrevBtn.addEventListener('click', svPrev);
    svNums.forEach(function (n, ni) {
      n.addEventListener('click', function () { svCrossfadeTo(ni); svResetAutoplay(); });
    });

    /* pause autoplay while pointer is over the slider */
    svHero.addEventListener('mouseenter', function () { if (svTimer) clearInterval(svTimer); });
    svHero.addEventListener('mouseleave', svResetAutoplay);

    /* horizontal swipe only — vertical page scroll stays untouched.
       touchmove only calls preventDefault once we're sure the gesture
       is horizontal, so native vertical scrolling is never blocked,
       but the browser/viewer's own horizontal pan can't fight our swipe. */
    var svStartX = null, svStartY = null, svSwipeLock = null;
    svHero.addEventListener('touchstart', function (e) {
      svStartX = e.touches[0].clientX;
      svStartY = e.touches[0].clientY;
      svSwipeLock = null;
    }, { passive: true });
    svHero.addEventListener('touchmove', function (e) {
      if (svStartX === null) return;
      var dx = e.touches[0].clientX - svStartX;
      var dy = e.touches[0].clientY - svStartY;
      if (svSwipeLock === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        svSwipeLock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (svSwipeLock === 'x' && e.cancelable) e.preventDefault();
    }, { passive: false });
    svHero.addEventListener('touchend', function (e) {
      if (svStartX === null) return;
      var dx = svStartX - e.changedTouches[0].clientX;
      var dy = svStartY - e.changedTouches[0].clientY;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx > 0) svNext(); else svPrev();
      }
      svStartX = null; svStartY = null; svSwipeLock = null;
    }, { passive: true });

    /* init */
    var svInitial = svIndexFromHash();
    svCurrent = svInitial;
    svLayers[0].src = svSlides[svInitial].video;
    svWraps[0].classList.add('is-active');
    svApplyState(0, { oy: 0, iy: 0, sx: 1, sy: 1, rot: 0, op: 1 });
    svSetSharedVideoName(0);
    var svInitPlay = svLayers[0].play();
    if (svInitPlay && svInitPlay.catch) svInitPlay.catch(function () {});
    svRenderContent(svInitial);
    svResetAutoplay();
  }

  /* =========================================================
     MOBILE NAV DRAWER
  ========================================================== */
  var menuToggle = document.getElementById('menuToggle');
  var navDrawer = document.getElementById('navDrawer');
  var navOverlay = document.getElementById('navOverlay');
  var navDrawerClose = document.getElementById('navDrawerClose');
  var navDrawerVideo = navDrawer ? navDrawer.querySelector('.nav-drawer-media video') : null;
  var navLinksList = navDrawer ? navDrawer.querySelector('.nav-drawer-links') : null;

  /* ---- панель мобильного меню теперь использует ту же зернистость,
     что и вся страница — единый .g_grain_overlay (см. разметку и стили
     выше). Отдельный canvas-шум панели удалён, чтобы не дублировать
     и не расходиться по виду с общим эффектом. ---- */

  if (navLinksList && !prefersReducedMotion) {
    var menuLinks = Array.prototype.slice.call(navLinksList.querySelectorAll('a'));
    var menuSpans = [];
    menuLinks.forEach(function (a) {
      menuSpans = menuSpans.concat(edgeSplit(a));
    });
    prepareEdgeBurst(menuSpans, 26);
  }

  function playMenuEdgeBurst() {
    if (prefersReducedMotion || !navLinksList) return;
    navLinksList.classList.remove('eb-play');
    void navLinksList.offsetWidth; /* force reflow so the animation can restart */
    navLinksList.classList.add('eb-play');
  }
  function resetMenuEdgeBurst() {
    if (navLinksList) { navLinksList.classList.remove('eb-play'); }
  }

  function openDrawer() {
    navDrawer.classList.add('is-open');
    navOverlay.classList.add('is-open');
    menuToggle.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    window.__lockBodyScroll();
    if (navDrawerVideo && navDrawerVideo.paused) { navDrawerVideo.play().catch(function () {}); }
    playMenuEdgeBurst();
  }
  function closeDrawer() {
    navDrawer.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    menuToggle.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    window.__unlockBodyScroll();
    resetMenuEdgeBurst();
  }
  if (menuToggle && navDrawer && navOverlay) {
    menuToggle.addEventListener('click', function () {
      if (navDrawer.classList.contains('is-open')) { closeDrawer(); } else { openDrawer(); }
    });
    navOverlay.addEventListener('click', closeDrawer);
    if (navDrawerClose) { navDrawerClose.addEventListener('click', closeDrawer); }
    navDrawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); }
    });
  }

  /* =========================================================
     SCROLL REVEAL
  ========================================================== */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();

/* ---- next block ---- */

(function () {

  /* =========================================================
     LEAD FORM SUBMISSION (Web3Forms)
  ========================================================== */
  var leadForm = document.getElementById('leadForm');
  if (leadForm) {
    var leadStatus = document.getElementById('leadFormStatus');
    var leadSubmitBtn = leadForm.querySelector('.submit-btn');
    var leadOriginalLabel = leadSubmitBtn ? leadSubmitBtn.textContent : '';

    var statusMessages = {
      sending: 'Sending…',
      ok:      'Thank you! Your request has been sent, we will reply within one business day.',
      err:     'Something went wrong. Please try again or email info@topscan.ge'
    };

    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      leadStatus.className = 'form-status';
      leadStatus.textContent = statusMessages.sending;
      leadStatus.style.display = 'block';
      leadStatus.style.color = 'var(--text-dim)';
      if (leadSubmitBtn) { leadSubmitBtn.disabled = true; }

      var formData = new FormData(leadForm);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            leadStatus.className = 'form-status ok';
            leadStatus.textContent = statusMessages.ok;
            leadForm.reset();
          } else {
            leadStatus.className = 'form-status err';
            leadStatus.textContent = statusMessages.err;
          }
        })
        .catch(function () {
          leadStatus.className = 'form-status err';
          leadStatus.textContent = statusMessages.err;
        })
        .finally(function () {
          if (leadSubmitBtn) { leadSubmitBtn.disabled = false; leadSubmitBtn.textContent = leadOriginalLabel; }
        });
    });
  }

  /* =========================================================
     EDGE BURST ENGINE (mobile menu)
  ========================================================== */
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var EB_DIRS = [
    { x: -120, y: 0 },
    { x: 120, y: 0 },
    { x: 0, y: -90 },
    { x: 0, y: 90 },
    { x: -100, y: -60 },
    { x: 100, y: 60 }
  ];

  function edgeSplit(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (word) {
      var w = '';
      for (var i = 0; i < word.length; i++) {
        w += '<span data-eb>' + word.charAt(i) + '</span>';
      }
      return '<span class="eb-word">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
    return Array.prototype.slice.call(el.querySelectorAll('[data-eb]'));
  }

  function prepareEdgeBurst(spans, stagger) {
    spans.forEach(function (span, i) {
      var d = EB_DIRS[i % EB_DIRS.length];
      span.style.setProperty('--ex', (d.x + (Math.random() * 40 - 20)).toFixed(0) + 'px');
      span.style.setProperty('--ey', (d.y + (Math.random() * 30 - 15)).toFixed(0) + 'px');
      span.style.animationDelay = (i * stagger) + 'ms';
    });
  }

  /* Word-level split + randomized delay: makes every line burst in
     together instead of a top-to-bottom sweep. */
  function edgeSplitWords(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (w) {
      return '<span data-eb style="display:inline-block;">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
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

  /* =========================================================
     ZIPPER SLIDE (hero title + breadcrumb + all h2/h3) + EDGE
     BURST (hero subtitle). Replays every time the element enters
     the viewport, scrolling either direction — same engine as the
     home page and services page.
  ========================================================== */
  var heroTitle = document.getElementById('heroTitle');
  var heroSub = document.getElementById('heroSub');
  var pageBreadcrumb = document.getElementById('pageBreadcrumb');

  function zipSplit(el, segmentSelector) {
    var lines = el.querySelectorAll(segmentSelector || '.hero-line');
    var source = lines.length ? Array.prototype.slice.call(lines) : [el];
    var counter = 0;
    source.forEach(function (line) {
      var text = line.textContent;
      var words = text.split(' ');
      var html = words.map(function (word) {
        var w = '';
        for (var i = 0; i < word.length; i++) {
          w += '<span data-zip style="--zi:' + counter + '">' + word.charAt(i) + '</span>';
          counter++;
        }
        return '<span class="zip-word">' + w + '</span>';
      }).join(' ');
      line.innerHTML = html;
    });
    el.setAttribute('data-zip-ready', '1');
    return counter;
  }

  function playZip(el) {
    el.classList.remove('zip-play');
    void el.offsetWidth;
    el.classList.add('zip-play');
  }
  function resetZip(el) {
    el.classList.remove('zip-play');
  }
  function playBurst(el) {
    el.classList.remove('eb-play');
    void el.offsetWidth;
    el.classList.add('eb-play');
  }
  function resetBurst(el) {
    el.classList.remove('eb-play');
  }

  if (!prefersReducedMotion) {
    /* ---- Breadcrumb: zipper, replaying on every viewport entry ---- */
    if (pageBreadcrumb) {
      Array.prototype.slice.call(pageBreadcrumb.children).forEach(function (ch) {
        ch.classList.add('zip-segment');
      });
      zipSplit(pageBreadcrumb, '.zip-segment');
      if ('IntersectionObserver' in window) {
        var breadcrumbIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playZip(entry.target); } else { resetZip(entry.target); }
          });
        }, { threshold: 0.3 });
        breadcrumbIO.observe(pageBreadcrumb);
      } else {
        pageBreadcrumb.classList.add('zip-play');
      }
    }

    /* ---- Hero: title -> subtitle, chained, replaying on every viewport entry ---- */
    var titleDuration = 850;

    if (heroTitle) {
      var zipCount = zipSplit(heroTitle);
      titleDuration = zipCount * 22 + 700 + 150;
    }
    if (heroSub) {
      var subSpans = edgeSplitWords(heroSub);
      prepareEdgeBurstRandom(subSpans, 220);
    }

    var heroTimers = [];
    function playHeroSequence() {
      heroTimers.forEach(function (t) { clearTimeout(t); });
      heroTimers = [];
      if (heroTitle) { playZip(heroTitle); }
      if (heroSub) { resetBurst(heroSub); }
      if (heroSub) {
        heroTimers.push(setTimeout(function () { playBurst(heroSub); }, titleDuration));
      }
    }
    function resetHeroSequence() {
      heroTimers.forEach(function (t) { clearTimeout(t); });
      heroTimers = [];
      if (heroTitle) { resetZip(heroTitle); }
      if (heroSub) { resetBurst(heroSub); }
    }

    if (heroTitle) {
      if ('IntersectionObserver' in window) {
        var heroIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playHeroSequence(); } else { resetHeroSequence(); }
          });
        }, { threshold: 0.3 });
        heroIO.observe(heroTitle);
      } else {
        playHeroSequence();
      }
    }

    /* ---- All h2 / h3: same zipper animation, replaying on every viewport entry ---- */
    var headingTargets = Array.prototype.slice.call(document.querySelectorAll('h2, h3'));
    headingTargets.forEach(function (h) { zipSplit(h); });

    if (headingTargets.length) {
      if ('IntersectionObserver' in window) {
        var headingIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { playZip(entry.target); } else { resetZip(entry.target); }
          });
        }, { threshold: 0.3 });
        headingTargets.forEach(function (h) { headingIO.observe(h); });
      } else {
        headingTargets.forEach(function (h) { h.classList.add('zip-play'); });
      }
    }
  }

  /* =========================================================
     MOBILE NAV DRAWER
  ========================================================== */
  var menuToggle = document.getElementById('menuToggle');
  var navDrawer = document.getElementById('navDrawer');
  var navOverlay = document.getElementById('navOverlay');
  var navDrawerClose = document.getElementById('navDrawerClose');
  var navDrawerVideo = navDrawer ? navDrawer.querySelector('.nav-drawer-media video') : null;
  var navLinksList = navDrawer ? navDrawer.querySelector('.nav-drawer-links') : null;

  if (navLinksList && !prefersReducedMotion) {
    var menuLinks = Array.prototype.slice.call(navLinksList.querySelectorAll('a'));
    var menuSpans = [];
    menuLinks.forEach(function (a) {
      menuSpans = menuSpans.concat(edgeSplit(a));
    });
    prepareEdgeBurst(menuSpans, 26);
  }

  function playMenuEdgeBurst() {
    if (prefersReducedMotion || !navLinksList) return;
    navLinksList.classList.remove('eb-play');
    void navLinksList.offsetWidth;
    navLinksList.classList.add('eb-play');
  }
  function resetMenuEdgeBurst() {
    if (navLinksList) { navLinksList.classList.remove('eb-play'); }
  }

  function openDrawer() {
    navDrawer.classList.add('is-open');
    navOverlay.classList.add('is-open');
    menuToggle.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    window.__lockBodyScroll();
    if (navDrawerVideo && navDrawerVideo.paused) { navDrawerVideo.play().catch(function () {}); }
    playMenuEdgeBurst();
  }
  function closeDrawer() {
    navDrawer.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    menuToggle.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    window.__unlockBodyScroll();
    resetMenuEdgeBurst();
  }
  if (menuToggle && navDrawer && navOverlay) {
    menuToggle.addEventListener('click', function () {
      if (navDrawer.classList.contains('is-open')) { closeDrawer(); } else { openDrawer(); }
    });
    navOverlay.addEventListener('click', closeDrawer);
    if (navDrawerClose) { navDrawerClose.addEventListener('click', closeDrawer); }
    navDrawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); }
    });
  }

  /* =========================================================
     PAGE-BG ANIMATION — SLIDE AWAY AS FOOTER APPROACHES
     The background (inlined polka.html canvas) is position:fixed (always
     full-viewport), sitting behind the header (z-index:-1 vs the
     header's z-index:100), so it is already visually "under" the
     header at all times. As the footer scrolls up into view from
     the bottom, we translate the fixed background upward by exactly
     how much of the footer is already visible, so the background
     visibly rises/scrolls away — disappearing behind the header at
     the top — in sync with the footer, instead of ever appearing to
     sit still underneath the footer's own media. Once the footer
     fully covers the viewport, the background has been pushed
     exactly one viewport-height up (fully out of view).
  ========================================================== */
  var siteBg = document.querySelector('.site-bg-video');
  var pageFooter = document.querySelector('footer');
  if (siteBg && pageFooter) {
    var lastOffset = -1;
    var ticking = false;
    var updateBgOffset = function () {
      var vh = window.innerHeight;
      var footerTop = pageFooter.getBoundingClientRect().top;
      var visibleFooter = vh - footerTop; // how much of the footer has entered the viewport
      var offset = Math.max(0, Math.min(vh, visibleFooter));
      if (offset !== lastOffset) {
        siteBg.style.transform = offset ? 'translateY(-' + offset + 'px)' : '';
        lastOffset = offset;
      }
      ticking = false;
    };
    var onScrollOrResize = function () {
      if (!ticking) {
        window.requestAnimationFrame(updateBgOffset);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    updateBgOffset();
  }

  /* =========================================================
     SCROLL REVEAL
  ========================================================== */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();

/* ---- next block ---- */

(function(){
  var canvas = document.getElementById('site-bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  /* This field is 2D-canvas software work: every point gets its own noise
     sample and its own beginPath/arc/fill call, every frame, whether or not
     the page is scrolling. At the full desktop density that's fine, but on
     touch devices it was running unthrottled on the same main thread as the
     scroll engine (and, on offer pages, two playing <video> elements) — the
     single biggest contributor to the mobile stutter. Mobile gets a quarter
     of the points and half the frame rate; about-us's equivalent background
     doesn't have this cost at all because it's a single WebGL draw call, so
     it isn't throttled. */
  var isCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // ---- Grid setup (world space) ----
  var COLS = isCoarse ? 45 : 90;
  var ROWS = isCoarse ? 70 : 140;
  var SPACING = 0.34;

  // ---- camera / projection ----
  var CAM_DIST = 26;
  var FOCAL = 620;

  // The particle field has a fixed "natural" size in world units. At rest
  // (no rotation/wave) it projects to a fixed pixel box roughly
  // BASE_HALF_W_PX x BASE_HALF_H_PX around the screen center. On wide/tall
  // desktop viewports that fixed box doesn't reach the edges, leaving black
  // gutters. coverScale (recomputed on resize, like CSS background-size:
  // cover) uniformly blows the projected positions up just enough that the
  // field always spans the full viewport in both directions.
  var BASE_HALF_W_PX = (COLS/2) * SPACING * (FOCAL/CAM_DIST);
  var BASE_HALF_H_PX = (ROWS/2) * SPACING * (FOCAL/CAM_DIST);

  var count = COLS * ROWS;
  var baseX = new Float32Array(count);
  var baseY = new Float32Array(count);

  var k = 0;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      baseX[k] = (c - COLS/2) * SPACING;
      baseY[k] = (r - ROWS/2) * SPACING;
      k++;
    }
  }

  // ---- cheap smooth value noise ----
  function fade(t){ return t*t*t*(t*(t*6-15)+10); }
  function lerp(a,b,t){ return a+t*(b-a); }
  function hash(x,y,z){
    var s = Math.sin(x*127.1 + y*311.7 + z*74.7) * 43758.5453123;
    return s - Math.floor(s);
  }
  function noise3(x,y,z){
    var xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
    var xf=x-xi, yf=y-yi, zf=z-zi;
    var u=fade(xf), v=fade(yf), w=fade(zf);
    var c000=hash(xi,yi,zi),     c100=hash(xi+1,yi,zi);
    var c010=hash(xi,yi+1,zi),   c110=hash(xi+1,yi+1,zi);
    var c001=hash(xi,yi,zi+1),   c101=hash(xi+1,yi,zi+1);
    var c011=hash(xi,yi+1,zi+1), c111=hash(xi+1,yi+1,zi+1);
    var x00=lerp(c000,c100,u), x10=lerp(c010,c110,u);
    var x01=lerp(c001,c101,u), x11=lerp(c011,c111,u);
    var y0=lerp(x00,x10,v), y1=lerp(x01,x11,v);
    return lerp(y0,y1,w) * 2 - 1;
  }

  // ---- pointer parallax ----
  var targetYaw = 0, targetPitch = 0;
  var yaw = 0, pitch = 0;
  function setTarget(nx, ny){
    targetYaw = nx * 0.5;
    targetPitch = -ny * 0.3;
  }
  window.addEventListener('mousemove', function(e){
    setTarget((e.clientX/window.innerWidth)*2-1, (e.clientY/window.innerHeight)*2-1);
  });
  window.addEventListener('touchmove', function(e){
    if(!e.touches.length) return;
    var t = e.touches[0];
    setTarget((t.clientX/window.innerWidth)*2-1, (t.clientY/window.innerHeight)*2-1);
  }, {passive:true});

  var W, H, DPR, coverScale;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    coverScale = Math.max(
      (W/2) / BASE_HALF_W_PX,
      (H/2) / BASE_HALF_H_PX,
      1
    );
  }
  window.addEventListener('resize', resize);
  resize();

  var pts = new Array(count);
  for (var i=0;i<count;i++) pts[i] = {sx:0, sy:0, scale:0, z:0};

  var t0 = performance.now();
  var skipFrame = false;

  function frame(now){
    requestAnimationFrame(frame);
    if (isCoarse) { skipFrame = !skipFrame; if (skipFrame) return; }
    var t = (now - t0) / 1000;

    yaw += (targetYaw - yaw) * 0.035;
    pitch += (targetPitch - pitch) * 0.035;
    var autoYaw = yaw + Math.sin(t*0.09) * 0.12;
    var autoPitch = pitch + Math.sin(t*0.07) * 0.06;

    var cosY = Math.cos(autoYaw), sinY = Math.sin(autoYaw);
    var cosP = Math.cos(autoPitch), sinP = Math.sin(autoPitch);

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,W,H);

    var cx = W/2, cy = H/2;

    for (var j=0;j<count;j++){
      var bx = baseX[j];
      var by = baseY[j];

      var n1 = noise3(bx*0.5, by*0.32 + t*0.35, t*0.15);
      var n2 = noise3(bx*1.2 + 10.0, by*0.85 - t*0.25, t*0.22) * 0.5;
      var ripple = Math.sin(by*1.5 - t*1.1 + bx*0.35) * 0.35;
      var wz = (n1*1.6 + n2 + ripple);

      var x = bx*cosY - wz*sinY;
      var z = bx*sinY + wz*cosY;
      var y = by*cosP - z*sinP;
      z = by*sinP + z*cosP;

      var depth = z + CAM_DIST;
      if (depth <= 1) { pts[j].scale = 0; continue; }
      var scale = FOCAL / depth;

      pts[j].sx = cx + x * scale * coverScale;
      pts[j].sy = cy + y * scale * coverScale;
      pts[j].scale = scale;
      pts[j].z = wz;
    }

    for (var m=0;m<count;m++){
      var p = pts[m];
      if (p.scale <= 0) continue;
      if (p.sx < -20 || p.sx > W+20 || p.sy < -20 || p.sy > H+20) continue;

      var size = Math.max(0.4, 1.55 * p.scale * Math.sqrt(coverScale) * 0.045);
      var bright = 0.35 + Math.max(-0.3, Math.min(0.55, p.z * 0.28));
      var g = Math.round(200 * bright + 40);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + g + ',' + (g+8) + ',' + (g+16) + ',' + (0.55+bright*0.4) + ')';
      ctx.arc(p.sx, p.sy, size, 0, Math.PI*2);
      ctx.fill();
    }
  }
  requestAnimationFrame(frame);
})();

(function () {

  /* =========================================================
     FOOTER + MOBILE-MENU CONTACTS — EDGE BURST
     (same word-burst animation as the hero subtitle, self-
     contained here since the footer and the mobile nav drawer
     are present on every page type.)
  ========================================================== */
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (prefersReducedMotion) return;

  var EB_DIRS = [
    { x: -120, y: 0 },
    { x: 120, y: 0 },
    { x: 0, y: -90 },
    { x: 0, y: 90 },
    { x: -100, y: -60 },
    { x: 100, y: 60 }
  ];

  /* Word-level split (identical technique to the hero subtitle):
     wraps each word of an element's own text in a [data-eb] span,
     keeping the element itself (e.g. the <a>) intact. */
  function edgeSplitWords(el) {
    var text = el.textContent;
    var words = text.split(' ');
    var html = words.map(function (w) {
      return '<span data-eb style="display:inline-block;">' + w + '</span>';
    }).join(' ');
    el.innerHTML = html;
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

  function playBurst(el) {
    el.classList.remove('eb-play');
    void el.offsetWidth; /* force reflow so the animation can restart */
    el.classList.add('eb-play');
  }
  function resetBurst(el) {
    el.classList.remove('eb-play');
  }

  /* Splits every <a> inside a container individually (so hrefs stay
     intact) and returns the flat list of spans produced. */
  function splitContactLinks(container) {
    var spans = [];
    Array.prototype.slice.call(container.querySelectorAll('a')).forEach(function (a) {
      spans = spans.concat(edgeSplitWords(a));
    });
    prepareEdgeBurstRandom(spans, 220);
    return spans;
  }

  /* ---- Footer contacts: burst in the same way as the hero
     subtitle, replaying every time the footer contact column
     scrolls into view. ---- */
  var footerContacts = document.querySelector('.footer-contacts');
  if (footerContacts) {
    splitContactLinks(footerContacts);
    if ('IntersectionObserver' in window) {
      var footerContactsIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { playBurst(footerContacts); } else { resetBurst(footerContacts); }
        });
      }, { threshold: 0.3 });
      footerContactsIO.observe(footerContacts);
    } else {
      footerContacts.classList.add('eb-play');
    }
  }

  /* ---- Mobile menu drawer contacts: burst in the same way,
     replaying every time the drawer is opened. ---- */
  var navDrawer = document.getElementById('navDrawer');
  var navDrawerContacts = navDrawer ? navDrawer.querySelector('.nav-drawer-contacts') : null;
  if (navDrawerContacts) {
    splitContactLinks(navDrawerContacts);
    var navDrawerObserver = new MutationObserver(function () {
      if (navDrawer.classList.contains('is-open')) {
        playBurst(navDrawerContacts);
      } else {
        resetBurst(navDrawerContacts);
      }
    });
    navDrawerObserver.observe(navDrawer, { attributes: true, attributeFilter: ['class'] });
  }

  /* =========================================================
     SITE-WIDE WEIGHTED SCROLL (wheel + touch + keyboard)
     Same engine as the about page's full-screen team profile: input
     (wheel, a finger, or a key) moves a TARGET, and the page's
     visible scroll position eases toward it a fixed share of the
     remaining distance every frame — independent of refresh rate, so
     it feels the same weight on a 60Hz and a 120Hz screen. During a
     touch drag the content deliberately trails the finger a little
     (not 1:1) and settles with a soft catch-up once it lifts, rather
     than the sharp stop of native touch scrolling.
     It still drives the page's REAL scroll position (window.scrollTo),
     not a transform on a wrapper: every existing scroll-driven bit of
     the site — IntersectionObserver reveals, the footer-background
     slide below, #anchor links, the mobile browser's own address-bar
     behaviour, screen-reader and no-JS scrolling — keeps working
     exactly as before, just eased and heavier.
     Elements with their own native scrolling opt out entirely: the
     nav drawer, the services bottom-sheet menu, the about page's
     full-screen team profile (which runs the very same engine, just
     inside its own fixed layer — see about.js), form fields, and the
     equipment slideshow's horizontal swipe. */
  (function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var EASE_60 = 0.065;        // share of the remaining distance covered per 60fps frame — lower = heavier/more viscous
    var RESYNC_PX = 2;          // native scroll moved more than this since our last frame (scrollbar drag, anchor jump): stop lerping, re-sync
    var TOUCH_GAIN = 1.35;      // finger px -> target px (>1 = the content noticeably trails the finger while dragging)
    var AXIS_LOCK_PX = 8;       // px of travel before a touch commits to a vertical or horizontal gesture
    var FLING_MS = 220, FLING_MIN = 0.1, FLING_MAX = 1300;   // release velocity (px/ms) carries the target a little further

    var target = window.scrollY || window.pageYOffset || 0;
    var current = target;
    var raf = null, last = 0;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    function ownsItsScroll(el) {
      return !!(el && el.closest && el.closest(
        '.nav-drawer, .sv-menu, .member-detail, input, textarea, select, [contenteditable], iframe'
      ));
    }
    function locked() { return document.body.dataset.scrollLockY !== undefined; }   // nav drawer / team profile has frozen the page

    function tick(now) {
      var dt = last ? Math.min(50, now - last) : 16.667;
      last = now;
      var k = 1 - Math.pow(1 - EASE_60, dt / 16.667);
      var diff = target - current;
      if (Math.abs(diff) < 0.4) {
        current = target; last = 0;
        window.scrollTo({ top: current, left: 0, behavior: 'instant' });
        raf = null;
        return;
      }
      current += diff * k;
      window.scrollTo({ top: current, left: 0, behavior: 'instant' });
      raf = requestAnimationFrame(tick);
    }
    function kick() { if (raf === null) { last = 0; raf = requestAnimationFrame(tick); } }
    function resync() {
      var liveY = window.scrollY || window.pageYOffset || 0;
      if (raf === null || Math.abs(liveY - current) > RESYNC_PX) current = target = liveY;
    }
    function moveTarget(d) { target = Math.max(0, Math.min(maxScroll(), target + d)); }

    window.addEventListener('wheel', function (e) {
      if (locked() || ownsItsScroll(e.target)) return;
      resync();
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;                     // DOM_DELTA_LINE
      else if (e.deltaMode === 2) delta *= window.innerHeight; // DOM_DELTA_PAGE
      moveTarget(delta);
      e.preventDefault();
      kick();
    }, { passive: false });

    var t = null;   // active touch, while it's driving the page
    window.addEventListener('touchstart', function (e) {
      if (locked() || ownsItsScroll(e.target) || e.touches.length !== 1) { t = null; return; }
      resync();
      var p = e.touches[0];
      t = { x0: p.clientX, y0: p.clientY, y: p.clientY, ts: performance.now(), v: 0, axis: null };
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!t || e.defaultPrevented || !e.touches.length) return;   // another handler (e.g. the slideshow) already claimed this gesture
      var p = e.touches[0];
      if (t.axis === null) {
        var dx = p.clientX - t.x0, dy = p.clientY - t.y0;
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        t.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
        if (t.axis === 'x') { t = null; return; }   // horizontal: leave it to whatever else handles it
      }
      var now = performance.now();
      var dy = (t.y - p.clientY) * TOUCH_GAIN;
      // Already at the top and still pulling further down: don't claim this
      // gesture, so the browser's native pull-to-refresh/bounce can take it.
      if (target <= 0 && current <= 0 && dy < 0) { t = null; return; }
      e.preventDefault();
      var dt = Math.max(1, now - t.ts);
      t.v = t.v * 0.7 + (dy / dt) * 0.3;              // smoothed release velocity, px/ms
      t.y = p.clientY; t.ts = now;
      moveTarget(dy);
      kick();
    }, { passive: false });

    function touchEnd() {
      if (!t || t.axis !== 'y') { t = null; return; }
      var v = (performance.now() - t.ts > 80) ? 0 : t.v;   // finger rested before lifting: no fling
      if (Math.abs(v) > FLING_MIN) moveTarget(Math.max(-FLING_MAX, Math.min(FLING_MAX, v * FLING_MS)));
      kick();
      t = null;
    }
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('touchcancel', touchEnd, { passive: true });

    /* Keyboard: only when nothing more specific has focus — matches the browser's own rule that
       arrows/space/page keys scroll the page solely while focus sits on <body>; a focused link,
       button or field keeps its native key behaviour untouched. */
    window.addEventListener('keydown', function (e) {
      if (locked() || document.activeElement !== document.body) return;
      var page = window.innerHeight * 0.85, d = null;
      if (e.key === 'ArrowDown') d = 90;
      else if (e.key === 'ArrowUp') d = -90;
      else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) d = page;
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) d = -page;
      else if (e.key === 'End') d = maxScroll() - target;
      else if (e.key === 'Home') d = -target;
      if (d === null) return;
      resync();
      e.preventDefault();
      moveTarget(d);
      kick();
    });

    window.addEventListener('resize', function () {
      target = Math.min(target, maxScroll());
    });
  })();

  /* =========================================================
     MEDIA-WINDOW PARALLAX
     Same technique as the reference file's card__img parallax:
     for each boxed media element, measure how far its center sits
     from the viewport center and nudge the media inside it a
     little the opposite way, scaled up slightly so the shifted
     edges never peek out of the box (which has overflow:hidden).
     Works on any element marked data-parallax — currently the
     equipment slideshow, the service-detail hero video and the
     terrain preview video.
  ========================================================== */
  (function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!boxes.length) return;

    var STRENGTH = 60; // px of travel at the viewport edges
    var SCALE = 1.12;  // headroom so the parallax shift never exposes the box's edges

    var items = boxes.map(function (box) {
      var media = box.querySelector(':scope > .slideshow, :scope > .terrain-video-wrap') ||
                  box.querySelector('video, img');
      if (media) media.style.willChange = 'transform';
      var isVideo = !!(media && (media.tagName === 'VIDEO' || media.querySelector('video')));
      return { box: box, media: media, isVideo: isVideo };
    }).filter(function (it) { return it.media; });
    if (!items.length) return;

    // Video parallax (the hero/terrain videos on offer pages) is the expensive
    // case: the decode + compose of an autoplaying <video> already leans on the
    // main thread, and this loop's own getBoundingClientRect()+transform write
    // stacks on top of it every frame. Two of those running at once on a phone
    // is what caused the offer-page stutter, so on touch devices we update
    // video parallax at 30fps instead of 60fps — the shift itself is slow and
    // subtle, so the halved rate isn't visible, but it does halve the layout
    // reads competing with video playback during a scroll.
    var isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var frame = 0;

    var visible = [];
    var raf = null;

    function tick() {
      frame++;
      var vh = window.innerHeight;
      var skipVideoThisFrame = isTouch && (frame % 2 === 0);
      visible.forEach(function (it) {
        if (skipVideoThisFrame && it.isVideo) return;
        var rect = it.box.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var offset = (center - vh / 2) / vh;
        var translate = (-offset * STRENGTH).toFixed(2);
        it.media.style.transform = 'translateY(' + translate + 'px) scale(' + SCALE + ')';
      });
      raf = visible.length ? requestAnimationFrame(tick) : null;
    }

    function ensureLoop() {
      if (visible.length && raf === null) raf = requestAnimationFrame(tick);
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var it = items.filter(function (i) { return i.box === entry.target; })[0];
          if (!it) return;
          var idx = visible.indexOf(it);
          if (entry.isIntersecting && idx === -1) visible.push(it);
          else if (!entry.isIntersecting && idx !== -1) visible.splice(idx, 1);
        });
        ensureLoop();
      }, { rootMargin: '20% 0px' });
      items.forEach(function (it) { io.observe(it.box); });
    } else {
      visible = items.slice();
      ensureLoop();
    }

    window.addEventListener('resize', ensureLoop);
  })();
})();
