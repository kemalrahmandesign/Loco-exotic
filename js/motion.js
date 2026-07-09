/* LOCO EXOTICS — motion engine
   Momentum wheel-scroll, scrubbed hero film, word-mask reveals,
   parallax bands, drawn dividers. All of it disabled under
   prefers-reduced-motion. */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) html.classList.add('reduced');

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  /* ----------------------------------------------------------
     Momentum smooth scroll — wheel events are intercepted and
     eased toward a target, so native layout (sticky hero, fixed
     nav, anchors) keeps working. Touch devices keep native
     scrolling; parallax and the scrub still follow along.
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

    // Nav anchors ease through the momentum target instead of jumping.
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var dest = document.getElementById(a.getAttribute('href').slice(1));
        if (!dest) return;
        e.preventDefault();
        target = clamp(dest.getBoundingClientRect().top + window.scrollY, 0, maxScroll());
      });
    });
  }

  /* ----------------------------------------------------------
     Hero — pinned track, film scrubbed by scroll progress,
     lockup drifting and fading as the scrub plays.
     ---------------------------------------------------------- */
  var heroTrack = document.querySelector('[data-hero-track]');
  var heroFilm = document.querySelector('[data-hero-film]');
  var heroLockup = document.querySelector('[data-hero-lockup]');
  var heroBeat = document.querySelector('[data-hero-beat]');
  var heroCue = document.querySelector('[data-hero-cue]');
  var filmDuration = 0;

  if (heroFilm) {
    heroFilm.addEventListener('loadedmetadata', function () {
      filmDuration = heroFilm.duration || 0;
    });
    heroFilm.load();
  }

  function fade(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }

  function heroFrame() {
    if (!heroTrack || reduced) return;
    var span = heroTrack.offsetHeight - window.innerHeight;
    if (span <= 0) return;
    var p = clamp(current / span, 0, 1);

    if (filmDuration && heroFilm.readyState >= 1) {
      var t = p * (filmDuration - 0.05);
      if (Math.abs(heroFilm.currentTime - t) > 0.02) heroFilm.currentTime = t;
    }

    if (heroLockup) {
      heroLockup.style.transform = 'translateY(' + (p * -70) + 'px)';
      heroLockup.style.opacity = String(1 - fade(p, 0.35, 0.62));
    }
    if (heroBeat) {
      var vis = fade(p, 0.45, 0.62) * (1 - fade(p, 0.82, 0.96));
      heroBeat.style.opacity = String(vis);
      heroBeat.style.transform = 'translateY(' + ((1 - vis) * 24) + 'px)';
    }
    if (heroCue) {
      heroCue.style.opacity = String(1 - fade(p, 0.02, 0.12));
    }
  }

  /* ----------------------------------------------------------
     Parallax bands — media drifts against scroll.
     ---------------------------------------------------------- */
  var parallaxEls = Array.prototype.map.call(
    document.querySelectorAll('[data-parallax]'),
    function (el) {
      return { el: el, factor: parseFloat(el.getAttribute('data-parallax')) || 0.12 };
    }
  );

  function parallaxFrame() {
    if (reduced) return;
    parallaxEls.forEach(function (item) {
      var host = item.el.parentElement;
      var rect = host.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      var centerDelta = rect.top + rect.height / 2 - window.innerHeight / 2;
      item.el.style.transform = 'translateY(' + (centerDelta * item.factor) + 'px)';
    });
  }

  /* ----------------------------------------------------------
     Main loop
     ---------------------------------------------------------- */
  function loop() {
    if (hijack) {
      current += (target - current) * 0.085;
      if (Math.abs(target - current) < 0.1) current = target;
      if (Math.abs(window.scrollY - current) >= 0.5) {
        window.scrollTo(0, current);
      }
    } else {
      current = window.scrollY;
    }
    heroFrame();
    parallaxFrame();
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

    // Page-load intro: wordmark rises, tagline/serial/cue fade in.
    window.addEventListener('load', function () {
      document.querySelector('.hero').classList.add('is-loaded');
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

    document.querySelectorAll('[data-reveal], [data-draw], [data-scale], [data-split]')
      .forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------
     Looping films play only while on screen.
     ---------------------------------------------------------- */
  var loops = document.querySelectorAll('[data-loop-film]');
  if ('IntersectionObserver' in window && !reduced) {
    var filmIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) v.play().catch(function () {});
        else v.pause();
      });
    }, { rootMargin: '20% 0px' });
    loops.forEach(function (v) { filmIo.observe(v); });
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
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { navIo.observe(s.el); });
  }

  /* ----------------------------------------------------------
     Estimate form → prefilled email (static site, no backend)
     ---------------------------------------------------------- */
  var form = document.querySelector('[data-estimate-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var subject = 'Estimate request — ' + (data.get('name') || '');
      var body = 'Name: ' + (data.get('name') || '') +
        '\nEmail: ' + (data.get('email') || '') +
        '\n\nThe car:\n' + (data.get('car') || '');
      window.location.href = 'mailto:bookings@locoexotics.com' +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    });
  }
})();
