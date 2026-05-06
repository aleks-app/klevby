(function () {
  if (window.KlevbyCallUI) {
    return;
  }

  let context = {
    safeStopEvent: null,

    unlockAudioForMobile: null,
    tryPlayRemoteAudio: null,
    startRingSound: null,
    stopRingSound: null,
    prepareRemoteAudioElement: null,
    startRemoteAudioRetry: null,

    endCall: null,
    acceptIncomingCall: null,
    declineCall: null
  };

  let callOverlay = null;
  let incomingOverlay = null;
  let callTimer = null;
  let callSeconds = 0;

  function $(selector) {
    return document.querySelector(selector);
  }

  function init(options = {}) {
    context = {
      ...context,
      ...options
    };
  }

  function callContext(name, ...args) {
    if (typeof context[name] === "function") {
      return context[name](...args);
    }

    return undefined;
  }

  function safeStopEvent(event) {
    if (typeof context.safeStopEvent === "function") {
      context.safeStopEvent(event);
      return;
    }

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

  function showToast(text) {
    const oldToast = $("#klevbyCallToast");

    if (oldToast) {
      oldToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "klevbyCallToast";
    toast.textContent = text;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 2100);
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

  function setCallStatus(text) {
    const status = $("#klevbyCallStatus");

    if (status) {
      status.textContent = text;
    }
  }

  function buildCallScreen({ name, status, incoming = false }) {
    const safeName = escapeHtml(name || "Собеседник");

    return `
      <div class="klevby-call-card">
        <div class="klevby-call-avatar-wrap">
          <div class="klevby-call-pulse"></div>
          <div class="klevby-call-pulse"></div>
          <div class="klevby-call-avatar">${escapeHtml(getInitial(name))}</div>
        </div>

        <div class="klevby-call-name">${safeName}</div>
        <div id="klevbyCallStatus" class="klevby-call-status">${escapeHtml(status)}</div>
        <div id="klevbyCallTimer" class="klevby-call-timer">${incoming ? "" : "00:00"}</div>

        <div class="klevby-call-actions">
          ${
            incoming
              ? `
                <button id="klevbyAcceptCallBtn" class="klevby-call-action-btn klevby-call-accept" type="button" aria-label="Принять вызов">📞</button>
                <button id="klevbyDeclineCallBtn" class="klevby-call-action-btn klevby-call-decline" type="button" aria-label="Отклонить вызов">✕</button>
              `
              : `
                <button id="klevbyEndCallBtn" class="klevby-call-action-btn klevby-call-end" type="button" aria-label="Сбросить вызов">✕</button>
              `
          }
        </div>

        <div class="klevby-call-muted-note">
          Значок микрофона сверху — это системный индикатор доступа к микрофону, не запись разговора.
        </div>

        <audio id="klevbyRemoteAudio" class="klevby-remote-audio" autoplay playsinline webkit-playsinline></audio>
      </div>
    `;
  }

  function openOutgoingOverlay(peerName) {
    closeOverlaysOnly();

    callOverlay = document.createElement("div");
    callOverlay.id = "klevbyCallOverlay";
    callOverlay.className = "klevby-call-overlay";
    callOverlay.innerHTML = buildCallScreen({
      name: peerName,
      status: "Идёт вызов...",
      incoming: false
    });

    document.body.appendChild(callOverlay);

    lockPage();
    bindCallButtons();
    startTimer();

    callContext("startRingSound");
    callContext("prepareRemoteAudioElement");
  }

  function openActiveCallOverlay(peerName) {
    closeOverlaysOnly();

    callOverlay = document.createElement("div");
    callOverlay.id = "klevbyCallOverlay";
    callOverlay.className = "klevby-call-overlay";
    callOverlay.innerHTML = buildCallScreen({
      name: peerName,
      status: "Соединение установлено",
      incoming: false
    });

    document.body.appendChild(callOverlay);

    lockPage();
    bindCallButtons();
    startTimer();

    callContext("prepareRemoteAudioElement");
    callContext("startRemoteAudioRetry");
  }

  function openIncomingOverlay(payload = {}) {
    closeOverlaysOnly();

    incomingOverlay = document.createElement("div");
    incomingOverlay.id = "klevbyIncomingCallOverlay";
    incomingOverlay.className = "klevby-incoming-call-overlay";
    incomingOverlay.innerHTML = buildCallScreen({
      name: payload.callerName || "Собеседник",
      status: "Входящий вызов...",
      incoming: true
    });

    document.body.appendChild(incomingOverlay);

    lockPage();
    bindCallButtons();

    callContext("startRingSound");
    callContext("prepareRemoteAudioElement");
  }

  function closeOverlaysOnly() {
    const outgoing = $("#klevbyCallOverlay");
    const incoming = $("#klevbyIncomingCallOverlay");

    if (outgoing) {
      outgoing.remove();
    }

    if (incoming) {
      incoming.remove();
    }

    callOverlay = null;
    incomingOverlay = null;
  }

  function lockPage() {
    document.documentElement.classList.add("klevby-chat-lock");
    document.body.classList.add("klevby-chat-lock");
  }

  function unlockPageIfChatClosed() {
    const chatModal = $("#klevby-chat-modal");
    const chatIsOpen = chatModal && chatModal.classList.contains("open");

    if (!chatIsOpen) {
      document.documentElement.classList.remove("klevby-chat-lock");
      document.body.classList.remove("klevby-chat-lock");
    }
  }

  function bindCallButtons() {
    const endButton = $("#klevbyEndCallBtn");
    const acceptButton = $("#klevbyAcceptCallBtn");
    const declineButton = $("#klevbyDeclineCallBtn");

    if (endButton) {
      endButton.onclick = function (event) {
        safeStopEvent(event);
        callContext("unlockAudioForMobile");
        callContext("tryPlayRemoteAudio");
        callContext("endCall", "ended");
      };
    }

    if (acceptButton) {
      acceptButton.onclick = function (event) {
        safeStopEvent(event);
        callContext("unlockAudioForMobile");
        callContext("acceptIncomingCall");
      };
    }

    if (declineButton) {
      declineButton.onclick = function (event) {
        safeStopEvent(event);
        callContext("unlockAudioForMobile");
        callContext("declineCall");
      };
    }
  }

  function getCallOverlay() {
    return callOverlay || $("#klevbyCallOverlay");
  }

  function getIncomingOverlay() {
    return incomingOverlay || $("#klevbyIncomingCallOverlay");
  }

  function hasActiveOverlay() {
    return Boolean(getCallOverlay() || getIncomingOverlay());
  }

  function cleanupUI() {
    stopTimer();
    closeOverlaysOnly();
    unlockPageIfChatClosed();
  }

  window.KlevbyCallUI = {
    init,

    escapeHtml,
    getInitial,
    formatCallTime,

    showToast,
    startTimer,
    stopTimer,
    setCallStatus,

    buildCallScreen,
    openOutgoingOverlay,
    openActiveCallOverlay,
    openIncomingOverlay,
    closeOverlaysOnly,

    lockPage,
    unlockPageIfChatClosed,
    bindCallButtons,

    getCallOverlay,
    getIncomingOverlay,
    hasActiveOverlay,
    cleanupUI
  };
})();
