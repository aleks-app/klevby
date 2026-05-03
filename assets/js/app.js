const KLEVB_CONFIG = window.KLEVB_CONFIG || {};

const SUPABASE_URL = KLEVB_CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = KLEVB_CONFIG.SUPABASE_ANON_KEY || "";
const SUPABASE_STORAGE_KEY = KLEVB_CONFIG.SUPABASE_STORAGE_KEY || "sb-klevby-auth-token";
const TELEGRAM_GROUP = KLEVB_CONFIG.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
const ADMIN_EMAIL = KLEVB_CONFIG.ADMIN_EMAIL || "";

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

const splashStartedAt = Date.now();

function hideAppSplash() {
  const splash = document.getElementById("appSplash");
  if (!splash) return;

  const minVisibleTime = 2500;
  const elapsed = Date.now() - splashStartedAt;
  const delay = Math.max(0, minVisibleTime - elapsed);

  setTimeout(() => {
    splash.classList.add("hide");

    setTimeout(() => {
      splash.remove();
    }, 800);
  }, delay);
}

window.addEventListener("load", hideAppSplash);
setTimeout(hideAppSplash, 5200);

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

      if (userChanged || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        reloadPondsIfReady({ delay: 700 });
      }
    });
  }

  syncGlobalAuthState({ notify: true, forceNotify: true });
  return true;
}

function showStatus(message, isError = false) {
  const status = document.getElementById("statusLine");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error-line", isError);
}

function showFormMessage(message, isError = false) {
  const el = document.getElementById("formMessage");
  if (!el) return;

  el.textContent = message;
  el.style.color = isError ? "#ffd2d2" : "rgba(245,245,245,0.66)";
}

function openTelegram() {
  window.open(TELEGRAM_GROUP, "_blank");
}

function showSection(section) {
  const homeSection = document.getElementById("homeSection");
  const marketSection = document.getElementById("marketSection");
  const pondsSection = document.getElementById("pondsSection");
  const mapSection = document.getElementById("mapSection");
  const authSection = document.getElementById("authSection");

  if (homeSection) homeSection.classList.toggle("hidden", section !== "home");
  if (marketSection) marketSection.classList.toggle("hidden", section !== "market");
  if (pondsSection) pondsSection.classList.toggle("hidden", section !== "ponds");
  if (mapSection) mapSection.classList.toggle("hidden", section !== "map");
  if (authSection) authSection.classList.toggle("hidden", section !== "auth");

  syncGlobalAuthState();

  if (section === "auth") {
    if (typeof window.setAuthMode === "function") {
      window.setAuthMode(currentUser ? "login" : authMode);
    }

    if (typeof window.scheduleAuthRestore === "function") {
      window.scheduleAuthRestore("open_auth", false);
    }
  }

  if (section === "market" && typeof window.klevbyLoadMarket === "function") {
    setTimeout(() => {
      window.klevbyLoadMarket();
    }, 250);
  }

  if (section === "ponds") {
    reloadPondsIfReady({ force: true, delay: 250 });
  }

  if (section === "map" && typeof window.klevbyReloadMap === "function") {
    setTimeout(() => {
      window.klevbyReloadMap();
    }, 300);
  }

  setTimeout(() => {
    if (typeof window.updateHomeFloatButton === "function") {
      window.updateHomeFloatButton();
    }
  }, 80);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMode(mode) {
  viewMode = mode === "mine" ? "mine" : "all";
  window.klevbyViewMode = viewMode;

  showSection("home");

  if (typeof window.renderPosts === "function") {
    window.renderPosts();
  }
}

function resetFilters() {
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

function handleGlobalScrollOrResize() {
  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
}

window.addEventListener("scroll", handleGlobalScrollOrResize, { passive: true });
window.addEventListener("resize", handleGlobalScrollOrResize);

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && typeof window.closePostModal === "function") {
    window.closePostModal();
  }
});

document.addEventListener("DOMContentLoaded", async function () {
  const ok = initSupabase();
  if (!ok) return;

  if (typeof window.setupAuthResumeHandlers === "function") {
    window.setupAuthResumeHandlers();
  }

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

  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
});

window.isAdmin = isAdmin;
window.syncGlobalAuthState = syncGlobalAuthState;
window.reloadPondsIfReady = reloadPondsIfReady;
window.initSupabase = initSupabase;
window.showStatus = showStatus;
window.showFormMessage = showFormMessage;
window.openTelegram = openTelegram;
window.showSection = showSection;
window.setMode = setMode;
window.resetFilters = resetFilters;
