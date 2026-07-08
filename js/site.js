/* LOCO EXOTICS — film overlay, nav state, estimate form */
(function () {
  'use strict';

  /* Film overlay */
  var film = document.querySelector('[data-film]');
  var filmVideo = document.querySelector('[data-film-video]');
  var openBtn = document.querySelector('[data-film-open]');
  var closeBtn = document.querySelector('[data-film-close]');

  function openFilm() {
    film.hidden = false;
    document.body.style.overflow = 'hidden';
    filmVideo.play().catch(function () {});
    closeBtn.focus();
  }

  function closeFilm() {
    filmVideo.pause();
    film.hidden = true;
    document.body.style.overflow = '';
    openBtn.focus();
  }

  if (film && filmVideo && openBtn && closeBtn) {
    openBtn.addEventListener('click', openFilm);
    closeBtn.addEventListener('click', closeFilm);
    film.addEventListener('click', function (e) {
      if (e.target === film) closeFilm();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !film.hidden) closeFilm();
    });
  }

  /* Active nav item follows scroll */
  var navItems = document.querySelectorAll('[data-nav]');
  var sections = [];
  navItems.forEach(function (item) {
    var section = document.getElementById(item.getAttribute('data-nav'));
    if (section) sections.push({ el: section, item: item });
  });

  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navItems.forEach(function (i) { i.classList.remove('is-active'); });
        sections.forEach(function (s) {
          if (s.el === entry.target) s.item.classList.add('is-active');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { observer.observe(s.el); });
  }

  /* Estimate form → prefilled email (static site, no backend) */
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
