/* home-v2.js — EXPERIMENT: drives the pinned hero of tpl_index_v2.html.
   One job: turn scroll position inside .hv2-runway into
     • the CSS variable --p (0..1) on the stage (CSS does all the visuals), and
     • the telemetry log lines (a line is shown once progress passes its data-at).
   Cheap by design: one passive scroll listener, one rAF per frame, active only
   while the runway is on screen. Nothing runs under prefers-reduced-motion. */
(function () {
  'use strict';
  var runway = document.getElementById('hv2Runway');
  var stage  = document.getElementById('hv2Stage');
  var logEl  = document.getElementById('hv2Log');
  if (!runway || !stage) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var lines = logEl ? [].slice.call(logEl.children) : [];
  var at = lines.map(function (l) { return parseFloat(l.getAttribute('data-at')) || 0; });
  var VISIBLE = 6;                 // how many log lines stay on screen
  var last = -1, shown = -2, ticking = false, active = true;

  function measure() {
    var r = runway.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    var p = span > 0 ? -r.top / span : 0;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  function renderLog(p) {
    var n = -1, i;
    for (i = 0; i < at.length; i++) if (p >= at[i]) n = i;
    if (n !== shown) {
      for (i = 0; i < lines.length; i++) {
        var on = i <= n;
        lines[i].classList.toggle('is-on', on);
        lines[i].classList.toggle('is-gone', on && i < n - (VISIBLE - 1));
        lines[i].classList.toggle('is-old', on && i < n - 2);
      }
      shown = n;
    }
  }

  function render(p) {
    // Round so the style isn't invalidated for imperceptible changes
    var q = Math.round(p * 1000) / 1000;
    if (q !== last) {
      stage.style.setProperty('--p', q);
      stage.classList.toggle('is-past', q > .3);
      last = q;
    }
    renderLog(p);
  }

  function frame() { ticking = false; render(measure()); }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  // Listen only while the runway is near the viewport
  var io = new IntersectionObserver(function (es) {
    var vis = es[0].isIntersecting;
    if (vis && !active) { window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); }
    if (!vis && active)  { window.removeEventListener('scroll', onScroll); }
    active = vis;
  }, { rootMargin: '100px 0px' });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  io.observe(runway);

  // First frame: boot lines play on their own for a moment, so the page isn't "empty" before the first scroll
  render(0);
  var boot = 0, bootTimer = setInterval(function () {
    boot += 0.02;
    if (measure() > 0.02 || boot > 0.14) { clearInterval(bootTimer); return; }
    renderLog(boot);   // log only — --p stays 0 so the headline isn't touched
  }, 260);
})();
