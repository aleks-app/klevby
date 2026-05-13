const KLEVB_CONFIG = window.KLEVB_CONFIG || {};

const SUPABASE_URL = KLEVB_CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = KLEVB_CONFIG.SUPABASE_ANON_KEY || "";
const SUPABASE_STORAGE_KEY = KLEVB_CONFIG.SUPABASE_STORAGE_KEY || "sb-klevby-auth-token";
const TELEGRAM_GROUP = KLEVB_CONFIG.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
const ADMIN_EMAIL = KLEVB_CONFIG.ADMIN_EMAIL || "";

const KLEVB_APP_RESUME_DEBOUNCE_MS = 650;
const KLEVB_APP_RESUME_MIN_INTERVAL_MS = 1400;
const KLEVB_APP_RESUME_BURST_DELAYS = [350, 1600, 4200];

window.__klevbyCentralResumeRouter = true;

window.klevbyAdminEmail = ADMIN_EMAIL;
window.KLEVB_ADMIN_EMAIL = ADMIN_EMAIL;
window.ADMIN_EMAIL = ADMIN_EMAIL;

let supabaseClient = null;
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

let lastAuthEventSignature = "";
let lastAuthEventAt = 0;

let pondsReloadTimer = null;
let pondsReloadInProgress = false;
let lastPondsReloadAt = 0;

let klevbyAppResumeTimer = null;
let klevbyAppResumeInProgress = false;
let klevbyLastAppResumeAt = 0;
let klevbyAppHiddenAt = 0;

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

  window.klevbySupabase = supabaseClient;
  window.supabaseClient = supabaseClient;

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

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  });

  window.klevbySupabase = supabaseClient;
  window.supabaseClient = supabaseClient;

  window.klevbyGetSupabase = function () {
    return supabaseClient;
  };

  window.klevbyGetCurrentUser = function () {
    return currentUser;
  };

  window.klevbyIsAdmin = function () {
    return isAdmin();
  };

  if (supabaseClient.auth && typeof supabaseClient.auth.onAuthStateChange === "function") {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      const previousUserId = currentUser?.id || null;

      if (event === "SIGNED_OUT") {
        currentUser = null;
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

      if (userChanged || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        reloadPondsIfReady({ delay: 700 });
      }
    });
  }

  syncGlobalAuthState({ notify: true, forceNotify: true });
  return true;
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

function showSection(section) {
  const safeSection = String(section || "home").trim();

  if (safeSection === "profile") {
    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }
  }

  const sectionMap = {
    home: "homeSection",
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
  syncGlobalAuthState();

  if (safeSection === "home") {
    setMobileTabVisual(0);

    if (typeof window.renderProfileFeed === "function") {
      window.renderProfileFeed();
    }
  }

  if (safeSection === "trips") {
    setMobileTabVisual(0);

    if (typeof window.renderPosts === "function") {
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

    if (typeof window.klevbyReloadMap === "function") {
      setTimeout(() => {
        window.klevbyReloadMap();
      }, 300);
    }
  }

  setTimeout(() => {
    if (typeof window.updateHomeFloatButton === "function") {
      window.updateHomeFloatButton();
    }
  }, 80);

  if (safeSection !== "create") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function setAppViewMode(mode) {
  viewMode = mode === "mine" ? "mine" : "all";
  window.klevbyViewMode = viewMode;
  return viewMode;
}

function setProfileReturnMode(enabled) {
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
  const actions = getAppTripActions();

  if (typeof actions.setMode === "function") {
    return actions.setMode(mode, {
      setViewMode: setAppViewMode,
      showSection
    });
  }

  setAppViewMode(mode);
  showSection("trips");

  if (typeof window.renderPosts === "function") {
    window.renderPosts();
  }

  return viewMode;
}

function showCreatePostScreen(options = {}) {
  const actions = getAppTripActions();

  if (typeof actions.showCreatePostScreen === "function") {
    return actions.showCreatePostScreen(options, {
      setProfileReturnMode,
      showSection
    });
  }

  const fromProfile = Boolean(options.fromProfile);

  if (fromProfile) {
    setProfileReturnMode(true);
  }

  showSection("create");
  return true;
}

function showTripsBoard(mode = "all") {
  const actions = getAppTripActions();

  if (typeof actions.showTripsBoard === "function") {
    return actions.showTripsBoard(mode, {
      setViewMode: setAppViewMode,
      showSection
    });
  }

  return setMode(mode);
}

function goMobileFeed() {
  const actions = getAppMobileActions();

  if (typeof actions.goMobileFeed === "function") {
    actions.goMobileFeed();
    return;
  }

  showSection("home");
}

function goMobileMap() {
  const actions = getAppMobileActions();

  if (typeof actions.goMobileMap === "function") {
    actions.goMobileMap();
    return;
  }

  showSection("map");
}

function goMobileCreate() {
  const actions = getAppMobileActions();

  if (typeof actions.goMobileCreate === "function") {
    actions.goMobileCreate();
    return;
  }

  showCreatePostScreen();
}

function goMobileWeather() {
  const actions = getAppMobileActions();

  if (typeof actions.goMobileWeather === "function") {
    actions.goMobileWeather();
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
  const actions = getAppMobileActions();

  if (typeof actions.goHomeTop === "function") {
    actions.goHomeTop();
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
  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
}

function handleAppEscapeKey(event) {
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

function scheduleKlevbyAppResume(reason = "resume", options = {}) {
  clearTimeout(klevbyAppResumeTimer);

  klevbyAppResumeTimer = setTimeout(() => {
    handleKlevbyAppResume(reason, options);
  }, KLEVB_APP_RESUME_DEBOUNCE_MS);
}

async function handleKlevbyAppResume(reason = "resume", options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();

  if (klevbyAppResumeInProgress) return false;

  if (!force && now - klevbyLastAppResumeAt < KLEVB_APP_RESUME_MIN_INTERVAL_MS) {
    return false;
  }

  klevbyAppResumeInProgress = true;
  klevbyLastAppResumeAt = now;

  const sleptFor = klevbyAppHiddenAt ? now - klevbyAppHiddenAt : 0;

  try {
    syncGlobalAuthState({
      notify: true,
      forceNotify: true
    });

    if (typeof window.restoreAuthState === "function") {
      try {
        await window.restoreAuthState("app_resume_" + reason, false);
      } catch (error) {
        console.warn("Klevby: вход не восстановился после возврата:", reason, error);
      }
    }

    window.dispatchEvent(new CustomEvent("klevby-app-resumed", {
      detail: {
        reason,
        sleptFor,
        user: currentUser,
        supabase: supabaseClient,
        source: "app"
      }
    }));

    refreshCurrentScreenAfterResume(reason, {
      force: true,
      sleptFor
    });

    scheduleKlevbyResumeBurst(reason, sleptFor);

    return true;
  } catch (error) {
    console.warn("Klevby: ошибка пробуждения приложения:", reason, error);
    return false;
  } finally {
    klevbyAppResumeInProgress = false;
  }
}

function scheduleKlevbyResumeBurst(reason = "resume", sleptFor = 0) {
  KLEVB_APP_RESUME_BURST_DELAYS.forEach((delay, index) => {
    setTimeout(() => {
      if (document.visibilityState === "hidden") return;

      refreshCurrentScreenAfterResume(reason + "_burst_" + (index + 1), {
        burst: true,
        sleptFor
      });
    }, delay);
  });
}

function refreshCurrentScreenAfterResume(reason = "resume", options = {}) {
  const visibleSection = getVisibleSectionName();
  const isBurst = Boolean(options.burst);

  try {
    if (visibleSection === "home" || visibleSection === "profile") {
      if (typeof window.renderProfileFeed === "function") {
        const delay = isBurst ? 0 : 250;

        setTimeout(() => {
          try {
            window.renderProfileFeed();
          } catch (error) {
            console.warn("Klevby: лента не обновилась после resume:", reason, error);
          }
        }, delay);
      }

      if (!isBurst && typeof window.syncLocalProfilePhotosToSupabaseFeed === "function") {
        setTimeout(() => {
          try {
            window.syncLocalProfilePhotosToSupabaseFeed(true);
          } catch (error) {
            console.warn("Klevby: синхронизация фото не запустилась после resume:", reason, error);
          }
        }, 900);
      }
    }

    if (visibleSection === "trips") {
      if (typeof window.loadPosts === "function") {
        window.loadPosts({ force: true });
      } else if (typeof window.renderPosts === "function") {
        window.renderPosts();
      }
    }

    if (visibleSection === "market" && typeof window.klevbyLoadMarket === "function") {
      window.klevbyLoadMarket();
    }

    if (visibleSection === "ponds") {
      reloadPondsIfReady({ force: true, delay: 250 });
    }

    if (visibleSection === "map" && typeof window.klevbyReloadMap === "function") {
      window.klevbyReloadMap();
    }

    if (!isBurst && window.KlevbyChatLifecycle && typeof window.KlevbyChatLifecycle.scheduleChatResume === "function") {
      window.KlevbyChatLifecycle.scheduleChatResume(reason);
    }

    if (!isBurst && typeof window.klevbyReloadChatAfterResume === "function") {
      window.klevbyReloadChatAfterResume(reason);
    }
  } catch (error) {
    console.warn("Klevby: текущий экран не обновился после возврата:", error);
  }
}

function setupKlevbyAppLifecycle() {
  if (window.__klevbyAppLifecycleBound) return;

  window.__klevbyAppLifecycleBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      klevbyAppHiddenAt = Date.now();
      return;
    }

    scheduleKlevbyAppResume("visibilitychange", { force: true });
  });

  window.addEventListener("pageshow", () => {
    scheduleKlevbyAppResume("pageshow", { force: true });
  });

  window.addEventListener("focus", () => {
    scheduleKlevbyAppResume("focus", { force: false });
  });

  window.addEventListener("online", () => {
    scheduleKlevbyAppResume("online", { force: true });
  });
}

setupAppGlobalEvents();

document.addEventListener("DOMContentLoaded", async function () {
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
});

patchProfileOpenForExtraSections();
patchProfileShortcutActions();

window.isAdmin = isAdmin;
window.syncGlobalAuthState = syncGlobalAuthState;
window.reloadPondsIfReady = reloadPondsIfReady;
window.initSupabase = initSupabase;
window.scheduleKlevbyAppResume = scheduleKlevbyAppResume;
window.handleKlevbyAppResume = handleKlevbyAppResume;
window.refreshCurrentScreenAfterResume = refreshCurrentScreenAfterResume;
window.setupKlevbyAppLifecycle = setupKlevbyAppLifecycle;
window.showStatus = showStatus;
window.showFormMessage = showFormMessage;
window.openTelegram = openTelegram;
window.getAppSections = getAppSections;
window.hideAllAppSectionsExcept = hideAllAppSectionsExcept;
window.clearProfileChromeIfNeeded = clearProfileChromeIfNeeded;
window.setMobileTabVisual = setMobileTabVisual;
window.getVisibleSectionName = getVisibleSectionName;
window.showSection = showSection;
window.setMode = setMode;
window.showTripsBoard = showTripsBoard;
window.showCreatePostScreen = showCreatePostScreen;
window.goMobileFeed = goMobileFeed;
window.goMobileMap = goMobileMap;
window.goMobileCreate = goMobileCreate;
window.goMobileWeather = goMobileWeather;
window.goHomeTop = goHomeTop;
window.resetFilters = resetFilters;
window.handleGlobalScrollOrResize = handleGlobalScrollOrResize;
window.handleAppEscapeKey = handleAppEscapeKey;
window.setupAppGlobalEvents = setupAppGlobalEvents;
window.setAppViewMode = setAppViewMode;
window.setProfileReturnMode = setProfileReturnMode;
