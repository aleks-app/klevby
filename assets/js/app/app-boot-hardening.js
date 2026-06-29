(function () {
  "use strict";

  const EMERGENCY_ID = "klevbyBootEmergency";
  const STYLE_ID = "klevby-boot-emergency-style";

  function ensureEmergencyStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${EMERGENCY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        background: #0d1417;
        color: #fff8ea;
        font-family: "Onest", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #${EMERGENCY_ID}[data-visible="true"] {
        display: flex;
      }

      #${EMERGENCY_ID} .klevby-boot-emergency-card {
        width: min(100%, 360px);
        border-radius: 18px;
        border: 1px solid rgba(255, 141, 40, 0.35);
        background: rgba(22, 28, 32, 0.96);
        padding: 18px 16px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
      }

      #${EMERGENCY_ID} h1 {
        margin: 0 0 8px;
        font-size: 20px;
        line-height: 1.2;
      }

      #${EMERGENCY_ID} p {
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.4;
        color: rgba(255, 248, 234, 0.86);
      }

      #${EMERGENCY_ID} button {
        margin-top: 10px;
        min-height: 42px;
        width: 100%;
        border: 0;
        border-radius: 12px;
        background: #ff8d28;
        color: #111;
        font-size: 14px;
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureEmergencyScreen() {
    ensureEmergencyStyle();

    let node = document.getElementById(EMERGENCY_ID);
    if (node) return node;

    node = document.createElement("div");
    node.id = EMERGENCY_ID;
    node.setAttribute("role", "alert");
    node.innerHTML = `
      <div class="klevby-boot-emergency-card">
        <h1>KlevGo не смог запуститься</h1>
        <p>Приложение осталось в ограниченном режиме. Попробуйте обновить экран или проверьте интернет.</p>
        <p id="${EMERGENCY_ID}-detail"></p>
        <button type="button">Обновить</button>
      </div>
    `;

    node.querySelector("button")?.addEventListener("click", () => {
      window.location.reload();
    });

    document.body.appendChild(node);
    return node;
  }

  function showEmergencyScreen(message) {
    const node = ensureEmergencyScreen();
    const detail = node.querySelector(`#${EMERGENCY_ID}-detail`);
    if (detail) {
      detail.textContent = message || "";
    }
    node.dataset.visible = "true";
    window.KlevbyBootStore?.capture?.("emergency-screen", { message: message || null });
  }

  function hideEmergencyScreen() {
    const node = document.getElementById(EMERGENCY_ID);
    if (node) node.dataset.visible = "false";
  }

  function presentShellEarly() {
    const root = document.getElementById("klevbyAppRoot");
    if (root) {
      root.style.visibility = "visible";
    }

    if (typeof window.finalizeColdHomeBootPresentation === "function") {
      window.finalizeColdHomeBootPresentation();
    } else if (typeof window.klevbyFinalizeColdHomeBootPresentation === "function") {
      window.klevbyFinalizeColdHomeBootPresentation();
    } else if (typeof window.showSection === "function") {
      window.showSection("home");
    }

    window.KlevbyBootStore?.markShellPresented?.("boot-hardening");
    hideEmergencyScreen();
  }

  function bindGlobalErrorHandlers() {
    window.addEventListener("error", (event) => {
      window.KlevbyBootStore?.recordError?.("window.error", event.error || event.message);
      if (!document.getElementById("klevbyAppRoot")) {
        showEmergencyScreen(event.message || "Неизвестная ошибка запуска");
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      window.KlevbyBootStore?.recordError?.(
        "unhandledrejection",
        event.reason || "Unhandled promise rejection",
      );
    });
  }

  function bindServiceWorkerMessages() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "KLEVB_SW_VERSION" || data.type === "KLEVB_SW_ACTIVATED") {
        window.KlevbyBootStore?.setServiceWorkerInfo?.({
          buildVersion: data.buildVersion,
          cacheName: data.cacheName,
        });
      }
    });
  }

  function initBootHardening() {
    bindGlobalErrorHandlers();
    bindServiceWorkerMessages();
    presentShellEarly();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBootHardening, { once: true });
  } else {
    initBootHardening();
  }

  window.KlevbyBootHardening = {
    presentShellEarly,
    showEmergencyScreen,
    hideEmergencyScreen,
  };
})();
