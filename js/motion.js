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

  // Pinned scenes are empty at progress 0, so their nav anchors land
  // a little way INTO the scrub — far enough that the first beat
  // (services) or the caption and first review (reviews) is on screen.
  var anchorDepth = { services: 0.06, reviews: 0.18 };

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var dest = document.getElementById(id);
      if (!dest) return;
      var top = dest.getBoundingClientRect().top + window.scrollY;
      if (anchorDepth[id] && dest.hasAttribute('data-pin')) {
        top += (dest.offsetHeight - window.innerHeight) * anchorDepth[id];
      }
      e.preventDefault();
      if (hijack) {
        target = clamp(top, 0, maxScroll());
      } else {
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ----------------------------------------------------------
     Phones get portrait (9:16) cuts of any film that has one —
     promoted synchronously to the video's own src (which outranks
     <source> children) before anything below calls load(), so only
     one file is ever fetched. Both portrait cuts ship in media/.
     ---------------------------------------------------------- */
  var portraitMode = window.matchMedia('(max-width: 640px)').matches;
  document.querySelectorAll('source[data-portrait]').forEach(function (s) {
    var v = s.parentNode;
    if (portraitMode) {
      v.removeChild(s);
      v.src = s.getAttribute('data-portrait');
    }
    // the poster is assigned here, once, rather than in the HTML —
    // shipping a poster attribute painted the landscape frame first
    // on phones and made the hero appear to reload on cold loads
    var poster = s.getAttribute(portraitMode ? 'data-portrait-poster' : 'data-poster');
    if (poster) v.poster = poster;
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

  /* Same, but for a bare <video> element (tunnel has two of them
     in one section). Smoothed time is stashed on the element. */
  function seekVideo(video, prog, reverse) {
    if (!video || video.readyState < 1 || !video.duration) return;
    var t = clamp(reverse ? 1 - prog : prog, 0, 1) * (video.duration - 0.05);
    video._vt = video._vt == null ? t : video._vt + (t - video._vt) * 0.22;
    if (video.seeking) return;
    var delta = Math.abs(video.currentTime - video._vt);
    if (delta < 1 / 30) return;
    if (delta > 0.5 && typeof video.fastSeek === 'function') video.fastSeek(video._vt);
    else video.currentTime = video._vt;
  }

  /* Per-section choreography */
  var heroLockup = document.querySelector('[data-hero-lockup]');
  var heroCue = document.querySelector('[data-hero-cue]');
  var navWordmark = document.querySelector('.nav__wordmark');

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
  var liftHint = document.querySelector('[data-lift-hint]');

  // Tunnel layers + their videos
  var tlBrake = document.querySelector('[data-tl-brake]');
  var tlBrakeVid = tlBrake && tlBrake.querySelector('[data-tunnel-video]');
  var tlBrakeCap = document.querySelector('[data-tl-brake-cap]');
  var tlStreaks = document.querySelector('[data-tl-streaks]');
  var tlStreaksVid = tlStreaks && tlStreaks.querySelector('[data-tunnel-video]');

  /* The hero film loads immediately; every other film waits until its
     section is within two viewports. Loading all ~19MB of film at once
     starved the hero scrub of bandwidth and decode time — the main
     source of early-scroll choppiness. */
  function loadFilm(video) {
    if (!video) return;
    video.preload = 'auto';
    video.load();
  }

  function deferFilm(video, section) {
    if (!video || !section) return;
    if (!('IntersectionObserver' in window)) { loadFilm(video); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        loadFilm(video);
        io.disconnect();
      });
    }, { rootMargin: '200% 0px' });
    io.observe(section);
  }

  pins.forEach(function (pin) {
    if (pin.name === 'hero') loadFilm(pin.video);
    else deferFilm(pin.video, pin.el);
  });
  deferFilm(tlBrakeVid, tlBrake && tlBrake.closest('.pin'));
  deferFilm(tlStreaksVid, tlStreaks && tlStreaks.closest('.pin'));

  var handlers = {
    hero: function (pin, p) {
      scrubVideo(pin, p);
      // gentle zoom as you leave — the first "pass through"
      if (pin.video) {
        pin.video.style.transform =
          'translateY(' + (p * 40) + 'px) scale(' + (1 + fade(p, 0.55, 1) * 0.18) + ')';
      }
      // giant text rides up and fades like before; CTAs stay
      // visible with it instead of dying early
      if (heroLockup) {
        var lockupVis = 1 - fade(p, 0.4, 0.75);
        heroLockup.style.transform = 'translateY(' + (p * -70) + 'px)';
        heroLockup.style.opacity = String(lockupVis);
        // faded-out CTAs must stop catching taps — opacity alone
        // leaves invisible but clickable buttons over the film
        heroLockup.style.pointerEvents = lockupVis < 0.35 ? 'none' : '';
        heroLockup.style.visibility = lockupVis === 0 ? 'hidden' : '';
      }
      if (heroCue) heroCue.style.opacity = String(1 - fade(p, 0.02, 0.1));
      // corner wordmark SNAPS in the moment the hero starts moving
      if (navWordmark) navWordmark.classList.toggle('is-on', p > 0.1);
      // phone quick-book pill stays out of the hero — the real CTAs
      // are already on screen; it returns as the hero scrolls away
      if (bookPill) bookPill.classList.toggle('is-hidden', p < 0.85);
    },

    // ONE stage, three stacked layers. Each scene plays, then zooms
    // in and cross-fades into the next — that's the whole trick.
    //   gear   active 0.00–0.34, hands off 0.30–0.38
    //   rotor  active 0.38–0.66, hands off 0.64–0.72
    //   warp   active 0.72–1.00
    tunnel: function (pin, p) {
      // GEAR — spin + slow zoom, beats crossfade; zoom in hard and
      // fade out across the hand-off.
      if (gearEl) {
        var gScale = 1.05 + fade(p, 0, 0.34) * 0.55 + fade(p, 0.3, 0.38) * 1.4;
        gearEl.style.transform = 'rotate(' + (p * 180) + 'deg) scale(' + gScale + ')';
      }
      if (gearHole) gearHole.style.transform = 'scale(' + (0.5 + fade(p, 0.08, 0.34) * 1.0) + ')';
      var gearLayer = gearEl && gearEl.closest('.tunnel__gear');
      if (gearLayer) gearLayer.style.opacity = String(1 - fade(p, 0.3, 0.38));
      var n = gearBeats.length;
      gearBeats.forEach(function (beat, i) {
        var s0 = 0.02 + (i / n) * 0.28;
        var e0 = 0.02 + ((i + 1) / n) * 0.28;
        var vis = fade(p, s0, s0 + 0.04) * (1 - fade(p, e0 - 0.04, e0));
        if (i === n - 1) vis = fade(p, s0, s0 + 0.04) * (1 - fade(p, 0.3, 0.36));
        beat.style.opacity = String(vis);
      });
      if (gearHint) gearHint.style.opacity = String((1 - fade(p, 0.04, 0.12)) * 0.9);

      // ROTOR — fades in from a slight zoom as the gear leaves,
      // plays/glows, then zooms in and fades out into the warp.
      if (tlBrake) {
        tlBrake.style.opacity = String(fade(p, 0.3, 0.38) * (1 - fade(p, 0.68, 0.76)));
      }
      seekVideo(tlBrakeVid, fade(p, 0.34, 0.68), false);
      if (tlBrakeVid) {
        var bIn = (1 - fade(p, 0.3, 0.4)) * 0.15;   // settle from +15%
        var bOut = fade(p, 0.54, 0.76) * 1.35;       // long, deep zoom into the rotor before the blend
        tlBrakeVid.style.transform = 'scale(' + (1 + bIn + bOut) + ')';
      }
      if (tlBrakeCap) tlBrakeCap.classList.toggle('is-on', p > 0.44 && p < 0.6);

      // WARP — fades in from a slight zoom as the rotor leaves;
      // reversed film (red/amber stream first), text lands, exit.
      if (tlStreaks) tlStreaks.style.opacity = String(fade(p, 0.68, 0.76));
      seekVideo(tlStreaksVid, fade(p, 0.7, 1), true);
      if (tlStreaksVid) {
        tlStreaksVid.style.transform = 'scale(' + (1 + (1 - fade(p, 0.7, 0.82)) * 0.4) + ')';
      }
      var gone = fade(p, 0.93, 0.98);
      streakRows.forEach(function (row, i) {
        var at = 0.8 + i * 0.03;
        var vis = fade(p, at, at + 0.03) * (1 - gone);
        row.style.opacity = String(vis);
        row.style.transform = 'translateX(' + ((1 - vis) * -24) + 'px)';
      });

      // veil: flash guard on the first frame, settle to canvas at
      // the end for the reviews section
      if (pin.fadeEl) {
        pin.fadeEl.style.background = CANVAS;
        pin.fadeEl.style.opacity = String(fade(p, 0.96, 1));
      }
    },

    lift: function (pin, p) {
      // Lift film runs underneath while five-star reviews pop up
      // over it as glass cards. Desktop accumulates all six around
      // the frame; phones only fit two slots, so each card holds
      // its slot for a beat and hands off to the next.
      scrubVideo(pin, p);
      if (pin.caption) pin.caption.classList.toggle('is-on', p > 0.06 && p < 0.9);
      if (liftHint) {
        liftHint.style.opacity = String(fade(p, 0.08, 0.16) * (1 - fade(p, 0.32, 0.42)) * 0.9);
      }
      var n = reviewCards.length;
      var slot = 0.66 / n;
      var phones = window.innerWidth <= 640;
      reviewCards.forEach(function (card, i) {
        var at = 0.14 + i * slot;
        var on = phones ? (p > at && p < at + slot * 1.9) : (p > at);
        card.classList.toggle('is-on', on);
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
      // pEnter runs from the moment the section's top rises into
      // view (bottom of viewport) through the end of its scrub —
      // lets a film reveal DURING the sticky-release crossover
      // between sections instead of sitting frozen in black.
      var vh = window.innerHeight;
      var pEnter = clamp((vh - rect.top) / (vh + span), 0, 1);
      var fn = handlers[pin.name];
      if (fn) fn(pin, p, pEnter);
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
