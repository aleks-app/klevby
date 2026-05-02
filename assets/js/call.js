(function () {
  if (window.__klevbyCallLoaded) {
    return;
  }

  window.__klevbyCallLoaded = true;

  let callModal = null;
  let callTimer = null;
  let callSeconds = 0;

  let audioContext = null;
  let beepInterval = null;
  let activeOscillator = null;
  let activeGain = null;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCurrentPeerName() {
    const title = document.getElementById("chatTitle");
    const text = title ? title.textContent.trim() : "";

    if (!text) return "Рыбак";
    if (text === "Чат рыбаков") return "Рыбак";
    if (text === "Личные сообщения") return "Рыбак";

    return text;
  }

  function getCurrentPeerAvatar() {
    const avatar = document.getElementById("chatAvatar");
    const text = avatar ? avatar.textContent.trim() : "";

    return text || "🎣";
  }

  function formatCallTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function ensureCallStyles() {
    if (document.getElementById("klevby-call-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "klevby-call-styles";

    style.textContent = `
      .klevby-call-hidden {
        display: none !important;
      }

      .klevby-call-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483600 !important;
        background:
          radial-gradient(circle at 50% 12%, rgba(87, 230, 178, 0.20), transparent 34%),
          linear-gradient(180deg, #0d2520 0%, #06110f 48%, #030807 100%) !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: stretch !important;
        justify-content: center !important;
        font-family: Montserrat, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }

      .klevby-call-screen {
        width: min(430px, 100%) !important;
        min-height: 100dvh !important;
        padding: max(28px, env(safe-area-inset-top)) 22px max(24px, env(safe-area-inset-bottom)) !important;
        display: grid !important;
        grid-template-rows: auto 1fr auto !important;
        text-align: center !important;
      }

      .klevby-call-top {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
      }

      .klevby-call-status-pill {
        min-height: 38px !important;
        padding: 0 14px !important;
        border-radius: 999px !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.10) !important;
        color: rgba(255, 255, 255, 0.72) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 13px !important;
        font-weight: 800 !important;
      }

      .klevby-call-close {
        width: 42px !important;
        height: 42px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(255, 255, 255, 0.08) !important;
        color: #ffffff !important;
        font-size: 24px !important;
        font-weight: 900 !important;
        cursor: pointer !important;
      }

      .klevby-call-main {
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 18px !important;
      }

      .klevby-call-avatar-wrap {
        position: relative !important;
        width: 150px !important;
        height: 150px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .klevby-call-pulse,
      .klevby-call-pulse-two {
        position: absolute !important;
        inset: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.13) !important;
        border: 1px solid rgba(87, 230, 178, 0.20) !important;
        animation: klevbyCallPulse 1.85s ease-out infinite !important;
      }

      .klevby-call-pulse-two {
        animation-delay: 0.55s !important;
      }

      .klevby-call-avatar {
        position: relative !important;
        z-index: 2 !important;
        width: 112px !important;
        height: 112px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, rgba(87, 230, 178, 0.30), rgba(40, 201, 144, 0.12)) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        box-shadow: 0 18px 55px rgba(0,0,0,0.42) !important;
        color: #dffff0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 46px !important;
        font-weight: 900 !important;
      }

      .klevby-call-name {
        max-width: 100% !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 30px !important;
        line-height: 1.12 !important;
        font-weight: 900 !important;
        color: #ffffff !important;
      }

      .klevby-call-subtitle {
        margin-top: -8px !important;
        color: rgba(255, 255, 255, 0.58) !important;
        font-size: 15px !important;
        font-weight: 700 !important;
      }

      .klevby-call-timer {
        min-height: 30px !important;
        color: rgba(255, 255, 255, 0.72) !important;
        font-size: 20px !important;
        font-weight: 900 !important;
        letter-spacing: 0.03em !important;
      }

      .klevby-call-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 22px !important;
        padding-bottom: 8px !important;
      }

      .klevby-call-action {
        width: 74px !important;
        height: 74px !important;
        border: 0 !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 30px !important;
        cursor: pointer !important;
        box-shadow: 0 18px 45px rgba(0,0,0,0.30) !important;
      }

      .klevby-call-hangup {
        background: #e05252 !important;
        color: #ffffff !important;
      }

      .klevby-call-muted {
        background: rgba(255, 255, 255, 0.10) !important;
        color: #ffffff !important;
      }

      @keyframes klevbyCallPulse {
        0% {
          transform: scale(0.72);
          opacity: 0.95;
        }

        100% {
          transform: scale(1.35);
          opacity: 0;
        }
      }

      .klevby-chat-call {
        width: 38px !important;
        height: 38px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.16) !important;
        color: #c8ffe0 !important;
        font-size: 19px !important;
        line-height: 1 !important;
        cursor: pointer !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .klevby-dialog-screen .klevby-chat-call {
        display: flex !important;
      }

      .klevby-dialog-screen .klevby-chat-close {
        display: none !important;
      }

      @media (max-width: 768px) {
        .klevby-call-screen {
          width: 100% !important;
        }

        .klevby-call-name {
          font-size: 28px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureCallModal() {
    if (callModal) {
      return callModal;
    }

    ensureCallStyles();

    const html = `
      <div id="klevbyCallModal" class="klevby-call-backdrop klevby-call-hidden">
        <div class="klevby-call-screen">
          <div class="klevby-call-top">
            <div class="klevby-call-status-pill" id="klevbyCallStatus">Исходящий вызов</div>
            <button class="klevby-call-close" id="klevbyCallCloseBtn" type="button" aria-label="Закрыть">×</button>
          </div>

          <div class="klevby-call-main">
            <div class="klevby-call-avatar-wrap">
              <div class="klevby-call-pulse"></div>
              <div class="klevby-call-pulse-two"></div>
              <div class="klevby-call-avatar" id="klevbyCallAvatar">🎣</div>
            </div>

            <div class="klevby-call-name" id="klevbyCallName">Рыбак</div>
            <div class="klevby-call-subtitle" id="klevbyCallSubtitle">Звоним...</div>
            <div class="klevby-call-timer" id="klevbyCallTimer">00:00</div>
          </div>

          <div class="klevby-call-actions">
            <button class="klevby-call-action klevby-call-muted" id="klevbyCallSoundBtn" type="button" aria-label="Звук">🔊</button>
            <button class="klevby-call-action klevby-call-hangup" id="klevbyCallHangupBtn" type="button" aria-label="Сбросить">✕</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);

    callModal = document.getElementById("klevbyCallModal");

    document.getElementById("klevbyCallCloseBtn").addEventListener("click", endCall);
    document.getElementById("klevbyCallHangupBtn").addEventListener("click", endCall);

    document.getElementById("klevbyCallSoundBtn").addEventListener("click", function () {
      const isMuted = this.dataset.muted === "1";

      if (isMuted) {
        this.dataset.muted = "0";
        this.textContent = "🔊";
        startBeepLoop();
      } else {
        this.dataset.muted = "1";
        this.textContent = "🔇";
        stopBeepLoop();
      }
    });

    return callModal;
  }

  function ensureChatCallButton() {
    const header = document.getElementById("chat-header");
    const closeBtn = document.getElementById("close-chat");

    if (!header || !closeBtn) return;

    if (document.getElementById("chat-call-btn")) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = "chat-call-btn";
    btn.className = "klevby-chat-call";
    btn.type = "button";
    btn.setAttribute("aria-label", "Позвонить");
    btn.title = "Позвонить";
    btn.textContent = "📞";

    closeBtn.parentNode.insertBefore(btn, closeBtn);

    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      startCall();
    });
  }

  function startCall() {
    ensureCallModal();

    const name = getCurrentPeerName();
    const avatar = getCurrentPeerAvatar();

    document.getElementById("klevbyCallName").textContent = name;
    document.getElementById("klevbyCallAvatar").textContent = avatar;
    document.getElementById("klevbyCallStatus").textContent = "Исходящий вызов";
    document.getElementById("klevbyCallSubtitle").textContent = "Звоним...";
    document.getElementById("klevbyCallTimer").textContent = "00:00";

    callSeconds = 0;

    callModal.classList.remove("klevby-call-hidden");

    document.documentElement.classList.add("klevby-chat-lock");
    document.body.classList.add("klevby-chat-lock");

    clearInterval(callTimer);
    callTimer = setInterval(function () {
      callSeconds += 1;

      const timer = document.getElementById("klevbyCallTimer");
      if (timer) {
        timer.textContent = formatCallTime(callSeconds);
      }

      const subtitle = document.getElementById("klevbyCallSubtitle");
      if (subtitle) {
        subtitle.textContent = callSeconds < 8 ? "Звоним..." : "Нет ответа";
      }
    }, 1000);

    startBeepLoop();

    setTimeout(function () {
      if (!callModal || callModal.classList.contains("klevby-call-hidden")) {
        return;
      }

      const subtitle = document.getElementById("klevbyCallSubtitle");
      if (subtitle) {
        subtitle.textContent = "Пока это тестовый вызов";
      }
    }, 12000);
  }

  function endCall() {
    clearInterval(callTimer);
    callTimer = null;
    callSeconds = 0;

    stopBeepLoop();

    if (callModal) {
      callModal.classList.add("klevby-call-hidden");
    }

    document.documentElement.classList.remove("klevby-chat-lock");
    document.body.classList.remove("klevby-chat-lock");
  }

  function getAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(function () {});
    }

    return audioContext;
  }

  function playBeep() {
    const ctx = getAudioContext();

    if (!ctx) return;

    try {
      stopActiveTone();

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(420, ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.78);

      activeOscillator = oscillator;
      activeGain = gain;
    } catch (error) {
      console.warn("Не удалось проиграть гудок:", error);
    }
  }

  function stopActiveTone() {
    try {
      if (activeOscillator) {
        activeOscillator.stop();
      }
    } catch (error) {}

    try {
      if (activeOscillator) {
        activeOscillator.disconnect();
      }

      if (activeGain) {
        activeGain.disconnect();
      }
    } catch (error) {}

    activeOscillator = null;
    activeGain = null;
  }

  function startBeepLoop() {
    stopBeepLoop();

    const soundBtn = document.getElementById("klevbyCallSoundBtn");
    if (soundBtn && soundBtn.dataset.muted === "1") {
      return;
    }

    playBeep();

    beepInterval = setInterval(function () {
      playBeep();
    }, 2600);
  }

  function stopBeepLoop() {
    clearInterval(beepInterval);
    beepInterval = null;
    stopActiveTone();
  }

  function boot() {
    ensureCallStyles();

    const buttonObserver = new MutationObserver(function () {
      ensureChatCallButton();
    });

    buttonObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    ensureChatCallButton();

    document.addEventListener("click", function (event) {
      const callBtn = event.target.closest("#chat-call-btn, .klevby-chat-call");

      if (!callBtn) return;

      event.preventDefault();
      event.stopPropagation();

      startCall();
    });

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && callModal && !callModal.classList.contains("klevby-call-hidden")) {
        endCall();
      }
    });

    window.klevbyStartTestCall = startCall;
    window.klevbyEndTestCall = endCall;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
