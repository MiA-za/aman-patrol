/* ============================================================
   AMAN PATROL — service worker (offline shell)
   Network-first for pages so updates always land; the cached
   shell is only used when there is no connection. Cross-origin
   requests (Supabase, OpenStreetMap, Open-Meteo) are never
   touched. Bump CACHE when the shell assets change.
   ============================================================ */
var CACHE = "aman-shell-v7";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/apple-touch-icon.png",
  "./images/aman_robot.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var c1 = res.clone();
        var c2 = res.clone();
        caches.open(CACHE).then(function (c) {
          c.put(req, c1);
          c.put("./index.html", c2);
        });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("./index.html");
        }).then(function (hit) {
          return hit || Response.error();
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return Response.error(); });
    })
  );
});
