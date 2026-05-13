(function () {
  const PROFILE_STORAGE_VERSION = "20260513-profile-storage-split-1";

  const KLEVB_PROFILE_STORAGE_KEY = "klevby_profile_settings";
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

  function getFallbackNameFromInputs(options = {}) {
    if (typeof options.getProfileNameFromInputs === "function") {
      try {
        return String(options.getProfileNameFromInputs() || "").trim();
      } catch (_) {
        return "";
      }
    }

    return "";
  }

  function getFallbackNameFromCurrentUser(options = {}) {
    if (typeof options.getProfileNameFromCurrentUser === "function") {
      try {
        return String(options.getProfileNameFromCurrentUser() || "").trim();
      } catch (_) {
        return "";
      }
    }

    return "";
  }

  function readProfileData(options = {}) {
    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};

      return {
        ...getDefaultProfileData(),
        ...parsed,
        name:
          parsed.name ||
          localStorage.getItem(KLEVB_PROFILE_NAME_KEY) ||
          getFallbackNameFromInputs(options) ||
          getFallbackNameFromCurrentUser(options) ||
          ""
      };
    } catch (error) {
      console.warn("Klevby profile storage: не удалось прочитать профиль", error);

      return {
        ...getDefaultProfileData(),
        name: getFallbackNameFromInputs(options) || getFallbackNameFromCurrentUser(options) || ""
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
      console.warn("Klevby profile storage: не удалось сохранить профиль", error);
    }

    return cleanData;
  }

  function readProfilePhotos() {
    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_PHOTOS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Klevby profile storage: не удалось прочитать фото", error);
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
      console.warn("Klevby profile storage: не удалось сохранить фото", error);
      alert("Фото не сохранилось. Память браузера заполнена. Удали старые фото или выбери другое.");
    }

    return safePhotos;
  }

  function getProfileFeedItems(options = {}) {
    const data = readProfileData(options);
    const photos = readProfilePhotos();

    return photos.map((photo) => {
      return {
        type: "profile_photo",
        id: photo.feedPostId || photo.id,
        localId: photo.id,
        feedPostId: photo.feedPostId || "",
        feedImagePath: photo.feedImagePath || "",
        authorName: data.name || getFallbackNameFromCurrentUser(options) || "Рыбак",
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
      KLEVB_PROFILE_NAME_KEY,
      KLEVB_PROFILE_PHOTOS_KEY,
      KLEVB_PROFILE_MAX_PHOTOS
    },

    getDefaultProfileData,
    readProfileData,
    saveProfileData,
    readProfilePhotos,
    saveProfilePhotos,
    getProfileFeedItems
  };

  console.log("Klevby profile storage loaded", {
    version: PROFILE_STORAGE_VERSION
  });
})();
