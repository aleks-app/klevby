(function () {
  "use strict";

  const BANNER_ID = "klevby-network-banner";
  const STYLE_ID = "klevby-network-banner-style";
  const CHECK_INTERVAL_MS = 45000;
  const WEAK_TIMEOUT_MS = 4500;

  let status = navigator.onLine ? "online" : "offline";
  let lastCheckedAt = 0;
  let checkInFlight = false;
  let intervalId = null;
  let lastProbe = {
    ok: null,
    elapsedMs: null,
    status: null,
    error: null,
    at: null,
  };

  function getEffectiveOnline() {
    if (window.KlevbyBootStore?.isSimulatedOffline?.()) {
      return false;
    }
    return navigator.onLine;
  }

  function setStatus(nextStatus) {
    const normalized = String(nextStatus || "unknown");
    if (status === normalized) {
      updateBanner();
      return;
    }

    status = normalized;
    window.KlevbyBootStore?.capture?.("network-status", { status });
    updateBanner();
    window.dispatchEvent(
      new CustomEvent("klevby-network-status", {
        detail: { status },
      }),
    );
  }

  function isOfflineOrWeak() {
    return status === "offline" || status === "weak" || !getEffectiveOnline();
  }

  function ensureBannerStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID} {
        position: fixed;
        left: 12px;
        right: 12px;
        top: calc(env(safe-area-inset-top, 0px) + 8px);
        z-index: 2147482000;
        display: none;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(255, 141, 40, 0.35);
        background: rgba(18, 24, 27, 0.94);
        color: #fff8ea;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.35;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        pointer-events: none;
      }

      #${BANNER_ID}[data-visible="true"] {
        display: block;
      }

      #${BANNER_ID} strong {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    ensureBannerStyle();

    let banner = document.getElementById(BANNER_ID);
    if (banner) return banner;

    banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `
      <strong>Слабый интернет</strong>
      <span>Часть данных может быть недоступна</span><br />
      <span>Приложение запущено в ограниченном режиме</span>
    `;

    const root = document.getElementById("klevbyAppRoot") || document.body;
    root.appendChild(banner);
    return banner;
  }

  function updateBanner() {
    const banner = ensureBanner();
    const show = status === "offline" || status === "weak";
    banner.dataset.visible = show ? "true" : "false";

    if (status === "offline") {
      banner.querySelector("strong").textContent = "Нет интернета";
    } else if (status === "weak") {
      banner.querySelector("strong").textContent = "Слабый интернет";
    }
  }

  async function probeWeakConnection() {
    if (!getEffectiveOnline()) {
      setStatus("offline");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), WEAK_TIMEOUT_MS);
    const startedAt = performance.now();

    try {
      const response = await fetch(`/index.html?klevby-net-probe=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      const elapsed = performance.now() - startedAt;

      if (!response.ok) {
        lastProbe = {
          ok: false,
          elapsedMs: Math.round(elapsed),
          status: "weak",
          error: `HTTP ${response.status}`,
          at: Date.now(),
        };
        setStatus("weak");
        return;
      }

      if (elapsed > 2200) {
        lastProbe = {
          ok: true,
          elapsedMs: Math.round(elapsed),
          status: "weak",
          error: null,
          at: Date.now(),
        };
        setStatus("weak");
        return;
      }

      lastProbe = {
        ok: true,
        elapsedMs: Math.round(elapsed),
        status: "online",
        error: null,
        at: Date.now(),
      };
      setStatus("online");
    } catch (error) {
      lastProbe = {
        ok: false,
        elapsedMs: null,
        status: getEffectiveOnline() ? "weak" : "offline",
        error: error?.message || String(error),
        at: Date.now(),
      };
      window.KlevbyBootStore?.recordError?.("network-probe", error, "network");
      setStatus(getEffectiveOnline() ? "weak" : "offline");
    } finally {
      window.clearTimeout(timer);
      lastCheckedAt = Date.now();
      checkInFlight = false;
    }
  }

  function scheduleProbe(force) {
    if (checkInFlight) return;

    const now = Date.now();
    if (!force && now - lastCheckedAt < CHECK_INTERVAL_MS) {
      updateBanner();
      return;
    }

    checkInFlight = true;

    if (!getEffectiveOnline()) {
      setStatus("offline");
      checkInFlight = false;
      lastCheckedAt = now;
      return;
    }

    probeWeakConnection();
  }

  function bindEvents() {
    window.addEventListener("online", () => scheduleProbe(true));
    window.addEventListener("offline", () => setStatus("offline"));
    window.addEventListener("pageshow", () => scheduleProbe(true));
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleProbe(false);
      }
    });

    if (intervalId == null) {
      intervalId = window.setInterval(() => scheduleProbe(false), CHECK_INTERVAL_MS);
    }
  }

  function initNetworkState() {
    ensureBanner();
    setStatus(getEffectiveOnline() ? "online" : "offline");
    bindEvents();
    scheduleProbe(true);
  }

  window.KlevbyNetworkState = {
    getStatus: () => status,
    isOfflineOrWeak,
    refresh: () => scheduleProbe(true),
    setSimulatedOffline(enabled) {
      window.KlevbyBootStore?.setSimulatedOffline?.(enabled);
      scheduleProbe(true);
    },
    getDiagnosticsSnapshot() {
      return {
        lastCheckedAt,
        lastCheckedAtIso: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
        lastProbe: { ...lastProbe },
        checkInFlight,
      };
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNetworkState, { once: true });
  } else {
    initNetworkState();
  }
})();
