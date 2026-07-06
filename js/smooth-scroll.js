/*
 * Dependency-free smooth / momentum scrolling.
 *
 * Engages ONLY for fine pointers (mouse / trackpad): it captures wheel input,
 * eases the real window scroll position toward a target each frame, and lets
 * that inertia drive everything downstream (including the hero video scrub, so
 * the reveal eases too).
 *
 * It deliberately does NOTHING on touch / coarse pointers — iOS & Android
 * native momentum is already excellent, and hijacking it there breaks inline
 * video playback, the address-bar hide behavior, and the hero's touch
 * fallback. Reduced-motion also opts out entirely.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduce || coarse) return;

  var root = document.documentElement;
  // Tell CSS to stop applying native smooth scroll — we own the easing now.
  root.classList.add('js-smooth');

  var EASE = 0.14; // per-frame lerp factor -> higher = snappier, lower = floatier
  var target = window.scrollY || window.pageYOffset || 0;
  var current = target;
  var lastSet = -1;
  var running = false;

  function maxScroll() {
    return Math.max(0, root.scrollHeight - window.innerHeight);
  }

  function clamp(v) {
    var m = maxScroll();
    return v < 0 ? 0 : v > m ? m : v;
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    // If something other than us moved the scroll (keyboard, scrollbar drag,
    // anchor jump, focus), resync so we don't fight it or snap back.
    if (lastSet !== -1 && Math.abs(window.scrollY - lastSet) > 2) {
      current = target = window.scrollY;
    }

    var diff = target - current;
    if (Math.abs(diff) < 0.5) {
      current = target;
      window.scrollTo(0, current);
      lastSet = Math.round(current);
      running = false;
      return;
    }

    current += diff * EASE;
    var y = Math.round(current);
    window.scrollTo(0, y);
    lastSet = y;
    requestAnimationFrame(tick);
  }

  function onWheel(e) {
    // Let pinch-zoom (ctrl+wheel) and modified scrolls pass through natively.
    if (e.ctrlKey) return;
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16; // lines -> ~px
    else if (e.deltaMode === 2) delta *= window.innerHeight; // pages -> px
    target = clamp(target + delta);
    start();
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', function () {
    target = clamp(target);
    current = clamp(current);
  });
  window.addEventListener('load', function () {
    // Adopt whatever the browser restored (e.g. deep link / refresh position).
    target = current = window.scrollY;
    lastSet = Math.round(current);
  });
})();
