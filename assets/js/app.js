const KLEVB_CONFIG = window.KLEVB_CONFIG || {};

const SUPABASE_URL = KLEVB_CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = KLEVB_CONFIG.SUPABASE_ANON_KEY || "";
const SUPABASE_STORAGE_KEY = KLEVB_CONFIG.SUPABASE_STORAGE_KEY || "sb-klevby-auth-token";
const TELEGRAM_GROUP = KLEVB_CONFIG.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";
const ADMIN_EMAIL = KLEVB_CONFIG.ADMIN_EMAIL || "";
const CARD_IMAGES = Array.isArray(KLEVB_CONFIG.CARD_IMAGES) ? KLEVB_CONFIG.CARD_IMAGES : [];

window.klevbyAdminEmail = ADMIN_EMAIL;
window.KLEVB_ADMIN_EMAIL = ADMIN_EMAIL;
window.ADMIN_EMAIL = ADMIN_EMAIL;

let supabaseClient = null;
let posts = [];
let currentUser = null;
let viewMode = "all";
let editingId = null;
let activeModalPost = null;
let postModalCloseTimer = null;
let authMode = "register";
let authRestoreTimer = null;
let authRestoreInProgress = false;
let lastAuthRestoreAt = 0;
let authReady = false;

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
  return Boolean(currentUser && currentUser.email === ADMIN_EMAIL);
}

function syncGlobalAuthState() {
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

  window.dispatchEvent(new CustomEvent("klevby-auth-changed", {
    detail: {
      user: currentUser,
      isAdmin: isAdmin(),
      adminEmail: ADMIN_EMAIL,
      supabase: supabaseClient
    }
  }));
}

function reloadPondsIfReady() {
  syncGlobalAuthState();

  if (typeof window.klevbyLoadPonds === "function") {
    window.klevbyLoadPonds();
  }

  if (typeof window.klevbyInitPonds === "function") {
    window.klevbyInitPonds();
  }

  if (typeof window.loadPonds === "function") {
    window.loadPonds();
  }
}

function initSupabase() {
  if (!window.supabase) {
    showStatus("Supabase не загрузился. Обнови страницу.", true);
    return false;
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
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || currentUser || null;
      authReady = true;

      if (!session?.user && _event === "SIGNED_OUT") {
        currentUser = null;
      }

      syncGlobalAuthState();

      if (typeof window.updateAuthStatus === "function") {
        window.updateAuthStatus();
      }

      if (typeof window.fillAuthorLocal === "function") {
        window.fillAuthorLocal();
      }

      if (typeof window.renderPosts === "function") {
        window.renderPosts();
      }

      reloadPondsIfReady();
    });
  }

  syncGlobalAuthState();
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

window.addEventListener("scroll", () => {
  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
}, { passive: true });

window.addEventListener("resize", () => {
  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
});

function showSection(section) {
  document.getElementById("homeSection").classList.toggle("hidden", section !== "home");
  document.getElementById("marketSection").classList.toggle("hidden", section !== "market");
  document.getElementById("pondsSection").classList.toggle("hidden", section !== "ponds");
  document.getElementById("mapSection").classList.toggle("hidden", section !== "map");
  document.getElementById("authSection").classList.toggle("hidden", section !== "auth");

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
    window.klevbyLoadMarket();
  }

  if (section === "ponds") {
    reloadPondsIfReady();
  }

  if (section === "map" && typeof window.klevbyReloadMap === "function") {
    setTimeout(() => window.klevbyReloadMap(), 300);
  }

  setTimeout(() => {
    if (typeof window.updateHomeFloatButton === "function") {
      window.updateHomeFloatButton();
    }
  }, 80);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMode(mode) {
  viewMode = mode;
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

document.addEventListener("keydown", function(event) {
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

    if (typeof window.loadPosts === "function") {
      await window.loadPosts();
    }
  }

  if (typeof window.updateHomeFloatButton === "function") {
    window.updateHomeFloatButton();
  }
});
