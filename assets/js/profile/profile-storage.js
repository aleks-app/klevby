(function () {
  const PROFILE_STORAGE_VERSION = "20260513-profile-storage-split-1";

  const KLEVB_PROFILE_STORAGE_KEY = "klevby_profile_settings";
  const KLEVB_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_PROFILE_PHOTOS_KEY = "klevby_profile_photos";

  const KLEVB_PROFILE_MAX_PHOTOS = 8;

  function getDefaultProfileData() {
    return {
      name: "",
      city: "",
      telegram: "",
      about: ""
    };
  }

  function isMainAuthGuestAuthoritative() {
    const recentLogout =
      typeof window.isAuthLogoutGuardActive === "function"
        ? window.isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);

    return Boolean(
      (recentLogout || window.klevbyAuthReady) &&
      !window.currentUser &&
      !window.klevbyCurrentUser &&
      !window.klevbyUser
    );
  }

  function getCurrentProfileUser() {
    const mainUser =
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      null;

    if (mainUser || isMainAuthGuestAuthoritative()) {
      return mainUser;
    }

    return getProfileUserFromStoredAuth() || null;
  }

  function parseProfileAuthStorageValue(raw) {
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function getProfileStoredAuthData() {
    try {
      const preferredKeys = [
        "sb-klevby-auth-token",
        "supabase.auth.token"
      ];

      for (const key of preferredKeys) {
        const raw = localStorage.getItem(key);
        const parsed = parseProfileAuthStorageValue(raw);

        if (parsed) {
          return parsed;
        }
      }

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";

        if (!key.includes("auth-token") && !key.startsWith("sb-")) {
          continue;
        }

        const raw = localStorage.getItem(key);
        const parsed = parseProfileAuthStorageValue(raw);

        if (
          parsed?.access_token ||
          parsed?.currentSession?.access_token ||
          parsed?.session?.access_token
        ) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("[KlevbyProfileStorage] Не удалось прочитать auth из localStorage.", error);
    }

    return null;
  }

  function getProfileSessionFromAuthData(authData) {
    if (!authData || typeof authData !== "object") {
      return null;
    }

    if (authData.currentSession?.access_token) {
      return authData.currentSession;
    }

    if (authData.session?.access_token) {
      return authData.session;
    }

    if (authData.data?.session?.access_token) {
      return authData.data.session;
    }

    if (authData.access_token) {
      return authData;
    }

    return null;
  }

  function getProfileUserFromStoredAuth() {
    const authData = getProfileStoredAuthData();
    const session = getProfileSessionFromAuthData(authData);

    return (
      session?.user ||
      authData?.user ||
      authData?.currentSession?.user ||
      authData?.session?.user ||
      authData?.data?.session?.user ||
      null
    );
  }

  function getProfileNameFromCurrentUser() {
    try {
      const user = getCurrentProfileUser();
      const meta = user?.user_metadata || {};

      return (
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        ""
      ).trim();
    } catch (_) {
      return "";
    }
  }

  function getProfileNameFromInputs() {
    const nameInput = document.getElementById("nameInput");
    const usernameInput = document.getElementById("usernameInput");

    const nameValue = nameInput && nameInput.value ? nameInput.value.trim() : "";
    const usernameValue = usernameInput && usernameInput.value ? usernameInput.value.trim() : "";

    return nameValue || usernameValue || "";
  }

  function readProfileData() {
    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};

      return {
        ...getDefaultProfileData(),
        ...parsed,
        name:
          parsed.name ||
          localStorage.getItem(KLEVB_PROFILE_NAME_KEY) ||
          getProfileNameFromInputs() ||
          getProfileNameFromCurrentUser() ||
          ""
      };
    } catch (error) {
      console.warn("[KlevbyProfileStorage] Не удалось прочитать профиль.", error);

      return {
        ...getDefaultProfileData(),
        name: getProfileNameFromInputs() || getProfileNameFromCurrentUser() || ""
      };
    }
  }

  function saveProfileData(data) {
    const cleanData = {
      name: String(data?.name || "").trim(),
      city: String(data?.city || "").trim(),
      telegram: String(data?.telegram || "").trim(),
      about: String(data?.about || "").trim()
    };

    try {
      localStorage.setItem(KLEVB_PROFILE_STORAGE_KEY, JSON.stringify(cleanData));

      if (cleanData.name) {
        localStorage.setItem(KLEVB_PROFILE_NAME_KEY, cleanData.name);
      }
    } catch (error) {
      console.warn("[KlevbyProfileStorage] Не удалось сохранить профиль.", error);
    }

    return cleanData;
  }

  function readProfilePhotos() {
    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_PHOTOS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[KlevbyProfileStorage] Не удалось прочитать фото профиля.", error);
      return [];
    }
  }

  function saveProfilePhotos(photos) {
    const safePhotos = Array.isArray(photos)
      ? photos.slice(0, KLEVB_PROFILE_MAX_PHOTOS)
      : [];

    try {
      localStorage.setItem(KLEVB_PROFILE_PHOTOS_KEY, JSON.stringify(safePhotos));
    } catch (error) {
      console.warn("[KlevbyProfileStorage] Не удалось сохранить фото профиля.", error);
      alert("Фото не сохранилось. Память браузера заполнена. Удали старые фото или выбери другое.");
    }

    return safePhotos;
  }

  function getProfileFeedItems() {
    const data = readProfileData();
    const photos = readProfilePhotos();

    return photos.map((photo) => {
      return {
        type: "profile_photo",
        id: photo.feedPostId || photo.id,
        localId: photo.id,
        feedPostId: photo.feedPostId || "",
        feedImagePath: photo.feedImagePath || "",
        authorName: data.name || getProfileNameFromCurrentUser() || "Рыбак",
        authorCity: data.city || "",
        authorTelegram: data.telegram || "",
        image: photo.feedImageUrl || photo.src || "",
        title: photo.title || "Фото с рыбалки",
        createdAt: photo.createdAt || "",
        savedSizeKb: photo.savedSizeKb || 0,
        width: photo.width || 0,
        height: photo.height || 0,
        source: photo.feedPostId ? "supabase" : (photo.source || "local")
      };
    });
  }

  window.KlevbyProfileStorage = {
    version: PROFILE_STORAGE_VERSION,

    constants: {
      KLEVB_PROFILE_STORAGE_KEY,
      KLEVB_PROFILE_AVATAR_KEY,
      KLEVB_PROFILE_NAME_KEY,
      KLEVB_PROFILE_PHOTOS_KEY,
      KLEVB_PROFILE_MAX_PHOTOS
    },

    getDefaultProfileData,
    readProfileData,
    saveProfileData,
    readProfilePhotos,
    saveProfilePhotos,
    getProfileFeedItems,

    getCurrentProfileUser,
    getProfileNameFromCurrentUser,
    getProfileNameFromInputs,
    parseProfileAuthStorageValue,
    getProfileStoredAuthData,
    getProfileSessionFromAuthData,
    getProfileUserFromStoredAuth
  };

  console.log("Klevby profile storage module loaded", {
    version: PROFILE_STORAGE_VERSION
  });
})();
