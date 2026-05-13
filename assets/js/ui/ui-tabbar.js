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
