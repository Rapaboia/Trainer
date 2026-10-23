// Service worker dell'app Trainer (app.html su GitHub Pages).
//
// Strategia: RETE PRIMA, con timeout, e cache come riserva offline.
// - Online: apre sempre l'ultima versione pubblicata su GitHub, senza bisogno
//   di chiudere/riaprire l'app più volte dopo un aggiornamento.
// - Offline o rete lenta (es. in palestra senza campo): dopo NETWORK_TIMEOUT_MS
//   usa l'ultima copia salvata.
// I dati dell'app (sedute, pesate, massimali...) stanno in localStorage, NON in
// questa cache: cambiare o cancellare la cache non li tocca.
//
// Ad ogni modifica di app.html o di questo file, alzare CACHE_NAME.
const CACHE_NAME = "trainer-app-v32";
const PRECACHE = ["./app.html"];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Scarica dalla rete chiedendo sempre a GitHub se il file è cambiato
// (cache: "no-cache"), e aggiorna la copia offline se la risposta è valida.
function fromNetwork(url) {
  return fetch(url, { cache: "no-cache", credentials: "same-origin" }).then((response) => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(url, copy));
    }
    return response;
  });
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const network = fromNetwork(req.url);
    network.catch(() => {}); // evita errori "non gestiti" se vince il timeout e poi la rete fallisce
    try {
      return await Promise.race([network, timeout(NETWORK_TIMEOUT_MS)]);
    } catch (e) {
      const cached = (await caches.match(req, { ignoreSearch: true }))
        || (req.mode === "navigate" ? await caches.match("./app.html") : undefined);
      if (cached) return cached;
      return network; // nessuna copia salvata: aspetta comunque la rete
    }
  })());
});
