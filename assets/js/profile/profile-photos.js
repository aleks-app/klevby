(function () {
  const PROFILE_PHOTOS_VERSION = "20260513-profile-upload-status-split-1";

  const PROFILE_MAX_PHOTOS = 8;
  const PROFILE_PHOTOS_KEY = "klevby_profile_photos";

  let profileUploadStatusTimer = null;

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

  function ensureProfileUploadStatus() {
    let node = document.getElementById("profileUploadStatus");

    if (node) return node;

    if (!document.getElementById("profileUploadStatusStyles")) {
      const style = document.createElement("style");
      style.id = "profileUploadStatusStyles";
      style.textContent = `
        .profile-upload-status.hidden {
          display: none !important;
        }

        .profile-upload-status {
          position: fixed;
          left: max(12px, env(safe-area-inset-left));
          right: max(12px, env(safe-area-inset-right));
          bottom: calc(92px + env(safe-area-inset-bottom));
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .profile-upload-status-inner {
          max-width: min(420px, 100%);
          min-height: 48px;
          padding: 12px 16px;
          border-radius: 18px;
          border: 1px solid rgba(244,178,74,0.26);
          background:
            radial-gradient(circle at 20% 0%, rgba(244,178,74,0.18), transparent 38%),
            rgba(8, 13, 11, 0.94);
          color: #fff8ea;
          box-shadow:
            0 18px 50px rgba(0,0,0,0.46),
            inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          font-size: 13px;
          font-weight: 900;
          line-height: 1.32;
          text-align: center;
        }

        .profile-upload-status.loading .profile-upload-status-inner::before {
          content: "⏳ ";
        }

        .profile-upload-status.success .profile-upload-status-inner {
          border-color: rgba(87,230,178,0.36);
        }

        .profile-upload-status.warning .profile-upload-status-inner {
          border-color: rgba(244,178,74,0.42);
        }

        .profile-upload-status.error .profile-upload-status-inner {
          border-color: rgba(228,88,88,0.38);
        }

        .profile-photo-uploading button[onclick*="openProfilePhotoAction"],
        .profile-photo-uploading .profile-photo-add-btn {
          opacity: 0.68;
          cursor: wait !important;
        }
      `;

      document.head.appendChild(style);
    }

    node = document.createElement("div");
    node.id = "profileUploadStatus";
    node.className = "profile-upload-status hidden";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.innerHTML = `<div class="profile-upload-status-inner">Загрузка…</div>`;

    document.body.appendChild(node);

    return node;
  }

  function showProfileUploadStatus(message, state = "loading") {
    clearTimeout(profileUploadStatusTimer);

    const node = ensureProfileUploadStatus();
    const inner = node.querySelector(".profile-upload-status-inner");

    node.className = `profile-upload-status ${state || "loading"}`;

    if (inner) {
      inner.textContent = String(message || "Загрузка…");
    }
  }

  function hideProfileUploadStatus(delay = 0) {
    clearTimeout(profileUploadStatusTimer);

    const hide = () => {
      const node = document.getElementById("profileUploadStatus");
      if (node) node.classList.add("hidden");
    };

    if (delay > 0) {
      profileUploadStatusTimer = setTimeout(hide, delay);
      return;
    }

    hide();
  }

  function setProfilePhotoButtonsDisabled(isDisabled) {
    const input = document.getElementById("profilePhotoUploadInput");

    if (input) {
      input.disabled = Boolean(isDisabled);
    }

    const buttons = document.querySelectorAll('button[onclick*="openProfilePhotoAction"]');

    buttons.forEach((button) => {
      button.disabled = Boolean(isDisabled);
      button.setAttribute("aria-busy", isDisabled ? "true" : "false");
    });
  }

  function setProfileUploadBusy(isBusy, message = "", state = "loading") {
    if (document.body) {
      document.body.classList.toggle("profile-photo-uploading", Boolean(isBusy));
    }

    setProfilePhotoButtonsDisabled(Boolean(isBusy));

    if (message) {
      showProfileUploadStatus(message, state);
    }
  }

  function finishProfileUploadStatus(message = "", state = "success", delay = 1200) {
    if (document.body) {
      document.body.classList.remove("profile-photo-uploading");
    }

    setProfilePhotoButtonsDisabled(false);

    if (message) {
      showProfileUploadStatus(message, state);
      hideProfileUploadStatus(delay);
    } else {
      hideProfileUploadStatus(delay);
    }
  }

  window.KlevbyProfilePhotos = {
    version: PROFILE_PHOTOS_VERSION,
    makeLocalProfilePhoto,
    updateLocalPhotoWithFeedItem,
    updateProfilePhotoByLocalId,
    ensureProfileUploadStatus,
    showProfileUploadStatus,
    hideProfileUploadStatus,
    setProfileUploadBusy,
    finishProfileUploadStatus,
    setProfilePhotoButtonsDisabled
  };

  console.log("Klevby profile photos module loaded", {
    version: PROFILE_PHOTOS_VERSION
  });
})();
