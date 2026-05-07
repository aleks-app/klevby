const KLEVB_PROFILE_STORAGE_KEY = "klevby_profile_settings";
const KLEVB_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
const KLEVB_PROFILE_NAME_KEY = "klevby_profile_name";
const KLEVB_PROFILE_RETURN_KEY = "klevby_profile_return_mode";

let klevbyMainTabbarSnapshot = null;
let klevbyOriginalGoHomeTop = null;
let klevbyOriginalUpdateHomeFloatButton = null;
let klevbyOriginalShowSection = null;

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

function openKlevbyProfile() {
  setProfileReturnMode(false);

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
  closeProfileSettingsModal();
  hideProfileTopGearButton();
  applyProfileTabbar();
  setProfileTabActive(0);
  updateKlevbyProfileView();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(() => {
    updateProfileHomeFloatButton();
  }, 150);
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

  fillProfileSettingsForm();

  if (message) {
    message.textContent = "";
    message.classList.remove("error-line");
  }

  modal.classList.remove("hidden");
  document.body.classList.add("post-modal-open");

  setProfileTabActive(3);

  setTimeout(() => {
    const nameInput = document.getElementById("profileSettingsNameInput");
    if (nameInput) nameInput.focus({ preventScroll: true });
  }, 120);
}

function closeProfileSettingsModal() {
  const modal = document.getElementById("profileSettingsModal");

  if (modal) {
    modal.classList.add("hidden");
  }

  document.body.classList.remove("post-modal-open");
}

function handleProfileSettingsBackdrop(event) {
  if (!event || event.target?.id !== "profileSettingsModal") return;
  closeProfileSettingsModal();
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
    closeProfileSettingsModal();
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

  if (reportsNode) reportsNode.textContent = String(userPostsCount);
  if (tripsNode) tripsNode.textContent = String(userPostsCount);

  restoreLocalProfileAvatar();
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
      localStorage.setItem(KLEVB_PROFILE_AVATAR_KEY, result);
    } catch (error) {
      console.warn("Klevby profile: аватар не сохранился", error);
      alert("Аватар не сохранился. Попробуй фото меньшего размера.");
      return;
    }

    setProfileAvatar(result);
    showProfileAvatarSavedMessage();

    if (navigator.vibrate) {
      navigator.vibrate(18);
    }
  };

  reader.readAsDataURL(file);
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

  closeProfileSettingsModal();
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
  applyProfileTabbar();
  setProfileTabActive(0);
  triggerProfileAvatarInput();
}

function openProfileTripsView() {
  setProfileReturnMode(true);
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
      showSection("home");
      window.__klevbyProfileInternalNavigation = false;
    }
  } catch (error) {
    window.__klevbyProfileInternalNavigation = false;
  }

  setTimeout(() => {
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
  applyProfileTabbar();
  setProfileTabActive(2);

  hideProfileSectionOnly();

  try {
    if (typeof showSection === "function") {
      window.__klevbyProfileInternalNavigation = true;
      showSection("home");
      window.__klevbyProfileInternalNavigation = false;
    }
  } catch (error) {
    window.__klevbyProfileInternalNavigation = false;
  }

  setTimeout(() => {
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

  closeProfileSettingsModal();
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

function updateProfileHomeFloatButton() {
  const btn = document.getElementById("homeFloatBtn");

  if (!btn) return;

  if (isProfileReturnMode()) {
    btn.textContent = "← Профиль";
    btn.setAttribute("aria-label", "Вернуться в профиль");
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
      if (isProfileReturnMode()) {
        openKlevbyProfile();
        return;
      }

      restoreMainTabbar();

      if (typeof klevbyOriginalGoHomeTop === "function") {
        return klevbyOriginalGoHomeTop.apply(this, arguments);
      }

      return undefined;
    };
  }

  if (typeof window.updateHomeFloatButton === "function" && !klevbyOriginalUpdateHomeFloatButton) {
    klevbyOriginalUpdateHomeFloatButton = window.updateHomeFloatButton;

    window.updateHomeFloatButton = function patchedUpdateHomeFloatButton() {
      if (isProfileReturnMode()) {
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

function patchShowSectionForProfile() {
  if (window.__klevbyProfileShowSectionPatched) return;
  if (typeof window.showSection !== "function") return;

  klevbyOriginalShowSection = window.showSection;

  window.showSection = function patchedShowSection(sectionName) {
    const result = klevbyOriginalShowSection.apply(this, arguments);

    if (sectionName !== "profile" && !window.__klevbyProfileInternalNavigation) {
      hideProfileSectionOnly();
      restoreMainTabbar();
      setProfileReturnMode(false);
    }

    if (sectionName === "profile") {
      openKlevbyProfile();
    }

    setTimeout(() => {
      updateProfileHomeFloatButton();
    }, 120);

    return result;
  };

  window.__klevbyProfileShowSectionPatched = true;
}

function initKlevbyProfileNavigation() {
  saveMainTabbarSnapshot();
  patchHomeFloatButton();

  setTimeout(patchShowSectionForProfile, 0);
  setTimeout(patchShowSectionForProfile, 250);
  setTimeout(patchShowSectionForProfile, 800);

  if (isProfileReturnMode()) {
    applyProfileTabbar();
    updateProfileHomeFloatButton();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindProfileInputSync();
  hideProfileTopGearButton();
  initKlevbyProfileNavigation();
  updateKlevbyProfileView();
});

window.openKlevbyProfile = openKlevbyProfile;
window.openProfileSettingsModal = openProfileSettingsModal;
window.closeProfileSettingsModal = closeProfileSettingsModal;
window.handleProfileSettingsBackdrop = handleProfileSettingsBackdrop;
window.saveProfileSettings = saveProfileSettings;
window.triggerProfileAvatarInput = triggerProfileAvatarInput;
window.handleLocalAvatarUpload = handleLocalAvatarUpload;
window.updateKlevbyProfileView = updateKlevbyProfileView;
window.logoutFromProfileSettings = logoutFromProfileSettings;

window.applyProfileTabbar = applyProfileTabbar;
window.restoreMainTabbar = restoreMainTabbar;
window.openProfilePhotoAction = openProfilePhotoAction;
window.openProfileTripsView = openProfileTripsView;
window.openProfileCreateView = openProfileCreateView;
