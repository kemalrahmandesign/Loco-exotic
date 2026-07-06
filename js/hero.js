/*
 * Scroll-driven hero: scroll position scrubs the reveal video while text
 * beats fade in/out over the void.
 *
 * Modes:
 *  - "scrub"    (default, fine pointers): scroll progress -> video.currentTime,
 *               seeks issued inside rAF only, after iOS-style play/pause priming.
 *  - "autoplay" (coarse pointer/touch, or when seeks prove too slow): the clip
 *               plays through once when the hero enters; only the text beats
 *               follow scroll progress.
 *  - "static"   (prefers-reduced-motion): the final side-profile frame is shown
 *               as a still; beats fade with scroll, no translate.
 */
(function () {
  'use strict';

  var track = document.querySelector('[data-hero-track]');
  if (!track) return;

  var stage = track.querySelector('[data-hero-stage]');
  var video = track.querySelector('[data-hero-video]');
  var endFrame = track.querySelector('[data-hero-endframe]');
  var cue = track.querySelector('[data-hero-cue]');

  var beats = [];
  var beatEls = track.querySelectorAll('[data-beat]');
  for (var i = 0; i < beatEls.length; i++) {
    var el = beatEls[i];
    beats.push({
      el: el,
      inStart: parseFloat(el.dataset.in),
      inEnd: parseFloat(el.dataset.inEnd),
      outStart: parseFloat(el.dataset.out),
      outEnd: parseFloat(el.dataset.outEnd),
      opacity: -1
    });
  }

  // The reveal completes at 90% of hero progress, holding the side profile
  // for the final stretch so it "lands" before the hero unpins.
  var SCRUB_END = 0.9;
  var SEEK_EPSILON = 1 / 30;
  var SLOW_SEEK_MS = 300;
  var SLOW_SEEK_LIMIT = 4;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer =
    window.matchMedia('(pointer: coarse)').matches ||
    (window.matchMedia('(hover: none)').matches && 'ontouchstart' in window);

  var mode = reducedMotion ? 'static' : coarsePointer ? 'autoplay' : 'scrub';

  var primed = false;
  var primeFailed = false;
  var playedThrough = false;
  var lastSetTime = -1;
  var seekIssuedAt = 0;
  var slowSeeks = 0;
  var active = false;
  var rafId = null;

  /* ---------------------------------------------------------------- */
  /* Mode setup                                                        */
  /* ---------------------------------------------------------------- */

  if (mode === 'static') {
    // No playback at all: swap the video for the final side-profile still.
    video.removeAttribute('autoplay');
    video.preload = 'none';
    video.hidden = true;
    endFrame.hidden = false;
  } else {
    video.muted = true; // property, not just attribute — iOS requires both
    if (mode === 'scrub') {
      if (video.readyState >= 1) {
        prime();
      } else {
        video.addEventListener('loadedmetadata', prime, { once: true });
      }
      video.addEventListener('seeked', onSeeked);
    }
  }

  // iOS refuses currentTime scrubbing until a muted play()/pause() cycle.
  function prime() {
    var p;
    try {
      p = video.play();
    } catch (err) {
      primeFailed = true;
      return;
    }
    if (p && typeof p.then === 'function') {
      p.then(function () {
        video.pause();
        primed = true;
      }).catch(function () {
        // Autoplay rejected: retry on the first user gesture.
        primeFailed = true;
        retryPrimeOnGesture();
      });
    } else {
      video.pause();
      primed = true;
    }
  }

  function retryPrimeOnGesture() {
    var retry = function () {
      window.removeEventListener('touchstart', retry);
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('scroll', retry);
      if (!primed) prime();
    };
    window.addEventListener('touchstart', retry, { once: true, passive: true });
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('scroll', retry, { once: true, passive: true });
  }

  function onSeeked() {
    if (!seekIssuedAt) return;
    var latency = performance.now() - seekIssuedAt;
    seekIssuedAt = 0;
    if (latency > SLOW_SEEK_MS) {
      slowSeeks++;
      if (slowSeeks >= SLOW_SEEK_LIMIT) fallBackToAutoplay();
    } else {
      slowSeeks = 0;
    }
  }

  // Scrubbing is too janky on this device — degrade to play-through.
  function fallBackToAutoplay() {
    if (mode !== 'scrub') return;
    mode = 'autoplay';
    video.removeEventListener('seeked', onSeeked);
    if (active && !playedThrough) playThrough();
  }

  /* ---------------------------------------------------------------- */
  /* Scroll progress -> render                                         */
  /* ---------------------------------------------------------------- */

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function ramp(p, a, b) {
    return b > a ? clamp01((p - a) / (b - a)) : p >= a ? 1 : 0;
  }

  function progress() {
    var rect = track.getBoundingClientRect();
    var scrollable = rect.height - window.innerHeight;
    return scrollable > 0 ? clamp01(-rect.top / scrollable) : 0;
  }

  function renderBeats(p) {
    for (var j = 0; j < beats.length; j++) {
      var b = beats[j];
      var rIn = ramp(p, b.inStart, b.inEnd);
      var rOut = ramp(p, b.outStart, b.outEnd);
      var opacity = rIn * (1 - rOut);
      if (Math.abs(opacity - b.opacity) < 0.005) continue;
      b.opacity = opacity;
      b.el.style.opacity = opacity.toFixed(3);
      if (!reducedMotion) {
        var y = (1 - rIn) * 24 - rOut * 24;
        b.el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      }
    }
  }

  function seekReady(t) {
    var s = video.seekable;
    for (var k = 0; k < s.length; k++) {
      if (t >= s.start(k) && t <= s.end(k)) return true;
    }
    return false;
  }

  function scrubTo(p) {
    if (!primed || !video.duration) return;
    var t = clamp01(p / SCRUB_END) * Math.max(video.duration - 0.05, 0);
    if (Math.abs(t - lastSetTime) < SEEK_EPSILON) return;
    if (video.readyState < 2 || !seekReady(t)) return;
    lastSetTime = t;
    seekIssuedAt = performance.now();
    video.currentTime = t;
  }

  function render() {
    var p = progress();
    renderBeats(p);
    cue.classList.toggle('is-hidden', p > 0.02);
    if (mode === 'scrub') scrubTo(p);
  }

  function tick() {
    if (!active) {
      rafId = null;
      return;
    }
    render();
    rafId = requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------- */
  /* Autoplay fallback playback                                        */
  /* ---------------------------------------------------------------- */

  function playThrough() {
    if (mode !== 'autoplay') return;
    if (playedThrough) {
      // Re-entering the hero mid-clip: resume instead of restarting.
      if (video.paused && !video.ended) video.play().catch(function () {});
      return;
    }
    var p;
    try {
      p = video.play();
    } catch (err) {
      return;
    }
    playedThrough = true;
    if (p && typeof p.then === 'function') {
      p.catch(function () {
        // Blocked: retry once on first gesture so the reveal still happens.
        playedThrough = false;
        window.addEventListener('touchstart', playThrough, { once: true, passive: true });
        window.addEventListener('pointerdown', playThrough, { once: true });
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Activate the rAF loop only while the hero is near the viewport    */
  /* ---------------------------------------------------------------- */

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !active) {
          active = true;
          if (mode === 'autoplay') playThrough();
          if (rafId === null) rafId = requestAnimationFrame(tick);
        } else if (!visible && active) {
          active = false;
          if (mode === 'autoplay' && !video.ended && !video.paused) video.pause();
        }
      },
      { rootMargin: '20% 0px 20% 0px' }
    );
    io.observe(stage);
  } else {
    active = true;
    if (mode === 'autoplay') playThrough();
    rafId = requestAnimationFrame(tick);
  }

  // Paint the initial state (cue visible, beats at their p=0 opacity).
  render();
})();
