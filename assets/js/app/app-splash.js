(function () {
  "use strict";

  const SPLASH_STATE = {
    INITIAL: "initial",
    ANIMATING: "animating",
    COMPLETED: "completed",
    FADING_OUT: "fading-out",
    HIDDEN: "hidden",
  };

  const KLEVB_SPLASH_MIN_VISIBLE_MS = 2000;
  const KLEVB_SPLASH_INTRO_ANIMATION_MS = 1800;
  const KLEVB_SPLASH_REDUCED_MIN_VISIBLE_MS = 900;
  const KLEVB_SPLASH_REDUCED_INTRO_MS = 700;
  const KLEVB_SPLASH_FORCE_HIDE_MS = 4000;
  const KLEVB_SPLASH_FADE_MS = 350;
  const KLEVB_SPLASH_DEBUG_STORAGE_KEY = "klevgo:splashDebug";
  const KLEVB_SPLASH_DEBUG_FORCE_HIDE_MS = 30000;

  const splashStartedAt =
    typeof window.__KLEVBY_SPLASH_PAGE_START__ === "number"
      ? window.__KLEVBY_SPLASH_PAGE_START__
      : performance.now();

  let currentState = SPLASH_STATE.INITIAL;
  let initialStateAppliedAt = null;
  let animationClassAddedAt = null;
  let animationStartedAt = null;
  let animationCompletedAt = null;
  let shellReady = false;
  let shellReadyMarkedAt = null;
  let minDurationPassedAt = null;
  let fadeOutStartedAt = null;
  let splashHiddenAt = null;
  let hideReason = null;
  let hideCommitted = false;
  let evaluateTimer = null;
  let fadeRemoveScheduled = false;
  let animationCompletionTimer = null;
  let scriptLoadedAt = performance.now();
  let splashElementFound = false;
  let serviceWorkerCacheVersion = null;

  function isSplashDebugEnabled() {
    try {
      return window.localStorage.getItem(KLEVB_SPLASH_DEBUG_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function getSafetyTimeoutMs() {
    return isSplashDebugEnabled() ? KLEVB_SPLASH_DEBUG_FORCE_HIDE_MS : KLEVB_SPLASH_FORCE_HIDE_MS;
  }

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
    const splash = document.getElementById("appSplash");
    if (splash) splashElementFound = true;
    return splash;
  }

  function setSplashState(nextState) {
    const splash = getSplashNode();
    currentState = nextState;
    if (!splash) return;

    splash.setAttribute("data-splash-state", nextState);
    updateDebugLabel(nextState);
    splash.classList.remove(
      "splash-state-initial",
      "splash-state-animating",
      "splash-state-completed",
      "splash-state-fading-out",
      "splash-animate",
      "hide",
    );

    if (nextState === SPLASH_STATE.INITIAL) {
      splash.classList.add("splash-state-initial");
    } else if (nextState === SPLASH_STATE.ANIMATING) {
      splash.classList.add("splash-state-animating");
    } else if (nextState === SPLASH_STATE.COMPLETED) {
      splash.classList.add("splash-state-completed");
    } else if (nextState === SPLASH_STATE.FADING_OUT) {
      splash.classList.add("splash-state-fading-out", "hide");
    }
  }

  function updateDebugLabel(state) {
    if (!isSplashDebugEnabled()) return;
    const splash = getSplashNode();
    if (!splash) return;
    let label = splash.querySelector("[data-splash-debug-label]");
    if (!label) {
      label = document.createElement("div");
      label.setAttribute("data-splash-debug-label", "true");
      label.style.cssText = "position:absolute;left:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:1;padding:5px 8px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;";
      splash.appendChild(label);
    }
    label.textContent = `splash: ${state}`;
  }

  function bindDebugHoldRelease(splash) {
    if (!isSplashDebugEnabled() || !splash) return;
    const release = () => {
      if (hideCommitted) return;
      commitHide("debug-user-release");
    };
    splash.addEventListener("click", release, { once: true });
    splash.addEventListener("touchend", release, { once: true, passive: true });
  }

  function removeSplashNode(splash) {
    if (!splash || !splash.parentNode) return;
    splash.remove();
    splashHiddenAt = performance.now();
    currentState = SPLASH_STATE.HIDDEN;
    if (!hideReason) hideReason = "splash-removed";
    setSplashActive(false);
    window.dispatchEvent(new CustomEvent("klevby-app-splash-hidden"));
  }

  function applyInitialSplashState() {
    const splash = getSplashNode();
    if (!splash) return;

    splash.setAttribute("aria-hidden", "false");
    setSplashState(SPLASH_STATE.INITIAL);
    initialStateAppliedAt = performance.now();
  }

  function clearAnimationCompletionTimer() {
    if (animationCompletionTimer) {
      window.clearTimeout(animationCompletionTimer);
      animationCompletionTimer = null;
    }
  }

  function markAnimationCompleted(source) {
    if (animationCompletedAt != null) return;
    animationCompletedAt = performance.now();
    clearAnimationCompletionTimer();
    setSplashState(SPLASH_STATE.COMPLETED);
    hideReason = hideReason || `animation-complete:${source}`;
    evaluateHide();
  }

  function bindAnimationCompletionWatch(splash) {
    clearAnimationCompletionTimer();

    const introMs = getIntroDurationMs();
    animationCompletionTimer = window.setTimeout(() => {
      markAnimationCompleted("intro-timeout");
    }, introMs + 80);

    const animatedNodes = splash.querySelectorAll(
      ".splash-k, .splash-rest .letter, .splash-logo",
    );
    let pending = animatedNodes.length;

    const onAnimationEnd = () => {
      pending -= 1;
      if (pending <= 0) {
        markAnimationCompleted("animationend");
      }
    };

    animatedNodes.forEach((node) => {
      node.addEventListener("animationend", onAnimationEnd, { once: true });
    });
  }

  function startSplashAnimation() {
    const splash = getSplashNode();
    if (!splash || animationStartedAt != null) return;

    setSplashState(SPLASH_STATE.INITIAL);
    void splash.offsetWidth;

    animationClassAddedAt = performance.now();
    animationStartedAt = animationClassAddedAt;
    setSplashState(SPLASH_STATE.ANIMATING);
    bindAnimationCompletionWatch(splash);
    scheduleEvaluate(0);
  }

  function bootstrapSplashPresentation() {
    applyInitialSplashState();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        startSplashAnimation();
      });
    });
  }

  function commitHide(reason) {
    if (hideCommitted) return;
    hideCommitted = true;
    hideReason = reason || hideReason || "unknown";
    clearAnimationCompletionTimer();

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
    setSplashState(SPLASH_STATE.FADING_OUT);
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
    window.setTimeout(finalize, KLEVB_SPLASH_FADE_MS + 120);
  }

  function evaluateHide() {
    if (hideCommitted) return;

    const now = performance.now();
    const elapsed = now - splashStartedAt;
    const minVisibleMet = elapsed >= getMinVisibleMs();
    const introComplete = animationCompletedAt != null;
    const forceHide = elapsed >= getSafetyTimeoutMs();

    if (minVisibleMet && minDurationPassedAt == null) {
      minDurationPassedAt = now;
    }

    if (currentState === SPLASH_STATE.INITIAL && !forceHide) {
      scheduleEvaluate(32);
      return;
    }

    if (currentState === SPLASH_STATE.ANIMATING && !introComplete && !forceHide) {
      const waitForIntro =
        animationStartedAt != null
          ? Math.max(0, getIntroDurationMs() - (now - animationStartedAt))
          : getIntroDurationMs();
      scheduleEvaluate(Math.max(waitForIntro, 32));
      return;
    }

    if (!minVisibleMet && !forceHide) {
      scheduleEvaluate(Math.max(0, getMinVisibleMs() - elapsed));
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

    const safeDelay = Math.max(0, Math.min(Number(delayMs) || 0, getSafetyTimeoutMs()));

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
    const logo = splash?.querySelector(".splash-logo") || null;
    const k = splash?.querySelector(".splash-k") || logo || splash;
    const computed = k ? window.getComputedStyle(k) : null;
    const splashComputed = splash ? window.getComputedStyle(splash) : null;

    return {
      pageStartedAt: splashStartedAt,
      scriptLoadedAt,
      splashElementFound,
      startedAt: splashStartedAt,
      splashStartedAtMs: splashStartedAt,
      initialStateAppliedAt,
      animationClassAddedAt,
      animationStartedAt,
      animationCompletedAt,
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
      fadeDurationMs: KLEVB_SPLASH_FADE_MS,
      maxSafetyTimeoutMs: getSafetyTimeoutMs(),
      forceHideMs: getSafetyTimeoutMs(),
      hideReason,
      prefersReducedMotion: prefersReducedMotion(),
      currentState,
      currentClasses: splash?.className || null,
      computedOpacity: computed?.opacity ?? null,
      computedTransform: computed?.transform ?? null,
      computedFilter: computed?.filter ?? null,
      computedAnimationName: computed?.animationName ?? null,
      computedAnimationDuration: computed?.animationDuration ?? null,
      computedTransitionDuration: splashComputed?.transitionDuration ?? null,
      shellReady,
      hideCommitted,
      animationStarted: animationStartedAt != null,
      isActive: (() => {
        if (!splash || hideCommitted) return false;
        return currentState !== SPLASH_STATE.HIDDEN && !splash.classList.contains("hide");
      })(),
      bodySplashActive: document.body?.classList.contains("klevby-splash-active") === true,
      serviceWorkerCacheVersion,
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
    getState: () => currentState,
  };

  window.__KLEVBY_SPLASH_DIAGNOSTICS__ = {
    getSnapshot: buildDiagnosticsSnapshot,
    getJson() {
      return JSON.stringify(buildDiagnosticsSnapshot(), null, 2);
    },
  };

  window.hideAppSplash = hideAppSplash;

  window.addEventListener("klevby-app-shell-ready", hideAppSplashWhenShellReady);
  window.setTimeout(() => {
    shellReady = true;
    if (!shellReadyMarkedAt) shellReadyMarkedAt = performance.now();
    evaluateHide();
  }, getSafetyTimeoutMs());

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "KLEVB_SW_VERSION") {
      serviceWorkerCacheVersion = data.cacheName || data.buildVersion || null;
    }
  });

  try {
    window.navigator.serviceWorker?.controller?.postMessage?.({ type: "KLEVB_GET_SW_VERSION" });
  } catch (_) {}

  const initialSplash = document.getElementById("appSplash");
  if (initialSplash) {
    splashElementFound = true;
    bindDebugHoldRelease(initialSplash);
    bootstrapSplashPresentation();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapSplashPresentation, { once: true });
  } else {
    bootstrapSplashPresentation();
  }
})();
