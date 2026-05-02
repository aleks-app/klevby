const CACHE_NAME = "klevby-cache-v3-assets-2026-05-02";

const APP_FILES = [
  "/",
  "/index.html",

  "/assets/css/main.css",
  "/assets/css/ponds.css",
  "/assets/css/chat-style.css",

  "/assets/js/chat.js",
  "/assets/js/map-logic.js",
  "/assets/js/market-logic.js",
  "/assets/js/ponds.js",

  "/assets/img/klevby-icon-512.png",
  "/assets/img/narach-bg.webp"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES).catch(() => null);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== location.origin) {
    return;
  }

  const isHtml =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html");

  const isFreshFile =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".html");

  if (isHtml || isFreshFile) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const freshResponse = await fetch(request, { cache: "no-store" });

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, freshResponse.clone());

    return freshResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const freshResponse = await fetch(request);

  const cache = await caches.open(CACHE_NAME);
  cache.put(request, freshResponse.clone());

  return freshResponse;
}
