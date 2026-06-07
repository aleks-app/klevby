(function () {
  "use strict";

  const STORAGE_KEY = "klevbyAndroidDiagnosticsEnabled";
  const BUTTON_CONTAINER_ID = "klevbyAndroidDiagnosticsControls";
  const LOGO_TAP_TARGET = 7;
  const LOGO_TAP_RESET_MS = 4000;

  const params = new URLSearchParams(window.location.search);
  const hasAndroidDebugFlag = params.get("klevbyAndroidDebug") === "1";
  const hasViewportDebugFlag = params.get("klevbyViewportDebug") === "1";
  const hasExplicitDebugFlag = hasAndroidDebugFlag || hasViewportDebugFlag;

  let logoTapCount = 0;
  let logoTapResetTimer = 0;
  let logoActivationBound = false;

  function readStorageEnabled() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setStorageEnabled(enabled) {
    try {
      if (enabled) {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }

  function isDiagnosticsEnabled() {
    return hasExplicitDebugFlag || readStorageEnabled();
  }

  function getCapacitorNativeState() {
    const capacitor = window.Capacitor;
    if (!capacitor || typeof capacitor.isNativePlatform !== "function") {
      return { capacitor, isNativePlatform: false };
    }

    try {
      return {
        capacitor,
        isNativePlatform: capacitor.isNativePlatform() === true
      };
    } catch (_) {
      return { capacitor, isNativePlatform: false };
    }
  }

  function isHomeActive() {
    const homeSection = document.getElementById("homeSection");
    const body = document.body;

    if (!homeSection || !body) return false;
    if (homeSection.classList.contains("hidden")) return false;
    return body.getAttribute("data-app-chrome-mode") === "home";
  }

  function getDiagnosticsJson() {
    return JSON.stringify(window.klevbyAndroidDiagnostics.collect(), null, 2);
  }

  function copyWithTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }

    textarea.remove();
    return copied;
  }

  function initDiagnosticsModule() {
    const { capacitor, isNativePlatform } = getCapacitorNativeState();

    if (!window.klevbyAndroidDiagnostics) {
      window.klevbyAndroidDiagnostics = {};
    }

    const diag = window.klevbyAndroidDiagnostics;

    diag.collect = function () {
      const home = document.querySelector("#homeSection");
      const touchBar = document.querySelector(".mobile-tabbar");
      const body = document.body;
      const html = document.documentElement;
      const bodyStyles = body ? getComputedStyle(body) : null;
      const htmlStyles = getComputedStyle(html);
      const touchBarStyles = touchBar ? getComputedStyle(touchBar) : null;

      return {
        timestamp: new Date().toISOString(),
        locationHref: window.location.href,
        documentReadyState: document.readyState,
        documentVisibilityState: document.visibilityState,
        capacitorPlatform:
          isNativePlatform && typeof capacitor.getPlatform === "function"
            ? capacitor.getPlatform()
            : "browser",
        isNativePlatform,
        debugFlags: {
          klevbyAndroidDebug: hasAndroidDebugFlag,
          klevbyViewportDebug: hasViewportDebugFlag,
          klevbyAndroidDiagnosticsEnabled: readStorageEnabled()
        },
        userAgent: navigator.userAgent,
        dpr: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              offsetTop: window.visualViewport.offsetTop,
              offsetLeft: window.visualViewport.offsetLeft,
              scale: window.visualViewport.scale
            }
          : null,
        homeSection: home ? home.getBoundingClientRect() : null,
        touchBar: touchBar ? touchBar.getBoundingClientRect() : null,
        body: body ? body.getBoundingClientRect() : null,
        html: html.getBoundingClientRect(),
        scroll: {
          bodyScrollTop: body ? body.scrollTop : null,
          documentElementScrollTop: html.scrollTop,
          windowScrollY: window.scrollY
        },
        computedStyles: {
          body: bodyStyles
            ? {
                overflow: bodyStyles.overflow,
                overflowX: bodyStyles.overflowX,
                overflowY: bodyStyles.overflowY,
                paddingBottom: bodyStyles.paddingBottom
              }
            : null,
          html: {
            overflow: htmlStyles.overflow,
            overflowX: htmlStyles.overflowX,
            overflowY: htmlStyles.overflowY,
            paddingBottom: htmlStyles.paddingBottom
          },
          touchBar: touchBarStyles
            ? {
                bottom: touchBarStyles.bottom,
                height: touchBarStyles.height
              }
            : null
        },
        appHeight: htmlStyles.getPropertyValue("--klevby-app-height"),
        homeScreenLock: {
          root: html.getAttribute("data-home-screen-lock") || null,
          body: body?.getAttribute("data-home-screen-lock") || null
        },
        chromeMode: body?.getAttribute("data-app-chrome-mode") || null,
        homeDensity: html.getAttribute("data-home-density") || null,
        compactMediaQuery: window.matchMedia("(max-width: 390px) and (max-height: 820px)").matches,
        homeScrollDiff: home ? home.scrollHeight - home.clientHeight : null
      };
    };

    diag.saveJSON = function () {
      const json = getDiagnosticsJson();
      const blob = new Blob([json], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = "klevby-android-diagnostics.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    };

    diag.copyJSON = async function () {
      const json = getDiagnosticsJson();
      console.log("[Klevby Android Diagnostics]", json);

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(json);
          return true;
        }
      } catch (_) {}

      return copyWithTextarea(json);
    };

    diag.shareJSON = async function () {
      if (!navigator.share || typeof navigator.share !== "function") return false;

      const json = getDiagnosticsJson();
      const file = new File([json], "klevby-android-diagnostics.json", {
        type: "application/json"
      });

      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Klevby Android Diagnostics"
          });
          return true;
        }
      } catch (_) {}

      try {
        await navigator.share({
          title: "Klevby Android Diagnostics",
          text: json
        });
        return true;
      } catch (_) {
        return false;
      }
    };

    diag.disable = function () {
      setStorageEnabled(false);
      removeDiagnosticsControls();
      bindLogoActivation();
    };
  }

  function createDiagnosticsButton(label, onClick, options) {
    const button = document.createElement("button");
    const opts = options || {};

    button.type = "button";
    button.textContent = label;
    button.style.position = "relative";
    button.style.display = "block";
    button.style.width = "100%";
    button.style.background = opts.background || "#F47A2B";
    button.style.color = opts.color || "#fff";
    button.style.padding = opts.padding || "8px 12px";
    button.style.border = "none";
    button.style.borderRadius = "6px";
    button.style.fontSize = opts.fontSize || "12px";
    button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    button.style.cursor = "pointer";
    button.addEventListener("click", onClick);

    return button;
  }

  function flashButtonLabel(button, successLabel, failureLabel, succeeded) {
    const originalText = button.textContent;
    button.textContent = succeeded ? successLabel : failureLabel;

    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1800);
  }

  function removeDiagnosticsControls() {
    const container = document.getElementById(BUTTON_CONTAINER_ID);
    if (container) container.remove();
  }

  function showDiagnosticsControls() {
    if (!window.klevbyAndroidDiagnostics || document.getElementById(BUTTON_CONTAINER_ID)) return;

    const container = document.createElement("div");
    container.id = BUTTON_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.bottom = "80px";
    container.style.left = "10px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "6px";
    container.style.maxWidth = "220px";

    const downloadButton = createDiagnosticsButton("Save Android Diagnostics", () => {
      window.klevbyAndroidDiagnostics.saveJSON();
    });
    container.appendChild(downloadButton);

    const copyButton = createDiagnosticsButton("Copy JSON", async () => {
      const copied = await window.klevbyAndroidDiagnostics.copyJSON();
      flashButtonLabel(copyButton, "JSON copied", "Copy failed", copied);
    });
    container.appendChild(copyButton);

    if (navigator.share && typeof navigator.share === "function") {
      const shareButton = createDiagnosticsButton("Share JSON", async () => {
        const shared = await window.klevbyAndroidDiagnostics.shareJSON();
        flashButtonLabel(shareButton, "Share opened", "Share failed", shared);
      });
      container.appendChild(shareButton);
    }

    const disableButton = createDiagnosticsButton(
      "Disable Diagnostics",
      () => {
        window.klevbyAndroidDiagnostics.disable();
      },
      {
        background: "rgba(8,12,10,0.92)",
        color: "#fff",
        fontSize: "11px",
        padding: "6px 10px"
      }
    );
    container.appendChild(disableButton);

    document.body.appendChild(container);
  }

  function activateDiagnosticsFromLogoGesture() {
    setStorageEnabled(true);
    initDiagnosticsModule();
    showDiagnosticsControls();
    console.log("[Klevby Android Diagnostics] Enabled via logo gesture.");
  }

  function bindLogoActivation() {
    if (logoActivationBound) return;

    const { isNativePlatform } = getCapacitorNativeState();
    if (!isNativePlatform) return;

    const logo = document.querySelector(".logo.app-header-logo, .logo.app-header-logo img");
    if (!logo) return;

    logo.addEventListener("click", () => {
      if (!isHomeActive()) return;

      logoTapCount += 1;
      window.clearTimeout(logoTapResetTimer);

      if (logoTapCount < LOGO_TAP_TARGET) {
        logoTapResetTimer = window.setTimeout(() => {
          logoTapCount = 0;
        }, LOGO_TAP_RESET_MS);
        return;
      }

      logoTapCount = 0;
      window.clearTimeout(logoTapResetTimer);
      activateDiagnosticsFromLogoGesture();
    });

    logoActivationBound = true;
  }

  function bootDiagnostics() {
    if (isDiagnosticsEnabled()) {
      initDiagnosticsModule();

      const showControls = () => {
        if (!document.body) return;
        showDiagnosticsControls();
      };

      if (document.body) {
        showControls();
      } else {
        document.addEventListener("DOMContentLoaded", showControls, { once: true });
      }

      window.addEventListener("load", showControls, { once: true });
      console.log("[Klevby Android Diagnostics] Opt-in diagnostics loaded.");
      return;
    }

    bindLogoActivation();
  }

  if (document.body) {
    bootDiagnostics();
  } else {
    document.addEventListener("DOMContentLoaded", bootDiagnostics, { once: true });
  }
})();
