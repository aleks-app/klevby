let deferredInstallPrompt = null;
let installBannerShown = false;

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function updatePwaInstallVisibility() {
  if (isStandaloneMode()) {
    document.documentElement.classList.add("pwa-standalone");
    document.body.classList.add("pwa-installed");
  } else {
    document.documentElement.classList.remove("pwa-standalone");
    document.body.classList.remove("pwa-installed");
  }
}

function shouldShowInstallBanner() {
  const closedAt = Number(localStorage.getItem("klevby_install_banner_closed_at") || "0");
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (closedAt && Date.now() - closedAt < sevenDays) {
    return false;
  }

  if (isStandaloneMode()) {
    return false;
  }

  return true;
}

function showInstallBanner() {
  if (installBannerShown || !shouldShowInstallBanner()) return;

  if (!deferredInstallPrompt && !isIosDevice()) return;

  const banner = document.getElementById("installBanner");
  if (!banner) return;

  installBannerShown = true;
  banner.classList.remove("hidden");

  requestAnimationFrame(() => {
    banner.classList.add("show");
  });
}

function hideInstallBanner(saveClose = false) {
  const banner = document.getElementById("installBanner");
  if (!banner) return;

  if (saveClose) {
    localStorage.setItem("klevby_install_banner_closed_at", String(Date.now()));
  }

  banner.classList.remove("show");

  setTimeout(() => {
    banner.classList.add("hidden");
  }, 350);
}

function openIosInstallModal() {
  hideInstallBanner(false);

  const modal = document.getElementById("iosInstallModal");
  if (!modal) return;

  modal.classList.remove("hidden");
}

function closeIosInstallModal() {
  const modal = document.getElementById("iosInstallModal");
  if (!modal) return;

  modal.classList.add("hidden");
}

async function handleInstallClick() {
  if (isStandaloneMode()) {
    updatePwaInstallVisibility();
    return;
  }

  if (isIosDevice()) {
    openIosInstallModal();
    return;
  }

  if (!deferredInstallPrompt) {
    alert("Если окно установки не появилось, открой сайт в Chrome или Edge и попробуй ещё раз. Иногда браузер показывает установку только после нескольких посещений сайта.");
    return;
  }

  deferredInstallPrompt.prompt();

  try {
    await deferredInstallPrompt.userChoice;
  } catch (error) {
    console.warn("Install prompt closed:", error);
  }

  deferredInstallPrompt = null;
  hideInstallBanner(true);
  updatePwaInstallVisibility();
}

function initInstallPrompt() {
  updatePwaInstallVisibility();

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;

    if (!shouldShowInstallBanner()) return;

    setTimeout(showInstallBanner, 2200);

    const showOnScroll = function () {
      showInstallBanner();
      window.removeEventListener("scroll", showOnScroll);
    };

    window.addEventListener("scroll", showOnScroll, { passive: true });
  });

  window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    hideInstallBanner(true);
    document.documentElement.classList.add("pwa-standalone");
    document.body.classList.add("pwa-installed");
  });

  if (isIosDevice() && shouldShowInstallBanner()) {
    setTimeout(showInstallBanner, 2600);
  }
}

async function forceAppUpdate() {
  const softReload = () => {
    window.location.reload();
  };

  if (!("serviceWorker" in navigator)) {
    softReload();
    return;
  }

  let reloaded = false;
  let fallbackReloadTimer = null;

  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    softReload();
  };

  const onControllerChange = function () {
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);

    if (fallbackReloadTimer) {
      clearTimeout(fallbackReloadTimer);
      fallbackReloadTimer = null;
    }

    reloadOnce();
  };

  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

  let hadWaitingWorker = false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map(async (registration) => {
        try {
          await registration.update();

          if (registration.waiting) {
            hadWaitingWorker = true;
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        } catch (error) {
          console.warn("Не удалось обновить Service Worker:", error);
        }
      })
    );
  } catch (error) {
    console.warn("Ошибка обновления приложения:", error);
  }

  if (hadWaitingWorker) {
    fallbackReloadTimer = setTimeout(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      reloadOnce();
    }, 2200);

    return;
  }

  navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  reloadOnce();
}

async function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none"
    });

    await registration.update();

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      console.log("Klevby Service Worker обновлён.");
    });

    console.log("Klevby Service Worker зарегистрирован: /sw.js");
  } catch (error) {
    console.warn("Service Worker не зарегистрирован. Проверь, что файл /sw.js лежит в корневой папке сайта.", error);
  }
}

window.isStandaloneMode = isStandaloneMode;
window.isIosDevice = isIosDevice;
window.updatePwaInstallVisibility = updatePwaInstallVisibility;
window.shouldShowInstallBanner = shouldShowInstallBanner;
window.showInstallBanner = showInstallBanner;
window.hideInstallBanner = hideInstallBanner;
window.openIosInstallModal = openIosInstallModal;
window.closeIosInstallModal = closeIosInstallModal;
window.handleInstallClick = handleInstallClick;
window.initInstallPrompt = initInstallPrompt;
window.forceAppUpdate = forceAppUpdate;
window.registerPwaServiceWorker = registerPwaServiceWorker;
