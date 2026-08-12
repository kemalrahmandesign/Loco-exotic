/* LOCO EXOTICS — offline service worker.
   Precaches the entire site (films included) on first load so the
   whole thing can be demoed with no network. Bump CACHE to ship a
   new version; old caches are dropped on activate. */
var CACHE = 'loco-v1';

var ASSETS = [
  './',
  'index.html',
  'css/tokens.css',
  'css/site.css',
  'js/motion.js',
  'fonts/inter.css',
  'fonts/inter-var.woff2',
  'media/hero.mp4',
  'media/brake.mp4',
  'media/tail.mp4',
  'media/lift.mp4',
  'media/gear.webp',
  'media/hero-poster.jpg',
  'media/lift-poster.jpg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Cache each asset independently: one bad URL shouldn't fail the
      // whole install the way cache.addAll() would.
      return Promise.all(
        ASSETS.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' }))['catch'](function (err) {
            console.warn('[sw] skipped', url, err);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    }).then(function () {
      return self.clients.matchAll({ includeUncontrolled: true });
    }).then(function (clients) {
      clients.forEach(function (c) { c.postMessage({ type: 'offline-ready' }); });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches['delete'](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Safari asks for video with a Range header and refuses a plain 200
   reply. Slice the cached body and answer 206 ourselves — without
   this the films play on desktop and fail on iPad. */
function rangeReply(cached, rangeHeader) {
  return cached.arrayBuffer().then(function (buf) {
    var total = buf.byteLength;
    var m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    var start = 0;
    var end = total - 1;
    if (m) {
      if (m[1] === '' && m[2] !== '') {
        start = Math.max(0, total - parseInt(m[2], 10)); // suffix: bytes=-N
      } else {
        if (m[1] !== '') start = parseInt(m[1], 10);
        if (m[2] !== '') end = parseInt(m[2], 10);
      }
    }
    if (end > total - 1) end = total - 1;
    if (start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': 'bytes */' + total }
      });
    }
    var slice = buf.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': String(slice.byteLength),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // maps links etc. stay online-only

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true, ignoreVary: true }).then(function (cached) {
        if (!cached && req.mode === 'navigate') {
          return cache.match('index.html', { ignoreSearch: true });
        }
        return cached;
      }).then(function (cached) {
        if (cached) {
          var range = req.headers.get('range');
          return range ? rangeReply(cached, range) : cached;
        }
        return fetch(req).then(function (res) {
          // Only full 200s are cacheable; a 206 would throw.
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })['catch'](function (err) {
          if (req.mode === 'navigate') {
            return cache.match('index.html', { ignoreSearch: true });
          }
          throw err;
        });
      });
    })
  );
});
