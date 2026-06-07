(function() {
  if (!window.klevbyAndroidDiagnostics) {
    window.klevbyAndroidDiagnostics = {};
  }

  const diag = window.klevbyAndroidDiagnostics;

  diag.collect = function() {
    const data = {};

    // Environment
    data.capacitorPlatform = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.getPlatform()) || "unknown";
    data.userAgent = navigator.userAgent;
    data.dpr = window.devicePixelRatio;
    data.innerWidth = window.innerWidth;
    data.innerHeight = window.innerHeight;
    data.outerWidth = window.outerWidth;
    data.outerHeight = window.outerHeight;
    data.visualViewport = {
      width: window.visualViewport?.width,
      height: window.visualViewport?.height,
      offsetTop: window.visualViewport?.offsetTop,
      offsetLeft: window.visualViewport?.offsetLeft,
      scale: window.visualViewport?.scale
    };

    // App Screen
    const home = document.querySelector("#homeSection");
    const touchBar = document.querySelector(".mobile-tabbar");
    const body = document.body;
    const html = document.documentElement;

    data.homeSection = home ? home.getBoundingClientRect() : null;
    data.touchBar = touchBar ? touchBar.getBoundingClientRect() : null;
    data.body = body ? body.getBoundingClientRect() : null;
    data.html = html ? html.getBoundingClientRect() : null;

    // Computed CSS / Locks
    data.appHeight = getComputedStyle(html).getPropertyValue("--klevby-app-height");
    data.homeLock = body.getAttribute("data-home-screen-lock") || null;
    data.chromeMode = body.getAttribute("data-app-chrome-mode") || null;

    // Compact / regular media query
    data.compactMediaQuery = window.matchMedia("(max-width: 390px) and (max-height: 820px)").matches;

    // Fit / scroll
    data.homeScrollDiff = home ? (home.scrollHeight - home.clientHeight) : null;

    // Event timestamp
    data.timestamp = new Date().toISOString();

    return data;
  };

  diag.saveJSON = function() {
    const json = JSON.stringify(diag.collect(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const filename = "klevby-android-diagnostics.json";

    // Save to Downloads
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Expose a button for manual trigger
  window.addEventListener("load", () => {
    const btn = document.createElement("button");
    btn.innerText = "Save Android Diagnostics";
    btn.style.position = "fixed";
    btn.style.bottom = "80px";
    btn.style.left = "10px";
    btn.style.zIndex = 9999;
    btn.style.background = "#F47A2B";
    btn.style.color = "#fff";
    btn.style.padding = "8px 12px";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.fontSize = "12px";
    btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    btn.onclick = diag.saveJSON;
    document.body.appendChild(btn);
  });

  console.log("[Klevby Android Diagnostics] Loaded and ready.");
})();
