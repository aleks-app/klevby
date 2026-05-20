(function () {
  const KLEVB_FEED_BUCKET = "feed-photos";
  const KLEVB_FEED_TABLE = "feed_posts";
  const KLEVB_FEED_LIKES_TABLE = "feed_likes";
  const KLEVB_FEED_COMMENTS_TABLE = "feed_comments";
  const KLEVB_FEED_VIEWS_TABLE = "feed_post_views";

  const KLEVB_FEED_PROFILE_STORAGE_KEY = "klevby_profile_settings";
  const KLEVB_FEED_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_FEED_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_FEED_VIEWER_KEY = "klevby_feed_viewer_key";

  const KLEVB_FEED_AUTH_TIMEOUT_MS = 1400;
  const KLEVB_FEED_REST_TIMEOUT_MS = 9000;
  const KLEVB_FEED_SDK_TIMEOUT_MS = 6500;
  const KLEVB_FEED_TOKEN_EXPIRY_GRACE_SECONDS = 60;

  const KLEVB_FEED_COMMENT_SELECT = [
    "id",
    "post_id",
    "user_id",
    "author_name",
    "author_city",
    "author_telegram",
    "text",
    "created_at",
    "updated_at"
  ].join(",");

  let klevbyFeedRealtimeCallback = null;

  function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      return window.klevbyGetSupabase();
    }

    return null;
  }

  function getConfig() {
    const config = window.KLEVB_CONFIG || window.KlevbyConfig || window.klevbyConfig || {};

    const supabaseUrl =
      config.SUPABASE_URL ||
      config.supabaseUrl ||
      window.SUPABASE_URL ||
      window.KLEVB_SUPABASE_URL ||
      "";

    const supabaseAnonKey =
      config.SUPABASE_ANON_KEY ||
      config.supabaseAnonKey ||
      window.SUPABASE_ANON_KEY ||
      window.KLEVB_SUPABASE_ANON_KEY ||
      "";

    const supabaseStorageKey =
      config.SUPABASE_STORAGE_KEY ||
      config.supabaseStorageKey ||
      "sb-klevby-auth-token";

    return {
      supabaseUrl: String(supabaseUrl || "").replace(/\/+$/, ""),
      supabaseAnonKey: String(supabaseAnonKey || ""),
      supabaseStorageKey: String(supabaseStorageKey || "sb-klevby-auth-token")
    };
  }

  function safeJsonParse(value) {
    try {
      if (!value) return null;

      if (typeof value === "object") {
        return value;
      }

      return JSON.parse(String(value));
    } catch (_) {
      return null;
    }
  }

  function withTimeout(promise, timeoutMs, fallbackValue = null) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        setTimeout(() => resolve(fallbackValue), Math.max(0, Number(timeoutMs || 0)));
      })
    ]);
  }

  function rejectTimeout(promise, timeoutMs, errorMessage) {
    let timer = null;

    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(errorMessage || "Supabase не ответил."));
        }, Math.max(1200, Number(timeoutMs || 0)));
      })
    ]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  function cleanTelegram(value) {
    let cleanValue = String(value || "").trim();

    cleanValue = cleanValue.replace(/^@/, "");
    cleanValue = cleanValue.replace(/^https?:\/\/t\.me\//i, "");
    cleanValue = cleanValue.replace(/^https?:\/\/telegram\.me\//i, "");
    cleanValue = cleanValue.replace(/^t\.me\//i, "");
    cleanValue = cleanValue.split("?")[0];
    cleanValue = cleanValue.split("/")[0];
    cleanValue = cleanValue.replace(/[^a-zA-Z0-9_]/g, "");

    return cleanValue;
  }

  function makeIdPart() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return [
      Date.now(),
      Math.random().toString(16).slice(2),
      Math.random().toString(16).slice(2)
    ].join("-");
  }

  function getViewerKey() {
    try {
      let key = localStorage.getItem(KLEVB_FEED_VIEWER_KEY);

      if (!key || key.length < 12) {
        key = `viewer_${makeIdPart()}`;
        localStorage.setItem(KLEVB_FEED_VIEWER_KEY, key);
      }

      return key;
    } catch (error) {
      return `viewer_${makeIdPart()}`;
    }
  }

  function dataUrlToBlob(dataUrl) {
    const value = String(dataUrl || "");
    const parts = value.split(",");

    if (parts.length < 2) {
      throw new Error("Некорректный формат изображения.");
    }

    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/jpeg";

    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], {
      type: mime
    });
  }

  function setRealtimeCallback(callback) {
    klevbyFeedRealtimeCallback = typeof callback === "function" ? callback : null;
  }

  function getRealtimeCallback() {
    return klevbyFeedRealtimeCallback;
  }

  function dispatch(action, detail = {}) {
    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action,
        ...detail
      }
    }));

    if (typeof klevbyFeedRealtimeCallback === "function") {
      try {
        klevbyFeedRealtimeCallback({
          action,
          ...detail
        });
      } catch (error) {
        console.warn("Klevby feed: callback realtime не сработал", error);
      }
    }
  }

  window.KlevbyFeedSupabaseCore = {
    BUCKET: KLEVB_FEED_BUCKET,
    TABLE: KLEVB_FEED_TABLE,
    LIKES_TABLE: KLEVB_FEED_LIKES_TABLE,
    COMMENTS_TABLE: KLEVB_FEED_COMMENTS_TABLE,
    VIEWS_TABLE: KLEVB_FEED_VIEWS_TABLE,

    PROFILE_STORAGE_KEY: KLEVB_FEED_PROFILE_STORAGE_KEY,
    PROFILE_NAME_KEY: KLEVB_FEED_PROFILE_NAME_KEY,
    PROFILE_AVATAR_KEY: KLEVB_FEED_PROFILE_AVATAR_KEY,
    VIEWER_KEY: KLEVB_FEED_VIEWER_KEY,

    AUTH_TIMEOUT_MS: KLEVB_FEED_AUTH_TIMEOUT_MS,
    REST_TIMEOUT_MS: KLEVB_FEED_REST_TIMEOUT_MS,
    SDK_TIMEOUT_MS: KLEVB_FEED_SDK_TIMEOUT_MS,
    TOKEN_EXPIRY_GRACE_SECONDS: KLEVB_FEED_TOKEN_EXPIRY_GRACE_SECONDS,
    COMMENT_SELECT: KLEVB_FEED_COMMENT_SELECT,

    getClient,
    getConfig,
    safeJsonParse,
    withTimeout,
    rejectTimeout,
    cleanTelegram,
    makeIdPart,
    getViewerKey,
    dataUrlToBlob,
    setRealtimeCallback,
    getRealtimeCallback,
    dispatch
  };
})();
