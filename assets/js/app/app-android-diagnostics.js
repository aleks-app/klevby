(function() {
  const params = new URLSearchParams(window.location.search);
  const hasAndroidDebugFlag = params.get("klevbyAndroidDebug") === "1";
  const hasViewportDebugFlag = params.get("klevbyViewportDebug") === "1";
  const hasExplicitDebugFlag = hasAndroidDebugFlag || hasViewportDebugFlag;

  if (!hasExplicitDebugFlag) return;

  const capacitor = window.Capacitor;
  let isNativePlatform = false;

  if (capacitor && typeof capacitor.isNativePlatform === "function") {
    isNativePlatform = capacitor.isNativePlatform() === true;
  }

  // Native Capacitor sessions are preferred. Because the query flag is
  // required above, non-native sessions are enabled only for explicit tests.

  if (!window.klevbyAndroidDiagnostics) {
    window.klevbyAndroidDiagnostics = {};
  }

  const diag = window.klevbyAndroidDiagnostics;

  diag.collect = function() {
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
        klevbyViewportDebug: hasViewportDebugFlag
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
      compactMediaQuery: window.matchMedia("(max-width: 390px) and (max-height: 820px)").matches,
      homeScrollDiff: home ? home.scrollHeight - home.clientHeight : null
    };
  };

  diag.saveJSON = function() {
    const json = JSON.stringify(diag.collect(), null, 2);
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

  window.addEventListener("load", () => {
    if (document.querySelector("#klevbyAndroidDiagnosticsButton")) return;

    const btn = document.createElement("button");
    btn.id = "klevbyAndroidDiagnosticsButton";
    btn.type = "button";
    btn.innerText = "Save Android Diagnostics";
    btn.style.position = "fixed";
    btn.style.bottom = "80px";
    btn.style.left = "10px";
    btn.style.zIndex = "9999";
    btn.style.background = "#F47A2B";
    btn.style.color = "#fff";
    btn.style.padding = "8px 12px";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.fontSize = "12px";
    btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    btn.addEventListener("click", diag.saveJSON);
    document.body.appendChild(btn);
  }, { once: true });

  console.log("[Klevby Android Diagnostics] Opt-in diagnostics loaded.");
})();
