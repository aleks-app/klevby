(function () {
  if (window.__klevbyCallLoaded) return;
  window.__klevbyCallLoaded = true;

  let callOverlay = null;
  let callTimer = null;
  let callSeconds = 0;

  let audioContext = null;
  let ringInterval = null;
  let activeOscillator = null;
  let activeGain = null;

  let observer = null;
  let observerUpdateTimer = null;
  let isUpdatingButton = false;

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function getChatWindow() {
    return $("#chat-window");
  }

  function getChatHeader() {
    return $("#chat-header");
  }

  function getCloseButton() {
    return $("#close-chat");
  }

  function isPrivateDialogOpen() {
    const chatWindow = getChatWindow();
    return Boolean(chatWindow && chatWindow.classList.contains("klevby-dialog-screen"));
  }

  function getPeerName() {
    const title = $("#chatTitle");
    const name = title ? title.textContent.trim() : "";
    return name || "Собеседник";
  }

  function safeStopEvent(event) {
    if (!event) return;
    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getInitial(name) {
    const clean = String(name || "С").trim();
    return (clean[0] || "С").toUpperCase();
  }

  function formatCallTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function removeOldCallButtons() {
    const header = getChatHeader();
    if (!header) return;

    const buttons = Array.from(header.querySelectorAll("button"));

    buttons.forEach((button) => {
      if (!button) return;

      if (button.id === "klevby-call-btn") return;
      if (button.id === "back-chat") return;

      const text = String(button.textContent || "").trim();
      const id = String(button.id || "").toLowerCase();
      const cls = String(button.className || "").toLowerCase();
      const aria = String(button.getAttribute("aria-label") || "").toLowerCase();
      const title = String(button.getAttribute("title") || "").toLowerCase();

      const isCloseButton = button.id === "close-chat";

      const looksLikeCallButton =
        text.includes("📞") ||
        text.includes("☎") ||
        text.includes("📱") ||
        text.includes("📲") ||
        id.includes("call") ||
        id.includes("phone") ||
        cls.includes("call") ||
        cls.includes("phone") ||
        aria.includes("звон") ||
        aria.includes("вызов") ||
        aria.includes("call") ||
        aria.includes("phone") ||
        title.includes("звон") ||
        title.includes("вызов") ||
        title.includes("call") ||
        title.includes("phone");

      if (looksLikeCallButton && !isCloseButton) {
        button.remove();
      }
    });
  }

  function restoreCloseButton() {
    const closeButton = getCloseButton();
    if (!closeButton) return;

    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Закрыть");
    closeButton.textContent = "×";
  }

  function ensureCallButton() {
    if (isUpdatingButton) return;

    isUpdatingButton = true;

    try {
      const header = getChatHeader();
      const closeButton = getCloseButton();

      if (!header || !closeButton) return;

      restoreCloseButton();
      removeOldCallButtons();

      let callButton = $("#klevby-call-btn");

      if (!callButton) {
        callButton = document.createElement("button");
        callButton.id = "klevby-call-btn";
        callButton.className = "klevby-call-btn hidden";
        callButton.type = "button";
        callButton.setAttribute("aria-label", "Позвонить");
        callButton.setAttribute("title", "Позвонить");
        callButton.textContent = "📞";

        closeButton.insertAdjacentElement("beforebegin", callButton);
      }

      updateCallButtonVisibility();
    } finally {
      isUpdatingButton = false;
    }
  }

  function updateCallButtonVisibility() {
    const callButton = $("#klevby-call-btn");
    const closeButton = getCloseButton();

    if (!callButton || !closeButton) return;

    restoreCloseButton();

    if (isPrivateDialogOpen()) {
      callButton.classList.remove("hidden");
      closeButton.classList.add("hidden");
    } else {
      callButton.classList.add("hidden");
      closeButton.classList.remove("hidden");
    }
  }

  function scheduleButtonUpdate() {
    clearTimeout(observerUpdateTimer);

    observerUpdateTimer = setTimeout(() => {
      ensureCallButton();
      updateCallButtonVisibility();
    }, 120);
  }

  function injectCallStyles() {
    const oldStyle = $("#klevby-call-styles");
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = "klevby-call-styles";

    style.textContent = `
      #klevby-call-btn.klevby-call-btn {
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        flex: 0 0 auto !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.18) !important;
        color: #ffffff !important;
        font-size: 22px !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28) !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
      }

      #klevby-call-btn.klevby-call-btn:active {
        transform: scale(0.94) !important;
      }

      #klevby-call-btn.hidden {
        display: none !important;
      }

      .klevby-call-overlay {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483640 !important;
        background:
          radial-gradient(circle at 50% 22%, rgba(87, 230, 178, 0.16), transparent 38%),
          linear-gradient(180deg, #0c211e 0%, #040b0c 100%) !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        font-family: Montserrat, system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
        touch-action: manipulation !important;
      }

      .klevby-call-card {
        width: min(420px, 100%) !important;
        min-height: 560px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
      }

      .klevby-call-avatar-wrap {
        position: relative !important;
        width: 138px !important;
        height: 138px !important;
        margin-bottom: 28px !important;
      }

      .klevby-call-pulse {
        position: absolute !important;
        inset: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.16) !important;
        animation: klevbyCallPulse 1.55s ease-out infinite !important;
      }

      .klevby-call-pulse:nth-child(2) {
        animation-delay: 0.45s !important;
      }

      .klevby-call-avatar {
        position: relative !important;
        z-index: 2 !important;
        width: 138px !important;
        height: 138px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #1f6f58, #174139) !important;
        border: 1px solid rgba(255, 255, 255, 0.14) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 58px !important;
        font-weight: 900 !important;
        color: #d9ffed !important;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38) !important;
      }

      .klevby-call-name {
        max-width: 100% !important;
        font-size: 30px !important;
        line-height: 1.15 !important;
        font-weight: 900 !important;
        color: #ffffff !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .klevby-call-status {
        margin-top: 10px !important;
        font-size: 17px !important;
        font-weight: 700 !important;
        color: rgba(255, 255, 255, 0.62) !important;
      }

      .klevby-call-timer {
        margin-top: 12px !important;
        min-height: 24px !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        color: rgba(200, 255, 224, 0.88) !important;
      }

      .klevby-call-actions {
        margin-top: 70px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 22px !important;
      }

      .klevby-call-end {
        width: 78px !important;
        height: 78px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: #e05252 !important;
        color: #ffffff !important;
        font-size: 31px !important;
        line-height: 1 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        box-shadow: 0 18px 48px rgba(224, 82, 82, 0.32) !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
        touch-action: manipulation !important;
      }

      .klevby-call-end:active {
        transform: scale(0.94) !important;
      }

      .klevby-call-hint {
        margin-top: 22px !important;
        max-width: 310px !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
        font-weight: 600 !important;
        color: rgba(255, 255, 255, 0.38) !important;
      }

      #klevbyCallToast {
        position: fixed !important;
        left: 50% !important;
        bottom: max(26px, env(safe-area-inset-bottom)) !important;
        transform: translateX(-50%) !important;
        z-index: 2147483641 !important;
        padding: 10px 14px !important;
        border-radius: 999px !important;
        background: rgba(12, 22, 25, 0.96) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.84) !important;
        font-family: Montserrat, system-ui, sans-serif !important;
        font-size: 13px !important;
        font-weight: 800 !important;
        box-shadow: 0 14px 38px rgba(0,0,0,0.35) !important;
      }

      @keyframes klevbyCallPulse {
        0% {
          transform: scale(0.86);
          opacity: 0.9;
        }

        100% {
          transform: scale(1.75);
          opacity: 0;
        }
      }

      @media (max-width: 768px) {
        .klevby-call-overlay {
          padding-top: max(24px, env(safe-area-inset-top)) !important;
          padding-bottom: max(24px, env(safe-area-inset-bottom)) !important;
        }

        .klevby-call-card {
          min-height: 100% !important;
        }

        .klevby-call-name {
          font-size: 28px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function startTimer() {
    stopTimer();

    callSeconds = 0;

    const timerEl = $("#klevbyCallTimer");

    if (timerEl) {
      timerEl.textContent = "00:00";
    }

    callTimer = setInterval(() => {
      callSeconds += 1;

      const el = $("#klevbyCallTimer");
      if (el) {
        el.textContent = formatCallTime(callSeconds);
      }
    }, 1000);
  }

  function stopTimer() {
    if (callTimer) {
      clearInterval(callTimer);
      callTimer = null;
    }

    callSeconds = 0;
  }

  function ensureAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) return null;

    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  function stopSingleBeep() {
    try {
      if (activeOscillator) {
        activeOscillator.onended = null;
        activeOscillator.stop();
      }
    } catch (error) {}

    try {
      if (activeGain) {
        activeGain.disconnect();
      }
    } catch (error) {}

    activeOscillator = null;
    activeGain = null;
  }

  function playSingleBeep() {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    stopSingleBeep();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    activeOscillator = oscillator;
    activeGain = gain;

    oscillator.onended = () => {
      try {
        gain.disconnect();
      } catch (error) {}

      if (activeOscillator === oscillator) {
        activeOscillator = null;
      }

      if (activeGain === gain) {
        activeGain = null;
      }
    };
  }

  function startRingSound() {
    stopRingSound();

    playSingleBeep();

    ringInterval = setInterval(() => {
      playSingleBeep();
    }, 1850);
  }

  function stopRingSound() {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }

    stopSingleBeep();
  }

  function showSmallToast(text) {
    const oldToast = $("#klevbyCallToast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.id = "klevbyCallToast";
    toast.textContent = text;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.remove();
      }
    }, 1400);
  }

  function closeCallOverlay(showToast = true) {
    stopTimer();
    stopRingSound();

    const overlay = $("#klevbyCallOverlay");

    if (overlay) {
      overlay.remove();
    }

    callOverlay = null;

    const chatModal = $("#klevby-chat-modal");
    const chatIsOpen = chatModal && chatModal.classList.contains("open");

    if (!chatIsOpen) {
      document.documentElement.classList.remove("klevby-chat-lock");
      document.body.classList.remove("klevby-chat-lock");
    }

    if (showToast) {
      showSmallToast("Вызов завершён");
    }

    scheduleButtonUpdate();
  }

  function bindEndCallButton() {
    const endButton = $("#klevbyEndCallBtn");

    if (!endButton) return;

    const endHandler = function (event) {
      safeStopEvent(event);
      closeCallOverlay(true);
    };

    endButton.addEventListener("click", endHandler, true);
    endButton.addEventListener("pointerup", endHandler, true);
    endButton.addEventListener("touchend", end
