const CACHE_NAME = "klevby-cache-v9-css-modules-2026-05-07";

const APP_FILES = [
  "/",
  "/index.html",

  "/assets/css/main.css",
  "/assets/css/ponds.css",
  "/assets/css/chat-style.css",

  "/assets/css/base/global.css",

  "/assets/css/layout/header.css",
  "/assets/css/layout/bottom-nav.css",

  "/assets/css/components/buttons-forms.css",
  "/assets/css/components/feed-cards.css",
  "/assets/css/components/modals-install.css",

  "/assets/css/screens/home.css",
  "/assets/css/screens/secondary.css",

  "/assets/css/responsive/mobile.css",

  "/assets/js/config.js",
  "/assets/js/pwa-manifest.js",
  "/assets/js/pwa.js",
  "/assets/js/weather.js",
  "/assets/js/auth.js",
  "/assets/js/posts.js",
  "/assets/js/ui.js",
  "/assets/js/app.js",

  "/assets/js/chat-shell.js",
  "/assets/js/chat-state.js",
  "/assets/js/chat-push.js",
  "/assets/js/chat-viewport.js",
  "/assets/js/chat-realtime.js",
  "/assets/js/chat-user.js",
  "/assets/js/chat-render.js",
  "/assets/js/chat-public.js",
  "/assets/js/chat-private.js",
  "/assets/js/chat-reply.js",
  "/assets/js/chat-message-actions.js",
  "/assets/js/chat-lifecycle.js",
  "/assets/js/chat-auth-events.js",
  "/assets/js/chat-events.js",
  "/assets/js/chat.js",

  "/assets/js/call-styles.js",
  "/assets/js/call-audio.js",
  "/assets/js/call-ui.js",
  "/assets/js/call.js",

  "/assets/js/map-logic.js",
  "/assets/js/market-logic.js",
  "/assets/js/ponds.js",

  "/assets/img/klevby-icon-512.png",
  "/assets/img/narach-bg.webp",
  "/assets/img/gold-lake-bg.webp"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    precacheAppFiles()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
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
  let payload = {
    title: "Klevby",
    message: "Новое уведомление Klevby 🎣",
    url: "/",
    icon: "/assets/img/klevby-icon-512.png",
    badge: "/assets/img/klevby-icon-512.png"
  };

  try {
    if (event.data) {
      const text = event.data.text();

      if (text) {
        try {
          const json = JSON.parse(text);

          payload = {
            ...payload,
            ...json,
            message: json.message || json.body || payload.message
          };
        } catch (error) {
          payload.message = text;
        }
      }
    }
  } catch (error) {
    payload.message = "Новое уведомление Klevby 🎣";
  }

  const title = payload.title || "Klevby";

  const options = {
    body: payload.message || payload.body || "Новое уведомление Klevby 🎣",
    icon: payload.icon || "/assets/img/klevby-icon-512.png",
    badge: payload.badge || "/assets/img/klevby-icon-512.png",
    data: {
      url: payload.url || "/"
    },
    tag: "klevby-push",
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();

            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }

            return client;
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
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

  if (request.headers.has("range")) {
    event.respondWith(fetch(request));
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

async function precacheAppFiles() {
  const cache = await caches.open(CACHE_NAME);

  const results = await Promise.allSettled(
    APP_FILES.map(async (path) => {
      try {
        const request = new Request(path, {
          method: "GET",
          cache: "reload"
        });

        const response = await fetch(request);

        await safeCachePut(cache, request, response);

        return true;
      } catch (error) {
        console.warn("Klevby SW: файл не добавился в кэш:", path, error);
        return false;
      }
    })
  );

  return results;
}

async function networkFirst(request) {
  try {
    const freshResponse = await fetch(request, {
      cache: "no-store"
    });

    const cache = await caches.open(CACHE_NAME);
    await safeCachePut(cache, request, freshResponse);

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
  await safeCachePut(cache, request, freshResponse);

  return freshResponse;
}

async function safeCachePut(cache, request, response) {
  if (!cache || !request || !response) return;

  if (request.method !== "GET") return;

  if (request.headers && request.headers.has("range")) {
    return;
  }

  if (response.status === 206) {
    return;
  }

  if (!response.ok) {
    return;
  }

  try {
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("Klevby SW: ответ не удалось сохранить в кэш:", request.url, error);
  }
}
