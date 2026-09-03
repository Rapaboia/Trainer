// Service worker per l'app Palestra.
// Serve SOLO quando app.html viene ospitata online (https) insieme a questo file
// nella stessa cartella: garantisce che l'app si apra anche a zero campo,
// anche dopo aver chiuso del tutto Safari / riavviato il telefono.
// Se apri app.html da solo (senza questo file accanto) l'app funziona comunque:
// è un unico file autosufficiente, semplicemente senza questa cache di riserva.

var CACHE_NAME = "palestra-app-v1";
var APP_SHELL = ["./", "./app.html", "./index.html", "./sw.js"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        APP_SHELL.map(function (url) {
          return cache.add(url).catch(function () {
            /* alcuni percorsi (es. index.html) potrebbero non esistere: ignora */
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetchPromise = fetch(event.request)
        .then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            var clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          }
          return networkResponse;
        })
        .catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
