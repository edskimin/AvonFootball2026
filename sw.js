/* Offline support for the roster lookup.
   Bump CACHE whenever you ship a roster or code change, otherwise phones that
   already installed the app will keep serving the old copy. */

var CACHE = "eagles-roster-v2";

var ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "roster.json",
  "manifest.webmanifest",
  "assets/eagle.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png",
  "assets/fonts/fonts.css",
  "assets/fonts/bitter-700.woff2",
  "assets/fonts/opensans.woff2",
  "assets/fonts/plexmono-500.woff2"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      // Serve from cache first so a dead stadium connection never blocks a
      // lookup, then quietly refresh the copy for next time.
      var network = fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });

      return cached || network;
    })
  );
});
