(function () {
  const PROFILE_UTILS_VERSION = "20260513-profile-utils-split-1";

  const DEFAULT_REST_TIMEOUT_MS = 12000;
  const DEFAULT_TOKEN_EXPIRY_GRACE_SECONDS = 90;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTelegramLabel(value) {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) return "";

    if (cleanValue.startsWith("@")) return cleanValue;

    const match = cleanValue.match(/t\.me\/([^/?#]+)/i);
    if (match && match[1]) return `@${match[1]}`;

    return cleanValue;
  }

  function isPublicUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
  }

  function waitForFrame() {
    return new Promise((resolve) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
        return;
      }

      setTimeout(resolve, 0);
    });
  }

  function parseProfileAuthStorageValue(raw) {
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function decodeJwtPayload(token) {
    const value = String(token || "").trim();

    if (!value || !value.includes(".")) {
      return null;
    }

    try {
      const payloadPart = value.split(".")[1] || "";
      const normalized = payloadPart
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");

      return JSON.parse(atob(normalized));
    } catch (_) {
      return null;
    }
  }

  function getJwtExpiresAtMs(token) {
    const payload = decodeJwtPayload(token);
    const exp = Number(payload?.exp || 0);

    if (!exp) {
      return 0;
    }

    return exp * 1000;
  }

  function isProfileAccessTokenUsable(token, graceSeconds = DEFAULT_TOKEN_EXPIRY_GRACE_SECONDS) {
    const value = String(token || "").trim();

    if (!value) {
      return false;
    }

    const expiresAtMs = getJwtExpiresAtMs(value);

    if (!expiresAtMs) {
      return true;
    }

    return expiresAtMs > Date.now() + (Number(graceSeconds || 0) * 1000);
  }

  function encodeStoragePath(path) {
    return String(path || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function promiseWithTimeout(promise, timeoutMs, message = "Timeout") {
    let timer = null;

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_REST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result || ""));
      };

      reader.onerror = () => {
        reject(new Error("FileReader error"));
      };

      reader.readAsDataURL(blob);
    });
  }

  function estimateDataUrlSizeKb(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const padding = (base64.match(/=+$/) || [""])[0].length;
    const bytes = Math.max(0, Math.round((base64.length * 3) / 4) - padding);

    return Math.round(bytes / 1024);
  }

  window.KlevbyProfileUtils = {
    version: PROFILE_UTILS_VERSION,

    constants: {
      DEFAULT_REST_TIMEOUT_MS,
      DEFAULT_TOKEN_EXPIRY_GRACE_SECONDS
    },

    escapeHtml,
    formatTelegramLabel,
    isPublicUrl,
    waitForFrame,
    parseProfileAuthStorageValue,
    decodeJwtPayload,
    getJwtExpiresAtMs,
    isProfileAccessTokenUsable,
    encodeStoragePath,
    promiseWithTimeout,
    fetchWithTimeout,
    blobToDataUrl,
    estimateDataUrlSizeKb
  };

  console.log("Klevby profile utils loaded", {
    version: PROFILE_UTILS_VERSION
  });
})();
