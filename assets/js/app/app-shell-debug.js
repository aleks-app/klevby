(function () {
  "use strict";

  const STORAGE_KEY = "klevbyShellDebug";
  const BUTTON_ID = "klevbyShellDebugCopyButton";
  const MAX_LOG_ENTRIES = 200;
  const logs = [];
  let button = null;
  let logoTapCount = 0;
  let logoTapResetTimer = 0;

  function readAttribute(element, name) {
    return element ? element.getAttribute(name) : null;
  }

  function readRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return null;

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y
    };
  }

  function readSection(id) {
    const section = document.getElementById(id);
    return {
      present: Boolean(section),
      hidden: section ? section.classList.contains("hidden") : null,
      boundingClientRect: readRect(section)
    };
  }

  function readStandaloneDisplayMode() {
    try {
      return typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)").matches
        : null;
    } catch (_) {
      return null;
    }
  }

  function collect(event, details) {
    const root = document.documentElement;
    const body = document.body;
    const header = document.querySelector("header");
    const touchBar = document.querySelector(".mobile-tabbar");
    const touchBarStyles = touchBar ? window.getComputedStyle(touchBar) : null;
    const rootStyles = root ? window.getComputedStyle(root) : null;

    const entry = {
      event,
      timestamp: new Date().toISOString(),
      performanceNow: typeof performance !== "undefined" ? performance.now() : null,
      details: details || null,
      locationHref: window.location.href,
      displayModeStandalone: readStandaloneDisplayMode(),
      navigatorStandalone: typeof navigator.standalone === "boolean" ? navigator.standalone : null,
      documentReadyState: document.readyState,
      windowInnerHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport ? window.visualViewport.height : null,
      documentElementClientHeight: root ? root.clientHeight : null,
      bodyClientHeight: body ? body.clientHeight : null,
      computedKlevbyAppHeight: rootStyles
        ? rootStyles.getPropertyValue("--klevby-app-height").trim()
        : null,
      htmlHomeScreenLock: readAttribute(root, "data-home-screen-lock"),
      bodyHomeScreenLock: readAttribute(body, "data-home-screen-lock"),
      bodyAppChromeMode: readAttribute(body, "data-app-chrome-mode"),
      headerChromeMode: readAttribute(header, "data-chrome-mode"),
      homeSection: readSection("homeSection"),
      feedSection: readSection("feedSection"),
      touchBar: {
        present: Boolean(touchBar),
        boundingClientRect: readRect(touchBar),
        computed: touchBarStyles
          ? {
              position: touchBarStyles.position,
              bottom: touchBarStyles.bottom,
              transform: touchBarStyles.transform
            }
          : null
      }
    };

    logs.push(entry);
    if (logs.length > MAX_LOG_ENTRIES) logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    return entry;
  }

  function capture(event, details) {
    try {
      return collect(event, details);
    } catch (error) {
      console.warn(`Klevby shell debug: failed to capture ${event}`, error);
      return null;
    }
  }

  function buildPayload() {
    return {
      collector: "klevby-shell-debug",
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      entries: logs.slice()
    };
  }

  function copyWithTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function copyLogs() {
    const payload = buildPayload();
    const text = JSON.stringify(payload, null, 2);
    console.log("Klevby shell debug logs", text);

    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        copied = copyWithTextarea(text);
      }
    } catch (error) {
      console.warn("Klevby shell debug: clipboard copy failed", error);
      copied = copyWithTextarea(text);
    }

    if (button) {
      const originalText = button.textContent;
      button.textContent = copied ? "Shell debug copied" : "Copy failed — see console";
      window.setTimeout(() => {
        if (button) button.textContent = originalText;
      }, 1800);
    }

    return payload;
  }

  function ensureCopyButton() {
    if (button || !document.body) return;

    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Copy shell debug";
    button.style.cssText =
      "position:fixed;" +
      "right:8px;" +
      "top:calc(8px + env(safe-area-inset-top, 0px));" +
      "z-index:2147483647;" +
      "min-height:36px;" +
      "padding:8px 10px;" +
      "border:1px solid rgba(255,255,255,0.35);" +
      "border-radius:8px;" +
      "background:rgba(8,12,10,0.92);" +
      "color:#fff;" +
      "font:12px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;" +
      "box-shadow:0 4px 14px rgba(0,0,0,0.3);";
    button.addEventListener("click", copyLogs);
    document.body.appendChild(button);
  }

  function isDebugRequested() {
    try {
      if (new URLSearchParams(window.location.search).get("shellDebug") === "1") return true;
    } catch (_) {}

    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function activateFromLogoGesture() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {}

    ensureCopyButton();
    capture("shell debug activated", { source: "fish-logo-7-taps" });
  }

  function bindLogoGesture() {
    const logo = document.querySelector(".app-header-logo img, .app-header-logo");
    if (!logo) return;

    logo.addEventListener("click", () => {
      logoTapCount += 1;
      window.clearTimeout(logoTapResetTimer);

      if (logoTapCount >= 7) {
        logoTapCount = 0;
        activateFromLogoGesture();
        return;
      }

      logoTapResetTimer = window.setTimeout(() => {
        logoTapCount = 0;
      }, 4000);
    });
  }

  function captureAfterBrowserEvent(event, details) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => capture(event, details));
    });
  }

  function initUi() {
    if (isDebugRequested()) ensureCopyButton();
    bindLogoGesture();
  }

  window.KlevbyShellDebug = Object.freeze({
    capture,
    copy: copyLogs,
    getLogs: () => logs.slice(),
    showCopyButton: ensureCopyButton
  });

  window.addEventListener("pageshow", (event) => {
    captureAfterBrowserEvent("after pageshow", { persisted: event.persisted });
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      captureAfterBrowserEvent("after visualViewport resize");
    }, { passive: true });
    window.visualViewport.addEventListener("scroll", () => {
      captureAfterBrowserEvent("after visualViewport scroll");
    }, { passive: true });
  }

  if (document.body) {
    initUi();
  } else {
    document.addEventListener("DOMContentLoaded", initUi, { once: true });
  }
})();
