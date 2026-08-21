/* Offline support for the roster lookup.

   Strategy is split on purpose:

   - Content (the page, roster.json, css, js) is NETWORK FIRST. When there is a
     signal you always get the current roster, and a mid-season update lands on
     the next open rather than the one after. Cache is the fallback.
   - Fonts and images are CACHE FIRST. They only change when the file name or
     the cache version changes, so there is nothing to be stale about.

   Bump CACHE whenever you ship a change. */

var CACHE = "eagles-roster-v17";

var ASSETS = [
  "./",
  "index.html",
  "lookup.html",
  "roster.html",
  "schedule.html",
  "styles.css",
  "app.js",
  "roster.js",
  "roster.json",
  "schedule.js",
  "schedule.json",
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

// Static by nature: a new version means a new cache, not a changed file.
var STATIC = /\.(woff2|png|svg|jpg|jpeg|ico|mp3)$/i;

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

function cachePut(request, response) {
  var copy = response.clone();
  return caches.open(CACHE).then(function (cache) {
    return cache.put(request, copy);
  });
}

// Hand the write to waitUntil so the browser keeps the worker alive until it
// lands. Without this it can be shut down mid-put and the cache never updates.
function keep(event, request, response) {
  if (response && response.status === 200) {
    event.waitUntil(cachePut(request, response).catch(function () {}));
  }
  return response;
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          return keep(event, request, response);
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(function (response) {
        return keep(event, request, response);
      })
      .catch(function () {
        return caches.match(request).then(function (cached) {
          // A navigation to any path in scope falls back to the app shell.
          return cached || caches.match("./");
        });
      })
  );
});
