const CACHE_NAME = "stockli-static-v3";
const DATA_CACHE_NAME = "stockli-public-data-v1";

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/public/")) {
    event.respondWith(networkFirst(request, DATA_CACHE_NAME));
    return;
  }

  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (request.mode === "navigate") return;

  const cacheable =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/landing/");

  if (!cacheable) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request));
}
