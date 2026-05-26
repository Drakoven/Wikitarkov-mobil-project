const CACHE_NAME = "wikitarkov-cache-v3";

// Assets statiques : mis en cache à l'installation
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/manifest.json",
  "/assets/background.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

// app.js reçoit un traitement spécial (network-first)
const NETWORK_FIRST = ["/app.js"];

/* =========================
   INSTALLATION
   On pré-cache uniquement les assets statiques
========================= */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Force l'activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
});

/* =========================
   ACTIVATION
   Supprime les anciens caches (versions précédentes du SW)
========================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  // Prend le contrôle de tous les onglets ouverts immédiatement
  self.clients.claim();
});

/* =========================
   FETCH — Stratégies par type de ressource

   - app.js         → Network-first
     On essaie toujours le réseau pour avoir la dernière version.
     Si offline, on sert le cache.

   - Assets statiques (CSS, HTML, images)  → Stale-while-revalidate
     On répond immédiatement depuis le cache (rapide),
     puis on met à jour le cache en arrière-plan pour la prochaine fois.

   - API tarkov.dev → Network-only
     Les données temps réel ne doivent pas être cachées ici
     (géré côté app.js avec localStorage + TTL).
========================= */

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // On ignore les requêtes non-GET et les extensions navigateur
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // API Tarkov — réseau uniquement, pas de cache SW
  if (url.hostname === "api.tarkov.dev") {
    event.respondWith(fetch(request));
    return;
  }

  // app.js — Network-first
  if (NETWORK_FIRST.some(path => url.pathname === path)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tout le reste — Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

/* =========================
   STRATÉGIE : Network-first
   Tente le réseau, fallback cache si offline
========================= */

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    // Met à jour le cache avec la version réseau
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    // Offline : on sert le cache
    const cached = await cache.match(request);
    return cached || new Response("Hors ligne — ressource non disponible.", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

/* =========================
   STRATÉGIE : Stale-while-revalidate
   Répond depuis le cache immédiatement,
   met à jour le cache en arrière-plan
========================= */

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Mise à jour en arrière-plan (sans bloquer la réponse)
  const networkFetch = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  // Si on a un cache : réponse immédiate, mise à jour en arrière-plan
  if (cached) return cached;

  // Pas de cache : on attend le réseau
  return networkFetch;
}