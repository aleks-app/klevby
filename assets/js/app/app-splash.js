(function () {
  "use strict";

  const KLEVB_SPLASH_MIN_VISIBLE_MS = 1500;
  const KLEVB_SPLASH_INTRO_ANIMATION_MS = 2400;
  const KLEVB_SPLASH_REDUCED_MIN_VISIBLE_MS = 1100;
  const KLEVB_SPLASH_REDUCED_INTRO_MS = 1100;
  const KLEVB_SPLASH_FORCE_HIDE_MS = 3400;
  const KLEVB_SPLASH_FADE_MS = 700;

  const splashStartedAt = performance.now();
  let shellReady = false;
  let hideCommitted = false;
  let evaluateTimer = null;

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function getMinVisibleMs() {
    return prefersReducedMotion() ? KLEVB_SPLASH_REDUCED_MIN_VISIBLE_MS : KLEVB_SPLASH_MIN_VISIBLE_MS;
  }

  function getIntroDurationMs() {
    return prefersReducedMotion() ? KLEVB_SPLASH_REDUCED_INTRO_MS : KLEVB_SPLASH_INTRO_ANIMATION_MS;
  }

  function getRequiredVisibleMs() {
    return Math.max(getMinVisibleMs(), getIntroDurationMs());
  }

  function setSplashActive(active) {
    document.body?.classList.toggle("klevby-splash-active", Boolean(active));
  }

  function getSplashNode() {
    return document.getElementById("appSplash");
  }

  function removeSplashNode(splash) {
    if (!splash || !splash.parentNode) return;
    splash.remove();
    setSplashActive(false);
    window.dispatchEvent(new CustomEvent("klevby-app-splash-hidden"));
  }

  function commitHide() {
    if (hideCommitted) return;
    hideCommitted = true;

    if (evaluateTimer) {
      window.clearTimeout(evaluateTimer);
      evaluateTimer = null;
    }

    const splash = getSplashNode();
    if (!splash) {
      setSplashActive(false);
      return;
    }

    splash.classList.add("hide");
    splash.setAttribute("aria-hidden", "true");

    window.setTimeout(() => {
      removeSplashNode(splash);
    }, KLEVB_SPLASH_FADE_MS);
  }

  function evaluateHide() {
    if (hideCommitted) return;

    const elapsed = performance.now() - splashStartedAt;
    const visualReady = elapsed >= getRequiredVisibleMs();
    const forceHide = elapsed >= KLEVB_SPLASH_FORCE_HIDE_MS;

    if (!visualReady && !forceHide) {
      scheduleEvaluate(getRequiredVisibleMs() - elapsed);
      return;
    }

    if (!shellReady && !forceHide) {
      scheduleEvaluate(80);
      return;
    }

    commitHide();
  }

  function scheduleEvaluate(delayMs) {
    if (hideCommitted) return;

    const safeDelay = Math.max(0, Math.min(Number(delayMs) || 0, KLEVB_SPLASH_FORCE_HIDE_MS));

    if (evaluateTimer) {
      window.clearTimeout(evaluateTimer);
    }

    evaluateTimer = window.setTimeout(() => {
      evaluateTimer = null;
      evaluateHide();
    }, safeDelay);
  }

  function markShellReady() {
    if (shellReady) return;
    shellReady = true;
    evaluateHide();
  }

  function hideAppSplashWhenShellReady() {
    markShellReady();
  }

  function hideAppSplash() {
    shellReady = true;
    evaluateHide();
  }

  setSplashActive(true);

  if (prefersReducedMotion()) {
    document.documentElement.classList.add("klevby-splash-reduced-motion");
  }

  window.KlevbyAppSplash = {
    hideAppSplash,
    hideAppSplashWhenShellReady,
    markShellReady,
    isSplashActive() {
      const splash = getSplashNode();
      if (!splash || hideCommitted) return false;
      return !splash.classList.contains("hide");
    },
  };

  window.hideAppSplash = hideAppSplash;

  window.addEventListener("klevby-app-shell-ready", hideAppSplashWhenShellReady);
  window.setTimeout(() => {
    shellReady = true;
    evaluateHide();
  }, KLEVB_SPLASH_FORCE_HIDE_MS);

  scheduleEvaluate(getRequiredVisibleMs());
})();
