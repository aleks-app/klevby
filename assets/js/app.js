const KLEVB_CONFIG = window.KLEVB_CONFIG || {};

const SUPABASE_URL = KLEVB_CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = KLEVB_CONFIG.SUPABASE_ANON_KEY || "";
const SUPABASE_STORAGE_KEY = KLEVB_CONFIG.SUPABASE_STORAGE_KEY || "sb-klevby-auth-token";
const TELEGRAM_GROUP = KLEVB_CONFIG.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
const ADMIN_EMAIL = KLEVB_CONFIG.ADMIN_EMAIL || "";

window.__klevbyCentralResumeRouter = true;

window.klevbyAdminEmail = ADMIN_EMAIL;
window.KLEVB_ADMIN_EMAIL = ADMIN_EMAIL;
window.ADMIN_EMAIL = ADMIN_EMAIL;

let supabaseClient = window.klevbyGetSupabase?.() || null;
let currentUser = null;
let viewMode = "all";
let authMode = "register";
let authReady = false;

let posts = [];
let editingId = null;
let activeModalPost = null;
let postModalCloseTimer = null;

let authRestoreTimer = null;
let authRestoreInProgress = false;
let lastAuthRestoreAt = 0;
let authLogoutInProgress = false;
let lastLogoutAt = (() => {
  const values = [Number(window.klevbyLastLogoutAt || 0) || 0];

  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((store) => {
    try {
      values.push(Number(store.getItem("klevby_recent_logout_at") || 0) || 0);
    } catch (_) {}
  });

  return Math.max(...values);
})();

window.klevbyLastLogoutAt = lastLogoutAt;
window.klevbyAuthLogoutInProgress = authLogoutInProgress;

let lastAuthEventSignature = "";
let lastAuthEventAt = 0;

let pondsReloadTimer = null;
let pondsReloadInProgress = false;
let lastPondsReloadAt = 0;

function ensureAppSplashSafety() {
  if (
    window.KlevbyAppSplash &&
    typeof window.KlevbyAppSplash.hideAppSplash === "function"
  ) {
    return;
  }

  const fallbackSplashStartedAt = Date.now();

  function fallbackHideAppSplash() {
    const splash = document.getElementById("appSplash");
    if (!splash) return;

    const minVisibleTime = 2500;
    const elapsed = Date.now() - fallbackSplashStartedAt;
    const delay = Math.max(0, minVisibleTime - elapsed);

    setTimeout(() => {
      if (!splash || !splash.parentNode) return;

      splash.classList.add("hide");

      setTimeout(() => {
        if (splash && splash.parentNode) {
          splash.remove();
        }
      }, 800);
    }, delay);
  }

  if (typeof window.hideAppSplash !== "function") {
    window.hideAppSplash = fallbackHideAppSplash;
  }

  window.addEventListener("load", fallbackHideAppSplash);
  setTimeout(fallbackHideAppSplash, 5200);
}

ensureAppSplashSafety();

function getAppNavigation() {
  return window.KlevbyAppNavigation || {};
}

function getAppProfilePatches() {
  return window.KlevbyAppProfilePatches || {};
}

function getAppMobileActions() {
  return window.KlevbyAppMobileActions || {};
}

function getAppUiHelpers() {
  return window.KlevbyAppUiHelpers || {};
}

function getAppFilters() {
  return window.KlevbyAppFilters || {};
}

function getAppGlobalEvents() {
  return window.KlevbyAppGlobalEvents || {};
}

function getAppTripActions() {
  return window.KlevbyAppTripActions || {};
}

function getAppWindowExports() {
  return window.KlevbyAppWindowExports || {};
}

function getAppPondsBridge() {
  return window.KlevbyAppPondsBridge || {};
}

function isAdmin() {
  return Boolean(
    currentUser &&
    ADMIN_EMAIL &&
    String(currentUser.email || "").toLowerCase() === String(ADMIN_EMAIL).toLowerCase()
  );
}

function getAuthEventSignature() {
  return [
    currentUser?.id || "guest",
    currentUser?.email || "",
    isAdmin() ? "admin" : "user",
    authReady ? "ready" : "not-ready"
  ].join("|");
}

function syncGlobalAuthState(options = {}) {
  const shouldNotify = Boolean(options.notify);
  const forceNotify = Boolean(options.forceNotify);

  if (window.KlevbySupabaseCompatGlobals?.syncCompatGlobals) {
    window.KlevbySupabaseCompatGlobals.syncCompatGlobals();
  } else {
    window.klevbySupabase = supabaseClient;
    window.supabaseClient = supabaseClient;
  }

  window.klevbyCurrentUser = currentUser;
  window.currentUser = currentUser;
  window.klevbyUser = currentUser;

  window.klevbyAdminEmail = ADMIN_EMAIL;
  window.KLEVB_ADMIN_EMAIL = ADMIN_EMAIL;
  window.ADMIN_EMAIL = ADMIN_EMAIL;

  window.klevbyIsCurrentUserAdmin = isAdmin();
  window.isKlevbyAdmin = isAdmin();

  window.klevbyViewMode = viewMode;
  window.klevbyAuthReady = authReady;

  if (!shouldNotify && !forceNotify) {
    return;
  }

  const now = Date.now();
  const signature = getAuthEventSignature();
  const changed = signature !== lastAuthEventSignature;
  const enoughTimePassed = now - lastAuthEventAt > 1500;

  if (!forceNotify && !changed && !enoughTimePassed) {
    return;
  }

  lastAuthEventSignature = signature;
  lastAuthEventAt = now;

  window.dispatchEvent(new CustomEvent("klevby-auth-changed", {
    detail: {
      user: currentUser,
      isAdmin: isAdmin(),
      adminEmail: ADMIN_EMAIL,
      supabase: supabaseClient
    }
  }));
}

function reloadPondsIfReady(options = {}) {
  const bridge = getAppPondsBridge();

  if (typeof bridge.reloadPondsIfReady === "function") {
    return bridge.reloadPondsIfReady(options, {
      syncGlobalAuthState
    });
  }

  const force = Boolean(options.force);
  const delay = Number(options.delay || 450);

  clearTimeout(pondsReloadTimer);

  pondsReloadTimer = setTimeout(async () => {
    const now = Date.now();

    if (!force && pondsReloadInProgress) return;
    if (!force && now - lastPondsReloadAt < 1600) return;

    pondsReloadInProgress = true;
    lastPondsReloadAt = now;

    try {
      syncGlobalAuthState();

      if (typeof window.klevbyInitPonds === "function") {
        window.klevbyInitPonds();
        return;
      }

      if (typeof window.klevbyLoadPonds === "function") {
        await window.klevbyLoadPonds();
        return;
      }

      if (typeof window.loadPonds === "function") {
        await window.loadPonds();
      }
    } catch (error) {
      console.warn("Klevby ponds: не удалось обновить раздел прудов:", error);
    } finally {
      pondsReloadInProgress = false;
    }
  }, delay);

  return true;
}

let supabaseRecoveryInProgress = false;

async function recoverSupabaseClient(options = {}) {
  if (supabaseRecoveryInProgress) return Boolean(supabaseClient);

  supabaseRecoveryInProgress = true;

  try {
    console.warn("Klevby: recovering Supabase client", {
      reason: options.reason || "unknown",
      step: options.step || "unknown"
    });

    if (!supabaseClient) {
      const ok = initSupabase();
      syncGlobalAuthState({ notify: true, forceNotify: true });
      return Boolean(ok && supabaseClient);
    }

    if (supabaseClient?.realtime?.removeAllChannels) {
      try {
        await supabaseClient.realtime.removeAllChannels();
      } catch (error) {
        console.warn("Klevby: realtime cleanup before recovery failed", error);
      }
    }

    if (supabaseClient?.auth?.getSession) {
      try {
        await supabaseClient.auth.getSession();
      } catch (error) {
        console.warn("Klevby: auth session refresh during recovery failed", error);
      }
    }

    syncGlobalAuthState({ notify: true, forceNotify: true });
    return Boolean(supabaseClient);
  } catch (error) {
    console.warn("Klevby: Supabase recovery failed", error);
    return false;
  } finally {
    supabaseRecoveryInProgress = false;
  }
}

window.klevbyRecoverSupabaseClient = recoverSupabaseClient;

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showStatus("Supabase не настроен. Проверь assets/js/config.js.", true);
    console.error("Klevby: SUPABASE_URL или SUPABASE_ANON_KEY пустые.");
    return false;
  }

  if (!window.supabase) {
    showStatus("Supabase не загрузился. Обнови страницу.", true);
    console.error("Klevby: библиотека Supabase не загружена.");
    return false;
  }

  if (supabaseClient) {
    syncGlobalAuthState();
    return true;
  }

  if (!window.KlevbySupabaseCore || typeof window.KlevbySupabaseCore.initClient !== "function") {
    showStatus("Supabase клиент не удалось создать. Обнови страницу.", true);
    console.error("Klevby: Supabase core module is not available.");
    return false;
  }

  supabaseClient = window.KlevbySupabaseCore.initClient({
    supabaseLib: window.supabase,
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    options: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_STORAGE_KEY,
        flowType: "pkce"
      },
      global: {
        fetch: (...args) => fetch(...args)
      }
    }
  });

  if (!supabaseClient) {
    showStatus("Supabase клиент не удалось создать. Обнови страницу.", true);
    console.error("Klevby: failed to initialize Supabase client via core module.");
    return false;
  }

  if (window.KlevbySupabaseCompatGlobals?.syncCompatGlobals) {
    window.KlevbySupabaseCompatGlobals.syncCompatGlobals();
  } else {
    window.klevbySupabase = supabaseClient;
    window.supabaseClient = supabaseClient;
  }

  window.klevbyGetCurrentUser = function () {
    return currentUser;
  };

  window.klevbyIsAdmin = function () {
    return isAdmin();
  };

  const authStateHandler = async (event, session) => {
    const previousUserId = currentUser?.id || null;
    const signedInUser = event === "SIGNED_IN" && session?.user ? session.user : null;

    if (signedInUser && typeof window.clearAuthLogoutGuardForFreshLogin === "function") {
      window.clearAuthLogoutGuardForFreshLogin();
    }

    const logoutGuardActive =
      typeof isAuthLogoutGuardActive === "function"
        ? isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);

    if (signedInUser) {
      currentUser = signedInUser;
    } else if (event === "SIGNED_OUT" || logoutGuardActive) {
      currentUser = null;

      if (logoutGuardActive && typeof window.clearKnownAuthStorageKeys === "function") {
        window.clearKnownAuthStorageKeys();
      }

      if (typeof window.resetGuestProfileAfterLogout === "function") {
        window.resetGuestProfileAfterLogout();
      }
    } else if (session && session.user) {
      currentUser = session.user;
    }

    authReady = true;

    const newUserId = currentUser?.id || null;
    const userChanged = previousUserId !== newUserId;

    syncGlobalAuthState({
      notify: true,
      forceNotify: userChanged || event === "SIGNED_IN" || event === "SIGNED_OUT"
    });

    if (typeof window.updateAuthStatus === "function") {
      window.updateAuthStatus();
    }

    if (typeof window.fillAuthorLocal === "function") {
      window.fillAuthorLocal();
    }

    if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }

    if (typeof window.renderProfileFeed === "function") {
      window.renderProfileFeed();
    }

    if (event === "SIGNED_IN" && currentUser?.id) {
      reloadProfilePhotosAfterAuthSignIn();
    }

    if (userChanged || event === "SIGNED_IN" || event === "SIGNED_OUT") {
      reloadPondsIfReady({ delay: 700 });
    }
  };

  if (window.KlevbySupabaseAuthService?.bindAuthStateListener) {
    window.KlevbySupabaseAuthService.bindAuthStateListener({
      client: supabaseClient,
      callback: authStateHandler
    });
  } else if (supabaseClient.auth && typeof supabaseClient.auth.onAuthStateChange === "function") {
    supabaseClient.auth.onAuthStateChange(authStateHandler);
  }

  syncGlobalAuthState({ notify: true, forceNotify: true });
  return true;
}


function reloadProfilePhotosAfterAuthSignIn() {
  const photos = window.KlevbyProfilePhotos;
  const reload =
    (typeof photos?.markProfilePhotosDirtyAfterLogin === "function" && photos.markProfilePhotosDirtyAfterLogin) ||
    (typeof photos?.reloadProfilePhotosAfterLogin === "function" && photos.reloadProfilePhotosAfterLogin) ||
    null;

  if (!reload) {
    return;
  }

  Promise.resolve()
    .then(() => reload.call(photos))
    .then(() => {
      if (typeof window.updateKlevbyProfileView === "function") {
        window.updateKlevbyProfileView();
      }
    })
    .catch((error) => {
      console.warn("Klevby auth: фото профиля не обновились после SIGNED_IN", error);
    });
}

function showStatus(message, isError = false) {
  const helpers = getAppUiHelpers();

  if (typeof helpers.showStatus === "function") {
    helpers.showStatus(message, isError);
    return;
  }

  const status = document.getElementById("statusLine");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error-line", isError);
}

function showFormMessage(message, isError = false) {
  const helpers = getAppUiHelpers();

  if (typeof helpers.showFormMessage === "function") {
    helpers.showFormMessage(message, isError);
    return;
  }

  const el = document.getElementById("formMessage");
  if (!el) return;

  el.textContent = message;
  el.style.color = isError ? "#ffd2d2" : "rgba(245,245,245,0.66)";
}

function openTelegram() {
  const helpers = getAppUiHelpers();

  if (typeof helpers.openTelegram === "function") {
    helpers.openTelegram(TELEGRAM_GROUP);
    return;
  }

  window.open(TELEGRAM_GROUP, "_blank");
}

function getAppSections() {
  const navigation = getAppNavigation();

  if (typeof navigation.getAppSections === "function") {
    return navigation.getAppSections();
  }

  return [
    "homeSection",
    "feedSection",
    "tripsSection",
    "createSection",
    "marketSection",
    "pondsSection",
    "mapSection",
    "authSection",
    "profileSection"
  ];
}

function hideAllAppSectionsExcept(activeId) {
  const navigation = getAppNavigation();

  if (typeof navigation.hideAllAppSectionsExcept === "function") {
    navigation.hideAllAppSectionsExcept(activeId);
    return;
  }

  getAppSections().forEach((id) => {
    const section = document.getElementById(id);
    if (!section) return;

    section.classList.toggle("hidden", id !== activeId);
  });
}

function clearProfileChromeIfNeeded(section) {
  const navigation = getAppNavigation();

  if (typeof navigation.clearProfileChromeIfNeeded === "function") {
    navigation.clearProfileChromeIfNeeded(section);
    return;
  }

  if (section === "profile") return;

  try {
    if (typeof window.setProfileScreenChrome === "function") {
      window.setProfileScreenChrome(false);
    }

    if (typeof window.restoreMainTabbar === "function") {
      window.restoreMainTabbar();
    }

    sessionStorage.removeItem("klevby_profile_return_mode");
    window.__klevbyProfileReturnMode = false;
  } catch (error) {
    window.__klevbyProfileReturnMode = false;
  }
}

function setAppChromeMode(mode) {
  const navigation = getAppNavigation();

  if (typeof navigation.setAppChromeMode === "function") {
    return navigation.setAppChromeMode(mode);
  }

  const cleanMode =
    mode === "feed" ? "feed" :
    mode === "inner" ? "inner" :
    "home";
  const header = document.querySelector("header");

  if (header) {
    header.setAttribute("data-chrome-mode", cleanMode);
  }

  document.body.setAttribute("data-app-chrome-mode", cleanMode);
  return cleanMode;
}

function setMobileTabVisual(index) {
  const navigation = getAppNavigation();

  if (typeof navigation.setMobileTabVisual === "function") {
    navigation.setMobileTabVisual(index);
    return;
  }

  const buttons = Array.from(document.querySelectorAll(".mobile-tabbar .mobile-tab-btn"));

  buttons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", Number.isInteger(index) && buttonIndex === index);
  });
}

function getVisibleSectionName() {
  const navigation = getAppNavigation();

  if (typeof navigation.getVisibleSectionName === "function") {
    return navigation.getVisibleSectionName();
  }

  if (!document.getElementById("homeSection")?.classList.contains("hidden")) return "home";
  if (!document.getElementById("tripsSection")?.classList.contains("hidden")) return "trips";
  if (!document.getElementById("createSection")?.classList.contains("hidden")) return "create";
  if (!document.getElementById("mapSection")?.classList.contains("hidden")) return "map";
  if (!document.getElementById("marketSection")?.classList.contains("hidden")) return "market";
  if (!document.getElementById("pondsSection")?.classList.contains("hidden")) return "ponds";
  if (!document.getElementById("authSection")?.classList.contains("hidden")) return "auth";
  if (!document.getElementById("profileSection")?.classList.contains("hidden")) return "profile";

  return "home";
}

function closeMobileMenuFromAppNavigation() {
  try {
    if (typeof window.closeMobileMenuSafe === "function") {
      window.closeMobileMenuSafe();
      return;
    }

    if (typeof window.closeMobileMenu === "function") {
      window.closeMobileMenu();
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
    console.warn("Klevby navigation: не удалось закрыть мобильное меню.", error);
  }
}

let coldHomeBootPresentationFinalized = false;

function finalizeColdHomeBootPresentation() {
  const shellDebug = window.KlevbyShellDebug;
  shellDebug?.capture("finalizeColdHomeBootPresentation() start");

  let result = false;
  let reason = "already-finalized";

  if (!coldHomeBootPresentationFinalized) {
    const homeScreenOwner = window.KlevbyHomeScreenOwner;

    if (typeof homeScreenOwner?.isHomeScreenActive !== "function") {
      reason = "home-screen-owner-unavailable";
    } else if (!homeScreenOwner.isHomeScreenActive()) {
      reason = "home-screen-inactive";
    } else {
      coldHomeBootPresentationFinalized = true;
      showSection("home");
      result = true;
      reason = "finalized";
    }
  }

  shellDebug?.capture("finalizeColdHomeBootPresentation() end", { result, reason });
  return result;
}

function showSection(section) {
  const safeSection = String(section || "home").trim();
  const previousSection = getVisibleSectionName();
  const shouldCaptureShellSection = safeSection === "home" || safeSection === "feed";

  if (shouldCaptureShellSection) {
    window.KlevbyShellDebug?.capture(`showSection("${safeSection}") start`, { previousSection });
  }

  closeMobileMenuFromAppNavigation();

  setAppChromeMode(
    safeSection === "home" ? "home" :
    safeSection === "feed" ? "feed" :
    "inner"
  );

  if (safeSection === "profile") {
    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }
  }

  const sectionMap = {
    home: "homeSection",
    feed: "feedSection",
    trips: "tripsSection",
    create: "createSection",
    market: "marketSection",
    ponds: "pondsSection",
    map: "mapSection",
    auth: "authSection"
  };

  const activeId = sectionMap[safeSection] || "homeSection";

  clearProfileChromeIfNeeded(safeSection);
  hideAllAppSectionsExcept(activeId);

  if (typeof window.KlevbyHomeScreenOwner?.syncHomeScreenState === "function") {
    window.KlevbyHomeScreenOwner.syncHomeScreenState();
  }

  syncGlobalAuthState();

  if (safeSection === "home" || safeSection === "feed") {
    setMobileTabVisual(0);

    if (typeof window.renderProfileFeed === "function") {
      window.renderProfileFeed();
    }
  }

  if (safeSection === "trips") {
    setMobileTabVisual(0);

    if (typeof window.loadPosts === "function") {
      window.loadPosts({ force: true }).catch((error) => {
        console.warn("Klevby trips: не удалось загрузить объявления при открытии раздела:", error);
      });
    } else if (typeof window.renderPosts === "function") {
      window.renderPosts();
    }
  }

  if (safeSection === "create") {
    setMobileTabVisual(2);

    if (typeof window.fillAuthorLocal === "function") {
      window.fillAuthorLocal();
    }

    setTimeout(() => {
      const panel = document.getElementById("createPanel");
      if (panel) {
        panel.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }, 80);
  }

  if (safeSection === "auth") {
    setMobileTabVisual(null);

    if (typeof window.setAuthMode === "function") {
      window.setAuthMode(currentUser ? "login" : authMode);
    }

    if (typeof window.scheduleAuthRestore === "function") {
      window.scheduleAuthRestore("open_auth", false);
    }
  }

  if (safeSection === "market") {
    setMobileTabVisual(null);

    if (typeof window.klevbyLoadMarket === "function") {
      setTimeout(() => {
        window.klevbyLoadMarket();
      }, 250);
    }
  }

  if (safeSection === "ponds") {
    setMobileTabVisual(null);
    reloadPondsIfReady({ force: true, delay: 250 });
  }

  if (safeSection === "map") {
    setMobileTabVisual(1);

    window.klevbyEnsureMapInitialized?.().catch((error) => {
      console.warn("Klevby map: не удалось открыть карту:", error);
    });
  }

  setTimeout(() => {
    if (typeof window.updateHomeFloatButton === "function") {
      window.updateHomeFloatButton();
    }
  }, 80);

  if (safeSection !== "create") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (shouldCaptureShellSection) {
    window.KlevbyShellDebug?.capture(`showSection("${safeSection}") end`, { previousSection });

    if (safeSection === "home" && previousSection === "feed") {
      window.KlevbyShellDebug?.capture("after Feed → Home return");
    }
  }
}

function setAppViewMode(mode) {
  viewMode = mode === "mine" ? "mine" : "all";
  window.klevbyViewMode = viewMode;
  return viewMode;
}

function setProfileReturnMode(enabled) {
  const patches = getAppProfilePatches();

  if (typeof patches.setProfileReturnMode === "function") {
    return patches.setProfileReturnMode(enabled);
  }

  const value = Boolean(enabled);

  try {
    if (value) {
      sessionStorage.setItem("klevby_profile_return_mode", "1");
    } else {
      sessionStorage.removeItem("klevby_profile_return_mode");
    }

    window.__klevbyProfileReturnMode = value;
  } catch (error) {
    window.__klevbyProfileReturnMode = value;
  }

  return value;
}

function setMode(mode) {
  closeMobileMenuFromAppNavigation();

  const actions = getAppTripActions();

  if (typeof actions.setMode === "function") {
    return actions.setMode(mode, {
      setViewMode: setAppViewMode,
      setMineTripsMode: window.KlevbyPostsState?.setMineTripsMode,
      showSection
    });
  }

  setAppViewMode(mode);

  if (viewMode === "mine") {
    window.KlevbyPostsState?.setMineTripsMode?.("active");
  }

  showSection("trips");

  if (typeof window.renderPosts === "function") {
    window.renderPosts();
  }

  return viewMode;
}

function setMineTripsMode(mode) {
  const actions = getAppTripActions();
  const setStateMode = window.KlevbyPostsState?.setMineTripsMode;

  if (typeof actions.setMineTripsMode === "function") {
    return actions.setMineTripsMode(mode, {
      setMineTripsMode: setStateMode
    });
  }

  const nextMode = typeof setStateMode === "function"
    ? setStateMode(mode)
    : (mode === "expired" ? "expired" : "active");

  window.klevbyMineTripsMode = nextMode;

  if (typeof window.renderPosts === "function") {
    window.renderPosts();
  }

  return nextMode;
}

function showCreatePostScreen(options = {}) {
  closeMobileMenuFromAppNavigation();

  const actions = getAppTripActions();

  if (typeof actions.showCreatePostScreen === "function") {
    return actions.showCreatePostScreen(options, {
      setProfileReturnMode,
      enterCreateMode: window.KlevbyPostsForm?.enterCreateMode,
      showSection
    });
  }

  const fromProfile = Boolean(options.fromProfile);

  if (fromProfile) {
    setProfileReturnMode(true);
  }

  if (typeof window.KlevbyPostsForm?.enterCreateMode === "function") {
    window.KlevbyPostsForm.enterCreateMode();
  }

  showSection("create");
  return true;
}

function showTripsBoard(mode = "all") {
  closeMobileMenuFromAppNavigation();

  const actions = getAppTripActions();

  if (typeof actions.showTripsBoard === "function") {
    return actions.showTripsBoard(mode, {
      setViewMode: setAppViewMode,
      setMineTripsMode: window.KlevbyPostsState?.setMineTripsMode,
      showSection
    });
  }

  return setMode(mode);
}

function goMobileFeed() {
  closeMobileMenuFromAppNavigation();

  const actions = getAppMobileActions();

  if (typeof actions.goMobileFeed === "function") {
    actions.goMobileFeed({
      showSection
    });
    return;
  }

  showSection("home");
}

function goMobileMap() {
  closeMobileMenuFromAppNavigation();

  const actions = getAppMobileActions();

  if (typeof actions.goMobileMap === "function") {
    actions.goMobileMap({
      showSection
    });
    return;
  }

  showSection("map");
}

function goMobileCreate() {
  closeMobileMenuFromAppNavigation();

  const actions = getAppMobileActions();

  if (typeof actions.goMobileCreate === "function") {
    actions.goMobileCreate({
      showCreatePostScreen,
      showSection
    });
    return;
  }

  showCreatePostScreen();
}

function goMobileWeather() {
  closeMobileMenuFromAppNavigation();

  const actions = getAppMobileActions();

  if (typeof actions.goMobileWeather === "function") {
    actions.goMobileWeather({
      showSection
    });
    return;
  }

  showSection("home");

  setTimeout(() => {
    const panel = document.getElementById("forecastPanel");
    if (panel) {
      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, 120);
}

function goHomeTop() {
  closeMobileMenuFromAppNavigation();

  const actions = getAppMobileActions();

  if (typeof actions.goHomeTop === "function") {
    actions.goHomeTop({
      getVisibleSectionName,
      showSection,
      setMode
    });
    return;
  }

  const visibleSection = getVisibleSectionName();

  if (visibleSection === "profile") {
    showSection("home");
    return;
  }

  if (visibleSection === "create") {
    setMode("all");
    return;
  }

  showSection("home");
}

function resetFilters() {
  const filters = getAppFilters();

  if (typeof filters.resetFilters === "function") {
    filters.resetFilters();
    return;
  }

  const searchInput = document.getElementById("searchInput");
  const citySelect = document.getElementById("citySelect");
  const typeSelect = document.getElementById("typeSelect");
  const telegramOnly = document.getElementById("telegramOnly");

  if (searchInput) searchInput.value = "";
  if (citySelect) citySelect.value = "";
  if (typeSelect) typeSelect.value = "";
  if (telegramOnly) telegramOnly.checked = false;

  if (typeof window.renderPosts === "function") {
    window.renderPosts();
  }
}

function patchProfileOpenForExtraSections() {
  const patches = getAppProfilePatches();

  if (typeof patches.patchProfileOpenForExtraSections === "function") {
    return patches.patchProfileOpenForExtraSections();
  }

  if (patchProfileOpenForExtraSections.patched) return true;
  if (typeof window.openKlevbyProfile !== "function") return false;

  patchProfileOpenForExtraSections.originalOpenProfile = window.openKlevbyProfile;

  window.openKlevbyProfile = function patchedOpenKlevbyProfile() {
    hideAllAppSectionsExcept("profileSection");

    const originalOpenProfile = patchProfileOpenForExtraSections.originalOpenProfile;
    const result = typeof originalOpenProfile === "function"
      ? originalOpenProfile.apply(this, arguments)
      : undefined;

    const tripsSection = document.getElementById("tripsSection");
    const createSection = document.getElementById("createSection");

    if (tripsSection) tripsSection.classList.add("hidden");
    if (createSection) createSection.classList.add("hidden");

    setMobileTabVisual(null);

    return result;
  };

  patchProfileOpenForExtraSections.patched = true;
  return true;
}

function patchProfileShortcutActions() {
  const patches = getAppProfilePatches();

  if (typeof patches.patchProfileShortcutActions === "function") {
    return patches.patchProfileShortcutActions();
  }

  window.openProfileCreateView = function patchedOpenProfileCreateView() {
    showCreatePostScreen({ fromProfile: true });
  };

  window.openProfileTripsView = function patchedOpenProfileTripsView() {
    setProfileReturnMode(true);
    setMode("mine");
  };

  return true;
}

function handleGlobalScrollOrResize() {
  const globalEvents = getAppGlobalEvents();

  if (typeof globalEvents.handleGlobalScrollOrResize === "function") {
    return globalEvents.handleGlobalScrollOrResize();
  }

  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
}

function handleAppEscapeKey(event) {
  const globalEvents = getAppGlobalEvents();

  if (typeof globalEvents.handleAppEscapeKey === "function") {
    return globalEvents.handleAppEscapeKey(event);
  }

  if (event.key === "Escape" && typeof window.closePostModal === "function") {
    window.closePostModal();
  }
}

function setupAppGlobalEvents() {
  const globalEvents = getAppGlobalEvents();

  if (typeof globalEvents.setupGlobalEvents === "function") {
    return globalEvents.setupGlobalEvents({
      onScrollOrResize: handleGlobalScrollOrResize,
      onEscape: handleAppEscapeKey
    });
  }

  if (window.__klevbyAppGlobalEventsFallbackBound) {
    return false;
  }

  window.__klevbyAppGlobalEventsFallbackBound = true;

  window.addEventListener("scroll", handleGlobalScrollOrResize, { passive: true });
  window.addEventListener("resize", handleGlobalScrollOrResize);
  document.addEventListener("keydown", handleAppEscapeKey);

  return true;
}

const appResumeManager = window.KlevbyAppResumeManager?.create({
  syncGlobalAuthState,
  getVisibleSectionName,
  reloadPondsIfReady,
  getCurrentUser: () => currentUser,
  getSupabaseClient: () => supabaseClient
});

const markKlevbyResumeDebug = appResumeManager?.markKlevbyResumeDebug || (() => null);
const scheduleKlevbyAppResume = appResumeManager?.scheduleKlevbyAppResume || (() => false);
const handleKlevbyAppResume = appResumeManager?.handleKlevbyAppResume || (async () => false);
const refreshCurrentScreenAfterResume = appResumeManager?.refreshCurrentScreenAfterResume || (() => null);
const setupKlevbyAppLifecycle = appResumeManager?.setupKlevbyAppLifecycle || (() => null);

setupAppGlobalEvents();

async function initKlevbyApp() {
  try {
    patchProfileOpenForExtraSections();
    patchProfileShortcutActions();
    setupKlevbyAppLifecycle();

    const ok = initSupabase();
    if (!ok) return;

    if (typeof window.setAuthMode === "function") {
      window.setAuthMode("register");
    }

    if (typeof window.fillAuthorLocal === "function") {
      window.fillAuthorLocal();
    }

    if (typeof window.updateBiteForecast === "function") {
      window.updateBiteForecast(752);
    }

    if (typeof window.fetchWeather === "function") {
      window.fetchWeather();
      setInterval(window.fetchWeather, 1800000);
    }

    if (typeof window.initInstallPrompt === "function") {
      window.initInstallPrompt();
    }

    if (typeof window.registerPwaServiceWorker === "function") {
      window.registerPwaServiceWorker();
    }

    if (typeof window.initAuth === "function") {
      await window.initAuth();
    } else {
      authReady = true;
      syncGlobalAuthState({ notify: true, forceNotify: true });

      if (typeof window.loadPosts === "function") {
        await window.loadPosts({ force: true });
      }
    }

    if (typeof window.renderProfileFeed === "function") {
      window.renderProfileFeed();
    }

    if (typeof window.updateHomeFloatButton === "function") {
      window.updateHomeFloatButton();
    }
  } finally {
    if (appResumeManager && typeof appResumeManager.markBootCompleted === "function") {
      appResumeManager.markBootCompleted();
    }

    finalizeColdHomeBootPresentation();
  }
}

function startKlevbyAppWhenAllowed() {
  const appSurface = window.KlevbyAppSurface;

  if (appSurface && typeof appSurface.runWhenAllowed === "function") {
    appSurface.runWhenAllowed(initKlevbyApp);
    return;
  }

  initKlevbyApp();
}

document.addEventListener("DOMContentLoaded", startKlevbyAppWhenAllowed);

patchProfileOpenForExtraSections();
patchProfileShortcutActions();

function getAppWindowExportMap() {
  return {
    isAdmin,
    syncGlobalAuthState,
    reloadPondsIfReady,
    initSupabase,
    scheduleKlevbyAppResume,
    handleKlevbyAppResume,
    refreshCurrentScreenAfterResume,
    setupKlevbyAppLifecycle,
    showStatus,
    showFormMessage,
    openTelegram,
    getAppSections,
    hideAllAppSectionsExcept,
    clearProfileChromeIfNeeded,
    setMobileTabVisual,
    getVisibleSectionName,
    setAppChromeMode,
    closeMobileMenuFromAppNavigation,
    showSection,
    setMode,
    setMineTripsMode,
    showTripsBoard,
    showCreatePostScreen,
    goMobileFeed,
    goMobileMap,
    goMobileCreate,
    goMobileWeather,
    goHomeTop,
    resetFilters,
    handleGlobalScrollOrResize,
    handleAppEscapeKey,
    setupAppGlobalEvents,
    setAppViewMode,
    setProfileReturnMode,
    registerAppWindowExports,
    getAppWindowExportMap
  };
}

function registerAppWindowExports() {
  const exportsMap = getAppWindowExportMap();
  const exporter = getAppWindowExports();

  if (typeof exporter.registerAppWindowExports === "function") {
    return exporter.registerAppWindowExports(getAppWindowExportMap);
  }

  if (typeof exporter.registerWindowExports === "function") {
    return exporter.registerWindowExports(exportsMap);
  }

  Object.keys(exportsMap).forEach((key) => {
    window[key] = exportsMap[key];
  });

  return true;
}

registerAppWindowExports();
