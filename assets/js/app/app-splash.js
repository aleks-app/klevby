(function () {
  const KLEVB_SPLASH_MIN_VISIBLE_MS = 1200;
  const KLEVB_SPLASH_FORCE_HIDE_MS = 5200;

  const splashStartedAt = Date.now();
  let shellReadyHideRequested = false;
  let hideScheduled = false;

  function hideAppSplash() {
    if (hideScheduled) return;
    hideScheduled = true;

    const splash = document.getElementById("appSplash");
    if (!splash) return;

    const elapsed = Date.now() - splashStartedAt;
    const minVisible = shellReadyHideRequested
      ? Math.min(KLEVB_SPLASH_MIN_VISIBLE_MS, 900)
      : KLEVB_SPLASH_MIN_VISIBLE_MS;
    const delay = Math.max(0, minVisible - elapsed);

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

  function hideAppSplashWhenShellReady() {
    shellReadyHideRequested = true;
    hideAppSplash();
  }

  window.KlevbyAppSplash = {
    hideAppSplash,
    hideAppSplashWhenShellReady,
  };

  window.hideAppSplash = hideAppSplash;

  window.addEventListener("klevby-app-shell-ready", hideAppSplashWhenShellReady, { once: true });
  window.addEventListener("load", hideAppSplash);
  setTimeout(hideAppSplash, KLEVB_SPLASH_FORCE_HIDE_MS);
})();
