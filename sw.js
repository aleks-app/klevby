const CACHE_NAME = "klevby-cache-v10-fast-refresh-2026-05-07";

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
  "/assets/css/screens/profile.css",

  "/assets/css/responsive/mobile.css",

  "/assets/js/config.js",
  "/assets/js/pwa-manifest.js",
  "/assets/js/pwa.js",
  "/assets/js/weather.js",
  "/assets/js/auth.js",
  "/assets/js/posts.js",
  "/assets/js/ui.js",
  "/assets/js/app.js",

  "/assets/js/feed/feed-state.js",
  "/assets/js/feed/feed-utils.js",
  "/assets/js/feed/feed-api.js",
  "/assets/js/feed/feed-render.js",
  "/assets/js/feed/feed-modals.js",
  "/assets/js/feed/feed-actions.js",
  "/assets/js/feed/feed-events.js",
  "/assets/js/feed/feed-main.js",
  "/assets/js/feed.js",
  "/assets/js/feed-supabase.js",
  "/assets/js/profile.js",

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
    clearOldCaches()
      .then(() => self.clients.claim())
      .then(() => notifyClients({
        type: "KLEVB_SW_ACTIVATED",
        cacheName: CACHE_NAME
      }))
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "KLEVB_CLEAR_CACHE") {
    event.waitUntil(
      clearAllCaches()
        .then(() => notifyClients({
          type: "KLEVB_CACHE_CLEARED"
        }))
    );
    return;
  }

  if (data.type === "KLEVB_GET_SW_VERSION") {
    if (event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage({
        type: "KLEVB_SW_VERSION",
        cacheName: CACHE_NAME
      });
    }
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

  if (!request || request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  if (url.origin !== location.origin) {
    return;
  }

  if (request.headers.has("range")) {
    event.respondWith(fetch(request));
    return;
  }

  if (isSupabaseLikePath(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlRequest(request, url)) {
    event.respondWith(networkFirst(request, {
      cacheHtmlFallback: true
    }));
    return;
  }

  if (isFreshAsset(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function precacheAppFiles() {
  const cache = await caches.open(CACHE_NAME);

  const results = await Promise.allSettled(
    APP_FILES.map(async (path) => {
      try {
        const request = new Request(path, {
          method: "GET",
          cache: "reload",
          credentials: "same-origin"
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

async function clearOldCaches() {
  const cacheNames = await caches.keys();

  return Promise.all(
    cacheNames
      .filter((name) => name !== CACHE_NAME)
      .map((name) => caches.delete(name))
  );
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();

  return Promise.all(
    cacheNames.map((name) => caches.delete(name))
  );
}

async function notifyClients(message) {
  const clientList = await clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  return Promise.all(
    clientList.map((client) => {
      try {
        client.postMessage(message);
      } catch (error) {
        return null;
      }

      return null;
    })
  );
}

function isHtmlRequest(request, url) {
  return (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html")
  );
}

function isFreshAsset(pathname) {
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".webmanifest")
  );
}

function isStaticAsset(pathname) {
  return (
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".ttf")
  );
}

function isSupabaseLikePath(pathname) {
  return (
    pathname.includes("/rest/v1/") ||
    pathname.includes("/storage/v1/") ||
    pathname.includes("/auth/v1/") ||
    pathname.includes("/realtime/v1/")
  );
}

async function networkFirst(request, options = {}) {
  try {
    const freshResponse = await fetch(request, {
      cache: "no-store",
      credentials: "same-origin"
    });

    const cache = await caches.open(CACHE_NAME);
    await safeCachePut(cache, request, freshResponse);

    return freshResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (options.cacheHtmlFallback) {
      const htmlFallback = await caches.match("/index.html");

      if (htmlFallback) {
        return htmlFallback;
      }
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);

  const freshPromise = fetch(request, {
    cache: "reload",
    credentials: "same-origin"
  })
    .then(async (freshResponse) => {
      const cache = await caches.open(CACHE_NAME);
      await safeCachePut(cache, request, freshResponse);

      return freshResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const freshResponse = await freshPromise;

  if (freshResponse) {
    return freshResponse;
  }

  throw new Error("Klevby SW: ресурс недоступен и не найден в кэше.");
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
