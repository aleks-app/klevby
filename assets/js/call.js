(function () {
  if (window.__klevbyCallLoadedV2) return;
  window.__klevbyCallLoadedV2 = true;

  let callOverlay = null;
  let callTimer = null;
  let callSeconds = 0;

  let audioContext = null;
  let ringInterval = null;
  let activeOscillator = null;
  let activeGain = null;

  function $(selector) {
    return document.querySelector(selector);
  }

  function getPeerName() {
    const title = $("#chatTitle");
    const name = title ? title.textContent.trim() : "";
    return name || "Собеседник";
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

  function safeStopEvent(event) {
    if (!event) return;
    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function injectCallStyles() {
    const oldStyle = $("#klevby-call-styles");
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = "klevby-call-styles";

    style.textContent = `
      #klevby-call-btn {
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        flex: 0 0 auto !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.20) !important;
        color: #ffffff !important;
        font-size: 22px !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28), 0 0 22px rgba(87, 230, 178, 0.22) !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
        margin-left: 6px !important;
        margin-right: 2px !important;
        z-index: 10 !important;
      }

      #klevby-call-btn:active {
        transform: scale(0.94) !important;
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

  function forceAddCallButton() {
    const header = $("#chat-header");
    const closeButton = $("#close-chat");

    if (!header || !closeButton) return;

    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Закрыть");
    closeButton.setAttribute("title", "Закрыть");

    let callButton = $("#klevby-call-btn");

    if (!callButton) {
      callButton = document.createElement("button");
      callButton.id = "klevby-call-btn";
      callButton.type = "button";
      callButton.textContent = "📞";
      callButton.setAttribute("aria-label", "Позвонить");
      callButton.setAttribute("title", "Позвонить");

      closeButton.insertAdjacentElement("beforebegin", callButton);
    }

    callButton.style.display = "inline-flex";
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
  }

  function openCallOverlay() {
    const peerName = getPeerName();

    closeCallOverlay(false);

    callOverlay = document.createElement("div");
    callOverlay.id = "klevbyCallOverlay";
    callOverlay.className = "klevby-call-overlay";

    callOverlay.innerHTML = `
      <div class="klevby-call-card">
        <div class="klevby-call-avatar-wrap">
          <div class="klevby-call-pulse"></div>
          <div class="klevby-call-pulse"></div>
          <div class="klevby-call-avatar">${escapeHtml(getInitial(peerName))}</div>
        </div>

        <div class="klevby-call-name">${escapeHtml(peerName)}</div>
        <div class="klevby-call-status">Идёт вызов...</div>
        <div id="klevbyCallTimer" class="klevby-call-timer">00:00</div>

        <div class="klevby-call-actions">
          <button id="klevbyEndCallBtn" class="klevby-call-end" type="button" aria-label="Сбросить вызов">✕</button>
        </div>

        <div class="klevby-call-hint">
          Сейчас это тестовый звонок: экран вызова, гудок и сброс. Настоящий голосовой вызов подключим отдельным этапом.
        </div>
      </div>
    `;

    document.body.appendChild(callOverlay);

    document.documentElement.classList.add("klevby-chat-lock");
    document.body.classList.add("klevby-chat-lock");

    startTimer();
    startRingSound();
  }

  function handleClick(event) {
    const callButton = event.target.closest("#klevby-call-btn");

    if (callButton) {
      safeStopEvent(event);
      openCallOverlay();
      return;
    }

    const endButton = event.target.closest("#klevbyEndCallBtn");

    if (endButton) {
      safeStopEvent(event);
      closeCallOverlay(true);
      return;
    }
  }

  function handlePointerUp(event) {
    const endButton = event.target.closest("#klevbyEndCallBtn");

    if (endButton) {
      safeStopEvent(event);
      closeCallOverlay(true);
      return;
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && $("#klevbyCallOverlay")) {
      closeCallOverlay(true);
    }
  }

  function boot() {
    injectCallStyles();

    setInterval(forceAddCallButton, 300);

    const mutationObserver = new MutationObserver(function () {
      forceAddCallButton();
    });

    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    forceAddCallButton();
  }

  document.addEventListener("click", handleClick, true);
  document.addEventListener("pointerup", handlePointerUp, true);
  document.addEventListener("touchend", handlePointerUp, true);
  document.addEventListener("keydown", handleKeydown);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      closeCallOverlay(false);
    }
  });

  window.addEventListener("pagehide", function () {
    closeCallOverlay(false);
  });

  window.klevbyStartTestCall = openCallOverlay;
  window.klevbyEndTestCall = closeCallOverlay;
  window.klevbyCloseCallOverlay = closeCallOverlay;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
