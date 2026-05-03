const CACHE_NAME = "klevby-cache-v5-push-2026-05-03";

const APP_FILES = [
  "/",
  "/index.html",

  "/assets/css/main.css",
  "/assets/css/ponds.css",
  "/assets/css/chat-style.css",

  "/assets/js/chat.js",
  "/assets/js/call.js",
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

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "Klevby",
      body: event.data ? event.data.text() : "Новое уведомление"
    };
  }

  const title = data.title || "Klevby";
  const options = {
    body: data.body || "Новое уведомление Klevby",
    icon: data.icon || "/assets/img/klevby-icon-512.png",
    badge: data.badge || "/assets/img/klevby-icon-512.png",
    image: data.image || undefined,
    tag: data.tag || "klevby-notification",
    data: {
      url: data.url || "/",
      ...data.data
    },
    vibrate: [120, 80, 120],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";
  const finalUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(finalUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(finalUrl);
      }

      return null;
    })
  );
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
