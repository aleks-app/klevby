(function () {
  if (window.KlevbyCallUI) {
    return;
  }

  let context = {
    log: null,
    warn: null,

    safeStopEvent: null,

    getCallState: null,
    isPrivateDialogOpen: null,

    unlockAudioForMobile: null,
    tryPlayRemoteAudio: null,
    prepareRemoteAudioElement: null,
    startRemoteAudioRetry: null,

    startRingSound: null,
    stopRingSound: null,

    startCall: null,
    endCall: null,
    acceptIncomingCall: null,
    declineCall: null,

    incomingTimeoutMs: 45000
  };

  let callOverlay = null;
  let incomingOverlay = null;

  let callTimer = null;
  let callSeconds = 0;
  let incomingTimeoutTimer = null;

  let buttonObserver = null;
  let buttonUpdateTimer = null;

  function init(options = {}) {
    context = {
      ...context,
      ...options
    };
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function log(...args) {
    if (typeof context.log === "function") {
      context.log(...args);
      return;
    }

    console.log("Klevby calls:", ...args);
  }

  function warn(...args) {
    if (typeof context.warn === "function") {
      context.warn(...args);
      return;
    }

    console.warn("Klevby calls:", ...args);
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

  function getCallState() {
    if (typeof context.getCallState === "function") {
      return context.getCallState();
    }

    return "idle";
  }

  function isCallIdle() {
    return getCallState() === "idle";
  }

  function unlockAudioForMobile() {
    if (typeof context.unlockAudioForMobile === "function") {
      context.unlockAudioForMobile();
    }
  }

  function tryPlayRemoteAudio() {
    if (typeof context.tryPlayRemoteAudio === "function") {
      context.tryPlayRemoteAudio();
    }
  }

  function prepareRemoteAudioElement() {
    if (typeof context.prepareRemoteAudioElement === "function") {
      context.prepareRemoteAudioElement();
    }
  }

  function startRemoteAudioRetry() {
    if (typeof context.startRemoteAudioRetry === "function") {
      context.startRemoteAudioRetry();
    }
  }

  function startRingSound() {
    if (typeof context.startRingSound === "function") {
      context.startRingSound();
    }
  }

  function stopRingSound() {
    if (typeof context.stopRingSound === "function") {
      context.stopRingSound();
    }
  }

  function startCall() {
    if (typeof context.startCall === "function") {
      context.startCall();
    }
  }

  function endCall(reason = "ended") {
    if (typeof context.endCall === "function") {
      context.endCall(reason);
    }
  }

  function acceptIncomingCall() {
    if (typeof context.acceptIncomingCall === "function") {
      context.acceptIncomingCall();
    }
  }

  function declineCall() {
    if (typeof context.declineCall === "function") {
      context.declineCall();
    }
  }

  function isPrivateDialogOpen() {
    if (typeof context.isPrivateDialogOpen === "function") {
      return Boolean(context.isPrivateDialogOpen());
    }

    const chatWindow = $("#chat-window");

    return Boolean(
      chatWindow &&
      chatWindow.classList.contains("klevby-dialog-screen")
    );
  }

  function removeOldTestCallButton() {
    const oldTestButton = document.getElementById("klevby-chat-call");

    if (oldTestButton) {
      oldTestButton.remove();
    }

    const oldTestOverlay = document.getElementById("klevbyCallOverlay");

    if (oldTestOverlay && oldTestOverlay.textContent.includes("тестовый звонок")) {
      oldTestOverlay.remove();
    }
  }

  function getInitial(name) {
    const clean = String(name || "С").trim();
    return (clean[0] || "С").toUpperCase();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    startRingSound();
    prepareRemoteAudioElement();
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
    prepareRemoteAudioElement();
    startRemoteAudioRetry();
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
    startRingSound();
    prepareRemoteAudioElement();

    clearIncomingTimeout();

    incomingTimeoutTimer = setTimeout(() => {
      if (!isCallIdle()) {
        declineCall();
      }
    }, Number(context.incomingTimeoutMs) || 45000);
  }

  function clearIncomingTimeout() {
    if (incomingTimeoutTimer) {
      clearTimeout(incomingTimeoutTimer);
      incomingTimeoutTimer = null;
    }
  }

  function closeOverlaysOnly() {
    clearIncomingTimeout();

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
        unlockAudioForMobile();
        tryPlayRemoteAudio();
        endCall("ended");
      };
    }

    if (acceptButton) {
      acceptButton.onclick = function (event) {
        safeStopEvent(event);
        unlockAudioForMobile();
        acceptIncomingCall();
      };
    }

    if (declineButton) {
      declineButton.onclick = function (event) {
        safeStopEvent(event);
        unlockAudioForMobile();
        declineCall();
      };
    }
  }

  function ensureCallButton() {
    removeOldTestCallButton();

    const header = $("#chat-header");
    const closeButton = $("#close-chat");

    if (!header || !closeButton) return;

    let callButton = $("#klevby-call-btn");

    if (!callButton) {
      callButton = document.createElement("button");
      callButton.id = "klevby-call-btn";
      callButton.type = "button";
      callButton.setAttribute("aria-label", "Позвонить");
      callButton.setAttribute("title", "Позвонить");
      callButton.textContent = "📞";
      callButton.className = "hidden";

      closeButton.insertAdjacentElement("beforebegin", callButton);
    }

    updateCallButtonVisibility();
  }

  function updateCallButtonVisibility() {
    removeOldTestCallButton();

    const callButton = $("#klevby-call-btn");

    if (!callButton) return;

    if (isPrivateDialogOpen()) {
      callButton.classList.remove("hidden");
    } else {
      callButton.classList.add("hidden");
    }
  }

  function scheduleButtonUpdate() {
    clearTimeout(buttonUpdateTimer);

    buttonUpdateTimer = setTimeout(() => {
      ensureCallButton();
      updateCallButtonVisibility();
    }, 120);
  }

  function startButtonObserver() {
    if (buttonObserver || !document.body) return;

    buttonObserver = new MutationObserver(() => {
      scheduleButtonUpdate();
    });

    buttonObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-peer-id", "data-peer-name"]
    });
  }

  function stopButtonObserver() {
    if (!buttonObserver) return;

    buttonObserver.disconnect();
    buttonObserver = null;
  }

  function handleDocumentClick(event) {
    const oldTestButton = event.target.closest("#klevby-chat-call");

    if (oldTestButton) {
      safeStopEvent(event);
      oldTestButton.remove();
      return true;
    }

    if (event.target.closest(".klevby-call-overlay, .klevby-incoming-call-overlay")) {
      unlockAudioForMobile();
      tryPlayRemoteAudio();
    }

    const callButton = event.target.closest("#klevby-call-btn");

    if (callButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      startCall();
      return true;
    }

    const endButton = event.target.closest("#klevbyEndCallBtn");

    if (endButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      endCall("ended");
      return true;
    }

    const acceptButton = event.target.closest("#klevbyAcceptCallBtn");

    if (acceptButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      acceptIncomingCall();
      return true;
    }

    const declineButton = event.target.closest("#klevbyDeclineCallBtn");

    if (declineButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      declineCall();
      return true;
    }

    return false;
  }

  function handleTouchStart(event) {
    if (event.target.closest(".klevby-call-overlay, .klevby-incoming-call-overlay, #klevby-call-btn")) {
      unlockAudioForMobile();
      tryPlayRemoteAudio();
    }
  }

  function hasCallOverlay() {
    return Boolean(callOverlay || incomingOverlay || $("#klevbyCallOverlay") || $("#klevbyIncomingCallOverlay"));
  }

  function cleanupUI(options = {}) {
    const unlock = options.unlock !== false;

    clearIncomingTimeout();
    stopTimer();
    stopRingSound();
    closeOverlaysOnly();

    if (unlock) {
      unlockPageIfChatClosed();
    }

    scheduleButtonUpdate();
  }

  window.KlevbyCallUI = {
    init,

    removeOldTestCallButton,

    getInitial,
    escapeHtml,
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

    ensureCallButton,
    updateCallButtonVisibility,
    scheduleButtonUpdate,
    startButtonObserver,
    stopButtonObserver,

    bindCallButtons,
    handleDocumentClick,
    handleTouchStart,
    hasCallOverlay,

    clearIncomingTimeout,
    cleanupUI
  };
})();
