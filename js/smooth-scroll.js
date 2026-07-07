/*
 * Dependency-free smooth / momentum scrolling.
 *
 * Engages ONLY for fine pointers (mouse / trackpad): it captures wheel input,
 * eases the real window scroll toward a target each frame, and — after input
 * stops — keeps gliding on a decaying throw velocity so a flick coasts to a
 * stop instead of halting dead. That inertia drives everything downstream,
 * including the hero video scrub.
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

  var LAMBDA = 5;          // catch-up rate; lower = floatier easing
  var FRICTION = 0.93;     // per-frame (60fps) decay of the throw velocity
  var THROW = 0.38;        // how much of a wheel notch becomes throw velocity
  var BLEND = 0.55;        // how much prior throw survives a new notch
  var MAX_VEL = 90;        // px/frame cap on the throw
  var MIN_VEL = 0.3;       // below this the glide is finished
  var INERTIA_DELAY = 80;  // ms after the last wheel event before glide begins

  var target = window.scrollY || 0;
  var current = target;
  var lastSet = -1;
  var vel = 0;
  var lastWheelTs = 0;
  var running = false;
  var lastTick = 0;

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
      lastTick = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    var dt = Math.min((now - lastTick) / 1000, 0.05) || 0.016;
    lastTick = now;

    // If something other than us moved the scroll (keyboard, scrollbar drag,
    // anchor jump, focus), resync so we don't fight it or snap back.
    if (lastSet !== -1 && Math.abs(window.scrollY - lastSet) > 2) {
      current = target = window.scrollY;
      vel = 0;
    }

    // Inertia: once wheel input pauses, the throw keeps the target gliding.
    if (now - lastWheelTs > INERTIA_DELAY && Math.abs(vel) > MIN_VEL) {
      var next = clamp(target + vel * dt * 60);
      if (next === target) vel = 0; // hit an edge — stop grinding against it
      target = next;
      vel *= Math.pow(FRICTION, dt * 60);
    }

    var diff = target - current;
    var settled = Math.abs(diff) < 0.5 && Math.abs(vel) <= MIN_VEL;
    if (settled) {
      current = target;
    } else {
      // Framerate-independent exponential ease toward the target.
      current += diff * (1 - Math.exp(-LAMBDA * dt));
    }

    var y = Math.round(current);
    if (y !== lastSet) {
      window.scrollTo(0, y);
      lastSet = y;
    }

    if (settled) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  }

  function onWheel(e) {
    // Let pinch-zoom (ctrl+wheel) pass through natively.
    if (e.ctrlKey) return;
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16; // lines -> ~px
    else if (e.deltaMode === 2) delta *= window.innerHeight; // pages -> px

    if (delta * vel < 0) vel = 0; // direction flip kills the old throw
    target = clamp(target + delta);
    var v = vel * BLEND + delta * THROW * (1 - BLEND);
    vel = Math.max(-MAX_VEL, Math.min(MAX_VEL, v));
    lastWheelTs = performance.now();
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
    vel = 0;
  });
})();
