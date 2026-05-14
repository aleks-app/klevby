(function () {
  const PROFILE_PHOTOS_VERSION = "20260513-profile-feed-events-split-1";

  const PROFILE_MAX_PHOTOS = 8;
  const PROFILE_PHOTOS_KEY = "klevby_profile_photos";
  const PROFILE_FEED_TABLE = "feed_posts";

  let profileUploadStatusTimer = null;
  let profileRemotePhotos = [];
  let profileRemoteLoadedForUserId = "";
  let profileRemoteLoadInFlight = null;

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

  function getCurrentUserId() {
    const profile = window.KlevbyProfile || {};
    const user =
      (typeof profile.getCurrentProfileUser === "function" ? profile.getCurrentProfileUser() : null) ||
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null;

    return String(user?.id || "").trim();
  }

  function mapFeedPostToProfilePhoto(post) {
    const imageUrl = String(post?.image_url || post?.imageUrl || "").trim();
    const imagePath = String(post?.image_path || post?.imagePath || "").trim();
    if (!imageUrl && !imagePath) return null;

    const id = String(post?.id || "").trim();
    if (!id) return null;

    return {
      id: `feed_${id}`,
      src: imageUrl,
      title: String(post?.caption || "Фото с рыбалки").trim() || "Фото с рыбалки",
      createdAt: post?.created_at || post?.createdAt || "",
      savedSizeKb: Number(post?.image_size_kb || post?.savedSizeKb || 0),
      width: Number(post?.image_width || post?.width || 0),
      height: Number(post?.image_height || post?.height || 0),
      source: "supabase",
      feedPostId: id,
      feedImagePath: imagePath,
      feedImageUrl: imageUrl
    };
  }

  function dedupeProfilePhotos(photos) {
    const seen = new Set();
    return photos.filter((photo) => {
      const dedupeKey = String(photo?.feedPostId || photo?.id || "").trim();
      if (!dedupeKey || seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  }

  async function loadRemoteProfilePhotosByUserId() {
    const userId = getCurrentUserId();
    if (!userId) return [];
    if (profileRemoteLoadedForUserId === userId) return profileRemotePhotos;
    if (profileRemoteLoadInFlight) return profileRemoteLoadInFlight;

    const client =
      window.supabaseClient ||
      window.klevbySupabase ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null);

    async function loadViaFeedApiFallback() {
      if (typeof window.klevbyLoadFeedPostsFromSupabase !== "function") return [];

      try {
        const result = await window.klevbyLoadFeedPostsFromSupabase({
          limit: 120
        });
        const items = Array.isArray(result?.items) ? result.items : [];
        const onlyCurrentUserItems = items.filter((item) => {
          const itemUserId = String(item?.userId || item?.user_id || "").trim();
          return itemUserId && itemUserId === userId;
        });
        const mapped = onlyCurrentUserItems.map(mapFeedPostToProfilePhoto).filter(Boolean);
        return dedupeProfilePhotos(mapped);
      } catch (error) {
        console.warn("[KlevbyProfilePhotos] Feed API fallback не сработал.", error);
        return [];
      }
    }

    if (!client || typeof client.from !== "function") {
      profileRemotePhotos = await loadViaFeedApiFallback();
      profileRemoteLoadedForUserId = userId;
      return profileRemotePhotos;
    }

    profileRemoteLoadInFlight = (async () => {
      try {
        const { data, error } = await client
          .from(PROFILE_FEED_TABLE)
          .select("id,user_id,caption,image_url,image_path,image_width,image_height,image_size_kb,created_at,updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(80);

        if (error) throw error;

        const mapped = Array.isArray(data)
          ? data.map(mapFeedPostToProfilePhoto).filter(Boolean)
          : [];

        profileRemotePhotos = dedupeProfilePhotos(mapped);
        profileRemoteLoadedForUserId = userId;
      } catch (error) {
        const fallbackPhotos = await loadViaFeedApiFallback();
        if (fallbackPhotos.length) {
          profileRemotePhotos = fallbackPhotos;
          profileRemoteLoadedForUserId = userId;
        } else {
          console.warn("[KlevbyProfilePhotos] Не удалось загрузить фото из Supabase, используем localStorage fallback.", error);
        }
      } finally {
        profileRemoteLoadInFlight = null;
      }

      return profileRemotePhotos;
    })();

    return profileRemoteLoadInFlight;
  }

  function getProfilePhotosForDisplay() {
    const localPhotos = readProfilePhotos();
    if (!profileRemotePhotos.length) return localPhotos;
    return dedupeProfilePhotos([...profileRemotePhotos, ...localPhotos]);
  }

  function escapeHtml(value) {
    const core = getCore();

    if (typeof core.escapeHtml === "function") {
      return core.escapeHtml(value);
    }

    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function cleanupOldProfileReportGrid(contentCard) {
    if (!contentCard) return;

    const oldStaticGrids = contentCard.querySelectorAll(".profile-report-grid:not(.profile-photo-gallery)");

    oldStaticGrids.forEach((grid) => {
      const hasOldDemoCards =
        grid.querySelector(".profile-report-img-1") ||
        grid.querySelector(".profile-report-img-2") ||
        grid.querySelector(".profile-report-img-3");

      if (hasOldDemoCards) {
        grid.remove();
      }
    });
  }

  function renderProfilePhotos() {
    const contentCard = document.querySelector(".profile-content-card");
    if (!contentCard) return;

    cleanupOldProfileReportGrid(contentCard);

    const emptyState = contentCard.querySelector(".profile-empty-state");
    const oldGallery = contentCard.querySelector(".profile-photo-gallery");

    if (oldGallery) {
      oldGallery.remove();
    }

    const photos = getProfilePhotosForDisplay();

    if (!photos.length) {
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    const gallery = document.createElement("div");
    gallery.className = "profile-photo-gallery profile-report-grid";

    gallery.innerHTML = photos.map((photo) => {
      const safeId = escapeHtml(photo.id || photo.feedPostId || "");
      const safeTitle = escapeHtml(photo.title || "Фото с рыбалки");
      const safeSrc = escapeHtml(photo.feedImageUrl || photo.src || "");
      const savedSize = Number(photo.savedSizeKb || 0);
      const sizeLabel = savedSize ? `${savedSize} КБ` : "Фото";
      const sourceLabel = photo.feedPostId ? "🌐 в ленте" : "📱 локально";

      return `
        <button class="profile-report-card profile-photo-card" type="button" onclick="openProfilePhotoViewer('${safeId}')" aria-label="Открыть фото">
          <div class="profile-report-img" style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,0.32)), url('${safeSrc}');"></div>
          <p>${safeTitle}</p>
          <div class="profile-report-meta">
            <span>📸 ${escapeHtml(sizeLabel)}</span>
            <span>${escapeHtml(sourceLabel)}</span>
          </div>
        </button>
      `;
    }).join("");

    contentCard.appendChild(gallery);
  }

  async function ensureProfilePhotosLoaded() {
    const beforeCount = getProfilePhotosForDisplay().length;
    await loadRemoteProfilePhotosByUserId();
    const afterCount = getProfilePhotosForDisplay().length;

    if (afterCount !== beforeCount) {
      renderProfilePhotos();
      window.dispatchEvent(new CustomEvent("klevby-profile-photos-updated"));
    }
  }

  function ensureProfilePhotoViewer() {
    let viewer = document.getElementById("profilePhotoViewer");

    if (viewer) return viewer;

    viewer = document.createElement("div");
    viewer.id = "profilePhotoViewer";
    viewer.className = "profile-photo-viewer hidden";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");

    viewer.innerHTML = `
      <div class="profile-photo-viewer-backdrop" onclick="closeProfilePhotoViewer()"></div>
      <div class="profile-photo-viewer-sheet">
        <button class="profile-photo-viewer-close" type="button" onclick="closeProfilePhotoViewer()" aria-label="Закрыть фото">×</button>
        <img id="profilePhotoViewerImage" class="profile-photo-viewer-image" alt="Фото профиля">
        <div class="profile-photo-viewer-info">
          <div>
            <strong id="profilePhotoViewerTitle">Фото с рыбалки</strong>
            <span id="profilePhotoViewerMeta">Фото профиля</span>
          </div>
          <button id="profilePhotoViewerDelete" type="button">Удалить</button>
        </div>
      </div>
    `;

    if (!document.getElementById("profilePhotoViewerStyles")) {
      const style = document.createElement("style");
      style.id = "profilePhotoViewerStyles";
      style.textContent = `
        .profile-photo-viewer.hidden {
          display: none !important;
        }

        .profile-photo-viewer {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
        }

        .profile-photo-viewer-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .profile-photo-viewer-sheet {
          position: relative;
          z-index: 2;
          width: min(100%, 760px);
          max-height: 90vh;
          border: 1px solid rgba(244,178,74,0.18);
          border-radius: 28px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 0%, rgba(244,178,74,0.12), transparent 42%),
            rgba(10, 14, 12, 0.96);
          box-shadow:
            0 28px 90px rgba(0,0,0,0.72),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .profile-photo-viewer-close {
          appearance: none;
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 3;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(244,178,74,0.18);
          border-radius: 16px;
          background: rgba(0,0,0,0.45);
          color: #fff8ea;
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .profile-photo-viewer-close:active,
        .profile-photo-viewer-info button:active,
        .profile-photo-card:active {
          transform: scale(0.97);
        }

        .profile-photo-viewer-image {
          width: 100%;
          max-height: 72vh;
          display: block;
          object-fit: contain;
          background: #050807;
        }

        .profile-photo-viewer-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          color: #fff8ea;
        }

        .profile-photo-viewer-info strong {
          display: block;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.25;
        }

        .profile-photo-viewer-info span {
          display: block;
          margin-top: 4px;
          color: rgba(255,248,234,0.55);
          font-size: 12px;
          font-weight: 700;
        }

        .profile-photo-viewer-info button {
          appearance: none;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid rgba(228,88,88,0.24);
          border-radius: 15px;
          background: rgba(228,88,88,0.92);
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
          transition: 0.18s ease;
        }

        .profile-photo-card {
          width: 100%;
          padding: 0;
          text-align: left;
          cursor: pointer;
          transition: 0.18s ease;
        }
      `;

      document.body.appendChild(style);
    }

    document.body.appendChild(viewer);

    return viewer;
  }

  function requestRemoveProfilePhoto(photoId) {
    const profile = window.KlevbyProfile || {};

    if (typeof profile.removeProfilePhoto === "function") {
      return profile.removeProfilePhoto(photoId);
    }

    if (typeof window.removeProfilePhoto === "function") {
      return window.removeProfilePhoto(photoId);
    }

    console.warn("[KlevbyProfilePhotos] removeProfilePhoto не найден.");
    return null;
  }

  function openProfilePhotoViewer(photoId) {
    const cleanId = String(photoId || "");
    const photo = readProfilePhotos().find((item) => {
      return String(item.id) === cleanId || String(item.feedPostId || "") === cleanId;
    });

    if (!photo) return;

    const viewer = ensureProfilePhotoViewer();
    const image = document.getElementById("profilePhotoViewerImage");
    const title = document.getElementById("profilePhotoViewerTitle");
    const meta = document.getElementById("profilePhotoViewerMeta");
    const deleteButton = document.getElementById("profilePhotoViewerDelete");

    if (image) image.src = photo.feedImageUrl || photo.src || "";
    if (title) title.textContent = photo.title || "Фото с рыбалки";

    if (meta) {
      const sizeText = photo.savedSizeKb ? `${photo.savedSizeKb} КБ` : "сжато для профиля";
      const dimensionText = photo.width && photo.height ? `${photo.width}×${photo.height}` : "";
      const sourceText = photo.feedPostId ? "общая лента Supabase" : "локальное фото";
      meta.textContent = [sourceText, dimensionText, sizeText].filter(Boolean).join(" • ");
    }

    if (deleteButton) {
      deleteButton.onclick = () => requestRemoveProfilePhoto(photo.id || cleanId);
    }

    viewer.classList.remove("hidden");
    document.body.classList.add("post-modal-open");

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function closeProfilePhotoViewer() {
    const viewer = document.getElementById("profilePhotoViewer");
    const image = document.getElementById("profilePhotoViewerImage");

    if (viewer) {
      viewer.classList.add("hidden");
    }

    if (image) {
      image.removeAttribute("src");
    }

    document.body.classList.remove("post-modal-open");
  }

  function dispatchProfileFeedEvent(action, item = null, error = null) {
    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action,
        item,
        error: error ? String(error?.message || error) : ""
      }
    }));
  }

  function refreshProfileFeedSoon(delay = 220) {
    setTimeout(() => {
      try {
        if (typeof window.renderProfileFeed === "function") {
          window.renderProfileFeed();
        }
      } catch (error) {
        console.warn("Klevby profile: лента не обновилась после фото", error);
      }
    }, delay);
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
    setProfilePhotoButtonsDisabled,
    cleanupOldProfileReportGrid,
    renderProfilePhotos,
    getProfilePhotosForDisplay,
    ensureProfilePhotosLoaded,
    ensureProfilePhotoViewer,
    openProfilePhotoViewer,
    closeProfilePhotoViewer,
    dispatchProfileFeedEvent,
    refreshProfileFeedSoon
  };

  console.log("Klevby profile photos module loaded", {
    version: PROFILE_PHOTOS_VERSION
  });
})();
