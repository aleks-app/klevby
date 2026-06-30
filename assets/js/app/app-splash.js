(function () {
  const KLEVB_SPLASH_MIN_VISIBLE_MS = 2500;
  const KLEVB_SPLASH_FORCE_HIDE_MS = 5200;
  const KLEVB_SPLASH_CSS_READY_MAX_WAIT_MS = 12000;

  const splashStartedAt = Date.now();

  let cssReadyHidePending = false;

  function isMainCssReady() {
    const state = document.documentElement.dataset.klevbyMainCssReady;
    const mainCss = document.getElementById("klevbyMainCss");

    return state === "true" || state === "error" || state === "timeout" || !mainCss;
  }

  function markMainCssReady(state = "true") {
    const current = document.documentElement.dataset.klevbyMainCssReady;

    if (current === "true" || current === "error" || current === "timeout") return false;

    document.documentElement.dataset.klevbyMainCssReady = state;
    document.dispatchEvent(new Event("klevby:main-css-ready"));

    return true;
  }

  function markMainCssReadyTimedOut() {
    if (markMainCssReady("timeout")) {
      console.warn("Klevby app splash main CSS readiness timed out");
    }
  }

  function hideAppSplash() {
    const splash = document.getElementById("appSplash");
    if (!splash) return;

    if (!isMainCssReady()) {
      if (!cssReadyHidePending) {
        cssReadyHidePending = true;
        document.addEventListener("klevby:main-css-ready", hideAppSplash, { once: true });
      }
      return;
    }

    cssReadyHidePending = false;

    const elapsed = Date.now() - splashStartedAt;
    const delay = Math.max(0, KLEVB_SPLASH_MIN_VISIBLE_MS - elapsed);

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

  window.KlevbyAppSplash = {
    hideAppSplash
  };

  window.hideAppSplash = hideAppSplash;

  window.addEventListener("load", () => {
    markMainCssReady("true");
    hideAppSplash();
  });
  setTimeout(hideAppSplash, KLEVB_SPLASH_FORCE_HIDE_MS);
  setTimeout(markMainCssReadyTimedOut, KLEVB_SPLASH_CSS_READY_MAX_WAIT_MS);

  console.log("Klevby app splash loaded");
})();
