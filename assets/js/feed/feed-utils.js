(function () {
  const FALLBACK_CONSTANTS = {
    KLEVB_FEED_PROFILE_PHOTOS_KEY: "klevby_profile_photos",
    KLEVB_FEED_PROFILE_AVATAR_KEY: "klevby_profile_avatar",
    KLEVB_FEED_PROFILE_SETTINGS_KEY: "klevby_profile_settings",
    KLEVB_FEED_PROFILE_NAME_KEY: "klevby_profile_name",
    KLEVB_FEED_VIEWER_KEY: "klevby_feed_viewer_key"
  };

  function getConstants() {
    if (window.KlevbyFeedState && typeof window.KlevbyFeedState.getConstants === "function") {
      return {
        ...FALLBACK_CONSTANTS,
        ...window.KlevbyFeedState.getConstants()
      };
    }

    return FALLBACK_CONSTANTS;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
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

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    if (typeof window.klevbyGetSupabase === "function") {
      try {
        return window.klevbyGetSupabase();
      } catch (error) {
        console.warn("Klevby feed utils: Supabase client не получен", error);
      }
    }

    return null;
  }

  function getCurrentUser() {
    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    if (typeof window.klevbyGetCurrentUser === "function") {
      try {
        return window.klevbyGetCurrentUser();
      } catch (error) {
        console.warn("Klevby feed utils: currentUser не получен", error);
      }
    }

    return null;
  }

  async function ensureUser() {
    let user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    if (typeof window.restoreAuthState === "function") {
      try {
        await window.restoreAuthState("feed_action", false);
      } catch (error) {
        console.warn("Klevby feed utils: не удалось восстановить вход", error);
      }
    }

    user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    return null;
  }

  function isAdmin() {
    if (typeof window.isAdmin === "function") {
      try {
        return Boolean(window.isAdmin());
      } catch (error) {
        return false;
      }
    }

    return Boolean(window.klevbyIsCurrentUserAdmin || window.isKlevbyAdmin);
  }

  function readProfileData() {
    const constants = getConstants();

    try {
      const raw = localStorage.getItem(constants.KLEVB_FEED_PROFILE_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const user = getCurrentUser();
      const meta = user?.user_metadata || {};

      const fallbackName =
        parsed.name ||
        localStorage.getItem(constants.KLEVB_FEED_PROFILE_NAME_KEY) ||
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        "Рыбак";

      return {
        name: String(fallbackName || "Рыбак").trim(),
        city: String(parsed.city || "").trim(),
        telegram: String(parsed.telegram || "").trim(),
        about: String(parsed.about || "").trim()
      };
    } catch (error) {
      return {
        name: "Рыбак",
        city: "",
        telegram: "",
        about: ""
      };
    }
  }

  function getLocalAvatar() {
    const constants = getConstants();

    try {
      return localStorage.getItem(constants.KLEVB_FEED_PROFILE_AVATAR_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function getProfileFeedAvatar(item = null) {
    const itemAvatar =
      item?.authorAvatar ||
      item?.authorAvatarUrl ||
      item?.avatar ||
      item?.avatarUrl ||
      "";

    if (itemAvatar) {
      return itemAvatar;
    }

    try {
      const localAvatar = getLocalAvatar();
      const localProfile = readProfileData();
      const localName = String(localProfile.name || "").trim().toLowerCase();
      const itemName = String(item?.authorName || "").trim().toLowerCase();

      if (localAvatar && localName && itemName && localName === itemName) {
        return localAvatar;
      }

      return "";
    } catch (error) {
      return "";
    }
  }

  function getProfileFeedItemsSafe() {
    try {
      if (typeof window.getProfileFeedItems === "function") {
        const items = window.getProfileFeedItems();

        return Array.isArray(items)
          ? items
              .filter(Boolean)
              .map((item) => ({
                ...item,
                source: item.source || "local",
                userId: item.userId || getCurrentUser()?.id || ""
              }))
          : [];
      }
    } catch (error) {
      console.warn("Klevby feed utils: не удалось получить локальные фото профиля", error);
    }

    return [];
  }

  function getProfileFeedSearchText(item) {
    return normalizeText([
      item?.type,
      item?.authorName,
      item?.authorCity,
      item?.authorTelegram,
      item?.title,
      item?.caption,
      item?.source,
      "фото",
      "рыбалка",
      "профиль",
      "отчет",
      "отчёт",
      "лента",
      "соцсеть"
    ].join(" "));
  }

  function getFilteredProfileFeedItems(options = {}) {
    const search = normalizeText(options.search);
    const selectedCity = normalizeText(options.selectedCity);
    const selectedType = normalizeText(options.selectedType);
    const telegramOnly = Boolean(options.telegramOnly);

    let items = getProfileFeedItemsSafe();

    items = items.filter((item) => {
      if (!item || item.type !== "profile_photo" || !item.image) {
        return false;
      }

      if (search && !getProfileFeedSearchText(item).includes(search)) {
        return false;
      }

      if (selectedCity && !normalizeText(item.authorCity).includes(selectedCity)) {
        return false;
      }

      if (selectedType) {
        const typeText = getProfileFeedSearchText(item);

        if (!typeText.includes(selectedType)) {
          return false;
        }
      }

      if (telegramOnly && !cleanTelegram(item.authorTelegram)) {
        return false;
      }

      return true;
    });

    return items;
  }

  function formatFeedDate(value) {
    if (!value) return "";

    try {
      return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return "";
    }
  }

  function openKlevbyProfileSafe() {
    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (typeof window.showSection === "function") {
      window.showSection("profile");
    }
  }

  function canManageFeedItem(item) {
    if (!item) return false;

    if (item.source === "local") {
      return true;
    }

    const user = getCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      isAdmin() ||
      (userId && item.userId && String(userId) === String(item.userId))
    );
  }

  function canManageComment(comment) {
    if (!comment) return false;

    const user = getCurrentUser();
    const userId = user?.id || "";

    return Boolean(
      isAdmin() ||
      (userId && comment.user_id && String(userId) === String(comment.user_id))
    );
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
    const constants = getConstants();

    try {
      let key = localStorage.getItem(constants.KLEVB_FEED_VIEWER_KEY);

      if (!key || key.length < 12) {
        key = `viewer_${makeIdPart()}`;
        localStorage.setItem(constants.KLEVB_FEED_VIEWER_KEY, key);
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
      throw new Error("Некорректный формат изображения");
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

  function dispatchFeedUpdated(detail = {}) {
    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail
    }));
  }

  window.KlevbyFeedUtils = {
    getConstants,
    escapeHtml,
    escapeAttr,
    normalizeText,
    cleanTelegram,
    getSupabaseClient,
    getCurrentUser,
    ensureUser,
    isAdmin,
    readProfileData,
    getLocalAvatar,
    getProfileFeedAvatar,
    getProfileFeedItemsSafe,
    getProfileFeedSearchText,
    getFilteredProfileFeedItems,
    formatFeedDate,
    openKlevbyProfileSafe,
    canManageFeedItem,
    canManageComment,
    makeIdPart,
    getViewerKey,
    dataUrlToBlob,
    dispatchFeedUpdated
  };

  window.getProfileFeedItemsSafe = getProfileFeedItemsSafe;
  window.getFilteredProfileFeedItems = getFilteredProfileFeedItems;
  window.openKlevbyProfileSafe = openKlevbyProfileSafe;
})();
