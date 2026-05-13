function setMobileTabbarMode(mode) {
  const tabbar = document.querySelector(".mobile-tabbar");
  const buttons = getMobileTabButtons();

  if (!tabbar || buttons.length < 5) return;

  const cleanMode = mode === "profile" ? "profile" : "home";

  window.__klevbyMobileTabbarMode = cleanMode;
  tabbar.setAttribute("data-mode", cleanMode);

  const homeTabs = [
    {
      icon: "▰",
      text: "Лента",
      action: goMobileFeed
    },
    {
      icon: "⌖",
      text: "Карта",
      action: goMobileMap
    },
    {
      icon: "+",
      text: "Создать",
      action: goMobileCreate,
      create: true
    },
    {
      icon: "☁",
      text: "Погода",
      action: goMobileWeather
    },
    {
      icon: "☵",
      text: "Чат",
      action: goMobileChat,
      id: "nav-chat"
    }
  ];

  const profileTabs = [
    {
      icon: "▧",
      text: "Фото",
      action: goProfilePhotos
    },
    {
      icon: "▣",
      text: "Выезды",
      action: goProfileTrips
    },
    {
      icon: "+",
      text: "Создать",
      action: goProfileCreate,
      create: true
    },
    {
      icon: "⚙",
      text: "Анкета",
      action: goProfileSettings
    },
    {
      icon: "☵",
      text: "Чат",
      action: goMobileChat,
      id: "nav-chat"
    }
  ];

  const config = cleanMode === "profile" ? profileTabs : homeTabs;

  buttons.forEach((button, index) => {
    const item = config[index];
    if (!button || !item) return;

    button.className = item.create
      ? "mobile-tab-btn mobile-tab-create"
      : "mobile-tab-btn";

    if (item.id) {
      button.id = item.id;
    } else if (button.id === "nav-chat") {
      button.removeAttribute("id");
    }

    button.innerHTML = `<span class="mobile-tab-icon">${item.icon}</span><span class="mobile-tab-text">${item.text}</span>`;
    button.onclick = item.action;
  });
}

function goHomeTop() {
  setMobileTabbarMode("home");
  setMobileTabActive(0);
  showSection("home");

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateHomeFloatButton();
  }, 80);
}

function goMobileFeed() {
  setMobileTabbarMode("home");
  setMobileTabActive(0);
  showSection("home");
  mobileScrollTo("postsSection");
}

function goMobileCreate() {
  setMobileTabbarMode("home");
  setMobileTabActive(2);
  showSection("home");
  mobileScrollTo("createPanel");
}

function goMobileMap() {
  setMobileTabbarMode("home");
  setMobileTabActive(1);
  showSection("map");
}

function goMobileWeather() {
  setMobileTabbarMode("home");
  setMobileTabActive(3);
  showSection("home");
  mobileScrollTo("forecastPanel");
}

function goMobileProfile() {
  openKlevbyProfile();
}

function goMobileChat() {
  setMobileTabActive(4);

  const possibleChatFunctions = [
    "openKlevbyChat",
    "openChat",
    "showChat",
    "toggleChat",
    "openChatShell"
  ];

  for (const functionName of possibleChatFunctions) {
    if (typeof window[functionName] === "function") {
      window[functionName]();
      return;
    }
  }
}

function goProfilePhotos() {
  setMobileTabbarMode("profile");
  setMobileTabActive(0);

  const profileSection = document.getElementById("profileSection");
  const isProfileOpen = profileSection && !profileSection.classList.contains("hidden");

  if (!isProfileOpen) {
    openKlevbyProfile();
  }

  scrollToProfilePhotos();
}

function goProfileTrips() {
  setMobileTabbarMode("home");
  setMobileTabActive(0);

  if (typeof setMode === "function") {
    setMode("mine");
  }

  showSection("home");
  mobileScrollTo("postsSection");
}

function goProfileCreate() {
  setMobileTabbarMode("home");
  setMobileTabActive(2);
  showSection("home");
  mobileScrollTo("createPanel");
}

function goProfileSettings() {
  setMobileTabbarMode("profile");
  setMobileTabActive(3);

  const profileSection = document.getElementById("profileSection");
  const isProfileOpen = profileSection && !profileSection.classList.contains("hidden");

  if (!isProfileOpen) {
    openKlevbyProfile();
  }

  setTimeout(() => {
    if (typeof openProfileSettingsModal === "function") {
      openProfileSettingsModal();
    }
  }, 140);
}

function openKlevbyProfile() {
  const sectionIds = [
    "homeSection",
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
  setMobileTabbarMode("profile");
  setMobileTabActive(null);
  updateKlevbyProfileView();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(updateHomeFloatButton, 120);
}

function hideKlevbyProfileSection() {
  const profileSection = document.getElementById("profileSection");

  if (profileSection) {
    profileSection.classList.add("hidden");
  }

  closeProfileSettingsModal(false);
  setMobileTabbarMode("home");
}

function updateKlevbyProfileView() {
  const nameNode = document.getElementById("profileNameText");
  const fallbackNode = document.getElementById("profileAvatarFallback");
  const reportsNode = document.getElementById("profileReportsCount");
  const tripsNode = document.getElementById("profileTripsCount");
  const statusNode = document.getElementById("profileStatusText");

  const currentName =
    getProfileNameFromStorage() ||
    getProfileNameFromInputs() ||
    getProfileNameFromAuth() ||
    "Alex";

  const city = getProfileField("city");
  const telegram = getProfileField("telegram");
  const about = getProfileField("about");

  if (nameNode) {
    nameNode.textContent = currentName;
  }

  if (fallbackNode) {
    fallbackNode.textContent = currentName.trim().charAt(0).toUpperCase() || "A";
  }

  if (statusNode) {
    const statusParts = [];

    if (city) statusParts.push(`📍 ${city}`);
    if (telegram) statusParts.push(formatTelegramLabel(telegram));

    statusNode.textContent = statusParts.length
      ? statusParts.join(" • ")
      : (about ? about : "🎣 Рыбак Klevby");
  }

  try {
    const postsArray = Array.isArray(window.posts) ? window.posts : [];
    const ownerName = currentName.trim().toLowerCase();
    const ownerId = getCurrentProfileUserId();

    const userPosts = postsArray.filter((post) => {
      const postName = String(post?.name || "").trim().toLowerCase();
      const postOwnerId = String(post?.owner_id || "").trim();

      if (ownerId && postOwnerId && postOwnerId === ownerId) return true;
      return postName && ownerName && postName === ownerName;
    });

    if (reportsNode) reportsNode.textContent = String(userPosts.length || 0);
    if (tripsNode) tripsNode.textContent = String(userPosts.length || 0);
  } catch (error) {
    if (reportsNode) reportsNode.textContent = "0";
    if (tripsNode) tripsNode.textContent = "0";
  }

  restoreLocalProfileAvatar();
}

function getCurrentProfileUserId() {
  const user =
    window.currentUser ||
    window.klevbyCurrentUser ||
    window.klevbyUser ||
    null;

  return user && user.id ? String(user.id) : "";
}

function getProfileNameFromInputs() {
  const nameInput = document.getElementById("nameInput");
  const usernameInput = document.getElementById("usernameInput");

  const nameValue = nameInput && nameInput.value ? nameInput.value.trim() : "";
  const usernameValue = usernameInput && usernameInput.value ? usernameInput.value.trim() : "";

  return nameValue || usernameValue || "";
}

function getProfileNameFromAuth() {
  const user =
    window.currentUser ||
    window.klevbyCurrentUser ||
    window.klevbyUser ||
    null;

  if (!user) return "";

  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  const name =
    metadata.username ||
    metadata.nickname ||
    metadata.name ||
    metadata.full_name ||
    "";

  if (name) return String(name).trim();

  const email = user.email ? String(user.email) : "";
  if (!email) return "";

  return email.split("@")[0] || "";
}

function getProfileNameFromStorage() {
  return getProfileField("name");
}

function getProfileField(field) {
  try {
    return localStorage.getItem(`klevby_profile_${field}`) || "";
  } catch (error) {
    return "";
  }
}

function setProfileField(field, value) {
  try {
    const cleanValue = String(value || "").trim();

    if (cleanValue) {
      localStorage.setItem(`klevby_profile_${field}`, cleanValue);
    } else {
      localStorage.removeItem(`klevby_profile_${field}`);
    }
  } catch (error) {
    console.warn("Klevby profile: field was not saved", field, error);
  }
}

function formatTelegramLabel(value) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return "";

  if (cleanValue.startsWith("@")) return cleanValue;

  const match = cleanValue.match(/t\.me\/([^/?#]+)/i);
  if (match && match[1]) return `@${match[1]}`;

  return cleanValue;
}

function handleLocalAvatarUpload(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (!file.type || !file.type.startsWith("image/")) {
    alert("Выбери изображение для аватарки.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert("Картинка слишком тяжёлая. Выбери фото до 2 МБ.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    const result = String(reader.result || "");

    try {
      localStorage.setItem("klevby_profile_avatar", result);
    } catch (error) {
      console.warn("Klevby profile: avatar was not saved locally", error);
    }

    setProfileAvatar(result);

    if (navigator.vibrate) {
      navigator.vibrate(18);
    }
  };

  reader.readAsDataURL(file);
}

function restoreLocalProfileAvatar() {
  try {
    const savedAvatar = localStorage.getItem("klevby_profile_avatar");

    if (savedAvatar) {
      setProfileAvatar(savedAvatar);
    } else {
      resetProfileAvatarIcon();
    }
  } catch (error) {
    console.warn("Klevby profile: avatar restore skipped", error);
  }
}

function setProfileAvatar(src) {
  const image = document.getElementById("profileAvatarImage");
  const fallback = document.getElementById("profileAvatarFallback");
  const headerIcon = document.getElementById("mobileProfileAvatarIcon");

  if (image && fallback && src) {
    image.src = src;
    image.classList.remove("hidden");
    fallback.classList.add("hidden");
  }

  if (headerIcon && src) {
    headerIcon.style.backgroundImage = `url("${src}")`;
    headerIcon.textContent = "";
  }
}

function resetProfileAvatarIcon() {
  const headerIcon = document.getElementById("mobileProfileAvatarIcon");

  if (headerIcon) {
    headerIcon.style.backgroundImage = "";
    headerIcon.textContent = "👤";
  }
}

function triggerProfileAvatarInput() {
  const input = document.getElementById("profileAvatarInput");
  if (input) input.click();
}

function openProfileSettingsModal() {
  const modal = document.getElementById("profileSettingsModal");

  if (!modal) return;

  syncProfileSettingsForm();

  modal.classList.remove("hidden");

  const nameInput = document.getElementById("profileSettingsNameInput");
  if (nameInput) {
    setTimeout(() => nameInput.focus(), 80);
  }
}

function closeProfileSettingsModal(withMessage = true) {
  const modal = document.getElementById("profileSettingsModal");
  const message = document.getElementById("profileSettingsMessage");

  if (modal) modal.classList.add("hidden");
  if (message && !withMessage) message.textContent = "";
}

function handleProfileSettingsBackdrop(event) {
  if (event && event.target && event.target.id === "profileSettingsModal") {
    closeProfileSettingsModal();
  }
}

function syncProfileSettingsForm() {
  const nameInput = document.getElementById("profileSettingsNameInput");
  const telegramInput = document.getElementById("profileSettingsTelegramInput");
  const cityInput = document.getElementById("profileSettingsCityInput");
  const aboutInput = document.getElementById("profileSettingsAboutInput");
  const message = document.getElementById("profileSettingsMessage");

  const currentName =
    getProfileNameFromStorage() ||
    getProfileNameFromInputs() ||
    getProfileNameFromAuth() ||
    "";

  if (nameInput) nameInput.value = currentName;
  if (telegramInput) telegramInput.value = getProfileField("telegram");
  if (cityInput) cityInput.value = getProfileField("city");
  if (aboutInput) aboutInput.value = getProfileField("about");
  if (message) message.textContent = "";
}

function saveProfileSettings() {
  const nameInput = document.getElementById("profileSettingsNameInput");
  const telegramInput = document.getElementById("profileSettingsTelegramInput");
  const cityInput = document.getElementById("profileSettingsCityInput");
  const aboutInput = document.getElementById("profileSettingsAboutInput");
  const message = document.getElementById("profileSettingsMessage");

  const name = nameInput ? nameInput.value.trim() : "";
  const telegram = telegramInput ? telegramInput.value.trim() : "";
  const city = cityInput ? cityInput.value.trim() : "";
  const about = aboutInput ? aboutInput.value.trim() : "";

  if (!name) {
    if (message) {
      message.textContent = "Укажи nickname профиля.";
    }

    return;
  }

  setProfileField("name", name);
  setProfileField("telegram", telegram);
  setProfileField("city", city);
  setProfileField("about", about);

  syncProfileInputsFromSettings(name, telegram, city);
  updateKlevbyProfileView();

  if (message) {
    message.textContent = "✅ Профиль сохранён.";
  }

  if (navigator.vibrate) {
    navigator.vibrate(18);
  }
}

function syncProfileInputsFromSettings(name, telegram, city) {
  const nameInput = document.getElementById("nameInput");
  const usernameInput = document.getElementById("usernameInput");
  const telegramInput = document.getElementById("telegramInput");
  const cityInput = document.getElementById("cityInput");

  if (nameInput && name) nameInput.value = name;
  if (usernameInput && name) usernameInput.value = name;
  if (telegramInput && telegram) telegramInput.value = telegram;
  if (cityInput && city) cityInput.value = city;
}

function logoutFromProfileSettings() {
  closeProfileSettingsModal(false);

  if (typeof logout === "function") {
    logout();
    return;
  }

  showSection("auth");
}

function patchKlevbyShowSection() {
  if (window.__klevbyShowSectionPatched) return;
  if (typeof window.showSection !== "function") return;

  const originalShowSection = window.showSection;

  window.showSection = function patchedShowSection(sectionName) {
    const result = originalShowSection.apply(this, arguments);

    if (sectionName !== "profile") {
      hideKlevbyProfileSection();
      setMobileTabbarMode("home");
    }

    setTimeout(updateHomeFloatButton, 120);

    return result;
  };

  window.__klevbyShowSectionPatched = true;
}

function patchKlevbyProfileOpenFunction() {
  if (typeof window.openKlevbyProfile !== "function") return;
  if (window.openKlevbyProfile.__klevbyProfileTabPatched) return;

  const originalOpenProfile = window.openKlevbyProfile;

  const patchedOpenProfile = function patchedOpenKlevbyProfile() {
    const result = originalOpenProfile.apply(this, arguments);

    setMobileTabbarMode("profile");
    setMobileTabActive(null);

    setTimeout(updateHomeFloatButton, 120);

    return result;
  };

  patchedOpenProfile.__klevbyProfileTabPatched = true;
  window.openKlevbyProfile = patchedOpenProfile;
}

function initKlevbyProfileUi() {
  setMobileTabbarMode("home");
  restoreLocalProfileAvatar();
  updateKlevbyProfileView();

  const nameInput = document.getElementById("nameInput");
  const usernameInput = document.getElementById("usernameInput");

  [nameInput, usernameInput].forEach((input) => {
    if (!input) return;

    input.addEventListener("input", () => {
      const value = input.value.trim();

      if (value) {
        setProfileField("name", value);
      }

      updateKlevbyProfileView();
    });
  });

  setTimeout(patchKlevbyShowSection, 0);
  setTimeout(patchKlevbyShowSection, 250);
  setTimeout(patchKlevbyShowSection, 800);

  setTimeout(patchKlevbyProfileOpenFunction, 0);
  setTimeout(patchKlevbyProfileOpenFunction, 250);
  setTimeout(patchKlevbyProfileOpenFunction, 800);
}

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.updateHomeFloatButton = updateHomeFloatButton;
window.goHomeTop = goHomeTop;
window.scrollToPosts = scrollToPosts;
window.mobileScrollTo = mobileScrollTo;
window.setMobileTabActive = setMobileTabActive;
window.setMobileTabbarMode = setMobileTabbarMode;
window.goMobileFeed = goMobileFeed;
window.goMobileCreate = goMobileCreate;
window.goMobileMap = goMobileMap;
window.goMobileWeather = goMobileWeather;
window.goMobileProfile = goMobileProfile;
window.goMobileChat = goMobileChat;

window.goProfilePhotos = goProfilePhotos;
window.goProfileTrips = goProfileTrips;
window.goProfileCreate = goProfileCreate;
window.goProfileSettings = goProfileSettings;

window.openKlevbyProfile = openKlevbyProfile;
window.hideKlevbyProfileSection = hideKlevbyProfileSection;
window.updateKlevbyProfileView = updateKlevbyProfileView;
window.handleLocalAvatarUpload = handleLocalAvatarUpload;
window.triggerProfileAvatarInput = triggerProfileAvatarInput;
window.openProfileSettingsModal = openProfileSettingsModal;
window.closeProfileSettingsModal = closeProfileSettingsModal;
window.handleProfileSettingsBackdrop = handleProfileSettingsBackdrop;
window.saveProfileSettings = saveProfileSettings;
window.logoutFromProfileSettings = logoutFromProfileSettings;

document.addEventListener("DOMContentLoaded", initKlevbyProfileUi);
window.addEventListener("scroll", updateHomeFloatButton, { passive: true });
