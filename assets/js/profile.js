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

let klevbyMainTabbarSnapshot = null;
let klevbyOriginalGoHomeTop = null;
let klevbyOriginalUpdateHomeFloatButton = null;
let klevbyOriginalShowSection = null;
let klevbyHeaderDisplaySnapshot = null;
let klevbyProfileFeedSyncInProgress = false;
let klevbyProfileFeedSyncTimer = null;

function getDefaultProfileData() {
  return {
    name: "",
    city: "",
    telegram: "",
    about: ""
  };
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
    console.warn("Klevby profile: не удалось прочитать профиль", error);

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
    console.warn("Klevby profile: не удалось сохранить профиль", error);
  }

  return cleanData;
}

function readProfilePhotos() {
  try {
    const raw = localStorage.getItem(KLEVB_PROFILE_PHOTOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Klevby profile: не удалось прочитать фото", error);
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
    console.warn("Klevby profile: не удалось сохранить фото", error);
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
  patchProfileCardButtons();
  setProfileTabActive(0);
  updateKlevbyProfileView();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(updateProfileHomeFloatButton, 150);
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

function getCurrentProfileUser() {
  return (
    window.currentUser ||
    window.klevbyCurrentUser ||
    window.klevbyUser ||
    (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
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
  } catch (error) {
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

function formatTelegramLabel(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return "";

  if (cleanValue.startsWith("@")) return cleanValue;

  const match = cleanValue.match(/t\.me\/([^/?#]+)/i);
  if (match && match[1]) return `@${match[1]}`;

  return cleanValue;
}

function triggerProfileAvatarInput() {
  const input = document.getElementById("profileAvatarInput");
  if (input) input.click();
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
  return {
    id: `photo_${Date.now()}`,
    src: compressedPhoto.dataUrl,
    title: "Фото с рыбалки",
    createdAt: new Date().toISOString(),
    originalSizeKb: Math.round((file?.size || 0) / 1024),
    savedSizeKb: compressedPhoto.sizeKb,
    width: compressedPhoto.width,
    height: compressedPhoto.height,
    source: feedItem ? "supabase" : "local",
    feedPostId: feedItem?.id || "",
    feedImagePath: feedItem?.imagePath || "",
    feedImageUrl: feedItem?.imageUrl || feedItem?.image || "",
    feedSyncError: ""
  };
}

function updateLocalPhotoWithFeedItem(photo, feedItem) {
  if (!photo || !feedItem) return photo;

  return {
    ...photo,
    source: "supabase",
    feedPostId: feedItem.id || photo.feedPostId || "",
    feedImagePath: feedItem.imagePath || photo.feedImagePath || "",
    feedImageUrl: feedItem.imageUrl || feedItem.image || photo.feedImageUrl || "",
    feedSyncError: ""
  };
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

        const currentPhotos = readProfilePhotos();
        const updatedPhotos = currentPhotos.map((photo) => {
          if (String(photo.id) !== String(pendingPhoto.id)) {
            return photo;
          }

          return updateLocalPhotoWithFeedItem(photo, feedItem);
        });

        saveProfilePhotos(updatedPhotos);
        changed = true;

        window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
          detail: {
            action: "local_profile_photo_synced_to_supabase",
            item: feedItem
          }
        }));
      } catch (error) {
        console.warn("Klevby profile: локальное фото не удалось отправить в Supabase", error);

        const currentPhotos = readProfilePhotos();
        const updatedPhotos = currentPhotos.map((photo) => {
          if (String(photo.id) !== String(pendingPhoto.id)) {
            return photo;
          }

          return {
            ...photo,
            source: "local",
            feedSyncError: String(error?.message || error || "Ошибка Supabase")
          };
        });

        saveProfilePhotos(updatedPhotos);
      }
    }
  } finally {
    klevbyProfileFeedSyncInProgress = false;
  }

  if (changed) {
    updateKlevbyProfileView();

    if (typeof window.renderProfileFeed === "function") {
      setTimeout(window.renderProfileFeed, 250);
    }
  }

  return changed;
}

async function handleProfilePhotoUpload(event) {
  const file = event?.target?.files?.[0];

  if (!file) return;

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Выбери фото для профиля.");
    return;
  }

  try {
    const compressedPhoto = await compressImageFile(file, {
      maxSide: KLEVB_PROFILE_PHOTO_MAX_SIDE,
      quality: KLEVB_PROFILE_PHOTO_QUALITY,
      outputType: "image/jpeg"
    });

    let feedItem = null;
    let supabaseError = null;

    try {
      feedItem = await uploadProfilePhotoToSupabaseFeed(compressedPhoto, file);
    } catch (error) {
      supabaseError = error;
      console.warn("Klevby profile: фото сохранится локально, Supabase не принял загрузку", error);
    }

    const photos = readProfilePhotos();
    const localPhoto = makeLocalProfilePhoto(compressedPhoto, file, feedItem);

    photos.unshift(localPhoto);

    saveProfilePhotos(photos);
    updateKlevbyProfileView();
    openKlevbyProfile();

    if (typeof window.renderProfileFeed === "function") {
      setTimeout(window.renderProfileFeed, 350);
    }

    window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
      detail: {
        action: feedItem ? "profile_photo_uploaded_to_supabase" : "profile_photo_saved_locally",
        item: feedItem || localPhoto,
        error: supabaseError ? String(supabaseError.message || supabaseError) : ""
      }
    }));

    if (navigator.vibrate) {
      navigator.vibrate(18);
    }

    if (supabaseError) {
      alert(
        "Фото добавлено в профиль на этом устройстве, но пока не попало в общую ленту. " +
        (supabaseError.message || "Проверь вход, Supabase Storage и RLS.")
      );

      scheduleProfileFeedSync(1800);
    }
  } catch (error) {
    console.warn("Klevby profile: фото не обработалось", error);
    alert("Не получилось обработать фото. Попробуй другое изображение.");
  } finally {
    if (event?.target) {
      event.target.value = "";
    }
  }
}

function compressImageFile(file, options = {}) {
  const maxSide = Number(options.maxSide || 1080);
  const quality = Number(options.quality || 0.68);
  const outputType = options.outputType || "image/jpeg";

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const originalWidth = image.naturalWidth || image.width;
        const originalHeight = image.naturalHeight || image.height;

        if (!originalWidth || !originalHeight) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Image has empty size"));
          return;
        }

        const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
        const width = Math.max(1, Math.round(originalWidth * scale));
        const height = Math.max(1, Math.round(originalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { alpha: false });

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Canvas context is not available"));
          return;
        }

        ctx.fillStyle = "#07110f";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(outputType, quality);
        const sizeKb = estimateDataUrlSizeKb(dataUrl);

        URL.revokeObjectURL(objectUrl);

        resolve({
          dataUrl,
          width,
          height,
          sizeKb
        });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load error"));
    };

    image.src = objectUrl;
  });
}

function estimateDataUrlSizeKb(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  const padding = (base64.match(/=+$/) || [""])[0].length;
  const bytes = Math.max(0, Math.round((base64.length * 3) / 4) - padding);

  return Math.round(bytes / 1024);
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

  if (typeof window.renderProfileFeed === "function") {
    setTimeout(window.renderProfileFeed, 250);
  }

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
