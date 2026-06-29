(function () {
  "use strict";

  const KLEVB_SPLASH_MIN_VISIBLE_MS = 1800;
  const KLEVB_SPLASH_INTRO_ANIMATION_MS = 1500;
  const KLEVB_SPLASH_REDUCED_MIN_VISIBLE_MS = 900;
  const KLEVB_SPLASH_REDUCED_INTRO_MS = 650;
  const KLEVB_SPLASH_FORCE_HIDE_MS = 3500;
  const KLEVB_SPLASH_FADE_MS = 700;

  const splashStartedAt = performance.now();
  let initialStateAppliedAt = null;
  let animationStartedAt = null;
  let shellReady = false;
  let shellReadyMarkedAt = null;
  let minDurationPassedAt = null;
  let fadeOutStartedAt = null;
  let splashHiddenAt = null;
  let hideReason = null;
  let hideCommitted = false;
  let evaluateTimer = null;
  let fadeRemoveScheduled = false;

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

  function setSplashActive(active) {
    document.body?.classList.toggle("klevby-splash-active", Boolean(active));
  }

  function getSplashNode() {
    return document.getElementById("appSplash");
  }

  function removeSplashNode(splash) {
    if (!splash || !splash.parentNode) return;
    splash.remove();
    splashHiddenAt = performance.now();
    if (!hideReason) hideReason = "splash-removed";
    setSplashActive(false);
    window.dispatchEvent(new CustomEvent("klevby-app-splash-hidden"));
  }

  function applyInitialSplashState() {
    const splash = getSplashNode();
    if (!splash) return;

    splash.classList.remove("splash-animate", "hide");
    splash.setAttribute("aria-hidden", "false");
    initialStateAppliedAt = performance.now();
  }

  function startSplashAnimation() {
    const splash = getSplashNode();
    if (!splash || animationStartedAt != null) return;

    animationStartedAt = performance.now();
    splash.classList.add("splash-animate");
  }

  function bootstrapSplashPresentation() {
    applyInitialSplashState();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        startSplashAnimation();
        scheduleEvaluate(0);
      });
    });
  }

  function commitHide(reason) {
    if (hideCommitted) return;
    hideCommitted = true;
    hideReason = reason || hideReason || "unknown";

    if (evaluateTimer) {
      window.clearTimeout(evaluateTimer);
      evaluateTimer = null;
    }

    const splash = getSplashNode();
    if (!splash) {
      if (hideReason === "unknown") hideReason = "splash-node-missing";
      setSplashActive(false);
      return;
    }

    fadeOutStartedAt = performance.now();
    splash.classList.add("hide");
    splash.setAttribute("aria-hidden", "true");

    const finalize = () => {
      if (fadeRemoveScheduled) return;
      fadeRemoveScheduled = true;
      removeSplashNode(splash);
    };

    const onTransitionEnd = (event) => {
      if (event.target !== splash) return;
      if (event.propertyName !== "opacity" && event.propertyName !== "visibility") return;
      splash.removeEventListener("transitionend", onTransitionEnd);
      finalize();
    };

    splash.addEventListener("transitionend", onTransitionEnd);
    window.setTimeout(finalize, KLEVB_SPLASH_FADE_MS + 100);
  }

  function evaluateHide() {
    if (hideCommitted) return;

    const now = performance.now();
    const elapsed = now - splashStartedAt;
    const minVisibleMet = elapsed >= getMinVisibleMs();
    const introElapsed = animationStartedAt != null ? now - animationStartedAt : 0;
    const introComplete = animationStartedAt != null && introElapsed >= getIntroDurationMs();
    const forceHide = elapsed >= KLEVB_SPLASH_FORCE_HIDE_MS;

    if (minVisibleMet && minDurationPassedAt == null) {
      minDurationPassedAt = now;
    }

    if (!animationStartedAt && !forceHide) {
      scheduleEvaluate(32);
      return;
    }

    if ((!minVisibleMet || !introComplete) && !forceHide) {
      const waitForMin = Math.max(0, getMinVisibleMs() - elapsed);
      const waitForIntro =
        animationStartedAt != null
          ? Math.max(0, getIntroDurationMs() - introElapsed)
          : getIntroDurationMs();
      scheduleEvaluate(Math.max(waitForMin, waitForIntro, 32));
      return;
    }

    if (!shellReady && !forceHide) {
      scheduleEvaluate(80);
      return;
    }

    if (forceHide) {
      commitHide(shellReady ? "force-safety-timeout" : "force-safety-timeout-shell-not-ready");
      return;
    }

    commitHide("shell-and-visual-ready");
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
    shellReadyMarkedAt = performance.now();
    evaluateHide();
  }

  function hideAppSplashWhenShellReady() {
    markShellReady();
  }

  function hideAppSplash() {
    shellReady = true;
    if (!shellReadyMarkedAt) shellReadyMarkedAt = performance.now();
    evaluateHide();
  }

  function buildDiagnosticsSnapshot() {
    const now = performance.now();
    const elapsedMs = Math.round(now - splashStartedAt);
    const splash = getSplashNode();

    return {
      startedAt: splashStartedAt,
      splashStartedAtMs: splashStartedAt,
      initialStateAppliedAt,
      animationStartedAt,
      shellReadyAt: shellReadyMarkedAt,
      shellReadyMarkedAtMs: shellReadyMarkedAt,
      minDurationPassedAt,
      fadeOutStartedAt,
      hiddenAt: splashHiddenAt,
      splashHiddenAtMs: splashHiddenAt,
      visibleDurationMs:
        splashHiddenAt != null ? Math.round(splashHiddenAt - splashStartedAt) : elapsedMs,
      minDurationMs: getMinVisibleMs(),
      introDurationMs: getIntroDurationMs(),
      maxSafetyTimeoutMs: KLEVB_SPLASH_FORCE_HIDE_MS,
      forceHideMs: KLEVB_SPLASH_FORCE_HIDE_MS,
      hideReason,
      prefersReducedMotion: prefersReducedMotion(),
      shellReady,
      hideCommitted,
      animationStarted: animationStartedAt != null,
      isActive: (() => {
        if (!splash || hideCommitted) return false;
        return !splash.classList.contains("hide");
      })(),
      bodySplashActive: document.body?.classList.contains("klevby-splash-active") === true,
      elapsedMs,
    };
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
      return buildDiagnosticsSnapshot().isActive;
    },
    getDiagnosticsSnapshot: buildDiagnosticsSnapshot,
  };

  window.hideAppSplash = hideAppSplash;

  window.addEventListener("klevby-app-shell-ready", hideAppSplashWhenShellReady);
  window.setTimeout(() => {
    shellReady = true;
    if (!shellReadyMarkedAt) shellReadyMarkedAt = performance.now();
    evaluateHide();
  }, KLEVB_SPLASH_FORCE_HIDE_MS);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapSplashPresentation, { once: true });
  } else {
    bootstrapSplashPresentation();
  }
})();
