(function () {
  function logFeedMarker(functionName, reason, detail = {}) {
    const api = window.KlevbyFeedMainDebug;
    if (!api || typeof api.log !== "function") return;
    try {
      api.log("full_refresh_marker", String(reason || ""), {
        source: "profile-photos",
        function: String(functionName || "unknown"),
        action: String(detail.action || "profile_sync_refresh"),
        refreshKind: "full",
        delay: Number(detail.delay || 0),
        postId: detail.postId ? String(detail.postId) : "",
        visible: document.visibilityState !== "hidden"
      });
    } catch (_) {}
  }

  const PROFILE_PHOTOS_VERSION = "20260513-profile-feed-events-split-1";

  const PROFILE_MAX_PHOTOS = 8;
  const PROFILE_PHOTOS_KEY = "klevby_profile_photos";
  const PROFILE_FEED_TABLE = "feed_posts";

  let profileUploadStatusTimer = null;
  let profileRemotePhotos = [];
  let profileRemoteLoadedForUserId = "";
  let profileRemoteLoadInFlight = null;
  let profileRemoteLoadInFlightForUserId = "";
  let profileRemoteLoadGeneration = 0;
  let profilePhotosDirtyForUserId = "";

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

  function getCurrentProfileUserId() {
    const recentLogout =
      typeof window.isAuthLogoutGuardActive === "function"
        ? window.isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);

    if (recentLogout || window.klevbyForceGuestProfileUi) {
      return "";
    }

    const profile = window.KlevbyProfile || {};
    const fromProfileGetters =
      (typeof profile.getCurrentProfileUser === "function" ? profile.getCurrentProfileUser() : null) ||
      (typeof profile.getCurrentUser === "function" ? profile.getCurrentUser() : null) ||
      (typeof profile.getUser === "function" ? profile.getUser() : null) ||
      null;

    const user =
      fromProfileGetters ||
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null;

    return String(user?.id || user?.user_id || user?.userId || "").trim();
  }

  function getPhotoOwnerId(item) {
    if (!item || typeof item !== "object") return "";

    const ownerId =
      item.user_id ||
      item.userId ||
      item.owner_id ||
      item.ownerId ||
      item.author_id ||
      item.authorId ||
      item.profile_id ||
      item.profileId ||
      item.feedUserId ||
      item.feed_user_id ||
      "";

    return String(ownerId || "").trim();
  }

  function getCurrentProfileAuthorNames() {
    const names = [];
    const pushName = (value) => {
      const clean = String(value || "").trim().toLowerCase();
      if (clean && !names.includes(clean)) names.push(clean);
    };

    const user =
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null;

    const metadata = user?.user_metadata || user?.raw_user_meta_data || {};
    pushName(metadata.nickname);
    pushName(metadata.username);
    pushName(metadata.display_name);
    pushName(metadata.name);
    pushName(metadata.full_name);
    pushName(user?.email ? String(user.email).split("@")[0] : "");

    try {
      const profileData = JSON.parse(localStorage.getItem("klevby_profile_settings") || "{}");
      pushName(profileData.name);
    } catch (_) {}

    try {
      pushName(localStorage.getItem("klevby_profile_name"));
      pushName(localStorage.getItem("klevby_author_name"));
      pushName(localStorage.getItem("klevby_chat_username"));
    } catch (_) {}

    return names;
  }

  function getFeedPostAuthorName(item) {
    return String(
      item?.author_name ||
      item?.authorName ||
      item?.name ||
      item?.username ||
      item?.display_name ||
      ""
    ).trim().toLowerCase();
  }

  function getFeedPostType(item) {
    return String(item?.type || item?.postType || item?.post_type || "").trim().toLowerCase();
  }

  function isProfilePhotoFeedItem(item, options = {}) {
    const type = getFeedPostType(item);

    if (!type) {
      return !options.requireProfileType;
    }

    return type === "profile_photo" || type === "profile-photo";
  }

  function getFeedPostImageUrl(item) {
    return String(
      item?.imageUrl ||
      item?.image ||
      item?.image_url ||
      item?.src ||
      item?.feedImageUrl ||
      ""
    ).trim();
  }

  function getFeedPostImagePath(item) {
    return String(
      item?.imagePath ||
      item?.image_path ||
      item?.feedImagePath ||
      ""
    ).trim();
  }

  function hasFeedPostImage(item) {
    return Boolean(getFeedPostImageUrl(item) || getFeedPostImagePath(item));
  }

  function getFeedPostTitle(item) {
    return String(item?.caption || item?.title || "Фото с рыбалки").trim() || "Фото с рыбалки";
  }

  function getFeedPostCreatedAt(item) {
    return item?.createdAt || item?.created_at || "";
  }

  function getFeedPostSavedSizeKb(item) {
    return Number(item?.savedSizeKb || item?.image_size_kb || 0);
  }

  function isOwnProfilePhoto(item, options = {}) {
    const currentUserId = String(options.currentUserId || getCurrentProfileUserId() || "").trim();
    const ownerId = getPhotoOwnerId(item);
    const isLocalLegacy = !ownerId && String(item?.source || "").trim() === "local";

    if (!currentUserId) {
      return false;
    }

    if (ownerId) {
      return String(ownerId) === String(currentUserId);
    }

    if (options.allowAuthorFallback) {
      const authorName = getFeedPostAuthorName(item);
      if (authorName && getCurrentProfileAuthorNames().includes(authorName)) {
        return true;
      }
    }

    return isLocalLegacy;
  }

  function mapFeedPostToProfilePhoto(post, source = "feed_posts", fallbackUserId = "") {
    const imageUrl = getFeedPostImageUrl(post);
    const imagePath = getFeedPostImagePath(post);
    if (!imageUrl && !imagePath) return null;

    const id = String(post?.id || post?.feedPostId || "").trim();
    if (!id) return null;

    const ownerId = getPhotoOwnerId(post) || String(fallbackUserId || "").trim();

    return {
      id: `feed_${id}`,
      src: imageUrl,
      title: getFeedPostTitle(post),
      createdAt: getFeedPostCreatedAt(post),
      savedSizeKb: getFeedPostSavedSizeKb(post),
      width: Number(post?.width || post?.image_width || 0),
      height: Number(post?.height || post?.image_height || 0),
      source,
      userId: ownerId,
      feedUserId: ownerId,
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

  function mapFeedItemsToCurrentUserPhotos(items, source, userId, options = {}) {
    const safeItems = Array.isArray(items) ? items : [];

    return dedupeProfilePhotos(
      safeItems
        .filter((item) => isProfilePhotoFeedItem(item, {
          requireProfileType: Boolean(options.requireProfileType)
        }))
        .filter(hasFeedPostImage)
        .filter((item) => isOwnProfilePhoto(item, {
          currentUserId: userId,
          allowAuthorFallback: true
        }))
        .map((item) => mapFeedPostToProfilePhoto(item, source, userId))
        .filter((item) => isOwnProfilePhoto(item, { currentUserId: userId }))
    );
  }

  function commitRemoteProfilePhotos(photos, userId, loadGeneration) {
    if (loadGeneration !== profileRemoteLoadGeneration || userId !== getCurrentProfileUserId()) {
      return profileRemotePhotos;
    }

    const safePhotos = dedupeProfilePhotos(Array.isArray(photos) ? photos : []);

    if (!safePhotos.length) {
      profileRemoteLoadedForUserId = "";
      return profileRemotePhotos;
    }

    profileRemotePhotos = safePhotos;
    profileRemoteLoadedForUserId = userId;
    if (profilePhotosDirtyForUserId === userId) profilePhotosDirtyForUserId = "";

    return profileRemotePhotos;
  }

  function getLoadedFeedItemsFromMemory() {
    const batches = [];

    try {
      if (typeof window.KlevbyFeedState?.getLastItems === "function") {
        batches.push(window.KlevbyFeedState.getLastItems());
      }
    } catch (_) {}

    if (Array.isArray(window.__klevbyFeedLastItems)) {
      batches.push(window.__klevbyFeedLastItems);
    }

    try {
      if (typeof window.KlevbyFeedState?.getItemsCache === "function") {
        batches.push(Object.values(window.KlevbyFeedState.getItemsCache() || {}));
      }
    } catch (_) {}

    if (window.__klevbyFeedItemsCache && typeof window.__klevbyFeedItemsCache === "object") {
      batches.push(Object.values(window.__klevbyFeedItemsCache));
    }

    const seen = new Set();

    return batches
      .flat()
      .filter(Boolean)
      .filter((item) => {
        const dedupeKey = String(item?.id || item?.feedPostId || "").trim();
        if (!dedupeKey || seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
  }

  async function queryProfilePhotosByOwnerField(client, ownerField, userId) {
    const selectColumns = [
      "id",
      ownerField,
      "type",
      "author_name",
      "caption",
      "image_url",
      "image_path",
      "image_width",
      "image_height",
      "image_size_kb",
      "created_at",
      "updated_at"
    ].join(",");

    const { data, error } = await client
      .from(PROFILE_FEED_TABLE)
      .select(selectColumns)
      .eq(ownerField, userId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) throw error;

    return mapFeedItemsToCurrentUserPhotos(data, `feed_posts_${ownerField}`, userId);
  }

  async function loadRemoteProfilePhotosByUserId(options = {}) {
    const userId = getCurrentProfileUserId();
    const force = Boolean(options.force);
    const loadGeneration = profileRemoteLoadGeneration;
    if (!userId) return [];
    if (!force && profileRemoteLoadedForUserId === userId) return profileRemotePhotos;
    if (profileRemoteLoadInFlight && profileRemoteLoadInFlightForUserId === userId) return profileRemoteLoadInFlight;

    const client =
      window.supabaseClient ||
      window.klevbySupabase ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null);

    async function loadViaFeedApiFallback() {
      const memoryPhotos = mapFeedItemsToCurrentUserPhotos(
        getLoadedFeedItemsFromMemory(),
        "feed_memory",
        userId,
        { requireProfileType: true }
      );

      if (memoryPhotos.length) return memoryPhotos;

      if (typeof window.klevbyLoadFeedPostsFromSupabase !== "function") return [];

      try {
        const result = await window.klevbyLoadFeedPostsFromSupabase({
          limit: 120
        });
        const items = Array.isArray(result?.items) ? result.items : [];
        return mapFeedItemsToCurrentUserPhotos(items, "feed_fallback", userId, { requireProfileType: true });
      } catch (error) {
        console.warn("[KlevbyProfilePhotos] Feed API fallback не сработал.", error);
        return [];
      }
    }

    if (!client || typeof client.from !== "function") {
      const fallbackPhotos = await loadViaFeedApiFallback();

      return commitRemoteProfilePhotos(fallbackPhotos, userId, loadGeneration);
    }

    profileRemoteLoadInFlightForUserId = userId;
    profileRemoteLoadInFlight = (async () => {
      try {
        let mapped = mapFeedItemsToCurrentUserPhotos(
          getLoadedFeedItemsFromMemory(),
          "feed_memory",
          userId,
          { requireProfileType: true }
        );
        let directError = null;

        if (!mapped.length) {
          for (const ownerField of ["user_id", "owner_id"]) {
            try {
              mapped = await queryProfilePhotosByOwnerField(client, ownerField, userId);
              if (mapped.length) break;
            } catch (error) {
              directError = directError || error;
            }
          }
        }

        if (!mapped.length) {
          mapped = await loadViaFeedApiFallback();
        }

        commitRemoteProfilePhotos(mapped, userId, loadGeneration);

        if (!mapped.length && directError) {
          console.warn("[KlevbyProfilePhotos] Не удалось загрузить фото из Supabase, используем localStorage fallback.", directError);
        }
      } catch (error) {
        const fallbackPhotos = await loadViaFeedApiFallback();
        if (fallbackPhotos.length) {
          commitRemoteProfilePhotos(fallbackPhotos, userId, loadGeneration);
        } else {
          console.warn("[KlevbyProfilePhotos] Не удалось загрузить фото из Supabase, используем localStorage fallback.", error);
        }
      } finally {
        if (loadGeneration === profileRemoteLoadGeneration) {
          profileRemoteLoadInFlight = null;
          profileRemoteLoadInFlightForUserId = "";
        }
      }

      return profileRemotePhotos;
    })();

    return profileRemoteLoadInFlight;
  }

  function getProfilePhotosForDisplay() {
    const currentUserId = getCurrentProfileUserId();

    if (!currentUserId) {
      return [];
    }

    const localPhotos = readProfilePhotos();
    const ownRemotePhotos = profileRemotePhotos.filter((item) => isOwnProfilePhoto(item, { currentUserId }));

    const localPhotosWithOwner = localPhotos.filter((item) => {
      const ownerId = getPhotoOwnerId(item);
      if (!ownerId) return false;
      return isOwnProfilePhoto(item, { currentUserId });
    });

    const legacyLocalPhotos = localPhotos.filter((item) => {
      const ownerId = getPhotoOwnerId(item);
      if (ownerId) return false;
      return String(item?.source || "").trim() === "local";
    });

    const mergedPhotos = ownRemotePhotos.length
      ? [...ownRemotePhotos, ...localPhotosWithOwner]
      : [...localPhotosWithOwner, ...legacyLocalPhotos];

    return dedupeProfilePhotos(
      mergedPhotos.filter((item) => {
        if (isOwnProfilePhoto(item, { currentUserId })) return true;
        const ownerId = getPhotoOwnerId(item);
        if (ownerId) {
          console.warn("[KlevbyProfilePhotos] Отфильтрована чужая запись фото профиля.");
        }
        return false;
      })
    );
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
    const ownerId = getPhotoOwnerId(feedItem) || getCurrentProfileUserId();

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
      userId: ownerId,
      feedUserId: ownerId,
      feedPostId: feedItem?.id || "",
      feedImagePath: feedItem?.imagePath || "",
      feedImageUrl: uploadedUrl,
      feedSyncError: ""
    };
  }

  function updateLocalPhotoWithFeedItem(photo, feedItem) {
    if (!photo || !feedItem) return photo;

    const uploadedUrl = feedItem.imageUrl || feedItem.image || photo.feedImageUrl || "";
    const ownerId = getPhotoOwnerId(feedItem) || getPhotoOwnerId(photo) || getCurrentProfileUserId();

    return {
      ...photo,
      src: uploadedUrl || photo.src,
      source: "supabase",
      userId: ownerId,
      feedUserId: ownerId,
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

  async function ensureProfilePhotosLoaded(options = {}) {
    const currentUserId = getCurrentProfileUserId();
    if (!currentUserId) {
      renderProfilePhotos();
      return [];
    }

    const beforeCount = getProfilePhotosForDisplay().length;
    const loadedForUserBefore = profileRemoteLoadedForUserId;
    const dirtyForUserBefore = profilePhotosDirtyForUserId;
    const shouldForceLoad =
      Boolean(options.force) ||
      profilePhotosDirtyForUserId === currentUserId ||
      profileRemoteLoadedForUserId !== currentUserId;

    await loadRemoteProfilePhotosByUserId({ force: shouldForceLoad });

    const afterCount = getProfilePhotosForDisplay().length;
    const loadedForUserAfter = profileRemoteLoadedForUserId;
    const dirtyForUserAfter = profilePhotosDirtyForUserId;

    if (
      afterCount !== beforeCount ||
      loadedForUserBefore !== loadedForUserAfter ||
      dirtyForUserBefore !== dirtyForUserAfter ||
      options.force
    ) {
      renderProfilePhotos();
      window.dispatchEvent(new CustomEvent("klevby-profile-photos-updated"));
    }

    return getProfilePhotosForDisplay();
  }


  function resetProfilePhotosAfterLogout() {
    profileRemoteLoadGeneration += 1;
    profileRemotePhotos = [];
    profileRemoteLoadedForUserId = "";
    profileRemoteLoadInFlight = null;
    profileRemoteLoadInFlightForUserId = "";
    profilePhotosDirtyForUserId = "";
    saveProfilePhotos([]);

    const viewer = document.getElementById("profilePhotoViewer");
    if (viewer) {
      viewer.classList.add("hidden");
    }

    renderProfilePhotos();
  }

  function reloadProfilePhotosAfterLogin() {
    const userId = getCurrentProfileUserId();

    if (!userId) {
      renderProfilePhotos();
      return Promise.resolve([]);
    }

    profilePhotosDirtyForUserId = userId;

    if (profileRemoteLoadInFlight && profileRemoteLoadInFlightForUserId !== userId) {
      profileRemoteLoadGeneration += 1;
      profileRemoteLoadInFlight = null;
      profileRemoteLoadInFlightForUserId = "";
    }

    return ensureProfilePhotosLoaded({ force: true });
  }

  function markProfilePhotosDirtyAfterLogin() {
    const userId = getCurrentProfileUserId();

    if (!userId) {
      return Promise.resolve([]);
    }

    profilePhotosDirtyForUserId = userId;
    return reloadProfilePhotosAfterLogin();
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
    const displayPhotos = getProfilePhotosForDisplay();
    const photoFromDisplay = displayPhotos.find((item) => {
      return String(item.id) === cleanId || String(item.feedPostId || "") === cleanId;
    });
    const photo = photoFromDisplay || readProfilePhotos().find((item) => {
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
          logFeedMarker("renderProfileFeed", "profile_sync_render", { action: "profile_sync_refresh" });
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
    resetProfilePhotosAfterLogout,
    reloadProfilePhotosAfterLogin,
    markProfilePhotosDirtyAfterLogin,
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
