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

  // Hand-off shades: HANDOFF for film-to-film boundaries (both sides
  // show this exact color at the seam), CANVAS for film-to-section.
  var HANDOFF = '#060302';
  var CANVAS = '#100904';

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
        fadeEl: el.querySelector('[data-pin-fade]'),
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

  // Scroll cue: ring of little dots around the chevron
  var cueRing = document.querySelector('[data-cue-ring]');
  if (cueRing) {
    for (var d = 0; d < 16; d++) {
      var dot = document.createElement('i');
      dot.style.setProperty('--dot-angle', (d * 22.5) + 'deg');
      cueRing.appendChild(dot);
    }
  }

  // Nav items: wrap each letter so it can ride the ticker wave
  document.querySelectorAll('.nav__item').forEach(function (item) {
    var text = item.textContent;
    item.textContent = '';
    text.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.className = 'nav__ch';
      span.style.setProperty('--ch', i);
      span.textContent = ch === ' ' ? ' ' : ch;
      item.appendChild(span);
    });
  });
  var gearEl = document.querySelector('[data-gear]');
  var gearHole = document.querySelector('[data-gear-hole]');
  var gearBeats = document.querySelectorAll('[data-gear-beat]');
  var gearHint = document.querySelector('.gear-stage__hint');
  var streakRows = document.querySelectorAll('[data-streak-row]');
  var reviewCards = document.querySelectorAll('[data-review-card]');

  var handlers = {
    hero: function (pin, p) {
      scrubVideo(pin, p);
      // gentle zoom as you leave — the first "pass through"
      if (pin.video) {
        pin.video.style.transform =
          'translateY(' + (p * 40) + 'px) scale(' + (1 + fade(p, 0.55, 1) * 0.18) + ')';
      }
      if (heroLockup) {
        heroLockup.style.transform = 'translateY(' + (p * -70) + 'px)';
        heroLockup.style.opacity = String(1 - fade(p, 0.5, 0.85));
      }
      if (heroCue) heroCue.style.opacity = String(1 - fade(p, 0.02, 0.1));
    },

    gear: function (pin, p) {
      // The gear rotates and grows only modestly (so the photo never
      // blows up into visible pixels); the SOLID dark bore disc
      // behind it is what scales up to swallow the viewport — a flat
      // color that can't pixelate — carrying the tunnel dive into
      // the brake film's matching black.
      if (gearEl) {
        var gScale = 0.5 + Math.pow(fade(p, 0, 0.88), 1.3) * 1.9; // capped
        gearEl.style.transform = 'rotate(' + (p * 220) + 'deg) scale(' + gScale + ')';
        gearEl.style.opacity = String(1 - fade(p, 0.74, 0.9));
      }
      // the dark bore only takes over in the final stretch, so we
      // don't sit in black for long before the brake film
      if (gearHole) {
        var hScale = 0.34 + Math.pow(fade(p, 0.55, 0.98), 1.5) * 8;
        gearHole.style.transform = 'scale(' + hScale + ')';
      }
      var n = gearBeats.length;
      gearBeats.forEach(function (beat, i) {
        var start = 0.06 + (i / n) * 0.74;
        var end = 0.06 + ((i + 1) / n) * 0.74;
        var vis = fade(p, start, start + 0.05) * (1 - fade(p, end - 0.05, end));
        if (i === n - 1) vis = fade(p, start, start + 0.05) * (1 - fade(p, 0.84, 0.92));
        beat.style.opacity = String(vis);
        beat.style.transform = 'translateY(' + ((1 - vis) * 14) + 'px)';
      });
      if (gearHint) gearHint.style.opacity = String((1 - fade(p, 0.04, 0.12)) * 0.9);
      // veil finishes into HANDOFF black late, so the black dwell
      // before the brake film is short
      if (pin.fadeEl) {
        pin.fadeEl.style.background = HANDOFF;
        pin.fadeEl.style.opacity = String(fade(p, 0.9, 0.99));
      }
    },

    brake: function (pin, p) {
      // Opens under the same HANDOFF veil the gear faded into,
      // lifts to reveal the film, then settles to canvas brown
      // for the section that follows.
      scrubVideo(pin, p);
      if (pin.video) {
        pin.video.style.transform = 'scale(' + (1 + fade(p, 0.88, 1) * 0.45) + ')';
      }
      if (pin.caption) pin.caption.classList.toggle('is-on', p > 0.45);
      if (pin.fadeEl) {
        var inVeil = 1 - fade(p, 0.03, 0.14);
        var outVeil = fade(p, 0.93, 1);
        if (inVeil >= outVeil) {
          pin.fadeEl.style.background = HANDOFF;
          pin.fadeEl.style.opacity = String(inVeil);
        } else {
          pin.fadeEl.style.background = CANVAS;
          pin.fadeEl.style.opacity = String(outVeil);
        }
      }
    },

    streaks: function (pin, p) {
      // The taillight film: dive through the lens into the warp;
      // near the end we zoom hard into the stream and pass
      // through it into the next section — no hard stop.
      scrubVideo(pin, p);
      if (pin.video) {
        var zoom = 1 + Math.pow(fade(p, 0.78, 1), 1.6) * 1.9;
        pin.video.style.transform = 'scale(' + zoom + ')';
      }
      var gone = fade(p, 0.9, 0.99);
      streakRows.forEach(function (row, i) {
        var at = 0.5 + i * 0.1;
        var vis = fade(p, at, at + 0.09) * (1 - gone);
        row.style.opacity = String(vis);
        row.style.transform = 'translateX(' + ((1 - vis) * -24) + 'px)';
      });
      // open under a brief veil (hides the first raw/decoded frame
      // that could flash before the scrub seeks), settle to canvas
      // brown at the end so reviews continues the same shade
      if (pin.fadeEl) {
        var intro = 1 - fade(p, 0, 0.06);
        var outro = fade(p, 0.9, 1);
        if (intro >= outro) {
          pin.fadeEl.style.background = CANVAS;
          pin.fadeEl.style.opacity = String(intro);
        } else {
          pin.fadeEl.style.background = CANVAS;
          pin.fadeEl.style.opacity = String(outro);
        }
      }
    },

    lift: function (pin, p) {
      // Lift film runs underneath while five-star reviews pop up
      // over it one at a time as glass cards.
      scrubVideo(pin, p);
      if (pin.caption) pin.caption.classList.toggle('is-on', p > 0.06 && p < 0.9);
      var n = reviewCards.length;
      reviewCards.forEach(function (card, i) {
        var at = 0.14 + (i / n) * 0.66;
        card.classList.toggle('is-on', p > at);
      });
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
     Count-up numbers (statement stats)
     ---------------------------------------------------------- */
  function fmtCount(val, el) {
    var pad = parseInt(el.getAttribute('data-pad'), 10) || 0;
    var s = pad ? String(val).padStart(pad, '0') : String(val);
    if (el.hasAttribute('data-comma')) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s;
  }

  function countUp(el) {
    var to = parseInt(el.getAttribute('data-to'), 10) || 0;
    var dur = 1400;
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var k = clamp((ts - t0) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtCount(Math.round(eased * to), el);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    var countEls = document.querySelectorAll('[data-countup]');
    if (reduced) {
      countEls.forEach(function (el) {
        var to = parseInt(el.getAttribute('data-to'), 10) || 0;
        el.textContent = fmtCount(to, el);
      });
    } else {
      var countIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          countIo.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -20% 0px' });
      countEls.forEach(function (el) { countIo.observe(el); });
    }
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
