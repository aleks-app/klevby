(function () {
  const KLEVB_SPLASH_MIN_VISIBLE_MS = 2500;
  const KLEVB_SPLASH_FORCE_HIDE_MS = 5200;

  const splashStartedAt = Date.now();

  function hideAppSplash() {
    const splash = document.getElementById("appSplash");
    if (!splash) return;

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

  window.addEventListener("load", hideAppSplash);
  setTimeout(hideAppSplash, KLEVB_SPLASH_FORCE_HIDE_MS);

  console.log("Klevby app splash loaded");
})();
