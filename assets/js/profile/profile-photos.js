(function () {
  const PROFILE_PHOTOS_VERSION = "20260512-profile-photos-1";

  const PROFILE_MAX_PHOTOS = 8;
  const PROFILE_PHOTOS_KEY = "klevby_profile_photos";

  function getCore() {
    return window.KlevbyProfileCore || {};
  }

  function readProfilePhotos() {
    const core = getCore();

    if (typeof core.readProfilePhotos === "function") {
      return core.readProfilePhotos();
    }

    try {
      const raw = localStorage.getItem(PROFILE_PHOTOS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[KlevbyProfilePhotos] Не удалось прочитать фото профиля.", error);
      return [];
    }
  }

  function saveProfilePhotos(photos) {
    const core = getCore();

    if (typeof core.saveProfilePhotos === "function") {
      return core.saveProfilePhotos(photos);
    }

    const safePhotos = Array.isArray(photos)
      ? photos.slice(0, PROFILE_MAX_PHOTOS)
      : [];

    try {
      localStorage.setItem(PROFILE_PHOTOS_KEY, JSON.stringify(safePhotos));
    } catch (error) {
      console.warn("[KlevbyProfilePhotos] Не удалось сохранить фото профиля.", error);
      alert("Фото не сохранилось. Память браузера заполнена. Удали старые фото или выбери другое.");
    }

    return safePhotos;
  }

  function makeLocalProfilePhoto(compressedPhoto, file, feedItem = null) {
    const uploadedUrl = feedItem?.imageUrl || feedItem?.image || "";

    return {
      id: `photo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      src: uploadedUrl || compressedPhoto.dataUrl,
      title: "Фото с рыбалки",
      createdAt: new Date().toISOString(),
      originalSizeKb: Math.round((file?.size || 0) / 1024),
      savedSizeKb: compressedPhoto.sizeKb,
      width: compressedPhoto.width,
      height: compressedPhoto.height,
      source: feedItem ? "supabase" : "local",
      feedPostId: feedItem?.id || "",
      feedImagePath: feedItem?.imagePath || "",
      feedImageUrl: uploadedUrl,
      feedSyncError: ""
    };
  }

  function updateLocalPhotoWithFeedItem(photo, feedItem) {
    if (!photo || !feedItem) return photo;

    const uploadedUrl = feedItem.imageUrl || feedItem.image || photo.feedImageUrl || "";

    return {
      ...photo,
      src: uploadedUrl || photo.src,
      source: "supabase",
      feedPostId: feedItem.id || photo.feedPostId || "",
      feedImagePath: feedItem.imagePath || photo.feedImagePath || "",
      feedImageUrl: uploadedUrl || photo.feedImageUrl || "",
      feedSyncError: ""
    };
  }

  function updateProfilePhotoByLocalId(localId, updater) {
    const cleanId = String(localId || "");
    const currentPhotos = readProfilePhotos();

    const updatedPhotos = currentPhotos.map((photo) => {
      if (String(photo.id) !== cleanId) {
        return photo;
      }

      if (typeof updater === "function") {
        return updater(photo);
      }

      return photo;
    });

    saveProfilePhotos(updatedPhotos);
    return updatedPhotos;
  }

  window.KlevbyProfilePhotos = {
    version: PROFILE_PHOTOS_VERSION,
    makeLocalProfilePhoto,
    updateLocalPhotoWithFeedItem,
    updateProfilePhotoByLocalId
  };

  console.log("Klevby profile photos module loaded", {
    version: PROFILE_PHOTOS_VERSION
  });
})();
