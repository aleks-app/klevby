(function () {
  const DEFAULT_POSTS_LOAD_TIMEOUT_MS = 9000;

  const TRIP_CARD_IMAGES = [
    "assets/img/trips/narach.jpg",
    "assets/img/trips/minsk-sea.jpg",
    "assets/img/trips/quarry.jpg",
    "assets/img/trips/river.jpg",
    "assets/img/trips/forest-lake.jpg",
    "assets/img/trips/pond.jpg",
    "assets/img/trips/fishing-sunset.jpg",
    "assets/img/trips/default-lake.webp"
  ];

  const TRIP_CARD_DEFAULT_IMAGE = "assets/img/trips/default-lake.webp";

  const TRIP_IMAGE_RULES = [
    {
      image: "assets/img/trips/narach.jpg",
      keywords: [
        "нароч",
        "нарач",
        "narach",
        "naroch"
      ]
    },
    {
      image: "assets/img/trips/minsk-sea.jpg",
      keywords: [
        "минское море",
        "минск море",
        "заслав",
        "заславское",
        "заславское водохранилище",
        "море"
      ]
    },
    {
      image: "assets/img/trips/quarry.jpg",
      keywords: [
        "карьер",
        "карьеры",
        "солен",
        "соленый",
        "солёный",
        "солёное",
        "соленое",
        "солнечный",
        "меловой",
        "меловые",
        "мел"
      ]
    },
    {
      image: "assets/img/trips/river.jpg",
      keywords: [
        "река",
        "неман",
        "березина",
        "березин",
        "припять",
        "припят",
        "днепр",
        "свислочь",
        "свислоч",
        "вилия",
        "сож",
        "друть",
        "двина",
        "западная двина",
        "ручей"
      ]
    },
    {
      image: "assets/img/trips/pond.jpg",
      keywords: [
        "пруд",
        "пруды",
        "платник",
        "платный",
        "платная",
        "водоем",
        "водоём",
        "став",
        "карп",
        "карповый",
        "карпфишинг",
        "коммерческий"
      ]
    },
    {
      image: "assets/img/trips/forest-lake.jpg",
      keywords: [
        "лес",
        "лесное",
        "лесной",
        "озеро",
        "озера",
        "озёра",
        "озер",
        "дикое",
        "дикий",
        "болото",
        "болот",
        "залив",
        "тихое место",
        "туман"
      ]
    },
    {
      image: "assets/img/trips/fishing-sunset.jpg",
      keywords: [
        "закат",
        "рассвет",
        "вечер",
        "вечером",
        "утро",
        "утром",
        "заря",
        "ночь",
        "ночная",
        "ночью"
      ]
    }
  ];

  function isAuthLockError(error) {
    const message = String(error?.message || error || "").toLowerCase();

    return (
      message.includes("lock") &&
      message.includes("auth-token")
    );
  }

  function isPostsTimeoutError(error) {
    return Boolean(error && error.name === "KlevbyPostsTimeoutError");
  }

  function isPostsSchemaFallbackError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const payload = `${message} ${details} ${hint}`;

    return (
      payload.includes("fishing_type") ||
      payload.includes("schema cache") ||
      payload.includes("could not find") ||
      payload.includes("column")
    );
  }

  function showStatusSafe(message, isError = false) {
    if (typeof showStatus === "function") {
      showStatus(message, isError);
      return;
    }

    if (typeof window.showStatus === "function") {
      window.showStatus(message, isError);
      return;
    }

    const status = document.getElementById("tripsFullscreenStatusLine");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error-line", Boolean(isError));
  }

  function showFormMessageSafe(message, isError = false) {
    if (typeof showFormMessage === "function") {
      showFormMessage(message, isError);
      return;
    }

    if (typeof window.showFormMessage === "function") {
      window.showFormMessage(message, isError);
      return;
    }

    const el = document.getElementById("formMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#ffd2d2" : "rgba(245,245,245,0.66)";
  }

  function openTelegramSafe() {
    if (typeof openTelegram === "function") {
      openTelegram();
      return;
    }

    if (typeof window.openTelegram === "function") {
      window.openTelegram();
      return;
    }

    const config = window.KLEVB_CONFIG || {};
    const link = config.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
    window.open(link, "_blank");
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

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replaceAll("ё", "е")
      .trim();
  }

  function normalizeSelectFilterValue(elementId) {
    const value = normalizeText(document.getElementById(elementId)?.value);

    if (!value) return "";

    if (
      value === "выберите город" ||
      value === "все города" ||
      value === "город" ||
      value === "способ ловли" ||
      value === "выберите способ ловли" ||
      value === "тип ловли" ||
      value === "все способы"
    ) {
      return "";
    }

    return value;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replaceAll("`", "&#096;");
  }

  function getPostFishingType(post) {
    return post?.fishing_type || post?.type || post?.category || "";
  }

  function getFishingTypeClass(type) {
    const t = normalizeText(type);

    if (t.includes("спин")) return "type-spinning";
    if (t.includes("фидер")) return "type-feeder";
    if (t.includes("поплав")) return "type-float";
    if (t.includes("карп")) return "type-carp";
    if (t.includes("зим")) return "type-winter";

    return "";
  }

  function getCardImagesSafe() {
    return TRIP_CARD_IMAGES.slice();
  }

  function getPostImageSearchText(post) {
    return normalizeText([
      post?.destination,
      post?.city,
      post?.trip_time,
      post?.transport,
      post?.seats,
      post?.text,
      post?.name,
      getPostFishingType(post)
    ].filter(Boolean).join(" "));
  }

  function getCustomPostImage(post) {
    const value =
      post?.card_image ||
      post?.image_url ||
      post?.photo_url ||
      post?.cover_url ||
      post?.image ||
      "";

    const src = String(value || "").trim();

    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("assets/") ||
      src.startsWith("./assets/") ||
      src.startsWith("/")
    ) {
      return src;
    }

    return "";
  }

  function getDeterministicImage(post, images) {
    const safeImages = Array.isArray(images) && images.length ? images : [TRIP_CARD_DEFAULT_IMAGE];
    const key = String(
      post?.id ||
      post?.created_at ||
      post?.destination ||
      post?.city ||
      post?.name ||
      post?.text ||
      "klevby"
    );

    let sum = 0;

    for (let i = 0; i < key.length; i++) {
      sum += key.charCodeAt(i) * (i + 1);
    }

    return safeImages[Math.abs(sum) % safeImages.length] || TRIP_CARD_DEFAULT_IMAGE;
  }

  function getCardImage(post) {
    const customImage = getCustomPostImage(post);

    if (customImage) {
      return customImage;
    }

    const searchText = getPostImageSearchText(post);

    for (const rule of TRIP_IMAGE_RULES) {
      const matched = rule.keywords.some((keyword) => {
        return searchText.includes(normalizeText(keyword));
      });

      if (matched) {
        return rule.image;
      }
    }

    return getDeterministicImage(post, TRIP_CARD_IMAGES);
  }

  function saveAuthorLocal(name, telegram) {
    localStorage.setItem("klevby_author_name", name || "");
    localStorage.setItem("klevby_author_telegram", telegram || "");
  }

  function withPostsTimeout(promise, timeoutMs = DEFAULT_POSTS_LOAD_TIMEOUT_MS) {
    let timeoutId = null;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error("Загрузка объявлений заняла слишком много времени.");
        error.name = "KlevbyPostsTimeoutError";
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  function ensureTripImageBlendStyles() {
    return false;
  }


  window.KlevbyPostsUtils = {
    isAuthLockError,
    isPostsTimeoutError,
    isPostsSchemaFallbackError,
    showStatusSafe,
    showFormMessageSafe,
    openTelegramSafe,
    cleanTelegram,
    normalizeText,
    normalizeSelectFilterValue,
    escapeHtml,
    escapeAttr,
    getPostFishingType,
    getFishingTypeClass,
    getCardImagesSafe,
    getCardImage,
    saveAuthorLocal,
    withPostsTimeout,
    ensureTripImageBlendStyles
  };

  window.cleanTelegram = cleanTelegram;
  window.normalizeText = normalizeText;
  window.escapeHtml = escapeHtml;
  window.escapeAttr = escapeAttr;
  window.getPostFishingType = getPostFishingType;
  window.getFishingTypeClass = getFishingTypeClass;
  window.getCardImage = getCardImage;
  window.saveAuthorLocal = saveAuthorLocal;
  window.openTelegramSafe = openTelegramSafe;

  ensureTripImageBlendStyles();

  console.log("Klevby posts utils loaded", {
    version: "20260618-trips-fullscreen-utils-1"
  });
})();
