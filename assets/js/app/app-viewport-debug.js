(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("klevbyViewportDebug") !== "1") return;

  const OVERLAY_ID = "klevbyViewportDebugOverlay";
  let overlayEl = null;
  let preEl = null;
  let copyBtn = null;
  let lastPayload = null;

  function readSafeAreaInsets() {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;visibility:hidden;pointer-events:none;padding:" +
      "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) " +
      "env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);";
    document.body.appendChild(probe);
    const styles = getComputedStyle(probe);
    const result = {
      top: styles.paddingTop,
      right: styles.paddingRight,
      bottom: styles.paddingBottom,
      left: styles.paddingLeft
    };
    probe.remove();
    return result;
  }

  function collectViewportDebugPayload() {
    const vv = window.visualViewport;
    const safeArea = readSafeAreaInsets();

    return {
      capturedAt: new Date().toISOString(),
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight
      },
      visualViewport: vv
        ? {
            width: vv.width,
            height: vv.height,
            scale: vv.scale,
            offsetLeft: vv.offsetLeft,
            offsetTop: vv.offsetTop,
            pageLeft: vv.pageLeft,
            pageTop: vv.pageTop
          }
        : null,
      documentElement: {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight
      },
      safeArea,
      displayMode: {
        standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
        navigatorStandalone: typeof navigator.standalone === "boolean" ? navigator.standalone : null
      },
      userAgent: navigator.userAgent
    };
  }

  function formatPayload(payload) {
    return JSON.stringify(payload, null, 2);
  }

  function renderPayload(payload) {
    lastPayload = payload;
    if (!preEl) return;

    const lines = [
      "Klevby viewport debug",
      `capturedAt: ${payload.capturedAt}`,
      "",
      "window.innerWidth: " + payload.window.innerWidth,
      "window.innerHeight: " + payload.window.innerHeight,
      "window.outerWidth: " + payload.window.outerWidth,
      "window.outerHeight: " + payload.window.outerHeight,
      "window.devicePixelRatio: " + payload.window.devicePixelRatio,
      "",
      "screen.width: " + payload.screen.width,
      "screen.height: " + payload.screen.height,
      "screen.availWidth: " + payload.screen.availWidth,
      "screen.availHeight: " + payload.screen.availHeight,
      "",
      "visualViewport.width: " + (payload.visualViewport ? payload.visualViewport.width : "n/a"),
      "visualViewport.height: " + (payload.visualViewport ? payload.visualViewport.height : "n/a"),
      "visualViewport.scale: " + (payload.visualViewport ? payload.visualViewport.scale : "n/a"),
      "",
      "documentElement.clientWidth: " + payload.documentElement.clientWidth,
      "documentElement.clientHeight: " + payload.documentElement.clientHeight,
      "",
      "safeArea.top: " + payload.safeArea.top,
      "safeArea.bottom: " + payload.safeArea.bottom,
      "safeArea.left: " + payload.safeArea.left,
      "safeArea.right: " + payload.safeArea.right,
      "",
      "displayMode.standalone: " + payload.displayMode.standalone,
      "navigator.standalone: " + payload.displayMode.navigatorStandalone,
      "",
      "userAgent:",
      payload.userAgent
    ];

    preEl.textContent = lines.join("\n");
  }

  function refreshOverlay() {
    renderPayload(collectViewportDebugPayload());
  }

  async function copyDebugPayload() {
    if (!lastPayload) refreshOverlay();
    const text = formatPayload(lastPayload);

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      if (copyBtn) {
        const original = copyBtn.textContent;
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          if (copyBtn) copyBtn.textContent = original;
        }, 1200);
      }
    } catch (error) {
      console.warn("Klevby viewport debug: copy failed", error);
      if (copyBtn) copyBtn.textContent = "Copy failed";
    }
  }

  function ensureOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute("role", "status");
    overlayEl.setAttribute("aria-live", "polite");
    overlayEl.style.cssText =
      "position:fixed;" +
      "left:8px;" +
      "bottom:calc(8px + env(safe-area-inset-bottom, 0px));" +
      "z-index:2147483647;" +
      "max-width:min(92vw, 420px);" +
      "max-height:min(52vh, 360px);" +
      "overflow:auto;" +
      "padding:10px 12px;" +
      "border:1px solid rgba(255,255,255,0.18);" +
      "border-radius:10px;" +
      "background:rgba(8,12,10,0.92);" +
      "color:#e8fff2;" +
      "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;" +
      "box-shadow:0 10px 28px rgba(0,0,0,0.45);" +
      "pointer-events:auto;";

    const titleEl = document.createElement("div");
    titleEl.textContent = "Viewport debug";
    titleEl.style.cssText = "font-weight:700;margin-bottom:8px;";

    preEl = document.createElement("pre");
    preEl.style.cssText = "margin:0 0 10px;white-space:pre-wrap;word-break:break-word;";

    copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy viewport debug";
    copyBtn.style.cssText =
      "display:block;" +
      "width:100%;" +
      "min-height:36px;" +
      "padding:8px 10px;" +
      "border:1px solid rgba(255,255,255,0.22);" +
      "border-radius:8px;" +
      "background:rgba(255,255,255,0.08);" +
      "color:#fff;" +
      "font:inherit;" +
      "cursor:pointer;";
    copyBtn.addEventListener("click", copyDebugPayload);

    overlayEl.appendChild(titleEl);
    overlayEl.appendChild(preEl);
    overlayEl.appendChild(copyBtn);
    document.body.appendChild(overlayEl);
  }

  function bindEvents() {
    window.addEventListener("resize", refreshOverlay, { passive: true });
    window.addEventListener("orientationchange", refreshOverlay, { passive: true });
    window.addEventListener("load", refreshOverlay, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", refreshOverlay, { passive: true });
      window.visualViewport.addEventListener("scroll", refreshOverlay, { passive: true });
    }
  }

  function init() {
    ensureOverlay();
    refreshOverlay();
    bindEvents();
    console.log("Klevby viewport debug active");
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
