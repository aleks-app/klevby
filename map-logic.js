/* map-logic.js */
/* Klevby — карта объявлений рыбаков Беларуси */

(function () {
  "use strict";

  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  const YANDEX_MAPS_API_KEY = "6a7d9dd0-9c0c-4158-8e6d-ac06b5f43190";

  const DEFAULT_CENTER = [53.9023, 27.5619]; // Минск
  const DEFAULT_ZOOM = 7;

  let mapDb = null;
  let mapInstance = null;
  let clusterer = null;
  let mapInitialized = false;
  let postsLoaded = false;
  let cityCoordsCache = {};

  document.addEventListener("DOMContentLoaded", function () {
    prepareMapBlock();
    initMapSupabase();
    loadYandexMaps();
    hookSectionOpen();
  });

  function initMapSupabase() {
    if (!window.supabase || !window.supabase.createClient) {
      console.error("Klevby Map: Supabase не найден. Проверь подключение библиотеки Supabase.");
      return;
    }

    mapDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  function prepareMapBlock() {
    const mapSection = document.getElementById("mapSection");

    if (!mapSection) {
      console.warn("Klevby Map: не найдена секция #mapSection.");
      return;
    }

    let mapBlock = document.getElementById("map");

    if (mapBlock) {
      setupMapBlockStyle(mapBlock);
      return;
    }

    const placeholder = mapSection.querySelector(".map-placeholder");

    if (placeholder) {
      placeholder.innerHTML = "";
      placeholder.style.padding = "0";
      placeholder.style.display = "block";
      placeholder.style.overflow = "hidden";
      placeholder.style.minHeight = "420px";
      placeholder.style.background = "rgba(18, 30, 36, 0.94)";
      placeholder.style.borderRadius = "16px";

      mapBlock = document.createElement("div");
      mapBlock.id = "map";
      placeholder.appendChild(mapBlock);
    } else {
      mapBlock = document.createElement("div");
      mapBlock.id = "map";
      mapSection.appendChild(mapBlock);
    }

    setupMapBlockStyle(mapBlock);
  }

  function setupMapBlockStyle(mapBlock) {
    mapBlock.style.width = "100%";
    mapBlock.style.height = "420px";
    mapBlock.style.minHeight = "420px";
    mapBlock.style.borderRadius = "16px";
    mapBlock.style.overflow = "hidden";
    mapBlock.style.background = "#111";
  }

  function loadYandexMaps() {
    if (window.ymaps && window.ymaps.ready) {
      onYandexMapsReady();
      return;
    }

    const existingScript = document.querySelector('script[data-klevby-yandex-maps="true"]');

    if (existingScript) {
      existingScript.addEventListener("load", onYandexMapsReady);
      existingScript.addEventListener("error", function () {
        console.error("Klevby Map: не удалось загрузить Яндекс.Карты.");
      });
      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://api-maps.yandex.ru/2.1/?apikey=" +
      encodeURIComponent(YANDEX_MAPS_API_KEY) +
      "&lang=ru_RU";

    script.async = true;
    script.defer = true;
    script.setAttribute("data-klevby-yandex-maps", "true");

    script.onload = onYandexMapsReady;

    script.onerror = function () {
      console.error("Klevby Map: ошибка загрузки API Яндекс.Карт.");
    };

    document.head.appendChild(script);
  }

  function onYandexMapsReady() {
    if (!window.ymaps || !window.ymaps.ready) {
      console.error("Klevby Map: ymaps не найден после загрузки скрипта.");
      return;
    }

    window.ymaps.ready(function () {
      if (isMapSectionVisible()) {
        initMap();
      }
    });
  }

  function hookSectionOpen() {
    const originalShowSection = window.showSection;

    if (typeof originalShowSection === "function") {
      window.showSection = function (section) {
        originalShowSection(section);

        if (section === "map") {
          setTimeout(function () {
            initMap();
            fixMapSize();
          }, 250);
        }
      };
    }

    document.addEventListener("click", function (event) {
      const target = event.target.closest("button, a");
      if (!target) return;

      const text = (target.textContent || "").toLowerCase();
      const onclick = target.getAttribute("onclick") || "";

      const isMapButton =
        text.includes("карта") ||
        text.includes("карту") ||
        onclick.includes("goMobileMap") ||
        onclick.includes("showSection('map')") ||
        onclick.includes('showSection("map")');

      if (isMapButton) {
        setTimeout(function () {
          initMap();
          fixMapSize();
        }, 300);
      }
    });

    const mapSection = document.getElementById("mapSection");

    if (mapSection && "MutationObserver" in window) {
      const observer = new MutationObserver(function () {
        if (isMapSectionVisible()) {
          setTimeout(function () {
            initMap();
            fixMapSize();
          }, 250);
        }
      });

      observer.observe(mapSection, {
        attributes: true,
        attributeFilter: ["class", "style"]
      });
    }

    window.addEventListener("resize", function () {
      setTimeout(fixMapSize, 200);
    });
  }

  function isMapSectionVisible() {
    const mapSection = document.getElementById("mapSection");

    if (!mapSection) return false;
    if (mapSection.classList.contains("hidden")) return false;

    return window.getComputedStyle(mapSection).display !== "none";
  }

  function initMap() {
    if (mapInitialized) {
      fixMapSize();

      if (!postsLoaded) {
        loadPostsToMap();
      }

      return;
    }

    if (!mapDb) {
      initMapSupabase();
    }

    if (!mapDb) {
      console.error("Klevby Map: Supabase клиент не создан.");
      return;
    }

    if (!window.ymaps || !window.ymaps.Map) {
      console.warn("Klevby Map: Яндекс.Карты ещё не загружены.");
      return;
    }

    if (!document.getElementById("map")) {
      prepareMapBlock();
    }

    if (!document.getElementById("map")) {
      console.error("Klevby Map: блок #map не найден и не создан.");
      return;
    }

    mapInstance = new window.ymaps.Map("map", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ["zoomControl", "fullscreenControl", "geolocationControl"]
    });

    clusterer = new window.ymaps.Clusterer({
      preset: "islands#greenClusterIcons",
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
      clusterOpenBalloonOnClick: true
    });

    mapInstance.geoObjects.add(clusterer);

    mapInitialized = true;

    setTimeout(fixMapSize, 300);

    loadPostsToMap();
  }

  async function loadPostsToMap() {
    if (!mapDb || !mapInstance || !clusterer) return;

    postsLoaded = true;

    try {
      const result = await mapDb
        .from("posts")
        .select("id, name, city, fishing_type, text, telegram, crew_full, created_at")
        .order("created_at", { ascending: false });

      if (result.error) {
        console.error("Klevby Map: ошибка загрузки posts из Supabase:", result.error);
        return;
      }

      const posts = result.data || [];

      clusterer.removeAll();

      if (!posts.length) {
        console.warn("Klevby Map: в таблице posts нет объявлений.");
        return;
      }

      const placemarks = [];

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        if (!post || !post.city) continue;

        const city = String(post.city).trim();

        if (!city) continue;

        const coords = await getCoordsByCity(city);

        if (!coords) {
          console.warn("Klevby Map: не удалось определить координаты города:", city);
          continue;
        }

        const placemark = createPlacemark(post, coords);
        placemarks.push(placemark);
      }

      if (!placemarks.length) {
        console.warn("Klevby Map: нет объявлений с городами, которые удалось найти.");
        return;
      }

      clusterer.add(placemarks);

      if (placemarks.length === 1) {
        mapInstance.setCenter(placemarks[0].geometry.getCoordinates(), 10);
      } else {
        mapInstance.setBounds(clusterer.getBounds(), {
          checkZoomRange: true,
          zoomMargin: 45
        });
      }

      setTimeout(fixMapSize, 300);
    } catch (error) {
      console.error("Klevby Map: общая ошибка загрузки меток:", error);
    }
  }

  async function getCoordsByCity(city) {
    const cacheKey = city.toLowerCase();

    if (cityCoordsCache[cacheKey]) {
      return cityCoordsCache[cacheKey];
    }

    try {
      const searchQuery = city + ", Беларусь";

      const result = await window.ymaps.geocode(searchQuery, {
        results: 1
      });

      const firstGeoObject = result.geoObjects.get(0);

      if (!firstGeoObject) {
        return null;
      }

      const coords = firstGeoObject.geometry.getCoordinates();

      cityCoordsCache[cacheKey] = coords;

      return coords;
    } catch (error) {
      console.warn("Klevby Map: ошибка геокодера для города:", city, error);
      return null;
    }
  }

  function createPlacemark(post, coords) {
    const name = post.name ? String(post.name).trim() : "Рыбак Klevby";
    const city = post.city ? String(post.city).trim() : "";
    const fishingType = post.fishing_type ? String(post.fishing_type).trim() : "Тип ловли не указан";
    const text = post.text ? String(post.text).trim() : "Описание не указано.";
    const isFull = Boolean(post.crew_full);

    return new window.ymaps.Placemark(
      coords,
      {
        hintContent: escapeHtml(name + (city ? " — " + city : "")),
        balloonContentHeader: getBalloonHeader(name, city, isFull),
        balloonContentBody: getBalloonBody(fishingType, text, post.telegram, isFull),
        balloonContentFooter: getBalloonFooter(post.created_at)
      },
      {
        preset: isFull ? "islands#grayDotIcon" : "islands#greenDotIcon"
      }
    );
  }

  function getBalloonHeader(name, city, isFull) {
    let html = "";

    html += '<div style="font-family:Arial,sans-serif;max-width:280px;">';
    html += '<div style="font-size:16px;font-weight:700;color:#111;margin-bottom:4px;">';
    html += escapeHtml(name);
    html += "</div>";

    if (city) {
      html += '<div style="font-size:13px;color:#555;">📍 ';
      html += escapeHtml(city);
      html += "</div>";
    }

    if (isFull) {
      html += '<div style="display:inline-block;margin-top:7px;padding:5px 8px;border-radius:999px;background:#eeeeee;color:#555;font-size:12px;font-weight:700;">';
      html += "Экипаж набран";
      html += "</div>";
    }

    html += "</div>";

    return html;
  }

  function getBalloonBody(fishingType, text, telegram, isFull) {
    const telegramLink = makeTelegramLink(telegram);

    let html = "";

    html += '<div style="font-family:Arial,sans-serif;max-width:280px;">';

    html += '<div style="margin:10px 0 8px;">';
    html += '<div style="font-size:12px;color:#777;margin-bottom:3px;">Тип ловли</div>';
    html += '<div style="font-size:14px;font-weight:700;color:#222;">🎣 ';
    html += escapeHtml(fishingType);
    html += "</div>";
    html += "</div>";

    html += '<div style="margin:10px 0 12px;">';
    html += '<div style="font-size:12px;color:#777;margin-bottom:3px;">Описание</div>';
    html += '<div style="font-size:14px;line-height:1.45;color:#222;white-space:pre-line;">';
    html += escapeHtml(text);
    html += "</div>";
    html += "</div>";

    if (isFull) {
      html += '<button disabled style="width:100%;padding:10px 12px;border:0;border-radius:10px;background:#dddddd;color:#777;font-size:13px;font-weight:700;cursor:not-allowed;">';
      html += "Экипаж уже набран";
      html += "</button>";
    } else if (telegramLink) {
      html += '<a href="';
      html += escapeHtml(telegramLink);
      html += '" target="_blank" rel="noopener noreferrer" ';
      html += 'style="display:block;text-align:center;padding:10px 12px;border-radius:10px;background:#25d366;color:#06140b;text-decoration:none;font-size:13px;font-weight:700;">';
      html += "Написать в Telegram";
      html += "</a>";
    } else {
      html += '<div style="padding:10px 12px;border-radius:10px;background:#f1f1f1;color:#666;font-size:13px;">';
      html += "Telegram не указан";
      html += "</div>";
    }

    html += "</div>";

    return html;
  }

  function getBalloonFooter(createdAt) {
    if (!createdAt) return "";

    try {
      const date = new Date(createdAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
      });

      return '<span style="font-size:12px;color:#777;">Добавлено: ' + escapeHtml(date) + "</span>";
    } catch (error) {
      return "";
    }
  }

  function makeTelegramLink(value) {
    let tg = String(value || "").trim();

    if (!tg) return "";

    tg = tg.replace(/^@/, "");
    tg = tg.replace(/^https?:\/\/t\.me\//i, "");
    tg = tg.replace(/^https?:\/\/telegram\.me\//i, "");
    tg = tg.replace(/^t\.me\//i, "");
    tg = tg.split("?")[0];
    tg = tg.split("/")[0];
    tg = tg.replace(/\s/g, "");
    tg = tg.replace(/[^a-zA-Z0-9_]/g, "");

    if (!tg) return "";

    if (!/^[a-zA-Z0-9_]{5,32}$/.test(tg)) {
      return "";
    }

    return "https://t.me/" + tg;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fixMapSize() {
    if (!mapInstance || !mapInstance.container) return;

    try {
      mapInstance.container.fitToViewport();
    } catch (error) {
      console.warn("Klevby Map: не удалось обновить размер карты:", error);
    }
  }

  window.klevbyReloadMap = function () {
    postsLoaded = false;

    if (mapInitialized) {
      loadPostsToMap();
    } else {
      initMap();
    }
  };
})();
