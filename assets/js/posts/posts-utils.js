(function () {
  const DEFAULT_POSTS_LOAD_TIMEOUT_MS = 9000;

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

    const status = document.getElementById("statusLine");
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
    return String(value || "").toLowerCase().trim();
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
    const config = window.KLEVB_CONFIG || {};
    const images = Array.isArray(config.CARD_IMAGES) ? config.CARD_IMAGES.filter(Boolean) : [];

    if (images.length) {
      return images;
    }

    return [
      "assets/img/narach-bg.webp",
      "assets/img/klevby-icon-512.png"
    ];
  }

  function getCardImage(post) {
    const images = getCardImagesSafe();

    if (!images.length) {
      return "assets/img/klevby-icon-512.png";
    }

    const key = String(post?.id || post?.created_at || post?.name || "klevby");
    let sum = 0;

    for (let i = 0; i < key.length; i++) {
      sum += key.charCodeAt(i);
    }

    return images[Math.abs(sum) % images.length];
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
    withPostsTimeout
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
})();
