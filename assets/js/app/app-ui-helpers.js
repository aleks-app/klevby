(function () {
  const KLEVB_CONFIG = window.KLEVB_CONFIG || {};
  const TELEGRAM_GROUP = KLEVB_CONFIG.TELEGRAM_GROUP || "https://t.me/+W6eAuefzcJwwODEy";

  function showStatus(message, isError = false) {
    const status = document.getElementById("statusLine");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("error-line", Boolean(isError));
  }

  function showFormMessage(message, isError = false) {
    const el = document.getElementById("formMessage");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#ffd2d2" : "rgba(245,245,245,0.66)";
  }

  function openTelegram(url) {
    const targetUrl = String(url || TELEGRAM_GROUP || "").trim();

    if (!targetUrl) {
      console.warn("Klevby app UI helpers: Telegram URL пустой.");
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  window.KlevbyAppUiHelpers = {
    showStatus,
    showFormMessage,
    openTelegram
  };

  if (typeof window.showStatus !== "function") {
    window.showStatus = showStatus;
  }

  if (typeof window.showFormMessage !== "function") {
    window.showFormMessage = showFormMessage;
  }

  if (typeof window.openTelegram !== "function") {
    window.openTelegram = openTelegram;
  }

  console.log("Klevby app UI helpers loaded");
})();
