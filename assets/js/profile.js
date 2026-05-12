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

let klevbyMainTabbarSnapshot = null;
let klevbyOriginalGoHomeTop = null;
let klevbyOriginalUpdateHomeFloatButton = null;
let klevbyOriginalShowSection = null;
let klevbyHeaderDisplaySnapshot = null;
let klevbyProfileFeedSyncInProgress = false;
let klevbyProfileFeedSyncTimer = null;
let klevbyProfilePhotoUploadInProgress = false;
let klevbyProfileUploadStatusTimer = null;

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

function setProfileScreenChrome(isActive) {
  const html = document.documentElement;
  const body = document.body;
  const header = document.querySelector("header");

  if (html) {
    html.classList.toggle("profile-screen-open", Boolean(isActive));
  }

  if (body) {
    body.classList.toggle("profile-screen-open", Boolean(isActive));
  }

  if (!header) return;

  if (isActive) {
    if (klevbyHeaderDisplaySnapshot === null) {
      klevbyHeaderDisplaySnapshot = header.style.display || "";
    }

    header.style.display = "none";
    header.setAttribute("aria-hidden", "true");
    header.dataset.profileHidden = "1";
    return;
  }

  if (header.dataset.profileHidden === "1") {
    header.style.display = klevbyHeaderDisplaySnapshot || "";
    header.removeAttribute("aria-hidden");
    delete header.dataset.profileHidden;
  }
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

function closeMobileMenuSafe() {
  try {
    if (typeof closeMobileMenu === "function") {
      closeMobileMenu();
      return;
    }

    const menu = document.getElementById("mobileMenu");
    const burger = document.getElementById("burgerBtn");

    if (menu) menu.classList.remove("open");

    if (burger) {
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }
  } catch (error) {
    console.warn("Klevby profile: меню не закрылось", error);
  }
}

function hideProfileTopGearButton() {
  const gearButton = document.querySelector(".profile-gear-btn");

  if (gearButton) {
    gearButton.classList.add("hidden");
    gearButton.setAttribute("aria-hidden", "true");
    gearButton.tabIndex = -1;
  }
}

function openProfileSettingsModal() {
  const modal = document.getElementById("profileSettingsModal");
  const message = document.getElementById("profileSettingsMessage");

  if (!modal) return;

  setProfileScreenChrome(true);
  fillProfileSettingsForm();

  if (message) {
    message.textContent = "";
    message.classList.remove("error-line");
  }

  modal.classList.remove("hidden");
  document.body.classList.add("post-modal-open");

  applyProfileTabbar();
  setProfileTabActive(3);
  updateProfileHomeFloatButton();

  setTimeout(() => {
    const nameInput = document.getElementById("profileSettingsNameInput");
    if (nameInput) nameInput.focus({ preventScroll: true });
  }, 120);
}

function closeProfileSettingsModal(updateButton = true) {
  const modal = document.getElementById("profileSettingsModal");

  if (modal) {
    modal.classList.add("hidden");
  }

  document.body.classList.remove("post-modal-open");

  if (updateButton) {
    setTimeout(updateProfileHomeFloatButton, 80);
  }
}

function handleProfileSettingsBackdrop(event) {
  if (!event || event.target?.id !== "profileSettingsModal") return;
  closeProfileSettingsModal(true);
}

function fillProfileSettingsForm() {
  const data = readProfileData();

  const nameInput = document.getElementById("profileSettingsNameInput");
  const telegramInput = document.getElementById("profileSettingsTelegramInput");
  const cityInput = document.getElementById("profileSettingsCityInput");
  const aboutInput = document.getElementById("profileSettingsAboutInput");

  if (nameInput) nameInput.value = data.name || "";
  if (telegramInput) telegramInput.value = data.telegram || "";
  if (cityInput) cityInput.value = data.city || "";
  if (aboutInput) aboutInput.value = data.about || "";
}

function saveProfileSettings() {
  const message = document.getElementById("profileSettingsMessage");

  const nameInput = document.getElementById("profileSettingsNameInput");
  const telegramInput = document.getElementById("profileSettingsTelegramInput");
  const cityInput = document.getElementById("profileSettingsCityInput");
  const aboutInput = document.getElementById("profileSettingsAboutInput");

  const name = nameInput ? nameInput.value.trim() : "";
  const telegram = telegramInput ? telegramInput.value.trim() : "";
  const city = cityInput ? cityInput.value.trim() : "";
  const about = aboutInput ? aboutInput.value.trim() : "";

  if (!name) {
    if (message) {
      message.textContent = "Укажи никнейм, чтобы профиль нормально отображался.";
      message.classList.add("error-line");
    }

    if (nameInput) nameInput.focus();
    return;
  }

  const saved = saveProfileData({
    name,
    telegram,
    city,
    about
  });

  syncProfileDataToMainInputs(saved);
  updateKlevbyProfileView();
  pulseProfileSaved();

  if (message) {
    message.classList.remove("error-line");
    message.textContent = "✅ Анкета сохранена.";
  }

  if (navigator.vibrate) {
    navigator.vibrate(18);
  }

  setTimeout(() => {
    closeProfileSettingsModal(false);
    openKlevbyProfile();
  }, 420);
}

function syncProfileDataToMainInputs(data) {
  const nameInput = document.getElementById("nameInput");
  const cityInput = document.getElementById("cityInput");
  const telegramInput = document.getElementById("telegramInput");
  const usernameInput = document.getElementById("usernameInput");

  if (data.name) {
    if (nameInput && !nameInput.value.trim()) nameInput.value = data.name;
    if (usernameInput && !usernameInput.value.trim()) usernameInput.value = data.name;
  }

  if (data.city && cityInput && !cityInput.value.trim()) {
    cityInput.value = data.city;
  }

  if (data.telegram && telegramInput && !telegramInput.value.trim()) {
    telegramInput.value = data.telegram;
  }
}

function pulseProfileSaved() {
  const card = document.querySelector(".profile-main-card");

  if (!card) return;

  card.classList.remove("profile-saved-pulse");

  requestAnimationFrame(() => {
    card.classList.add("profile-saved-pulse");

    setTimeout(() => {
      card.classList.remove("profile-saved-pulse");
    }, 700);
  });
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

async function handleLocalAvatarUpload(event) {
  const file = event?.target?.files?.[0];

  if (!file) return;

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Выбери изображение для аватарки.");
    return;
  }

  try {
    const compressedAvatar = await compressImageFile(file, {
      maxSide: KLEVB_PROFILE_AVATAR_MAX_SIDE,
      quality: KLEVB_PROFILE_AVATAR_QUALITY,
      outputType: "image/jpeg"
    });

    try {
      localStorage.setItem(KLEVB_PROFILE_AVATAR_KEY, compressedAvatar.dataUrl);
    } catch (error) {
      console.warn("Klevby profile: аватар не сохранился", error);
      alert("Аватар не сохранился. Попробуй фото меньшего размера.");
      return;
    }

    setProfileAvatar(compressedAvatar.dataUrl);
    showProfileAvatarSavedMessage();
    console.info("[KlevbyProfile] Локальный аватар обновлён.");

    uploadProfileAvatarToSupabase(compressedAvatar.dataUrl)
      .then((result) => {
        if (!result?.avatarUrl) return;

        setProfileAvatar(result.avatarUrl);
        console.info("[KlevbyProfile] Аватар загружен в Supabase Storage и профиль обновлён.");
      })
      .catch((uploadError) => {
        console.warn("[KlevbyProfile] Upload аватара в Supabase не удался, оставляем local fallback.", uploadError);
      });

    if (navigator.vibrate) {
      navigator.vibrate(18);
    }
  } catch (error) {
    console.warn("Klevby profile: аватар не обработался", error);
    alert("Не получилось обработать аватар. Попробуй другое фото.");
  } finally {
    if (event?.target) {
      event.target.value = "";
    }
  }
}

function showProfileAvatarSavedMessage() {
  const message = document.getElementById("profileSettingsMessage");

  if (!message) return;

  message.classList.remove("error-line");
  message.textContent = "✅ Аватар обновлён.";
}

function restoreLocalProfileAvatar() {
  try {
    const savedAvatar = localStorage.getItem(KLEVB_PROFILE_AVATAR_KEY);

    if (savedAvatar) {
      setProfileAvatar(savedAvatar);
    } else {
      resetMobileProfileAvatar();
    }
  } catch (error) {
    console.warn("Klevby profile: аватар не восстановился", error);
  }

  loadProfileAvatarFromSupabase().catch((error) => {
    console.warn("[KlevbyProfile] Не удалось подтянуть avatar_url из profiles, используем localStorage.", error);
  });
}

async function loadProfileAvatarFromSupabase() {
  const supabase = getProfileSupabaseClient();
  const currentUser = await resolveCurrentProfileUser(supabase);

  if (!currentUser?.id) {
    return null;
  }

  try {
    const avatarUrlFromRest = await readProfileAvatarRowByRest(currentUser.id);

    if (avatarUrlFromRest) {
      setProfileAvatar(avatarUrlFromRest);
      console.info("[KlevbyProfile] Загружен avatar_url из profiles через REST.");
      return avatarUrlFromRest;
    }
  } catch (restError) {
    console.warn("[KlevbyProfile] REST avatar_url read не сработал, пробуем SDK fallback.", restError);
  }

  if (!supabase) {
    return null;
  }

  const queryPromise = supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", currentUser.id)
    .maybeSingle();

  const { data, error } = await promiseWithTimeout(
    queryPromise,
    5000,
    "Supabase SDK avatar_url read timeout"
  );

  if (error) throw error;

  const avatarUrl = String(data?.avatar_url || "").trim();

  if (!avatarUrl) return null;

  setProfileAvatar(avatarUrl);
  console.info("[KlevbyProfile] Загружен avatar_url из profiles.");
  return avatarUrl;
}

function setProfileAvatar(src) {
  if (!src) return;

  const image = document.getElementById("profileAvatarImage");
  const fallback = document.getElementById("profileAvatarFallback");
  const mobileIcon = document.getElementById("mobileProfileAvatarIcon");

  if (image && fallback) {
    image.src = src;
    image.classList.remove("hidden");
    fallback.classList.add("hidden");
  }

  if (mobileIcon) {
    mobileIcon.textContent = "";
    mobileIcon.style.backgroundImage = `url("${src}")`;
    mobileIcon.style.backgroundSize = "cover";
    mobileIcon.style.backgroundPosition = "center";
    mobileIcon.style.backgroundRepeat = "no-repeat";
  }
}

function resetMobileProfileAvatar() {
  const mobileIcon = document.getElementById("mobileProfileAvatarIcon");

  if (!mobileIcon) return;

  mobileIcon.textContent = "👤";
  mobileIcon.style.backgroundImage = "";
  mobileIcon.style.backgroundSize = "";
  mobileIcon.style.backgroundPosition = "";
  mobileIcon.style.backgroundRepeat = "";
}

function logoutFromProfileSettings() {
  try {
    if (typeof logout === "function") {
      logout();
    }
  } catch (error) {
    console.warn("Klevby profile: выход не сработал", error);
  }

  closeProfileSettingsModal(true);
}

function bindProfileInputSync() {
  const nameInput = document.getElementById("nameInput");
  const usernameInput = document.getElementById("usernameInput");

  [nameInput, usernameInput].forEach((input) => {
    if (!input) return;

    input.addEventListener("input", () => {
      const value = input.value.trim();

      if (!value) return;

      const current = readProfileData();

      if (!current.name) {
        saveProfileData({
          ...current,
          name: value
        });

        updateKlevbyProfileView();
      }
    });
  });
}

function saveMainTabbarSnapshot() {
  if (klevbyMainTabbarSnapshot) return;

  const tabbar = document.querySelector(".mobile-tabbar");
  if (!tabbar) return;

  const buttons = Array.from(tabbar.querySelectorAll(".mobile-tab-btn"));

  klevbyMainTabbarSnapshot = buttons.map((button) => {
    return {
      html: button.innerHTML,
      className: button.className,
      onclick: button.getAttribute("onclick"),
      id: button.id || ""
    };
  });
}

function restoreMainTabbar() {
  const tabbar = document.querySelector(".mobile-tabbar");
  if (!tabbar || !klevbyMainTabbarSnapshot) return;

  const buttons = Array.from(tabbar.querySelectorAll(".mobile-tab-btn"));

  buttons.forEach((button, index) => {
    const saved = klevbyMainTabbarSnapshot[index];
    if (!saved) return;

    button.innerHTML = saved.html;
    button.className = saved.className;

    if (saved.id) {
      button.id = saved.id;
    }

    if (saved.onclick) {
      button.setAttribute("onclick", saved.onclick);
    } else {
      button.removeAttribute("onclick");
    }

    button.classList.remove("profile-tab-active");
  });
}

function applyProfileTabbar() {
  saveMainTabbarSnapshot();

  const tabbar = document.querySelector(".mobile-tabbar");
  if (!tabbar) return;

  const buttons = Array.from(tabbar.querySelectorAll(".mobile-tab-btn"));
  if (buttons.length < 5) return;

  setProfileTabButton(buttons[0], "▧", "Фото", "openProfilePhotoAction()");
  setProfileTabButton(buttons[1], "▣", "Выезды", "openProfileTripsView()");
  setProfileTabButton(buttons[2], "+", "Создать", "openProfileCreateView()", true);
  setProfileTabButton(buttons[3], "⚙", "Анкета", "openProfileSettingsModal()");

  const chatButton = buttons[4];
  chatButton.innerHTML = '<span class="mobile-tab-icon">☵</span><span class="mobile-tab-text">Чат</span>';
  chatButton.classList.remove("active");
  chatButton.classList.remove("profile-tab-active");

  if (!chatButton.id) {
    chatButton.id = "nav-chat";
  }

  setProfilePhotoButtonsDisabled(klevbyProfilePhotoUploadInProgress);
}

function setProfileTabButton(button, icon, text, action, isCreate = false) {
  if (!button) return;

  button.className = isCreate
    ? "mobile-tab-btn mobile-tab-create"
    : "mobile-tab-btn";

  button.innerHTML = `<span class="mobile-tab-icon">${icon}</span><span class="mobile-tab-text">${text}</span>`;
  button.setAttribute("onclick", action);
}

function setProfileTabActive(index) {
  const buttons = document.querySelectorAll(".mobile-tab-btn");

  buttons.forEach((button, i) => {
    button.classList.toggle("active", Number.isInteger(index) && i === index);
  });
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
  const core = getProfileCore();

  if (typeof core.makeLocalProfilePhoto === "function") {
    return core.makeLocalProfilePhoto(compressedPhoto, file, feedItem);
  }

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
  const core = getProfileCore();

  if (typeof core.updateLocalPhotoWithFeedItem === "function") {
    return core.updateLocalPhotoWithFeedItem(photo, feedItem);
  }

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
  clearTimeout(klevbyProfileUploadStatusTimer);

  const node = ensureProfileUploadStatus();
  const inner = node.querySelector(".profile-upload-status-inner");

  node.className = `profile-upload-status ${state || "loading"}`;

  if (inner) {
    inner.textContent = String(message || "Загрузка…");
  }
}

function hideProfileUploadStatus(delay = 0) {
  clearTimeout(klevbyProfileUploadStatusTimer);

  const hide = () => {
    const node = document.getElementById("profileUploadStatus");
    if (node) node.classList.add("hidden");
  };

  if (delay > 0) {
    klevbyProfileUploadStatusTimer = setTimeout(hide, delay);
    return;
  }

  hide();
}

function setProfileUploadBusy(isBusy, message = "", state = "loading") {
  klevbyProfilePhotoUploadInProgress = Boolean(isBusy);

  if (document.body) {
    document.body.classList.toggle("profile-photo-uploading", klevbyProfilePhotoUploadInProgress);
  }

  setProfilePhotoButtonsDisabled(klevbyProfilePhotoUploadInProgress);

  if (message) {
    showProfileUploadStatus(message, state);
  }
}

function finishProfileUploadStatus(message = "", state = "success", delay = 1200) {
  klevbyProfilePhotoUploadInProgress = false;

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

  const photos = readProfilePhotos();

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
    deleteButton.onclick = () => removeProfilePhoto(photo.id || cleanId);
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

function hideProfileSectionOnly() {
  const profileSection = document.getElementById("profileSection");

  if (profileSection) {
    profileSection.classList.add("hidden");
  }

  closeProfileSettingsModal(false);
}

function setProfileReturnMode(isActive) {
  try {
    if (isActive) {
      sessionStorage.setItem(KLEVB_PROFILE_RETURN_KEY, "1");
    } else {
      sessionStorage.removeItem(KLEVB_PROFILE_RETURN_KEY);
    }
  } catch (error) {
    window.__klevbyProfileReturnMode = Boolean(isActive);
  }

  window.__klevbyProfileReturnMode = Boolean(isActive);
  updateProfileHomeFloatButton();
}

function isProfileReturnMode() {
  try {
    return sessionStorage.getItem(KLEVB_PROFILE_RETURN_KEY) === "1";
  } catch (error) {
    return Boolean(window.__klevbyProfileReturnMode);
  }
}

function isProfileSectionVisible() {
  const profileSection = document.getElementById("profileSection");

  return Boolean(profileSection && !profileSection.classList.contains("hidden"));
}

function isProfileSettingsModalVisible() {
  const modal = document.getElementById("profileSettingsModal");

  return Boolean(modal && !modal.classList.contains("hidden"));
}

function shouldShowProfileBackButton() {
  return isProfileReturnMode() || isProfileSettingsModalVisible();
}

function updateProfileHomeFloatButton() {
  const btn = document.getElementById("homeFloatBtn");

  if (!btn) return;

  if (shouldShowProfileBackButton()) {
    btn.textContent = "← Профиль";
    btn.setAttribute("aria-label", "Вернуться в профиль");
    btn.classList.add("show");
    return;
  }

  if (isProfileSectionVisible()) {
    btn.textContent = "⌂ Главная";
    btn.setAttribute("aria-label", "Вернуться на главную");
    btn.classList.add("show");
    return;
  }

  btn.textContent = "⌂ Главная";
  btn.setAttribute("aria-label", "Вернуться на главную");

  if (typeof klevbyOriginalUpdateHomeFloatButton === "function") {
    try {
      klevbyOriginalUpdateHomeFloatButton();
    } catch (error) {
      console.warn("Klevby profile: home float update skipped", error);
    }
  }
}

function patchHomeFloatButton() {
  if (typeof window.goHomeTop === "function" && !klevbyOriginalGoHomeTop) {
    klevbyOriginalGoHomeTop = window.goHomeTop;

    window.goHomeTop = function patchedGoHomeTop() {
      if (shouldShowProfileBackButton()) {
        closeProfileSettingsModal(false);
        openKlevbyProfile();
        return;
      }

      if (isProfileSectionVisible()) {
        setProfileReturnMode(false);
        setProfileScreenChrome(false);
        restoreMainTabbar();

        if (typeof klevbyOriginalGoHomeTop === "function") {
          return klevbyOriginalGoHomeTop.apply(this, arguments);
        }

        showHomeSectionFallback();
        return;
      }

      setProfileScreenChrome(false);
      restoreMainTabbar();

      if (typeof klevbyOriginalGoHomeTop === "function") {
        return klevbyOriginalGoHomeTop.apply(this, arguments);
      }

      showHomeSectionFallback();
      return;
    };
  }

  if (typeof window.updateHomeFloatButton === "function" && !klevbyOriginalUpdateHomeFloatButton) {
    klevbyOriginalUpdateHomeFloatButton = window.updateHomeFloatButton;

    window.updateHomeFloatButton = function patchedUpdateHomeFloatButton() {
      if (shouldShowProfileBackButton() || isProfileSectionVisible()) {
        updateProfileHomeFloatButton();
        return;
      }

      if (typeof klevbyOriginalUpdateHomeFloatButton === "function") {
        const result = klevbyOriginalUpdateHomeFloatButton.apply(this, arguments);
        updateProfileHomeFloatButton();
        return result;
      }

      return undefined;
    };
  }
}

function showHomeSectionFallback() {
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

    if (id === "homeSection") {
      section.classList.remove("hidden");
    } else {
      section.classList.add("hidden");
    }
  });

  setProfileReturnMode(false);
  setProfileScreenChrome(false);
  restoreMainTabbar();

  if (typeof setMobileTabActive === "function") {
    setMobileTabActive(0);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(updateProfileHomeFloatButton, 120);
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
  saveProfilePhotos
};

console.log("Klevby profile bridge loaded");
