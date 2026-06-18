// Touchbar icons: assets/icons/touchbar/*.svg
const KLEVB_TAB_ICON_HOME = `
<svg class="mobile-tab-svg mobile-tab-svg--home" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
  <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
</svg>`;

const KLEVB_TAB_ICON_MAP = `
<svg class="mobile-tab-svg mobile-tab-svg--map" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 12.248 21.969 a 1 1 0 0 1 -0.849 -0.17 C 9.539 20.193 4 14.993 4 10 a 8 8 0 0 1 16 0 C 20 10.42 19.961 10.841 19.888 11.262" />
  <path d="m22 22-1.88-1.88" />
  <circle cx="12" cy="10" r="3" />
  <circle cx="18" cy="18" r="3" />
</svg>`;

const KLEVB_TAB_ICON_PLUS = `
<svg class="mobile-tab-svg mobile-tab-svg--plus" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 12h14" />
  <path d="M12 5v14" />
</svg>`;

const KLEVB_TAB_ICON_TRIPS = `
<svg class="mobile-tab-svg mobile-tab-svg--trips" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" />
  <path d="M7 14h.01" />
  <path d="M17 14h.01" />
  <rect width="18" height="8" x="3" y="10" rx="2" />
  <path d="M5 18v2" />
  <path d="M19 18v2" />
</svg>`;

const KLEVB_TAB_ICON_CHAT = `
<svg class="mobile-tab-svg mobile-tab-svg--chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  <path d="M7 11h10" />
  <path d="M7 15h6" />
  <path d="M7 7h8" />
</svg>`;

function setMobileTabbarMode(mode) {
  const tabbar = document.querySelector(".mobile-tabbar");
  const buttons = getMobileTabButtons();

  if (!tabbar || buttons.length < 5) return;

  const cleanMode = mode === "profile" ? "profile" : "home";

  window.__klevbyMobileTabbarMode = cleanMode;
  tabbar.setAttribute("data-mode", cleanMode);

  const homeTabs = [
    {
      icon: KLEVB_TAB_ICON_HOME,
      text: "Лента",
      action: goMobileFeed
    },
    {
      icon: KLEVB_TAB_ICON_MAP,
      text: "Карта",
      action: goMobileMap
    },
    {
      icon: KLEVB_TAB_ICON_PLUS,
      text: "Создать",
      action: goMobileCreate,
      create: true
    },
    {
      icon: KLEVB_TAB_ICON_TRIPS,
      text: "Выезды",
      action: goMobileTrips
    },
    {
      icon: KLEVB_TAB_ICON_CHAT,
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
  showSection("feed");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goMobileCreate() {
  setMobileTabbarMode("home");
  setMobileTabActive(2);

  if (typeof window.showCreatePostScreen === "function") {
    window.showCreatePostScreen({ source: "create-button" });
    return;
  }

  if (typeof window.showSection === "function") {
    window.showSection("create");
  }
}

function goMobileMap() {
  setMobileTabbarMode("home");
  setMobileTabActive(1);
  showSection("map");
}

function goMobileTrips() {
  setMobileTabbarMode("home");

  if (typeof setMode === "function") {
    setMode("all");
  } else if (typeof showSection === "function") {
    showSection("trips");
  }

  setMobileTabActive(3);
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
  mobileScrollTo("tripsSection");
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

function initMobileTabbar() {
  setMobileTabbarMode("home");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileTabbar);
} else {
  initMobileTabbar();
}

window.KlevbyUiTabbar = {
  setMobileTabbarMode,
  goHomeTop,
  goMobileFeed,
  goMobileCreate,
  goMobileMap,
  goMobileTrips,
  goMobileWeather,
  goMobileProfile,
  goMobileChat,
  goProfilePhotos,
  goProfileTrips,
  goProfileCreate,
  goProfileSettings
};

window.setMobileTabbarMode = setMobileTabbarMode;
window.goHomeTop = goHomeTop;
window.goMobileFeed = goMobileFeed;
window.goMobileCreate = goMobileCreate;
window.goMobileMap = goMobileMap;
window.goMobileTrips = goMobileTrips;
window.goMobileWeather = goMobileWeather;
window.goMobileProfile = goMobileProfile;
window.goMobileChat = goMobileChat;
window.goProfilePhotos = goProfilePhotos;
window.goProfileTrips = goProfileTrips;
window.goProfileCreate = goProfileCreate;
window.goProfileSettings = goProfileSettings;

console.log("Klevby UI tabbar loaded");
