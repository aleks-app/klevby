const KLEVB_TAB_ICON_HOME = `
<svg class="mobile-tab-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 10.8 12 3l9 7.8" />
  <path d="M5.4 9.7V21h13.2V9.7" />
  <path d="M9.4 21v-6.2h5.2V21" />
</svg>`;

const KLEVB_TAB_ICON_MAP_PIN = `
<svg class="mobile-tab-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 21s7-5.3 7-12a7 7 0 0 0-14 0c0 6.7 7 12 7 12Z" />
  <circle cx="12" cy="9" r="2.4" />
</svg>`;

const KLEVB_TAB_ICON_CLOUD_SUN = `
<svg class="mobile-tab-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 7.2a4 4 0 0 1 4 4" />
  <path d="M20.5 3.5 19 5" />
  <path d="M22 11h-2" />
  <path d="M16 1.8v2" />
  <path d="M7.5 19.5h9.3a4 4 0 0 0 .2-8 5.7 5.7 0 0 0-10.9 1.7A3.2 3.2 0 0 0 7.5 19.5Z" />
</svg>`;

const KLEVB_TAB_ICON_CHAT = `
<svg class="mobile-tab-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 5.5h14a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H9l-5 3v-13.2a2 2 0 0 1 2-2Z" />
  <path d="M8 10.2h8" />
  <path d="M8 13.6h5.4" />
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
      icon: KLEVB_TAB_ICON_MAP_PIN,
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
      icon: KLEVB_TAB_ICON_CLOUD_SUN,
      text: "Погода",
      action: goMobileWeather
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

function closeMobileMenuFromTabbar() {
  if (typeof window.closeMobileMenuSafe === "function") {
    window.closeMobileMenuSafe();
    return;
  }

  if (typeof window.closeMobileMenu === "function") {
    window.closeMobileMenu();
  }
}

function goHomeTop() {
  closeMobileMenuFromTabbar();
  setMobileTabbarMode("home");
  setMobileTabActive(0);
  showSection("home");

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateHomeFloatButton();
  }, 80);
}

function goMobileFeed() {
  closeMobileMenuFromTabbar();
  setMobileTabbarMode("home");
  setMobileTabActive(0);
  showSection("home");
  mobileScrollTo("postsSection");
}

function goMobileCreate() {
  closeMobileMenuFromTabbar();
  setMobileTabbarMode("home");
  setMobileTabActive(2);
  showSection("home");
  mobileScrollTo("createPanel");
}

function goMobileMap() {
  closeMobileMenuFromTabbar();
  setMobileTabbarMode("home");
  setMobileTabActive(1);
  showSection("map");
}

function goMobileWeather() {
  closeMobileMenuFromTabbar();
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

window.KlevbyUiTabbar = {
  setMobileTabbarMode,
  goHomeTop,
  goMobileFeed,
  goMobileCreate,
  goMobileMap,
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
window.goMobileWeather = goMobileWeather;
window.goMobileProfile = goMobileProfile;
window.goMobileChat = goMobileChat;
window.goProfilePhotos = goProfilePhotos;
window.goProfileTrips = goProfileTrips;
window.goProfileCreate = goProfileCreate;
window.goProfileSettings = goProfileSettings;

console.log("Klevby UI tabbar loaded");
