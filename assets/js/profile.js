const KLEVB_PROFILE_STORAGE_KEY = "klevby_profile_settings";
const KLEVB_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
const KLEVB_PROFILE_NAME_KEY = "klevby_profile_name";
const KLEVB_PROFILE_RETURN_KEY = "klevby_profile_return_mode";
const KLEVB_PROFILE_PHOTOS_KEY = "klevby_profile_photos";

const KLEVB_PROFILE_MAX_PHOTOS = 8;
const KLEVB_PROFILE_PHOTO_MAX_SIDE = 1080;
const KLEVB_PROFILE_PHOTO_QUALITY = 0.68;
const KLEVB_PROFILE_AVATAR_MAX_SIDE = 520;
const KLEVB_PROFILE_AVATAR_QUALITY = 0.78;
const KLEVB_PROFILE_AVATAR_BUCKET = "profile-avatars";
const KLEVB_PROFILE_REST_TIMEOUT_MS = 12000;

let klevbyProfileFeedSyncInProgress = false;
let klevbyProfileFeedSyncTimer = null;
let klevbyProfilePhotoUploadInProgress = false;

function getProfileCore() {
  return window.KlevbyProfileCore || {};
}

function requireProfileCoreMethod(name) {
  const core = getProfileCore();

  if (core && typeof core[name] === "function") {
    return core[name].bind(core);
  }

  const error = new Error(`KlevbyProfileCore.${name} is not available`);
  console.error("[KlevbyProfile] profile-core.js не готов или функция не найдена:", name, error);
  throw error;
}

function getProfileUi() {
  return window.KlevbyProfileUi || {};
}

function requireProfileUiMethod(name) {
  const ui = getProfileUi();

  if (ui && typeof ui[name] === "function") {
    return ui[name].bind(ui);
  }

  const error = new Error(`KlevbyProfileUi.${name} is not available`);
  console.error("[KlevbyProfile] profile-ui.js не готов или функция не найдена:", name, error);
  throw error;
}

function getProfileAvatar() {
  return window.KlevbyProfileAvatar || {};
}

function requireProfileAvatarMethod(name) {
  const avatar = getProfileAvatar();

  if (avatar && typeof avatar[name] === "function") {
    return avatar[name].bind(avatar);
  }

  const error = new Error(`KlevbyProfileAvatar.${name} is not available`);
  console.error("[KlevbyProfile] profile-avatar.js не готов или функция не найдена:", name, error);
  throw error;
}

function getProfileSettings() {
  return window.KlevbyProfileSettings || {};
}

function requireProfileSettingsMethod(name) {
  const settings = getProfileSettings();

  if (settings && typeof settings[name] === "function") {
    return settings[name].bind(settings);
  }

  const error = new Error(`KlevbyProfileSettings.${name} is not available`);
  console.error("[KlevbyProfile] profile-settings.js не готов или функция не найдена:", name, error);
  throw error;
}

function getProfilePhotos() {
  return window.KlevbyProfilePhotos || {};
}

function requireProfilePhotosMethod(name) {
  const photos = getProfilePhotos();

  if (photos && typeof photos[name] === "function") {
    return photos[name].bind(photos);
  }

  const error = new Error(`KlevbyProfilePhotos.${name} is not available`);
  console.error("[KlevbyProfile] profile-photos.js не готов или функция не найдена:", name, error);
  throw error;
}

function getDefaultProfileData() {
  return requireProfileCoreMethod("getDefaultProfileData")();
}

function readProfileData() {
  return requireProfileCoreMethod("readProfileData")();
}

function saveProfileData(data) {
  return requireProfileCoreMethod("saveProfileData")(data);
}

function readProfilePhotos() {
  return requireProfileCoreMethod("readProfilePhotos")();
}

function saveProfilePhotos(photos) {
  return requireProfileCoreMethod("saveProfilePhotos")(photos);
}

function getProfileFeedItems() {
  return requireProfileCoreMethod("getProfileFeedItems")();
}

function getCurrentProfileUser() {
  return requireProfileCoreMethod("getCurrentProfileUser")();
}

function getProfileNameFromCurrentUser() {
  return requireProfileCoreMethod("getProfileNameFromCurrentUser")();
}

function getProfileNameFromInputs() {
  return requireProfileCoreMethod("getProfileNameFromInputs")();
}

function formatTelegramLabel(value) {
  return requireProfileCoreMethod("formatTelegramLabel")(value);
}

function triggerProfileAvatarInput() {
  return requireProfileCoreMethod("triggerProfileAvatarInput")();
}

function getProfileSupabaseClient() {
  return requireProfileCoreMethod("getProfileSupabaseClient")();
}

function getProfileSupabaseUrl() {
  return requireProfileCoreMethod("getProfileSupabaseUrl")();
}

function getProfileSupabaseAnonKey() {
  return requireProfileCoreMethod("getProfileSupabaseAnonKey")();
}

function getProfileStoredAuthData() {
  return requireProfileCoreMethod("getProfileStoredAuthData")();
}

function parseProfileAuthStorageValue(raw) {
  return requireProfileCoreMethod("parseProfileAuthStorageValue")(raw);
}

function getProfileAccessTokenFromStoredAuth() {
  return requireProfileCoreMethod("getProfileAccessTokenFromStoredAuth")();
}

function getProfileUserFromStoredAuth() {
  return requireProfileCoreMethod("getProfileUserFromStoredAuth")();
}

function resolveCurrentProfileUser(supabase = null) {
  return requireProfileCoreMethod("resolveCurrentProfileUser")(supabase);
}

function dataUrlToBlobSafe(dataUrl) {
  return requireProfileCoreMethod("dataUrlToBlobSafe")(dataUrl);
}

function encodeStoragePath(path) {
  return requireProfileCoreMethod("encodeStoragePath")(path);
}

function promiseWithTimeout(promise, timeoutMs, message = "Timeout") {
  return requireProfileCoreMethod("promiseWithTimeout")(promise, timeoutMs, message);
}

function fetchWithTimeout(url, options = {}, timeoutMs = KLEVB_PROFILE_REST_TIMEOUT_MS) {
  return requireProfileCoreMethod("fetchWithTimeout")(url, options, timeoutMs);
}

function getProfileRestAuthContext() {
  return requireProfileCoreMethod("getProfileRestAuthContext")();
}

function makeProfilePublicAvatarUrl(supabaseUrl, avatarPath) {
  return requireProfileCoreMethod("makeProfilePublicAvatarUrl")(supabaseUrl, avatarPath);
}

function uploadProfileAvatarByRest(avatarBlob, avatarPath) {
  return requireProfileCoreMethod("uploadProfileAvatarByRest")(avatarBlob, avatarPath);
}

function updateProfileAvatarRowByRest(userId, avatarUrl, avatarPath) {
  return requireProfileCoreMethod("updateProfileAvatarRowByRest")(userId, avatarUrl, avatarPath);
}

function readProfileAvatarRowByRest(userId) {
  return requireProfileCoreMethod("readProfileAvatarRowByRest")(userId);
}

function uploadProfileAvatarToSupabase(dataUrl) {
  return requireProfileCoreMethod("uploadProfileAvatarToSupabase")(dataUrl);
}

function waitForFrame() {
  return requireProfileCoreMethod("waitForFrame")();
}

function compressImageFile(file, options = {}) {
  return requireProfileCoreMethod("compressImageFile")(file, options);
}

function blobToDataUrl(blob) {
  return requireProfileCoreMethod("blobToDataUrl")(blob);
}

function estimateDataUrlSizeKb(dataUrl) {
  return requireProfileCoreMethod("estimateDataUrlSizeKb")(dataUrl);
}

function escapeHtml(value) {
  return requireProfileCoreMethod("escapeHtml")(value);
}

function handleLocalAvatarUpload(event) {
  return requireProfileAvatarMethod("handleLocalAvatarUpload")(event);
}

function showProfileAvatarSavedMessage() {
  return requireProfileAvatarMethod("showProfileAvatarSavedMessage")();
}

function restoreLocalProfileAvatar() {
  return requireProfileAvatarMethod("restoreLocalProfileAvatar")();
}

function loadProfileAvatarFromSupabase() {
  return requireProfileAvatarMethod("loadProfileAvatarFromSupabase")();
}

function setProfileAvatar(src) {
  return requireProfileAvatarMethod("setProfileAvatar")(src);
}

function resetMobileProfileAvatar() {
  return requireProfileAvatarMethod("resetMobileProfileAvatar")();
}

function openProfileSettingsModal() {
  return requireProfileSettingsMethod("openProfileSettingsModal")();
}

function closeProfileSettingsModal(updateButton = true) {
  return requireProfileSettingsMethod("closeProfileSettingsModal")(updateButton);
}

function handleProfileSettingsBackdrop(event) {
  return requireProfileSettingsMethod("handleProfileSettingsBackdrop")(event);
}

function fillProfileSettingsForm() {
  return requireProfileSettingsMethod("fillProfileSettingsForm")();
}

function saveProfileSettings() {
  return requireProfileSettingsMethod("saveProfileSettings")();
}

function syncProfileDataToMainInputs(data) {
  return requireProfileSettingsMethod("syncProfileDataToMainInputs")(data);
}

function pulseProfileSaved() {
  return requireProfileSettingsMethod("pulseProfileSaved")();
}

function logoutFromProfileSettings() {
  return requireProfileSettingsMethod("logoutFromProfileSettings")();
}

function bindProfileInputSync() {
  return requireProfileSettingsMethod("bindProfileInputSync")();
}

function setProfileScreenChrome(isActive) {
  return requireProfileUiMethod("setProfileScreenChrome")(isActive);
}

function closeMobileMenuSafe() {
  return requireProfileUiMethod("closeMobileMenuSafe")();
}

function hideProfileTopGearButton() {
  return requireProfileUiMethod("hideProfileTopGearButton")();
}

function saveMainTabbarSnapshot() {
  return requireProfileUiMethod("saveMainTabbarSnapshot")();
}

function restoreMainTabbar() {
  return requireProfileUiMethod("restoreMainTabbar")();
}

function applyProfileTabbar() {
  const result = requireProfileUiMethod("applyProfileTabbar")();

  setProfilePhotoButtonsDisabled(klevbyProfilePhotoUploadInProgress);

  return result;
}

function setProfileTabButton(button, icon, text, action, isCreate = false) {
  return requireProfileUiMethod("setProfileTabButton")(button, icon, text, action, isCreate);
}

function setProfileTabActive(index) {
  return requireProfileUiMethod("setProfileTabActive")(index);
}

function hideProfileSectionOnly() {
  return requireProfileUiMethod("hideProfileSectionOnly")();
}

function setProfileReturnMode(isActive) {
  return requireProfileUiMethod("setProfileReturnMode")(isActive);
}

function isProfileReturnMode() {
  return requireProfileUiMethod("isProfileReturnMode")();
}

function isProfileSectionVisible() {
  return requireProfileUiMethod("isProfileSectionVisible")();
}

function isProfileSettingsModalVisible() {
  return requireProfileUiMethod("isProfileSettingsModalVisible")();
}

function shouldShowProfileBackButton() {
  return requireProfileUiMethod("shouldShowProfileBackButton")();
}

function updateProfileHomeFloatButton() {
  return requireProfileUiMethod("updateProfileHomeFloatButton")();
}

function patchHomeFloatButton() {
  return requireProfileUiMethod("patchHomeFloatButton")();
}

function showHomeSectionFallback() {
  return requireProfileUiMethod("showHomeSectionFallback")();
}

function openKlevbyProfile() {
  setProfileReturnMode(false);
  setProfileScreenChrome(true);

  const sectionIds = [
    "homeSection",
    "tripsSection",
    "createSection",
    "marketSection",
    "pondsSection",
    "mapSection",
    "authSection",
    "profileSection"
  ];

  sectionIds.forEach((id) => {
    const section = document.getElementById(id);
    if (!section) return;

    if (id === "profileSection") {
      section.classList.remove("hidden");
    } else {
      section.classList.add("hidden");
    }
  });

  closeMobileMenuSafe();
  closeProfileSettingsModal(false);
  hideProfileTopGearButton();
  applyProfileTabbar();
  patchProfileCardButtonsSafe();
  setProfileTabActive(0);
  updateKlevbyProfileView();
  setProfilePhotoButtonsDisabled(klevbyProfilePhotoUploadInProgress);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(updateProfileHomeFloatButton, 150);
}

function patchProfileCardButtonsSafe() {
  try {
    if (typeof window.patchProfileCardButtons === "function") {
      window.patchProfileCardButtons();
    }
  } catch (error) {
    console.warn("Klevby profile: кнопки профиля не обновились", error);
  }
}

function updateKlevbyProfileView() {
  const data = readProfileData();

  const name =
    data.name ||
    getProfileNameFromInputs() ||
    getProfileNameFromCurrentUser() ||
    "Рыбак";

  const city = data.city || "";
  const telegram = data.telegram || "";
  const about = data.about || "";

  const nameNode = document.getElementById("profileNameText");
  const statusNode = document.getElementById("profileStatusText");
  const fallbackNode = document.getElementById("profileAvatarFallback");
  const reportsNode = document.getElementById("profileReportsCount");
  const tripsNode = document.getElementById("profileTripsCount");
  const photosNode = document.getElementById("profilePhotosCount");
  const friendsNode = document.getElementById("profileFriendsCount");

  if (nameNode) {
    nameNode.textContent = name;
  }

  if (statusNode) {
    const statusParts = [];

    if (city) statusParts.push(`📍 ${city}`);
    if (telegram) statusParts.push(formatTelegramLabel(telegram));

    if (statusParts.length) {
      statusNode.textContent = statusParts.join(" • ");
    } else if (about) {
      statusNode.textContent = about;
    } else {
      statusNode.textContent = "🎣 Рыбак Klevby";
    }
  }

  if (fallbackNode) {
    fallbackNode.textContent = name.trim().charAt(0).toUpperCase() || "Р";
  }

  const userPostsCount = countUserPosts(name);
  const photosCount = readProfilePhotos().length;

  if (reportsNode) reportsNode.textContent = String(userPostsCount);
  if (tripsNode) tripsNode.textContent = String(userPostsCount);
  if (photosNode) photosNode.textContent = String(photosCount);
  if (friendsNode) friendsNode.textContent = "0";

  restoreLocalProfileAvatar();
  renderProfilePhotos();
}

function countUserPosts(profileName) {
  const core = getProfileCore();

  if (typeof core.countUserPosts === "function") {
    return core.countUserPosts(profileName);
  }

  try {
    const postsArray = Array.isArray(window.posts) ? window.posts : [];
    const currentUser = getCurrentProfileUser();
    const ownerName = String(profileName || "").trim().toLowerCase();

    const userPosts = postsArray.filter((post) => {
      const postName = String(post?.name || "").trim().toLowerCase();
      const postOwnerId = post?.owner_id || post?.user_id || "";
      const currentUserId = currentUser?.id || "";

      if (currentUserId && postOwnerId && String(postOwnerId) === String(currentUserId)) {
        return true;
      }

      return postName && ownerName && postName === ownerName;
    });

    return userPosts.length || 0;
  } catch (error) {
    return 0;
  }
}

function openProfilePhotoAction() {
  if (klevbyProfilePhotoUploadInProgress) {
    showProfileUploadStatus("Фото уже загружается. Подожди пару секунд…", "loading");
    return;
  }

  setProfileScreenChrome(true);
  applyProfileTabbar();
  setProfileTabActive(0);
  updateProfileHomeFloatButton();
  triggerProfilePhotoInput();
}

function ensureProfilePhotoInput() {
  let input = document.getElementById("profilePhotoUploadInput");

  if (input) return input;

  input = document.createElement("input");
  input.id = "profilePhotoUploadInput";
  input.type = "file";
  input.accept = "image/*";
  input.className = "profile-avatar-input";
  input.addEventListener("change", handleProfilePhotoUpload);

  document.body.appendChild(input);

  return input;
}

function triggerProfilePhotoInput() {
  if (klevbyProfilePhotoUploadInProgress) {
    showProfileUploadStatus("Предыдущее фото ещё загружается…", "loading");
    return;
  }

  const input = ensureProfilePhotoInput();

  if (input) {
    input.value = "";
    input.click();
  }
}

async function uploadProfilePhotoToSupabaseFeed(compressedPhoto, file) {
  if (typeof window.klevbyCreateFeedPhotoPost !== "function") {
    throw new Error("Модуль Supabase-ленты ещё не подключён.");
  }

  return window.klevbyCreateFeedPhotoPost({
    dataUrl: compressedPhoto.dataUrl,
    title: "Фото с рыбалки",
    caption: "Фото с рыбалки",
    width: compressedPhoto.width,
    height: compressedPhoto.height,
    sizeKb: compressedPhoto.sizeKb,
    originalSizeKb: Math.round((file?.size || 0) / 1024)
  });
}

function makeLocalProfilePhoto(compressedPhoto, file, feedItem = null) {
  return requireProfilePhotosMethod("makeLocalProfilePhoto")(compressedPhoto, file, feedItem);
}

function updateLocalPhotoWithFeedItem(photo, feedItem) {
  return requireProfilePhotosMethod("updateLocalPhotoWithFeedItem")(photo, feedItem);
}

function updateProfilePhotoByLocalId(localId, updater) {
  return requireProfilePhotosMethod("updateProfilePhotoByLocalId")(localId, updater);
}

function scheduleProfileFeedSync(delay = 1200) {
  clearTimeout(klevbyProfileFeedSyncTimer);

  klevbyProfileFeedSyncTimer = setTimeout(() => {
    syncLocalProfilePhotosToSupabaseFeed(false).catch((error) => {
      console.warn("Klevby profile: автосинхронизация фото не сработала", error);
    });
  }, delay);
}

async function syncLocalProfilePhotosToSupabaseFeed(force = false) {
  if (klevbyProfileFeedSyncInProgress) return false;

  if (typeof window.klevbyCreateFeedPhotoPost !== "function") {
    if (force) {
      console.warn("Klevby profile: feed-supabase.js ещё не готов для синхронизации фото");
    }

    return false;
  }

  const currentUser = getCurrentProfileUser();

  if (!currentUser || !currentUser.id) {
    if (force) {
      console.warn("Klevby profile: нет пользователя для загрузки локальных фото в Supabase");
    }

    return false;
  }

  const photos = readProfilePhotos();

  const pendingPhotos = photos.filter((photo) => {
    return (
      photo &&
      photo.src &&
      !photo.feedPostId &&
      !photo.feedImageUrl
    );
  });

  if (!pendingPhotos.length) return false;

  klevbyProfileFeedSyncInProgress = true;

  let changed = false;

  try {
    for (const pendingPhoto of pendingPhotos) {
      try {
        const feedItem = await window.klevbyCreateFeedPhotoPost({
          dataUrl: pendingPhoto.src,
          title: pendingPhoto.title || "Фото с рыбалки",
          caption: pendingPhoto.title || "Фото с рыбалки",
          width: pendingPhoto.width || 0,
          height: pendingPhoto.height || 0,
          sizeKb: pendingPhoto.savedSizeKb || 0,
          originalSizeKb: pendingPhoto.originalSizeKb || 0
        });

        updateProfilePhotoByLocalId(pendingPhoto.id, (photo) => {
          return updateLocalPhotoWithFeedItem(photo, feedItem);
        });

        changed = true;

        dispatchProfileFeedEvent("local_profile_photo_synced_to_supabase", feedItem);
      } catch (error) {
        console.warn("Klevby profile: локальное фото не удалось отправить в Supabase", error);

        updateProfilePhotoByLocalId(pendingPhoto.id, (photo) => {
          return {
            ...photo,
            source: "local",
            feedSyncError: String(error?.message || error || "Ошибка Supabase")
          };
        });
      }
    }
  } finally {
    klevbyProfileFeedSyncInProgress = false;
  }

  if (changed) {
    updateKlevbyProfileView();
    refreshProfileFeedSoon(250);
  }

  return changed;
}

async function handleProfilePhotoUpload(event) {
  const file = event?.target?.files?.[0];

  if (!file) return;

  if (klevbyProfilePhotoUploadInProgress) {
    showProfileUploadStatus("Фото уже загружается. Подожди завершения…", "loading");

    if (event?.target) {
      event.target.value = "";
    }

    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Выбери фото для профиля.");
    return;
  }

  let localPhoto = null;
  let finished = false;

  setProfileUploadBusy(true, "Сжимаю фото…", "loading");

  try {
    await waitForFrame();

    const compressedPhoto = await compressImageFile(file, {
      maxSide: KLEVB_PROFILE_PHOTO_MAX_SIDE,
      quality: KLEVB_PROFILE_PHOTO_QUALITY,
      outputType: "image/jpeg"
    });

    setProfileUploadBusy(true, "Показываю фото в профиле…", "loading");

    const photos = readProfilePhotos();

    localPhoto = makeLocalProfilePhoto(compressedPhoto, file, null);
    photos.unshift(localPhoto);

    saveProfilePhotos(photos);
    updateKlevbyProfileView();
    openKlevbyProfile();
    setProfilePhotoButtonsDisabled(true);
    refreshProfileFeedSoon(120);

    dispatchProfileFeedEvent("profile_photo_saved_locally", localPhoto);

    setProfileUploadBusy(true, "Отправляю фото в общую ленту…", "loading");

    let feedItem = null;

    try {
      feedItem = await uploadProfilePhotoToSupabaseFeed(compressedPhoto, file);

      updateProfilePhotoByLocalId(localPhoto.id, (photo) => {
        return updateLocalPhotoWithFeedItem(photo, feedItem);
      });

      updateKlevbyProfileView();
      refreshProfileFeedSoon(180);

      dispatchProfileFeedEvent("profile_photo_uploaded_to_supabase", feedItem);

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }

      finishProfileUploadStatus("Фото добавлено в ленту ✅", "success", 1300);
      finished = true;
    } catch (supabaseError) {
      console.warn("Klevby profile: фото сохранено локально, Supabase не принял загрузку", supabaseError);

      updateProfilePhotoByLocalId(localPhoto.id, (photo) => {
        return {
          ...photo,
          source: "local",
          feedSyncError: String(supabaseError?.message || supabaseError || "Ошибка Supabase")
        };
      });

      updateKlevbyProfileView();
      refreshProfileFeedSoon(250);

      dispatchProfileFeedEvent("profile_photo_saved_locally", localPhoto, supabaseError);

      scheduleProfileFeedSync(2200);

      finishProfileUploadStatus("Фото в профиле. Синхронизация ленты повторится…", "warning", 2600);
      finished = true;
    }
  } catch (error) {
    console.warn("Klevby profile: фото не обработалось", error);
    finishProfileUploadStatus("Не получилось обработать фото", "error", 2200);
    alert("Не получилось обработать фото. Попробуй другое изображение.");
    finished = true;
  } finally {
    if (!finished) {
      finishProfileUploadStatus("", "success", 300);
    }

    if (event?.target) {
      event.target.value = "";
    }
  }
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

function ensureProfileUploadStatus() {
  return requireProfilePhotosMethod("ensureProfileUploadStatus")();
}

function showProfileUploadStatus(message, state = "loading") {
  return requireProfilePhotosMethod("showProfileUploadStatus")(message, state);
}

function hideProfileUploadStatus(delay = 0) {
  return requireProfilePhotosMethod("hideProfileUploadStatus")(delay);
}

function setProfileUploadBusy(isBusy, message = "", state = "loading") {
  klevbyProfilePhotoUploadInProgress = Boolean(isBusy);

  return requireProfilePhotosMethod("setProfileUploadBusy")(isBusy, message, state);
}

function finishProfileUploadStatus(message = "", state = "success", delay = 1200) {
  klevbyProfilePhotoUploadInProgress = false;

  return requireProfilePhotosMethod("finishProfileUploadStatus")(message, state, delay);
}

function setProfilePhotoButtonsDisabled(isDisabled) {
  return requireProfilePhotosMethod("setProfilePhotoButtonsDisabled")(isDisabled);
}

async function removeProfilePhoto(photoId) {
  const cleanId = String(photoId || "");
  const photos = readProfilePhotos();
  const photo = photos.find((item) => String(item.id) === cleanId || String(item.feedPostId) === cleanId);

  if (!photo) return;

  if (photo.feedPostId && typeof window.klevbyDeleteFeedPostFromSupabase === "function") {
    try {
      await window.klevbyDeleteFeedPostFromSupabase(photo.feedPostId, photo.feedImagePath || "");
    } catch (error) {
      console.warn("Klevby profile: Supabase-фото не удалилось", error);
      alert(error?.message || "Не получилось удалить фото из общей ленты.");
      return;
    }
  }

  const updatedPhotos = photos.filter((item) => {
    return String(item.id) !== cleanId && String(item.feedPostId || "") !== cleanId;
  });

  saveProfilePhotos(updatedPhotos);
  updateKlevbyProfileView();
  closeProfilePhotoViewer();
  refreshProfileFeedSoon(250);

  window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
    detail: {
      action: "profile_photo_deleted",
      photoId: cleanId
    }
  }));
}

function cleanupOldProfileReportGrid(contentCard) {
  return requireProfilePhotosMethod("cleanupOldProfileReportGrid")(contentCard);
}

function renderProfilePhotos() {
  return requireProfilePhotosMethod("renderProfilePhotos")();
}

function ensureProfilePhotoViewer() {
  return requireProfilePhotosMethod("ensureProfilePhotoViewer")();
}

function openProfilePhotoViewer(photoId) {
  return requireProfilePhotosMethod("openProfilePhotoViewer")(photoId);
}

function closeProfilePhotoViewer() {
  return requireProfilePhotosMethod("closeProfilePhotoViewer")();
}

function openProfileTripsView() {
  setProfileReturnMode(true);
  setProfileScreenChrome(true);
  applyProfileTabbar();
  setProfileTabActive(1);

  hideProfileSectionOnly();

  try {
    if (typeof setMode === "function") {
      setMode("mine");
    }
  } catch (error) {
    console.warn("Klevby profile: не удалось открыть мои выезды", error);
  }

  try {
    if (typeof showSection === "function") {
      window.__klevbyProfileInternalNavigation = true;
      showSection("trips");
      window.__klevbyProfileInternalNavigation = false;
    }
  } catch (error) {
    window.__klevbyProfileInternalNavigation = false;
  }

  setTimeout(() => {
    setProfileScreenChrome(true);
    applyProfileTabbar();
    setProfileTabActive(1);
    updateProfileHomeFloatButton();

    const posts = document.getElementById("postsSection");
    if (posts) {
      posts.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, 100);
}

function openProfileCreateView() {
  setProfileReturnMode(true);
  setProfileScreenChrome(true);
  applyProfileTabbar();
  setProfileTabActive(2);

  hideProfileSectionOnly();

  try {
    if (typeof showSection === "function") {
      window.__klevbyProfileInternalNavigation = true;
      showSection("create");
      window.__klevbyProfileInternalNavigation = false;
    }
  } catch (error) {
    window.__klevbyProfileInternalNavigation = false;
  }

  setTimeout(() => {
    setProfileScreenChrome(true);
    applyProfileTabbar();
    setProfileTabActive(2);
    updateProfileHomeFloatButton();

    const panel = document.getElementById("createPanel");
    if (panel) {
      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, 100);
}

window.KlevbyProfile = {
  openKlevbyProfile,
  openProfileSettingsModal,
  closeProfileSettingsModal,
  saveProfileSettings,
  updateKlevbyProfileView,
  handleLocalAvatarUpload,
  openProfilePhotoAction,
  handleProfilePhotoUpload,
  openProfilePhotoViewer,
  closeProfilePhotoViewer,
  removeProfilePhoto,
  openProfileTripsView,
  openProfileCreateView,
  getProfileFeedItems,
  readProfileData,
  saveProfileData,
  readProfilePhotos,
  saveProfilePhotos,
  setProfileScreenChrome,
  restoreMainTabbar,
  applyProfileTabbar,
  setProfileTabActive,
  setProfileReturnMode,
  updateProfileHomeFloatButton,
  patchHomeFloatButton,
  showHomeSectionFallback
};

console.log("Klevby profile bridge loaded");
