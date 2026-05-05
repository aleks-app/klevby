(function () {
  if (window.__klevbyCallLoadedV6) return;
  window.__klevbyCallLoadedV6 = true;

  window.__klevbyCallLoadedV5 = true;
  window.__klevbyCallLoadedV4 = true;
  window.__klevbyCallLoadedV3 = true;

  const CALL_TIMEOUT_MS = 45000;
  const AUTH_REFRESH_THROTTLE_MS = 2500;
  const PERSONAL_CHANNEL_THROTTLE_MS = 1800;
  const ICE_GATHERING_WAIT_MS = 4500;

  /*
    Важно:
    Сейчас звонки работают через Supabase Realtime broadcast.
    Таблица calls для самого разговора не нужна.
    Отключаем REST-записи, чтобы не ловить 400 Bad Request в консоли.
  */
  const SAVE_CALL_RECORDS = false;

  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" }
  ];

  let supabaseClient = null;
  let currentUser = null;
  let activePeer = null;
  let lastKnownPeer = null;

  let callState = "idle";
  let callId = null;
  let callChannel = null;
  let personalChannel = null;

  let peerConnection = null;
  let localStream = null;
  let remoteStream = null;

  let callOverlay = null;
  let incomingOverlay = null;
  let callTimer = null;
  let callSeconds = 0;
  let callTimeoutTimer = null;

  let audioContext = null;
  let ringInterval = null;
  let activeOscillator = null;
  let activeGain = null;

  let remoteAudioSourceNode = null;
  let remoteAudioSourceStream = null;
  let remoteAudioRetryTimer = null;
  let audioUnlocked = false;

  let buttonObserver = null;
  let buttonUpdateTimer = null;
  let personalChannelUserId = "";

  let userRefreshPromise = null;
  let lastUserRefreshAt = 0;

  let personalChannelPromise = null;
  let lastPersonalChannelEnsureAt = 0;

  let pendingRemoteIceCandidates = [];
  let callRecordCreated = false;

  function $(selector) {
    return document.querySelector(selector);
  }

  function log(...args) {
    console.log("Klevby calls:", ...args);
  }

  function warn(...args) {
    console.warn("Klevby calls:", ...args);
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

  function getMainSupabaseClient() {
    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      supabaseClient
    );
  }

  function getMainUser() {
    return (
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      currentUser ||
      null
    );
  }

  async function refreshUser(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    const mainClient = getMainSupabaseClient();
    const mainUser = getMainUser();

    supabaseClient = mainClient || supabaseClient;

    if (mainUser && mainUser.id) {
      currentUser = mainUser;
      lastUserRefreshAt = now;
      return currentUser;
    }

    if (!force && currentUser && currentUser.id && now - lastUserRefreshAt < AUTH_REFRESH_THROTTLE_MS) {
      return currentUser;
    }

    if (!force && userRefreshPromise) {
      return userRefreshPromise;
    }

    if (!mainClient?.auth?.getUser) {
      return currentUser || null;
    }

    lastUserRefreshAt = now;

    userRefreshPromise = (async () => {
      try {
        const { data, error } = await mainClient.auth.getUser();

        if (error) {
          warn("user refresh warning", error);
          return currentUser || null;
        }

        if (data?.user) {
          currentUser = data.user;
          window.klevbyCurrentUser = currentUser;
          window.currentUser = currentUser;
          window.klevbyUser = currentUser;
          return currentUser;
        }

        return currentUser || null;
      } catch (error) {
        warn("user refresh failed", error);
        return currentUser || null;
      } finally {
        userRefreshPromise = null;
      }
    })();

    return userRefreshPromise;
  }

  function cleanDisplayName(value) {
    let name = String(value || "").trim();

    if (!name) return "";

    if (name.includes("@")) {
      name = name.split("@")[0];
    }

    return name
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 32);
  }

  function getUserName(user = currentUser) {
    const meta = user?.user_metadata || {};

    return (
      cleanDisplayName(meta.nickname) ||
      cleanDisplayName(meta.username) ||
      cleanDisplayName(meta.display_name) ||
      cleanDisplayName(meta.name) ||
      cleanDisplayName(meta.full_name) ||
      cleanDisplayName(localStorage.getItem("klevby_chat_username")) ||
      cleanDisplayName(localStorage.getItem("klevby_author_name")) ||
      cleanDisplayName(user?.email) ||
      "Рыбак"
    );
  }

  function setLastKnownPeer(peer) {
    if (!peer || !peer.id) {
      lastKnownPeer = null;
      return;
    }

    lastKnownPeer = {
      id: String(peer.id),
      name: cleanDisplayName(peer.name) || "Собеседник"
    };
  }

  function getPeerFromChat() {
    const chatWindow = $("#chat-window");
    const title = $("#chatTitle");

    if (!chatWindow || !chatWindow.classList.contains("klevby-dialog-screen")) {
      return null;
    }

    const savedPeer = window.klevbySelectedPeer || window.selectedPeer || lastKnownPeer || null;

    if (savedPeer && savedPeer.id) {
      return {
        id: String(savedPeer.id),
        name: cleanDisplayName(savedPeer.name) || cleanDisplayName(title?.textContent) || "Собеседник"
      };
    }

    const peerId =
      chatWindow.dataset.peerId ||
      chatWindow.getAttribute("data-peer-id") ||
      "";

    const peerName =
      cleanDisplayName(chatWindow.dataset.peerName) ||
      cleanDisplayName(chatWindow.getAttribute("data-peer-name")) ||
      cleanDisplayName(title?.textContent) ||
      "Собеседник";

    if (!peerId) {
      return null;
    }

    return {
      id: String(peerId),
      name: peerName
    };
  }

  function isPrivateDialogOpen() {
    const chatWindow = $("#chat-window");
    const peer = getPeerFromChat();

    return Boolean(
      chatWindow &&
      chatWindow.classList.contains("klevby-dialog-screen") &&
      peer &&
      peer.id
    );
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

  function safeStopEvent(event) {
    if (!event) return;

    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function formatCallTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function showToast(text) {
    const oldToast = $("#klevbyCallToast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.id = "klevbyCallToast";
    toast.textContent = text;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2100);
  }

  function injectStyles() {
    const oldV6 = $("#klevby-call-styles-v6");
    if (oldV6) oldV6.remove();

    const oldV5 = $("#klevby-call-styles-v5");
    if (oldV5) oldV5.remove();

    const oldV4 = $("#klevby-call-styles-v4");
    if (oldV4) oldV4.remove();

    const oldV3 = $("#klevby-call-styles-v3");
    if (oldV3) oldV3.remove();

    const style = document.createElement("style");
    style.id = "klevby-call-styles-v6";

    style.textContent = `
      #klevby-chat-call {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #klevby-call-btn {
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        flex: 0 0 auto !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.18) !important;
        color: #d9ffed !important;
        font-size: 22px !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28), 0 0 22px rgba(87, 230, 178, 0.16) !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
      }

      #klevby-call-btn:active {
        transform: scale(0.94) !important;
      }

      #klevby-call-btn.hidden {
        display: none !important;
      }

      .klevby-call-overlay,
      .klevby-incoming-call-overlay {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483640 !important;
        background:
          radial-gradient(circle at 50% 24%, rgba(87, 230, 178, 0.18), transparent 38%),
          linear-gradient(180deg, #0d2a23 0%, #041012 100%) !important;
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
        width: 150px !important;
        height: 150px !important;
        margin-bottom: 34px !important;
      }

      .klevby-call-pulse {
        position: absolute !important;
        inset: 0 !important;
        border-radius: 50% !important;
        background: rgba(87, 230, 178, 0.14) !important;
        animation: klevbyCallPulse 1.55s ease-out infinite !important;
      }

      .klevby-call-pulse:nth-child(2) {
        animation-delay: 0.45s !important;
      }

      .klevby-call-avatar {
        position: relative !important;
        z-index: 2 !important;
        width: 150px !important;
        height: 150px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #1f6f58, #174139) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 64px !important;
        font-weight: 900 !important;
        color: #d9ffed !important;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42) !important;
      }

      .klevby-call-name {
        max-width: 100% !important;
        font-size: 32px !important;
        line-height: 1.15 !important;
        font-weight: 900 !important;
        color: #ffffff !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .klevby-call-status {
        margin-top: 12px !important;
        font-size: 17px !important;
        font-weight: 800 !important;
        color: rgba(255, 255, 255, 0.64) !important;
      }

      .klevby-call-timer {
        margin-top: 14px !important;
        min-height: 24px !important;
        font-size: 16px !important;
        font-weight: 900 !important;
        color: rgba(200, 255, 224, 0.9) !important;
      }

      .klevby-call-actions {
        margin-top: 76px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 38px !important;
      }

      .klevby-call-action-btn {
        width: 78px !important;
        height: 78px !important;
        border: 0 !important;
        border-radius: 50% !important;
        color: #ffffff !important;
        font-size: 31px !important;
        line-height: 1 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        -webkit-tap-highlight-color: transparent !important;
        user-select: none !important;
        touch-action: manipulation !important;
      }

      .klevby-call-action-btn:active {
        transform: scale(0.94) !important;
      }

      .klevby-call-accept {
        background: #28c990 !important;
        box-shadow: 0 18px 48px rgba(40, 201, 144, 0.32) !important;
      }

      .klevby-call-end,
      .klevby-call-decline {
        background: #e05252 !important;
        box-shadow: 0 18px 48px rgba(224, 82, 82, 0.34) !important;
      }

      .klevby-call-muted-note {
        margin-top: 28px !important;
        max-width: 340px !important;
        font-size: 13px !important;
        line-height: 1.55 !important;
        font-weight: 700 !important;
        color: rgba(255, 255, 255, 0.42) !important;
      }

      .klevby-remote-audio {
        position: fixed !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0.01 !important;
        pointer-events: none !important;
      }

      #klevbyCallToast {
        position: fixed !important;
        left: 50% !important;
        bottom: max(26px, env(safe-area-inset-bottom)) !important;
        transform: translateX(-50%) !important;
        z-index: 2147483641 !important;
        padding: 11px 15px !important;
        border-radius: 999px !important;
        background: rgba(12, 22, 25, 0.96) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.88) !important;
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
          transform: scale(1.82);
          opacity: 0;
        }
      }

      @media (max-width: 768px) {
        .klevby-call-overlay,
        .klevby-incoming-call-overlay {
          padding-top: max(24px, env(safe-area-inset-top)) !important;
          padding-bottom: max(24px, env(safe-area-inset-bottom)) !important;
        }

        .klevby-call-card {
          min-height: 100% !important;
        }

        .klevby-call-name {
          font-size: 30px !important;
        }
      }
    `;

    document.head.appendChild(style);
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

  function unlockAudioForMobile() {
    const ctx = ensureAudioContext();

    if (!ctx) {
      audioUnlocked = true;
      return;
    }

    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      gain.gain.value = 0.00001;

      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      audioUnlocked = true;
      log("mobile audio unlocked");
    } catch (error) {
      audioUnlocked = true;
      warn("mobile audio unlock skipped", error);
    }
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
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.03);
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

      if (activeOscillator === oscillator) activeOscillator = null;
      if (activeGain === gain) activeGain = null;
    };
  }

  function startRingSound() {
    stopRingSound();
    unlockAudioForMobile();

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

  function startTimer() {
    stopTimer();
    callSeconds = 0;

    const timerEl = $("#klevbyCallTimer");
    if (timerEl) timerEl.textContent = "00:00";

    callTimer = setInterval(() => {
      callSeconds += 1;

      const el = $("#klevbyCallTimer");
      if (el) el.textContent = formatCallTime(callSeconds);
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
    if (status) status.textContent = text;
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

  function openIncomingOverlay(payload) {
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

    callTimeoutTimer = setTimeout(() => {
      declineCall();
    }, CALL_TIMEOUT_MS);
  }

  function closeOverlaysOnly() {
    const outgoing = $("#klevbyCallOverlay");
    const incoming = $("#klevbyIncomingCallOverlay");

    if (outgoing) outgoing.remove();
    if (incoming) incoming.remove();

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

  function getPeerIdForSignal() {
    if (!activePeer?.id) return "";
    return String(activePeer.id);
  }

  function getMyId() {
    return String(currentUser?.id || "");
  }

  function makeUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === "x" ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function makeCallId() {
    return makeUuid();
  }

  async function waitForIceGatheringComplete(pc, label = "") {
    if (!pc) return;

    if (pc.iceGatheringState === "complete") {
      log("ice gathering already complete", label);
      return;
    }

    log("ice gathering wait", label, pc.iceGatheringState);

    await new Promise((resolve) => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        clearTimeout(timer);
        log("ice gathering finish", label, pc.iceGatheringState);
        resolve();
      };

      const onStateChange = () => {
        log("iceGatheringState", label, pc.iceGatheringState);
        if (pc.iceGatheringState === "complete") {
          finish();
        }
      };

      const timer = setTimeout(finish, ICE_GATHERING_WAIT_MS);
      pc.addEventListener("icegatheringstatechange", onStateChange);
    });
  }

  function getRemoteAudioElement() {
    return $("#klevbyRemoteAudio");
  }

  function prepareRemoteAudioElement() {
    const audio = getRemoteAudioElement();

    if (!audio) return null;

    try {
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = 1;
    } catch (error) {
      warn("remote audio prepare failed", error);
    }

    return audio;
  }

  function attachRemoteStreamToAudio() {
    const audio = prepareRemoteAudioElement();

    if (!audio || !remoteStream) return;

    try {
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = 1;

      if (audio.srcObject !== remoteStream) {
        audio.srcObject = remoteStream;
      }

      log("remote audio attached", {
        tracks: remoteStream.getTracks().map((track) => ({
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        }))
      });
    } catch (error) {
      warn("remote audio attach failed", error);
    }
  }

  function connectRemoteStreamToAudioContext() {
    if (!remoteStream || !remoteStream.getAudioTracks().length) return;

    const ctx = ensureAudioContext();
    if (!ctx) return;

    try {
      if (remoteAudioSourceNode && remoteAudioSourceStream === remoteStream) {
        return;
      }

      if (remoteAudioSourceNode) {
        try {
          remoteAudioSourceNode.disconnect();
        } catch (error) {}
      }

      remoteAudioSourceNode = ctx.createMediaStreamSource(remoteStream);
      remoteAudioSourceStream = remoteStream;
      remoteAudioSourceNode.connect(ctx.destination);

      log("remote stream connected to audio context");
    } catch (error) {
      warn("remote audio context connect skipped", error);
    }
  }

  function tryPlayRemoteAudio() {
    const audio = prepareRemoteAudioElement();

    unlockAudioForMobile();

    if (!audio) return;

    attachRemoteStreamToAudio();
    connectRemoteStreamToAudioContext();

    if (!remoteStream || !remoteStream.getAudioTracks().length) {
      return;
    }

    try {
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = 1;

      const playResult = audio.play();

      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => {
            log("remote audio playing");
          })
          .catch((error) => {
            warn("remote audio play blocked", error);
            showToast("Нажми по экрану звонка, чтобы включить звук.");
          });
      }
    } catch (error) {
      warn("remote audio play failed", error);
    }
  }

  function startRemoteAudioRetry() {
    stopRemoteAudioRetry();

    let tries = 0;

    remoteAudioRetryTimer = setInterval(() => {
      tries += 1;

      if (callState === "idle" || tries > 16) {
        stopRemoteAudioRetry();
        return;
      }

      tryPlayRemoteAudio();
    }, 650);
  }

  function stopRemoteAudioRetry() {
    if (remoteAudioRetryTimer) {
      clearInterval(remoteAudioRetryTimer);
      remoteAudioRetryTimer = null;
    }
  }

  function handleRemoteTrack(event) {
    log("remote track received", {
      streams: event.streams?.length || 0,
      trackKind: event.track?.kind || "unknown",
      trackEnabled: event.track?.enabled,
      trackMuted: event.track?.muted,
      trackReadyState: event.track?.readyState
    });

    if (!remoteStream) {
      remoteStream = new MediaStream();
    }

    if (event.track) {
      event.track.enabled = true;

      event.track.onunmute = () => {
        log("remote track unmuted", event.track.id);
        tryPlayRemoteAudio();
      };

      event.track.onmute = () => {
        log("remote track muted", event.track.id);
      };

      event.track.onended = () => {
        log("remote track ended", event.track.id);
      };
    }

    if (event.streams && event.streams[0]) {
      event.streams[0].getTracks().forEach((track) => {
        track.enabled = true;

        if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
    } else if (event.track) {
      if (!remoteStream.getTracks().some((item) => item.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }

    attachRemoteStreamToAudio();
    connectRemoteStreamToAudioContext();
    tryPlayRemoteAudio();
    startRemoteAudioRetry();
  }

  async function addRemoteIceCandidate(candidate) {
    if (!candidate || !peerConnection) return;

    if (!peerConnection.remoteDescription) {
      pendingRemoteIceCandidates.push(candidate);
      log("remote ice queued");
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      log("remote ice added");
    } catch (error) {
      warn("ice failed", error);
    }
  }

  async function flushPendingRemoteIceCandidates() {
    if (!peerConnection || !peerConnection.remoteDescription) return;
    if (!pendingRemoteIceCandidates.length) return;

    const candidates = [...pendingRemoteIceCandidates];
    pendingRemoteIceCandidates = [];

    for (const candidate of candidates) {
      await addRemoteIceCandidate(candidate);
    }
  }

  async function createCallChannel(id) {
    const client = getMainSupabaseClient();

    if (!client || !id) {
      throw new Error("Нет подключения к Supabase.");
    }

    if (callChannel) {
      try {
        await client.removeChannel(callChannel);
      } catch (error) {}
      callChannel = null;
    }

    callChannel = client.channel(`klevby_call_${id}`, {
      config: {
        broadcast: {
          self: false,
          ack: true
        }
      }
    });

    callChannel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (!payload || payload.to !== getMyId()) return;
      if (!peerConnection || !payload.answer) return;

      try {
        log("answer received");

        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushPendingRemoteIceCandidates();

        setCallStatus("Соединение установлено");
        stopRingSound();
        tryPlayRemoteAudio();
        startRemoteAudioRetry();
      } catch (error) {
        warn("answer failed", error);
        endCall("error", "Не удалось принять ответ вызова.");
      }
    });

    callChannel.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (!payload || payload.to !== getMyId()) return;
      if (!payload.candidate) return;

      log("remote ice received");
      await addRemoteIceCandidate(payload.candidate);
    });

    callChannel.on("broadcast", { event: "end" }, ({ payload }) => {
      if (!payload || payload.to !== getMyId()) return;
      cleanupCall(false);
      showToast("Вызов завершён");
    });

    await new Promise((resolve, reject) => {
      callChannel.subscribe((status) => {
        log("call channel status", status);

        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error("Не удалось подключить канал звонка."));
        }
      });
    });

    return callChannel;
  }

  async function ensurePersonalChannel(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    if (!force && personalChannelPromise) {
      return personalChannelPromise;
    }

    if (
      !force &&
      personalChannel &&
      personalChannelUserId &&
      currentUser?.id &&
      personalChannelUserId === String(currentUser.id) &&
      now - lastPersonalChannelEnsureAt < PERSONAL_CHANNEL_THROTTLE_MS
    ) {
      return;
    }

    personalChannelPromise = (async () => {
      lastPersonalChannelEnsureAt = Date.now();

      await refreshUser({ force });

      const client = getMainSupabaseClient();
      const myId = getMyId();

      if (!client || !myId) return;

      if (personalChannel && personalChannelUserId === myId) {
        return;
      }

      if (personalChannel) {
        try {
          await client.removeChannel(personalChannel);
        } catch (error) {}
        personalChannel = null;
        personalChannelUserId = "";
      }

      personalChannelUserId = myId;

      personalChannel = client.channel(`klevby_user_calls_${myId}`, {
        config: {
          broadcast: {
            self: false,
            ack: true
          }
        }
      });

      personalChannel.on("broadcast", { event: "incoming_call" }, async ({ payload }) => {
        if (!payload || payload.to !== myId) return;

        log("incoming_call received", payload.callId);

        await refreshUser();

        if (!currentUser || String(currentUser.id) !== myId) {
          return;
        }

        if (callState !== "idle") {
          const busyChannel = client.channel(`klevby_call_${payload.callId}`, {
            config: {
              broadcast: {
                self: false,
                ack: true
              }
            }
          });

          busyChannel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await busyChannel.send({
                type: "broadcast",
                event: "end",
                payload: {
                  callId: payload.callId,
                  from: myId,
                  to: payload.from,
                  reason: "busy"
                }
              });

              client.removeChannel(busyChannel);
            }
          });

          return;
        }

        callState = "incoming";
        callId = payload.callId;
        callRecordCreated = false;
        pendingRemoteIceCandidates = [];

        activePeer = {
          id: String(payload.from),
          name: cleanDisplayName(payload.callerName) || "Собеседник",
          offer: payload.offer
        };

        openIncomingOverlay(payload);
        await createCallChannel(callId);
      });

      personalChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          log("personal channel ready", myId);
        }
      });
    })();

    try {
      return await personalChannelPromise;
    } finally {
      personalChannelPromise = null;
    }
  }

  async function sendToPersonalChannel(userId, event, payload) {
    const client = getMainSupabaseClient();

    if (!client || !userId) {
      throw new Error("Нет подключения к Supabase.");
    }

    const channel = client.channel(`klevby_user_calls_${userId}`, {
      config: {
        broadcast: {
          self: false,
          ack: true
        }
      }
    });

    await new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        log("temporary personal channel status", status);

        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error("Собеседник сейчас недоступен."));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event,
      payload
    });

    log("personal event sent", event, userId);

    setTimeout(() => {
      try {
        client.removeChannel(channel);
      } catch (error) {}
    }, 1600);
  }

  async function updateCallRecord(status) {
    if (!SAVE_CALL_RECORDS) return;
    if (!callRecordCreated) return;

    const client = getMainSupabaseClient();

    if (!client || !callId) return;

    try {
      const { error } = await client
        .from("calls")
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", callId);

      if (error) {
        warn("call record update skipped", error);
      }
    } catch (error) {
      warn("call record update skipped", error);
    }
  }

  async function createCallRecord(peer) {
    callRecordCreated = false;

    if (!SAVE_CALL_RECORDS) return;

    const client = getMainSupabaseClient();

    if (!client || !currentUser || !peer?.id || !callId) return;

    try {
      const { error } = await client.from("calls").insert([
        {
          id: callId,
          caller_id: currentUser.id,
          receiver_id: peer.id,
          caller_name: getUserName(currentUser),
          receiver_name: peer.name || "Собеседник",
          status: "ringing",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      if (error) {
        warn("call record skipped", error);
        callRecordCreated = false;
        return;
      }

      callRecordCreated = true;
    } catch (error) {
      warn("call record skipped", error);
      callRecordCreated = false;
    }
  }

  async function requestMicrophoneStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Браузер не поддерживает микрофон для звонков.");
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
    } catch (firstError) {
      warn("advanced microphone constraints failed, retry audio:true", firstError);

      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
    }
  }

  async function setupPeerConnection() {
    const myId = getMyId();
    const peerId = getPeerIdForSignal();

    unlockAudioForMobile();

    log("request microphone");

    localStream = await requestMicrophoneStream();

    const localAudioTracks = localStream.getAudioTracks();

    if (!localAudioTracks.length) {
      throw new Error("Микрофон не найден или не дал аудиодорожку.");
    }

    localAudioTracks.forEach((track) => {
      track.enabled = true;

      track.onmute = () => {
        log("local audio track muted", track.id);
      };

      track.onunmute = () => {
        log("local audio track unmuted", track.id);
      };

      track.onended = () => {
        log("local audio track ended", track.id);
      };
    });

    log("local audio tracks", localAudioTracks.map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState
    })));

    remoteStream = new MediaStream();

    peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: "balanced",
      rtcpMuxPolicy: "require"
    });

    peerConnection.ontrack = handleRemoteTrack;

    peerConnection.onicecandidate = async function (event) {
      if (!event.candidate) {
        log("local ice complete");
        return;
      }

      const candidatePayload =
        typeof event.candidate.toJSON === "function"
          ? event.candidate.toJSON()
          : event.candidate;

      log("local ice candidate", candidatePayload.type || "candidate");

      if (!callChannel) return;

      try {
        await callChannel.send({
          type: "broadcast",
          event: "ice",
          payload: {
            callId,
            from: myId,
            to: peerId,
            candidate: candidatePayload
          }
        });
      } catch (error) {
        warn("send ice failed", error);
      }
    };

    peerConnection.onconnectionstatechange = function () {
      const state = peerConnection.connectionState;
      log("connectionState", state);

      if (state === "connected") {
        callState = "connected";
        setCallStatus("Разговор идёт");
        stopRingSound();
        tryPlayRemoteAudio();
        startRemoteAudioRetry();
        updateCallRecord("connected");
      }

      if (state === "failed") {
        if (callState !== "idle") {
          cleanupCall(false);
          showToast("Соединение не установилось. Позже добавим TURN-сервер.");
        }
      }

      if (state === "closed") {
        if (callState !== "idle") {
          cleanupCall(false);
          showToast("Соединение завершено");
        }
      }
    };

    peerConnection.oniceconnectionstatechange = function () {
      log("iceConnectionState", peerConnection.iceConnectionState);

      if (peerConnection.iceConnectionState === "connected" || peerConnection.iceConnectionState === "completed") {
        tryPlayRemoteAudio();
        startRemoteAudioRetry();
      }
    };

    peerConnection.onicegatheringstatechange = function () {
      log("iceGatheringState", peerConnection.iceGatheringState);
    };

    peerConnection.onsignalingstatechange = function () {
      log("signalingState", peerConnection.signalingState);
    };

    localStream.getTracks().forEach((track) => {
      track.enabled = true;
      peerConnection.addTrack(track, localStream);
    });

    return peerConnection;
  }

  async function startCall(payload = {}) {
    unlockAudioForMobile();

    await refreshUser();
    await ensurePersonalChannel();

    const peerFromPayload = payload.peer || {};
    const peerFromChat = getPeerFromChat();

    const peer = {
      id: String(peerFromPayload.id || peerFromChat?.id || ""),
      name: cleanDisplayName(peerFromPayload.name) || cleanDisplayName(peerFromChat?.name) || "Собеседник"
    };

    if (!currentUser) {
      showToast("Для звонка нужно войти в аккаунт.");
      return;
    }

    if (!peer.id) {
      showToast("Открой личную переписку с пользователем.");
      scheduleButtonUpdate();
      return;
    }

    if (peer.id === currentUser.id) {
      showToast("Нельзя позвонить самому себе.");
      return;
    }

    if (callState !== "idle") {
      showToast("Уже есть активный вызов.");
      return;
    }

    try {
      supabaseClient = payload.supabase || getMainSupabaseClient();
      activePeer = peer;
      setLastKnownPeer(peer);

      callId = makeCallId();
      callRecordCreated = false;
      pendingRemoteIceCandidates = [];
      callState = "calling";

      log("start call", { callId, from: currentUser.id, to: peer.id });

      openOutgoingOverlay(peer.name);
      await createCallChannel(callId);
      await setupPeerConnection();

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection, "offer");

      await createCallRecord(peer);

      await sendToPersonalChannel(peer.id, "incoming_call", {
        callId,
        from: currentUser.id,
        to: peer.id,
        callerName: getUserName(currentUser),
        receiverName: peer.name,
        offer: peerConnection.localDescription
      });

      clearTimeout(callTimeoutTimer);

      callTimeoutTimer = setTimeout(() => {
        if (callState === "calling") {
          endCall("no_answer", "Собеседник не ответил.");
        }
      }, CALL_TIMEOUT_MS);
    } catch (error) {
      console.error("Klevby calls: start failed", error);
      cleanupCall(false);
      showToast(error.message || "Не удалось начать звонок.");
    }
  }

  async function acceptIncomingCall() {
    unlockAudioForMobile();

    if (callState !== "incoming" || !activePeer?.offer) return;

    try {
      await refreshUser();

      if (!currentUser) {
        declineCall();
        showToast("Для звонка нужно войти.");
        return;
      }

      callState = "connecting";

      log("accept incoming call", callId);

      stopRingSound();
      openActiveCallOverlay(activePeer.name);
      setCallStatus("Подключаем микрофон...");

      if (!callChannel && callId) {
        await createCallChannel(callId);
      }

      await setupPeerConnection();

      await peerConnection.setRemoteDescription(new RTCSessionDescription(activePeer.offer));
      await flushPendingRemoteIceCandidates();

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitForIceGatheringComplete(peerConnection, "answer");

      await callChannel.send({
        type: "broadcast",
        event: "answer",
        payload: {
          callId,
          from: getMyId(),
          to: activePeer.id,
          answer: peerConnection.localDescription
        }
      });

      callState = "connected";
      setCallStatus("Разговор идёт");
      tryPlayRemoteAudio();
      startRemoteAudioRetry();
      await updateCallRecord("connected");
    } catch (error) {
      console.error("Klevby calls: accept failed", error);
      endCall("error", error.message || "Не удалось принять звонок.");
    }
  }

  async function declineCall() {
    if (activePeer?.id && callChannel) {
      try {
        await callChannel.send({
          type: "broadcast",
          event: "end",
          payload: {
            callId,
            from: getMyId(),
            to: activePeer.id,
            reason: "declined"
          }
        });
      } catch (error) {}
    }

    await updateCallRecord("declined");
    cleanupCall(false);
    showToast("Вызов отклонён");
  }

  async function endCall(reason = "ended", toastText = "Вызов завершён") {
    const peerId = activePeer?.id;

    if (peerId && callChannel) {
      try {
        await callChannel.send({
          type: "broadcast",
          event: "end",
          payload: {
            callId,
            from: getMyId(),
            to: peerId,
            reason
          }
        });
      } catch (error) {}
    }

    await updateCallRecord(reason);
    cleanupCall(false);
    showToast(toastText);
  }

  async function cleanupCall(showToastAfter = false) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;

    stopTimer();
    stopRingSound();
    stopRemoteAudioRetry();

    if (remoteAudioSourceNode) {
      try {
        remoteAudioSourceNode.disconnect();
      } catch (error) {}
    }

    remoteAudioSourceNode = null;
    remoteAudioSourceStream = null;

    if (peerConnection) {
      try {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onicegatheringstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.close();
      } catch (error) {}
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {}
      });
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {}
      });
    }

    const audio = $("#klevbyRemoteAudio");

    if (audio) {
      try {
        audio.pause();
        audio.srcObject = null;
      } catch (error) {}
    }

    const client = getMainSupabaseClient();

    if (client && callChannel) {
      try {
        await client.removeChannel(callChannel);
      } catch (error) {}
    }

    callChannel = null;
    peerConnection = null;
    localStream = null;
    remoteStream = null;
    callState = "idle";
    callId = null;
    activePeer = null;
    pendingRemoteIceCandidates = [];
    callRecordCreated = false;

    closeOverlaysOnly();
    unlockPageIfChatClosed();

    if (showToastAfter) {
      showToast("Вызов завершён");
    }

    scheduleButtonUpdate();
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

  function handleDocumentClick(event) {
    const oldTestButton = event.target.closest("#klevby-chat-call");

    if (oldTestButton) {
      safeStopEvent(event);
      oldTestButton.remove();
      return;
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
      return;
    }

    const endButton = event.target.closest("#klevbyEndCallBtn");

    if (endButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      endCall("ended");
      return;
    }

    const acceptButton = event.target.closest("#klevbyAcceptCallBtn");

    if (acceptButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      acceptIncomingCall();
      return;
    }

    const declineButton = event.target.closest("#klevbyDeclineCallBtn");

    if (declineButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      declineCall();
    }
  }

  function handleTouchStart(event) {
    if (event.target.closest(".klevby-call-overlay, .klevby-incoming-call-overlay, #klevby-call-btn")) {
      unlockAudioForMobile();
      tryPlayRemoteAudio();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && (callOverlay || incomingOverlay)) {
      endCall("ended");
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      ensurePersonalChannel();
      scheduleButtonUpdate();

      if (callState !== "idle") {
        unlockAudioForMobile();
        tryPlayRemoteAudio();
        startRemoteAudioRetry();
      }
    }
  }

  async function init() {
    injectStyles();
    removeOldTestCallButton();

    log("script loaded", "v6");

    const waitForClient = setInterval(async () => {
      const client = getMainSupabaseClient();

      if (!client) return;

      clearInterval(waitForClient);

      supabaseClient = client;

      await refreshUser();
      await ensurePersonalChannel();

      ensureCallButton();
      startButtonObserver();
      scheduleButtonUpdate();
    }, 300);

    setTimeout(() => {
      clearInterval(waitForClient);
      ensureCallButton();
      startButtonObserver();
      scheduleButtonUpdate();
    }, 10000);
  }

  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  window.addEventListener("klevby-peer-selected", (event) => {
    setLastKnownPeer(event.detail || null);
    scheduleButtonUpdate();
  });

  window.addEventListener("klevby-auth-changed", async () => {
    await refreshUser({ force: true });

    const client = getMainSupabaseClient();
    const myId = getMyId();

    if (personalChannel && personalChannelUserId === myId) {
      scheduleButtonUpdate();
      return;
    }

    if (personalChannel) {
      try {
        if (client) await client.removeChannel(personalChannel);
      } catch (error) {}

      personalChannel = null;
      personalChannelUserId = "";
    }

    await ensurePersonalChannel({ force: true });
    scheduleButtonUpdate();
  });

  window.addEventListener("pageshow", () => {
    ensurePersonalChannel();
    scheduleButtonUpdate();

    if (callState !== "idle") {
      unlockAudioForMobile();
      tryPlayRemoteAudio();
      startRemoteAudioRetry();
    }
  });

  window.addEventListener("focus", () => {
    ensurePersonalChannel();
    scheduleButtonUpdate();

    if (callState !== "idle") {
      unlockAudioForMobile();
      tryPlayRemoteAudio();
      startRemoteAudioRetry();
    }
  });

  window.addEventListener("pagehide", () => {
    cleanupCall(false);
  });

  window.KlevbyCalls = {
    startCall,
    endCall,
    declineCall,
    acceptIncomingCall
  };

  window.klevbyStartRealCall = startCall;
  window.klevbyEndRealCall = endCall;
  window.klevbyCloseCallOverlay = endCall;

  window.klevbyStartTestCall = null;
  window.klevbyEndTestCall = null;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
