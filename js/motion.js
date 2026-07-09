/* LOUDOUN COUNTY EXOTICS — motion engine
   Momentum wheel-scroll, gear spin-and-zoom, scrubbed paint sweep,
   one-shot ignition film, ambient loops, word-mask reveals.
   Everything is disabled under prefers-reduced-motion. */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) html.classList.add('reduced');

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var fade = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

  /* ----------------------------------------------------------
     Momentum smooth scroll — wheel input eased toward a target,
     so native layout (sticky gear stage, fixed nav, anchors)
     keeps working. Touch devices keep native scrolling.
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

    // Keyboard / scrollbar / anchor jumps: adopt outside scrolls.
    window.addEventListener('scroll', function () {
      if (Math.abs(window.scrollY - current) > 2) {
        target = current = window.scrollY;
      }
    }, { passive: true });
  }

  // All in-page anchors ease through the momentum target.
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
     Hero — ambient film with gentle parallax; lockup drifts
     up and fades as you leave the viewport.
     ---------------------------------------------------------- */
  var hero = document.querySelector('.hero');
  var heroFilm = document.querySelector('[data-hero-film]');
  var heroLockup = document.querySelector('[data-hero-lockup]');

  function heroFrame() {
    if (!hero || reduced) return;
    var h = hero.offsetHeight;
    var p = clamp(current / h, 0, 1);
    if (heroFilm) heroFilm.style.transform = 'translateY(' + (p * h * 0.18) + 'px)';
    if (heroLockup) {
      heroLockup.style.transform = 'translateY(' + (p * -60) + 'px)';
      heroLockup.style.opacity = String(1 - fade(p, 0.35, 0.75));
    }
  }

  /* ----------------------------------------------------------
     Gear — pinned stage: the gear spins and the camera zooms
     into its dark center; service beats crossfade inside it.
     ---------------------------------------------------------- */
  var gearTrack = document.querySelector('[data-gear-track]');
  var gearEl = document.querySelector('[data-gear]');
  var gearBeats = document.querySelectorAll('[data-gear-beat]');
  var gearHint = document.querySelector('.gear-stage__hint');

  function gearFrame() {
    if (!gearTrack || reduced) return;
    var rect = gearTrack.getBoundingClientRect();
    var span = gearTrack.offsetHeight - window.innerHeight;
    if (span <= 0) return;
    var p = clamp(-rect.top / span, 0, 1);
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    // Spin + zoom toward the hollow center.
    if (gearEl) {
      var zoom = 1 + fade(p, 0, 0.35) * 1.15; // settle once the text arrives
      gearEl.style.transform = 'rotate(' + (p * 240) + 'deg) scale(' + zoom + ')';
      gearEl.style.opacity = String(0.4 + 0.6 * fade(p, 0, 0.15));
    }

    // Four beats crossfading in the dark center.
    var n = gearBeats.length;
    gearBeats.forEach(function (beat, i) {
      var start = 0.12 + (i / n) * 0.84;
      var end = 0.12 + ((i + 1) / n) * 0.84;
      var vis = fade(p, start, start + 0.07) * (1 - fade(p, end - 0.07, end));
      if (i === n - 1) vis = fade(p, start, start + 0.07); // last beat holds
      beat.style.opacity = String(vis);
      beat.style.transform = 'translateY(' + ((1 - vis) * 14) + 'px)';
    });

    if (gearHint) gearHint.style.opacity = String((1 - fade(p, 0.05, 0.15)) * 0.9);
  }

  /* ----------------------------------------------------------
     Paint band — light sweep scrubbed by scroll position.
     ---------------------------------------------------------- */
  var scrubFilm = document.querySelector('[data-scrub-film]');
  var scrubDuration = 0;

  if (scrubFilm) {
    scrubFilm.addEventListener('loadedmetadata', function () {
      scrubDuration = scrubFilm.duration || 0;
    });
    scrubFilm.load();
  }

  function scrubFrame() {
    if (!scrubFilm || reduced || !scrubDuration) return;
    var host = scrubFilm.parentElement;
    var rect = host.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    var p = clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
    var t = p * (scrubDuration - 0.05);
    if (scrubFilm.readyState >= 1 && Math.abs(scrubFilm.currentTime - t) > 0.02) {
      scrubFilm.currentTime = t;
    }
  }

  /* ----------------------------------------------------------
     Main loop
     ---------------------------------------------------------- */
  function loop() {
    if (hijack) {
      current += (target - current) * 0.085;
      if (Math.abs(target - current) < 0.1) current = target;
      if (Math.abs(window.scrollY - current) >= 0.5) window.scrollTo(0, current);
    } else {
      current = window.scrollY;
    }
    heroFrame();
    gearFrame();
    scrubFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ----------------------------------------------------------
     Word-mask splitting — hero wordmark + [data-split] headings.
     ---------------------------------------------------------- */
  function splitWords(el, stagger) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (word, i) {
      var mask = document.createElement('span');
      mask.className = 'word';
      var inner = document.createElement('span');
      inner.textContent = word;
      inner.style.setProperty('--word-delay', (i * stagger) + 'ms');
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  if (!reduced) {
    var introWords = document.querySelector('[data-intro-words]');
    if (introWords) splitWords(introWords, 120);
    document.querySelectorAll('[data-split]').forEach(function (el) {
      splitWords(el, 70);
    });

    window.addEventListener('load', function () {
      if (hero) hero.classList.add('is-in');
      if (introWords) introWords.closest('.hero__lockup').classList.add('is-in');
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

    document.querySelectorAll('[data-reveal], [data-draw], [data-split]')
      .forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------
     Films: ambient loops play only on screen; the ignition
     film plays exactly once when its band enters.
     ---------------------------------------------------------- */
  if ('IntersectionObserver' in window && !reduced) {
    var loopIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) v.play().catch(function () {});
        else v.pause();
      });
    }, { rootMargin: '15% 0px' });
    document.querySelectorAll('[data-loop-film]').forEach(function (v) {
      loopIo.observe(v);
    });

    var igniteFilm = document.querySelector('[data-ignite-film]');
    if (igniteFilm) {
      var ignited = false;
      var igniteIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || ignited) return;
          ignited = true;
          igniteFilm.play().catch(function () {});
          igniteIo.disconnect();
        });
      }, { threshold: 0.55 });
      igniteIo.observe(igniteFilm);
    }
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
