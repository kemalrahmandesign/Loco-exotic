/* LOUDOUN COUNTY EXOTICS — motion engine
   Momentum wheel-scroll and a set of pinned, scroll-scrubbed
   sequences: hero camera pan, gear tunnel, headlight tunnel-exit,
   taillight streak reveal, and the lift. Text gets word-mask and
   soft-fade reveals. Everything off under prefers-reduced-motion. */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) html.classList.add('reduced');

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var fade = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

  /* ----------------------------------------------------------
     Momentum smooth scroll — wheel input eased toward a target
     so native layout (sticky stages, fixed nav, anchors) keeps
     working. Touch devices keep native scrolling.
     ---------------------------------------------------------- */
  var target = window.scrollY;
  var current = window.scrollY;
  var hijack = !reduced && window.matchMedia('(pointer: fine)').matches;

  function maxScroll() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  if (hijack) {
    html.classList.add('momentum');

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return; // pinch-zoom
      e.preventDefault();
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      target = clamp(target + dy, 0, maxScroll());
    }, { passive: false });

    window.addEventListener('scroll', function () {
      if (Math.abs(window.scrollY - current) > 2) {
        target = current = window.scrollY;
      }
    }, { passive: true });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var dest = document.getElementById(a.getAttribute('href').slice(1));
      if (!dest) return;
      if (hijack) {
        e.preventDefault();
        target = clamp(dest.getBoundingClientRect().top + window.scrollY, 0, maxScroll());
      }
    });
  });

  /* ----------------------------------------------------------
     Pinned sections — shared progress computation. Each .pin
     gets p in [0,1] across its scrollable span; a handler per
     pin-name turns p into the section's choreography.
     ---------------------------------------------------------- */
  var pins = Array.prototype.map.call(
    document.querySelectorAll('[data-pin]'),
    function (el) {
      var video = el.querySelector('[data-scrub]');
      if (video) video.load();
      return {
        el: el,
        name: el.getAttribute('data-pin-name'),
        video: video,
        reverse: video ? video.hasAttribute('data-scrub-reverse') : false,
        caption: el.querySelector('[data-pin-caption]'),
        vt: 0 // smoothed video time
      };
    }
  );

  /* Scrub with its own easing: the displayed frame chases the
     scroll-derived time, and we never queue a seek while one is
     still in flight — the two things that made scrubbing stutter. */
  function scrubVideo(pin, p) {
    var video = pin.video;
    if (!video || video.readyState < 1 || !video.duration) return;
    var t = (pin.reverse ? 1 - p : p) * (video.duration - 0.05);
    pin.vt += (t - pin.vt) * 0.22;
    if (video.seeking) return;
    var delta = Math.abs(video.currentTime - pin.vt);
    if (delta < 1 / 30) return;
    if (delta > 0.5 && typeof video.fastSeek === 'function') {
      video.fastSeek(pin.vt);
    } else {
      video.currentTime = pin.vt;
    }
  }

  /* Per-section choreography */
  var heroLockup = document.querySelector('[data-hero-lockup]');
  var heroCue = document.querySelector('[data-hero-cue]');
  var gearEl = document.querySelector('[data-gear]');
  var gearBeats = document.querySelectorAll('[data-gear-beat]');
  var gearHint = document.querySelector('.gear-stage__hint');
  var streaksBase = document.querySelector('[data-streaks-base]');
  var streakBands = document.querySelectorAll('[data-streak-band]');
  var streakRows = document.querySelectorAll('[data-streak-row]');

  var handlers = {
    hero: function (pin, p) {
      scrubVideo(pin, p);
      if (heroLockup) {
        heroLockup.style.transform = 'translateY(' + (p * -70) + 'px)';
        heroLockup.style.opacity = String(1 - fade(p, 0.5, 0.85));
      }
      if (heroCue) heroCue.style.opacity = String(1 - fade(p, 0.02, 0.1));
    },

    gear: function (pin, p) {
      // Tunnel approach: gear starts small, swells until its dark
      // bore swallows the viewport by ~0.9 — the next section's
      // film starts equally dark, so the handoff reads seamless.
      if (gearEl) {
        var scale = 0.42 + Math.pow(fade(p, 0, 0.92), 1.35) * 5.2;
        gearEl.style.transform = 'rotate(' + (p * 200) + 'deg) scale(' + scale + ')';
      }
      var n = gearBeats.length;
      gearBeats.forEach(function (beat, i) {
        var start = 0.1 + (i / n) * 0.72;
        var end = 0.1 + ((i + 1) / n) * 0.72;
        var vis = fade(p, start, start + 0.05) * (1 - fade(p, end - 0.05, end));
        if (i === n - 1) vis = fade(p, start, start + 0.05) * (1 - fade(p, 0.88, 0.94));
        beat.style.opacity = String(vis);
        beat.style.transform = 'translateY(' + ((1 - vis) * 14) + 'px)';
      });
      if (gearHint) gearHint.style.opacity = String((1 - fade(p, 0.04, 0.12)) * 0.9);
    },

    exit: function (pin, p) {
      // Shoot out of the headlight: the film starts as near-black
      // (matching the gear bore), rolls level as it pulls out to
      // the full car, lights igniting at the end.
      scrubVideo(pin, p);
      if (pin.caption) pin.caption.classList.toggle('is-on', p > 0.8);
    },

    streaks: function (pin, p) {
      // A real taillight first; then its light stretches into
      // horizontal trails, one band at a time, top to bottom,
      // each band carrying its own line of text.
      if (streaksBase) {
        streaksBase.style.opacity = String(1 - fade(p, 0.3, 0.75) * 0.82);
      }
      var n = streakBands.length;
      streakBands.forEach(function (band, i) {
        var at = 0.14 + i * 0.17;
        var vis = fade(p, at, at + 0.11);
        band.style.clipPath = 'inset(0 ' + ((1 - vis) * 100) + '% 0 0)';
      });
      streakRows.forEach(function (row, i) {
        var at = 0.17 + i * 0.17;
        var vis = fade(p, at, at + 0.1);
        row.style.opacity = String(vis);
        row.style.transform = 'translateX(' + ((1 - vis) * -24) + 'px)';
      });
    },

    lift: function (pin, p) {
      // Film was generated as the car lowering; scrubbed in
      // reverse so the car rises as you scroll down.
      scrubVideo(pin, p);
      if (pin.caption) pin.caption.classList.toggle('is-on', p > 0.15);
    }
  };

  function pinFrame() {
    if (reduced) return;
    pins.forEach(function (pin) {
      var rect = pin.el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      var span = pin.el.offsetHeight - window.innerHeight;
      if (span <= 0) return;
      var p = clamp(-rect.top / span, 0, 1);
      var fn = handlers[pin.name];
      if (fn) fn(pin, p);
    });
  }

  /* ----------------------------------------------------------
     Main loop
     ---------------------------------------------------------- */
  function loop() {
    if (hijack) {
      current += (target - current) * 0.06;
      if (Math.abs(target - current) < 0.1) current = target;
      if (Math.abs(window.scrollY - current) >= 0.5) window.scrollTo(0, current);
    } else {
      current = window.scrollY;
    }
    pinFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ----------------------------------------------------------
     Text splitting — masked words for headings, soft-fade words
     for body copy.
     ---------------------------------------------------------- */
  function splitWords(el, stagger, cls) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    var idx = 0;
    nodes.forEach(function (node) {
      if (node.nodeType !== 3) return; // keep <br> etc. intact
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (piece) {
        if (!piece.trim()) {
          if (piece) frag.appendChild(document.createTextNode(' '));
          return;
        }
        if (cls === 'softword') {
          var w = document.createElement('span');
          w.className = 'softword';
          w.textContent = piece;
          w.style.setProperty('--word-delay', (idx * stagger) + 'ms');
          frag.appendChild(w);
        } else {
          var mask = document.createElement('span');
          mask.className = 'word';
          var inner = document.createElement('span');
          inner.textContent = piece;
          inner.style.setProperty('--word-delay', (idx * stagger) + 'ms');
          mask.appendChild(inner);
          frag.appendChild(mask);
        }
        idx++;
      });
      el.replaceChild(frag, node);
    });
  }

  if (!reduced) {
    var introWords = document.querySelector('[data-intro-words]');
    if (introWords) splitWords(introWords, 120, 'word');
    document.querySelectorAll('[data-split]').forEach(function (el) {
      splitWords(el, 70, 'word');
    });
    document.querySelectorAll('[data-split-soft]').forEach(function (el) {
      splitWords(el, 24, 'softword');
    });

    window.addEventListener('load', function () {
      var lockup = document.querySelector('[data-hero-lockup]');
      if (lockup) lockup.classList.add('is-in');
      document.querySelectorAll('[data-intro-fade]').forEach(function (el) {
        el.classList.add('is-in');
      });
    });
  }

  /* ----------------------------------------------------------
     Scroll-triggered reveals
     ---------------------------------------------------------- */
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    document.querySelectorAll('[data-reveal], [data-draw], [data-split], [data-split-soft]')
      .forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------
     Active nav item
     ---------------------------------------------------------- */
  var navItems = document.querySelectorAll('[data-nav]');
  var sections = [];
  navItems.forEach(function (item) {
    var section = document.getElementById(item.getAttribute('data-nav'));
    if (section) sections.push({ el: section, item: item });
  });

  if ('IntersectionObserver' in window && sections.length) {
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navItems.forEach(function (i) { i.classList.remove('is-active'); });
        sections.forEach(function (s) {
          if (s.el === entry.target) s.item.classList.add('is-active');
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px' });
    sections.forEach(function (s) { navIo.observe(s.el); });
  }

  /* ----------------------------------------------------------
     Mobile quick-book pill — hidden while #book is on screen.
     ---------------------------------------------------------- */
  var bookPill = document.querySelector('[data-book-pill]');
  var bookSection = document.getElementById('book');
  if (bookPill && bookSection && 'IntersectionObserver' in window) {
    var pillIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        bookPill.classList.toggle('is-hidden', entry.isIntersecting);
      });
    }, { threshold: 0.1 });
    pillIo.observe(bookSection);
  }

  /* ----------------------------------------------------------
     Booking form — front-end only for now (no backend wired):
     validate, then swap in the confirmation block.
     ---------------------------------------------------------- */
  var form = document.querySelector('[data-book-form]');
  var done = document.querySelector('[data-book-done]');
  if (form && done) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.hidden = true;
      done.hidden = false;
    });
  }
})();
