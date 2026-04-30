(function () {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  /*
    Если карта уже работает — можешь оставить ключ пустым.
    Если Яндекс попросит ключ, вставь его между кавычками.
  */
  const YANDEX_API_KEY = "";

  const DEFAULT_CENTER = [53.9023, 27.5619]; // Минск
  const DEFAULT_ZOOM = 7;

  let mapDb = null;
  let mapInstance = null;
  let mapReady = false;
  let postsCollection = null;
  let spotsCollection = null;
  const geocodeCache = {};

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanTelegram(value) {
    let v = String(value || "").trim();

    v = v.replace(/^@/, "");
    v = v.replace(/^https?:\/\/t\.me\//i, "");
    v = v.replace(/^https?:\/\/telegram\.me\//i, "");
    v = v.replace(/^t\.me\//i, "");
    v = v.split("?")[0];
    v = v.split("/")[0];
    v = v.replace(/[^a-zA-Z0-9_]/g, "");

    return v;
  }

  function waitForSupabase() {
    return new Promise(function (resolve, reject) {
      let tries = 0;

      const timer = setInterval(function () {
        tries++;

        if (window.supabase) {
          clearInterval(timer);
          resolve();
        }

        if (tries > 80) {
          clearInterval(timer);
          reject(new Error("Supabase library not loaded"));
        }
      }, 100);
    });
  }

  function loadYandexMapsApi() {
    return new Promise(function (resolve, reject) {
      if (window.ymaps) {
        window.ymaps.ready(resolve);
        return;
      }

      const existingScript = document.querySelector('script[src*="api-maps.yandex.ru"]');

      if (existingScript) {
        existingScript.addEventListener("load", function () {
          window.ymaps.ready(resolve);
        });
        existingScript.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");

      const apiKeyPart = YANDEX_API_KEY
        ? "apikey=" + encodeURIComponent(YANDEX_API_KEY) + "&"
        : "";

      script.src = "https://api-maps.yandex.ru/2.1/?" + apiKeyPart + "lang=ru_RU";
      script.async = true;

      script.onload = function () {
        window.ymaps.ready(resolve);
      };

      script.onerror = function () {
        reject(new Error("Yandex Maps API not loaded"));
      };

      document.head.appendChild(script);
    });
  }

  function prepareMapContainer() {
    const mapSection = document.getElementById("mapSection");

    if (!mapSection) {
      console.error("Не найдена секция #mapSection");
      return null;
    }

    let mapEl = document.getElementById("map");

    if (!mapEl) {
      const oldPlaceholder = mapSection.querySelector(".map-placeholder");

      if (oldPlaceholder) {
        oldPlaceholder.id = "map";
        oldPlaceholder.className = "";
        oldPlaceholder.innerHTML = "";
        mapEl = oldPlaceholder;
      } else {
        mapEl = document.createElement("div");
        mapEl.id = "map";
        mapSection.appendChild(mapEl);
      }
    }

    mapEl.style.width = "100%";
    mapEl.style.minHeight = "520px";
    mapEl.style.height = "65vh";
    mapEl.style.borderRadius = "16px";
    mapEl.style.overflow = "hidden";
    mapEl.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)";
    mapEl.style.background = "#0b171d";

    addMapHint(mapSection);

    return mapEl;
  }

  function addMapHint(mapSection) {
    if (document.getElementById("mapHint")) return;

    const hint = document.createElement("div");
    hint.id = "mapHint";
    hint.style.margin = "14px 0";
    hint.style.padding = "14px 16px";
    hint.style.borderRadius = "16px";
    hint.style.background = "rgba(255,255,255,0.055)";
    hint.style.color = "rgba(244,251,247,0.78)";
    hint.style.fontSize = "14px";
    hint.style.fontWeight = "600";
    hint.style.lineHeight = "1.5";

    hint.innerHTML = `
      🗺️ <b style="color:#fff;">Карта ловли:</b>
      нажми на место на карте, чтобы добавить точку, где можно ловить.
      Для сохранения нужно быть залогиненным на сайте.
    `;

    mapSection.insertBefore(hint, mapSection.firstChild);
  }

  function createMap(mapEl) {
    mapInstance = new ymaps.Map(mapEl, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ["geolocationControl", "zoomControl", "fullscreenControl"]
    }, {
      suppressMapOpenBlock: true
    });

    postsCollection = new ymaps.GeoObjectCollection(null, {
      preset: "islands#blueFishingIcon"
    });

    spotsCollection = new ymaps.GeoObjectCollection(null, {
      preset: "islands#greenDotIcon"
    });

    mapInstance.geoObjects.add(spotsCollection);
    mapInstance.geoObjects.add(postsCollection);

    mapInstance.events.add("click", function (event) {
      const coords = event.get("coords");
      handleMapClick(coords);
    });

    mapReady = true;

    setTimeout(function () {
      if (mapInstance && mapInstance.container) {
        mapInstance.container.fitToViewport();
      }
    }, 500);
  }

  async function handleMapClick(coords) {
    const userResult = await mapDb.auth.getUser();
    const user = userResult.data && userResult.data.user;

    if (!user) {
      alert("Чтобы добавить точку ловли, сначала войди в аккаунт на сайте.");
      return;
    }

    const confirmAdd = confirm("Добавить здесь точку ловли?");
    if (!confirmAdd) return;

    const name = prompt("Название места. Например: Озеро возле Минска");
    if (!name || !name.trim()) return;

    const fish = prompt("Какая рыба водится? Например: щука, окунь, карась") || "";
    const description = prompt("Описание места. Например: подъезд, берег, глубина, совет") || "";

    const spotTypeAnswer = prompt(
      "Тип места: 1 — Бесплатное, 2 — Платное, 3 — Осторожно, 4 — Хороший клёв",
      "1"
    );

    let spotType = "Бесплатное место";

    if (spotTypeAnswer === "2") spotType = "Платное место";
    if (spotTypeAnswer === "3") spotType = "Осторожно";
    if (spotTypeAnswer === "4") spotType = "Хороший клёв";

    const result = await mapDb
      .from("fishing_spots")
      .insert([
        {
          name: name.trim(),
          description: description.trim(),
          fish: fish.trim(),
          spot_type: spotType,
          lat: coords[0],
          lng: coords[1],
          owner_id: user.id
        }
      ]);

    if (result.error) {
      console.error(result.error);
      alert("Не получилось сохранить точку. Проверь вход в аккаунт и таблицу fishing_spots.");
      return;
    }

    alert("Точка ловли добавлена на карту.");
    await loadFishingSpots();
  }

  async function loadFishingSpots() {
    if (!spotsCollection) return;

    spotsCollection.removeAll();

    const result = await mapDb
      .from("fishing_spots")
      .select("*")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("Ошибка загрузки fishing_spots:", result.error);
      return;
    }

    const spots = result.data || [];

    spots.forEach(function (spot) {
      if (!spot.lat || !spot.lng) return;

      const placemark = new ymaps.Placemark(
        [spot.lat, spot.lng],
        {
          balloonContent: getFishingSpotBalloonHtml(spot),
          hintContent: escapeHtml(spot.name || "Точка ловли")
        },
        {
          preset: getSpotPreset(spot.spot_type)
        }
      );

      spotsCollection.add(placemark);
    });
  }

  function getSpotPreset(spotType) {
    const type = String(spotType || "").toLowerCase();

    if (type.includes("плат")) return "islands#yellowDotIcon";
    if (type.includes("осторож")) return "islands#redDotIcon";
    if (type.includes("клёв") || type.includes("клев")) return "islands#greenDotIcon";

    return "islands#darkGreenDotIcon";
  }

  function getFishingSpotBalloonHtml(spot) {
    const name = escapeHtml(spot.name || "Точка ловли");
    const fish = escapeHtml(spot.fish || "Не указано");
    const description = escapeHtml(spot.description || "Описание не указано");
    const spotType = escapeHtml(spot.spot_type || "Место ловли");

    return `
      <div style="max-width:280px;font-family:Arial,sans-serif;">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">
          🎣 ${name}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Тип:</b> ${spotType}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Рыба:</b> ${fish}
        </div>

        <div style="font-size:13px;line-height:1.4;margin-bottom:8px;">
          ${description}
        </div>
      </div>
    `;
  }

  async function loadPostMarkers() {
    if (!postsCollection) return;

    postsCollection.removeAll();

    const result = await mapDb
      .from("posts")
      .select("id, name, city, text, telegram, fishing_type, created_at")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("Ошибка загрузки posts:", result.error);
      return;
    }

    const posts = result.data || [];

    for (const post of posts) {
      if (!post.city) continue;

      try {
        const coords = await geocodeCity(post.city);
        if (!coords) continue;

        const placemark = new ymaps.Placemark(
          coords,
          {
            balloonContent: getPostBalloonHtml(post),
            hintContent: escapeHtml((post.name || "Рыбак") + " — " + post.city)
          },
          {
            preset: "islands#blueFishingIcon"
          }
        );

        postsCollection.add(placemark);
      } catch (error) {
        console.warn("Не удалось поставить метку объявления:", post.city, error);
      }
    }
  }

  async function geocodeCity(city) {
    const query = String(city || "").trim() + ", Беларусь";
    const cacheKey = query.toLowerCase();

    if (geocodeCache[cacheKey]) {
      return geocodeCache[cacheKey];
    }

    const result = await ymaps.geocode(query, {
      results: 1
    });

    const firstGeoObject = result.geoObjects.get(0);

    if (!firstGeoObject) {
      return null;
    }

    const coords = firstGeoObject.geometry.getCoordinates();
    geocodeCache[cacheKey] = coords;

    return coords;
  }

  function getPostBalloonHtml(post) {
    const name = escapeHtml(post.name || "Без имени");
    const city = escapeHtml(post.city || "Город не указан");
    const fishingType = escapeHtml(post.fishing_type || "Тип ловли не указан");
    const text = escapeHtml(post.text || "Описание не указано");
    const tg = cleanTelegram(post.telegram);

    const telegramButton = tg
      ? `
        <a href="https://t.me/${escapeHtml(tg)}" target="_blank"
          style="
            display:inline-block;
            margin-top:8px;
            padding:8px 10px;
            background:#42d986;
            color:#03150c;
            border-radius:10px;
            text-decoration:none;
            font-weight:700;
            font-size:13px;
          ">
          Написать в Telegram
        </a>
      `
      : "";

    return `
      <div style="max-width:280px;font-family:Arial,sans-serif;">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">
          👤 ${name}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Город:</b> ${city}
        </div>

        <div style="font-size:13px;margin-bottom:6px;">
          <b>Тип ловли:</b> ${fishingType}
        </div>

        <div style="font-size:13px;line-height:1.4;margin-bottom:8px;">
          ${text}
        </div>

        ${telegramButton}
      </div>
    `;
  }

  async function reloadMapData() {
    if (!mapReady) return;

    await loadFishingSpots();
    await loadPostMarkers();

    setTimeout(function () {
      if (mapInstance && mapInstance.container) {
        mapInstance.container.fitToViewport();
      }
    }, 300);
  }

  function patchShowSection() {
    if (window.__klevbyMapShowSectionPatched) return;
    if (typeof window.showSection !== "function") return;

    const originalShowSection = window.showSection;

    window.showSection = function (section) {
      originalShowSection(section);

      if (section === "map") {
        setTimeout(function () {
          if (mapInstance && mapInstance.container) {
            mapInstance.container.fitToViewport();
          }

          reloadMapData();
        }, 300);
      }
    };

    window.__klevbyMapShowSectionPatched = true;
  }

  function patchMobileMapButton() {
    const mapButton = document.querySelector('.mobile-tab-btn[onclick="goMobileMap()"]');

    if (!mapButton) return;

    mapButton.addEventListener("click", function () {
      setTimeout(function () {
        if (mapInstance && mapInstance.container) {
          mapInstance.container.fitToViewport();
        }

        reloadMapData();
      }, 500);
    });
  }

  async function initMapLogic() {
    try {
      await waitForSupabase();

      mapDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const mapEl = prepareMapContainer();
      if (!mapEl) return;

      await loadYandexMapsApi();

      createMap(mapEl);
      patchShowSection();
      patchMobileMapButton();

      await reloadMapData();

      window.klevbyReloadMap = reloadMapData;

      console.log("Klevby карта ловли запущена.");
    } catch (error) {
      console.error("Ошибка запуска карты:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMapLogic();
  });
})();
