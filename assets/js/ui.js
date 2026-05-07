function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const btn = document.getElementById("burgerBtn");
  if (!menu || !btn) return;

  const isOpen = menu.classList.toggle("open");
  btn.classList.toggle("open", isOpen);
  btn.setAttribute("aria-expanded", String(isOpen));
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const btn = document.getElementById("burgerBtn");
  if (!menu || !btn) return;

  menu.classList.remove("open");
  btn.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function updateHomeFloatButton() {
  const btn = document.getElementById("homeFloatBtn");
  const homeSection = document.getElementById("homeSection");

  if (!btn || !homeSection) return;

  const isNotHome = homeSection.classList.contains("hidden");
  const isScrolledDown = window.scrollY > 300;

  btn.classList.toggle("show", isNotHome || isScrolledDown);
}

function goHomeTop() {
  setMobileTabActive(0);
  showSection("home");

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateHomeFloatButton();
  }, 80);
}

function scrollToPosts() {
  const postsSection = document.getElementById("postsSection");
  if (!postsSection) return;

  postsSection.scrollIntoView({ behavior: "smooth" });
}

function mobileScrollTo(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setTimeout(updateHomeFloatButton, 120);
  }, 80);
}

function setMobileTabActive(index) {
  const buttons = document.querySelectorAll(".mobile-tab-btn");

  buttons.forEach((button, i) => {
    button.classList.toggle("active", Number.isInteger(index) && i === index);
  });
}

function goMobileFeed() {
  setMobileTabActive(0);
  showSection("home");
  mobileScrollTo("postsSection");
}

function goMobileCreate() {
  setMobileTabActive(2);
  showSection("home");
  mobileScrollTo("createPanel");
}

function goMobileMap() {
  setMobileTabActive(1);
  showSection("map");
}

function goMobileWeather() {
  setMobileTabActive(3);
  showSection("home");
  mobileScrollTo("forecastPanel");
}

function goMobileProfile() {
  openKlevbyProfile();
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
    console.warn("Klevby profile: menu close skipped", error);
  }
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
    message.textContent = "Профиль сохранён.";
  }

  setTimeout(() => {
    closeProfileSettingsModal(false);
  }, 450);
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
    }

    setTimeout(updateHomeFloatButton, 120);

    return result;
  };

  window.__klevbyShowSectionPatched = true;
}

function initKlevbyProfileUi() {
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
}

window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.updateHomeFloatButton = updateHomeFloatButton;
window.goHomeTop = goHomeTop;
window.scrollToPosts = scrollToPosts;
window.mobileScrollTo = mobileScrollTo;
window.setMobileTabActive = setMobileTabActive;
window.goMobileFeed = goMobileFeed;
window.goMobileCreate = goMobileCreate;
window.goMobileMap = goMobileMap;
window.goMobileWeather = goMobileWeather;
window.goMobileProfile = goMobileProfile;

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
