(function () {
  function markKlevbyResumeDebug(source, reason, detail = {}) {
    const api = window.KlevbyResumeDebug;
    if (!api || typeof api.mark !== "function") return null;
    try {
      return api.mark(source, reason, detail);
    } catch (error) {
      return null;
    }
  }

  if (window.__klevbyCallLoadedV9) return;
  window.__klevbyCallLoadedV9 = true;

  window.__klevbyCallLoadedV8 = true;
  window.__klevbyCallLoadedV7 = true;
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

  let peerConnection = null;
  let localStream = null;
  let remoteStream = null;

  let callTimeoutTimer = null;

  let userRefreshPromise = null;
  let lastUserRefreshAt = 0;

  let pendingRemoteIceCandidates = [];
  let callRecordCreated = false;

  let callAudioMissingWarned = false;
  let callUiMissingWarned = false;
  let callRealtimeMissingWarned = false;

  function $(selector) {
    return document.querySelector(selector);
  }

  function log(...args) {
    console.log("Klevby calls:", ...args);
  }

  function warn(...args) {
    console.warn("Klevby calls:", ...args);
  }

  function getCallAudioApi() {
    return window.KlevbyCallAudio || null;
  }

  function getCallUIApi() {
    return window.KlevbyCallUI || null;
  }

  function getCallRealtimeApi() {
    return window.KlevbyCallRealtime || null;
  }

  function initCallAudioBridge() {
    const api = getCallAudioApi();

    if (!api || typeof api.init !== "function") {
      warn("assets/js/call-audio.js не подключён. Звук звонков может не работать.");
      return;
    }

    api.init({
      log,
      warn,
      showToast,
      getCallState: () => callState
    });
  }

  function initCallUIBridge() {
    const api = getCallUIApi();

    if (!api || typeof api.init !== "function") {
      warn("assets/js/call-ui.js не подключён. UI звонков может не работать.");
      return;
    }

    api.init({
      log,
      warn,

      safeStopEvent,

      getCallState: () => callState,
      isPrivateDialogOpen,

      unlockAudioForMobile,
      tryPlayRemoteAudio,
      prepareRemoteAudioElement,
      startRemoteAudioRetry,

      startRingSound,
      stopRingSound,

      startCall,
      endCall,
      acceptIncomingCall,
      declineCall,

      incomingTimeoutMs: CALL_TIMEOUT_MS
    });
  }

  function initCallRealtimeBridge() {
    const api = getCallRealtimeApi();

    if (!api || typeof api.init !== "function") {
      warn("assets/js/call-realtime.js не подключён. Сигналинг звонков может не работать.");
      return;
    }

    api.init({
      log,
      warn,

      getClient: getMainSupabaseClient,
      refreshUser,
      getMyId,
      getCurrentUser: () => currentUser,
      getCallState: () => callState,

      onAnswer: handleSignalAnswer,
      onIce: handleSignalIce,
      onEnd: handleSignalEnd,
      onIncomingCall: handleIncomingCallSignal,

      personalChannelThrottleMs: PERSONAL_CHANNEL_THROTTLE_MS
    });
  }

  function callAudio(name, fallback, ...args) {
    const api = getCallAudioApi();

    if (api && typeof api[name] === "function") {
      return api[name](...args);
    }

    if (!callAudioMissingWarned) {
      callAudioMissingWarned = true;
      warn("call-audio.js не найден или не готов. Проверь подключение перед call.js.");
    }

    if (typeof fallback === "function") {
      return fallback(...args);
    }

    return fallback;
  }

  function callUI(name, fallback, ...args) {
    const api = getCallUIApi();

    if (api && typeof api[name] === "function") {
      return api[name](...args);
    }

    if (!callUiMissingWarned) {
      callUiMissingWarned = true;
      warn("call-ui.js не найден или не готов. Проверь подключение перед call.js.");
    }

    if (typeof fallback === "function") {
      return fallback(...args);
    }

    return fallback;
  }

  function getRequiredCallRealtimeApi() {
    const api = getCallRealtimeApi();

    if (api) {
      return api;
    }

    if (!callRealtimeMissingWarned) {
      callRealtimeMissingWarned = true;
      warn("call-realtime.js не найден или не готов. Проверь подключение перед call.js.");
    }

    throw new Error("Модуль звонков call-realtime.js не подключён.");
  }

  function unlockAudioForMobile() {
    return callAudio("unlockAudioForMobile");
  }

  function startRingSound() {
    return callAudio("startRingSound");
  }

  function stopRingSound() {
    return callAudio("stopRingSound");
  }

  function prepareRemoteAudioElement() {
    return callAudio("prepareRemoteAudioElement", null);
  }

  function attachRemoteStreamToAudio() {
    return callAudio("attachRemoteStreamToAudio", null, remoteStream);
  }

  function connectRemoteStreamToAudioContext() {
    return callAudio("connectRemoteStreamToAudioContext", null, remoteStream);
  }

  function tryPlayRemoteAudio() {
    return callAudio("tryPlayRemoteAudio", null, remoteStream);
  }

  function startRemoteAudioRetry() {
    return callAudio("startRemoteAudioRetry", null, () => remoteStream);
  }

  function stopRemoteAudioRetry() {
    return callAudio("stopRemoteAudioRetry");
  }

  function cleanupAudio() {
    return callAudio("cleanupAudio");
  }

  function fallbackShowToast(text) {
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

  function fallbackRemoveOldTestCallButton() {
    const oldTestButton = document.getElementById("klevby-chat-call");

    if (oldTestButton) {
      oldTestButton.remove();
    }

    const oldTestOverlay = document.getElementById("klevbyCallOverlay");

    if (oldTestOverlay && oldTestOverlay.textContent.includes("тестовый звонок")) {
      oldTestOverlay.remove();
    }
  }

  function fallbackSetCallStatus(text) {
    const status = $("#klevbyCallStatus");

    if (status) {
      status.textContent = text;
    }
  }

  function fallbackCloseOverlaysOnly() {
    const outgoing = $("#klevbyCallOverlay");
    const incoming = $("#klevbyIncomingCallOverlay");

    if (outgoing) {
      outgoing.remove();
    }

    if (incoming) {
      incoming.remove();
    }
  }

  function fallbackUnlockPageIfChatClosed() {
    const chatModal = $("#klevby-chat-modal");
    const chatIsOpen = chatModal && chatModal.classList.contains("open");

    if (!chatIsOpen) {
      document.documentElement.classList.remove("klevby-chat-lock");
      document.body.classList.remove("klevby-chat-lock");
    }
  }

  function fallbackCleanupUI() {
    stopRingSound();
    fallbackCloseOverlaysOnly();
    fallbackUnlockPageIfChatClosed();
  }

  function removeOldTestCallButton() {
    return callUI("removeOldTestCallButton", fallbackRemoveOldTestCallButton);
  }

  function showToast(text) {
    return callUI("showToast", fallbackShowToast, text);
  }

  function setCallStatus(text) {
    return callUI("setCallStatus", fallbackSetCallStatus, text);
  }

  function openOutgoingOverlay(peerName) {
    return callUI("openOutgoingOverlay", null, peerName);
  }

  function openActiveCallOverlay(peerName) {
    return callUI("openActiveCallOverlay", null, peerName);
  }

  function openIncomingOverlay(payload) {
    return callUI("openIncomingOverlay", null, payload);
  }

  function ensureCallButton() {
    return callUI("ensureCallButton", null);
  }

  function scheduleButtonUpdate() {
    return callUI("scheduleButtonUpdate", null);
  }

  function startButtonObserver() {
    return callUI("startButtonObserver", null);
  }

  function cleanupUI() {
    return callUI("cleanupUI", fallbackCleanupUI, { unlock: true });
  }

  function safeStopEvent(event) {
    if (!event) return;

    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
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

  function getCentralUser() {
    return (
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null
    );
  }

  function isCentralAuthGuestAuthoritative() {
    const recentLogout =
      typeof window.isAuthLogoutGuardActive === "function"
        ? window.isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);

    if (recentLogout) {
      return true;
    }

    const centralUser = getCentralUser();
    if (centralUser && centralUser.id) {
      return false;
    }

    return Boolean(window.klevbyAuthReady || window.authReady);
  }

  function getMainUser() {
    const centralUser = getCentralUser();
    if (centralUser && centralUser.id) {
      return centralUser;
    }

    if (isCentralAuthGuestAuthoritative()) {
      return null;
    }

    return currentUser || null;
  }

  async function refreshUser(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    const mainClient = getMainSupabaseClient();
    const mainUser = getMainUser();

    supabaseClient = mainClient || supabaseClient;

    if (!mainUser && isCentralAuthGuestAuthoritative()) {
      currentUser = null;
      lastUserRefreshAt = now;
      return null;
    }

    if (mainUser && mainUser.id) {
      currentUser = mainUser;
      lastUserRefreshAt = now;
      return currentUser;
    }

    if (!force && currentUser && currentUser.id && now - lastUserRefreshAt < AUTH_REFRESH_THROTTLE_MS) {
      if (isCentralAuthGuestAuthoritative()) {
        currentUser = null;
        return null;
      }
      return currentUser;
    }

    if (!force && userRefreshPromise) {
      return userRefreshPromise;
    }

    if (!mainClient?.auth?.getUser) {
      if (isCentralAuthGuestAuthoritative()) {
        currentUser = null;
        return null;
      }
      return getCentralUser() || currentUser || null;
    }

    lastUserRefreshAt = now;

    userRefreshPromise = (async () => {
      try {
        const { data, error } = await mainClient.auth.getUser();

        if (error) {
          warn("user refresh warning", error);
          if (isCentralAuthGuestAuthoritative()) {
            currentUser = null;
            return null;
          }
          return getCentralUser() || currentUser || null;
        }

        if (data?.user && !isCentralAuthGuestAuthoritative()) {
          currentUser = data.user;
          return currentUser;
        }

        if (isCentralAuthGuestAuthoritative()) {
          currentUser = null;
          return null;
        }

        return getCentralUser() || currentUser || null;
      } catch (error) {
        warn("user refresh failed", error);
        if (isCentralAuthGuestAuthoritative()) {
          currentUser = null;
          return null;
        }
        return getCentralUser() || currentUser || null;
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

  async function createCallChannel(id) {
    const api = getRequiredCallRealtimeApi();

    if (typeof api.createCallChannel !== "function") {
      throw new Error("Модуль call-realtime.js загружен неправильно.");
    }

    return api.createCallChannel(id);
  }

  async function removeCallChannel() {
    const api = getCallRealtimeApi();

    if (api && typeof api.removeCallChannel === "function") {
      return api.removeCallChannel();
    }
  }

  async function sendCallEvent(event, payload) {
    const api = getRequiredCallRealtimeApi();

    if (typeof api.sendCallEvent !== "function") {
      throw new Error("Модуль call-realtime.js загружен неправильно.");
    }

    return api.sendCallEvent(event, payload);
  }

  async function ensurePersonalChannel(options = {}) {
    const api = getCallRealtimeApi();

    if (!api || typeof api.ensurePersonalChannel !== "function") {
      if (!callRealtimeMissingWarned) {
        callRealtimeMissingWarned = true;
        warn("call-realtime.js не найден или не готов. Проверь подключение перед call.js.");
      }

      return;
    }

    return api.ensurePersonalChannel(options);
  }

  async function resetPersonalChannel() {
    const api = getCallRealtimeApi();

    if (api && typeof api.resetPersonalChannel === "function") {
      return api.resetPersonalChannel();
    }
  }

  async function sendToPersonalChannel(userId, event, payload) {
    const api = getRequiredCallRealtimeApi();

    if (typeof api.sendToPersonalChannel !== "function") {
      throw new Error("Модуль call-realtime.js загружен неправильно.");
    }

    return api.sendToPersonalChannel(userId, event, payload);
  }

  async function handleSignalAnswer(payload) {
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
  }

  async function handleSignalIce(payload) {
    if (!payload || payload.to !== getMyId()) return;
    if (!payload.candidate) return;

    log("remote ice received");
    await addRemoteIceCandidate(payload.candidate);
  }

  async function handleSignalEnd(payload) {
    if (!payload || payload.to !== getMyId()) return;

    await cleanupCall(false);
    showToast("Вызов завершён");
  }

  async function handleIncomingCallSignal(payload) {
    if (!payload || payload.to !== getMyId()) return;

    if (callState !== "idle") {
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

      try {
        await sendCallEvent("ice", {
          callId,
          from: myId,
          to: peerId,
          candidate: candidatePayload
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

      await setupPeerConnection();

      await peerConnection.setRemoteDescription(new RTCSessionDescription(activePeer.offer));
      await flushPendingRemoteIceCandidates();

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitForIceGatheringComplete(peerConnection, "answer");

      await sendCallEvent("answer", {
        callId,
        from: getMyId(),
        to: activePeer.id,
        answer: peerConnection.localDescription
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
    if (activePeer?.id) {
      try {
        await sendCallEvent("end", {
          callId,
          from: getMyId(),
          to: activePeer.id,
          reason: "declined"
        });
      } catch (error) {}
    }

    await updateCallRecord("declined");
    cleanupCall(false);
    showToast("Вызов отклонён");
  }

  async function endCall(reason = "ended", toastText = "Вызов завершён") {
    const peerId = activePeer?.id;

    if (peerId) {
      try {
        await sendCallEvent("end", {
          callId,
          from: getMyId(),
          to: peerId,
          reason
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

    stopRemoteAudioRetry();
    cleanupAudio();

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

    await removeCallChannel();

    peerConnection = null;
    localStream = null;
    remoteStream = null;
    callState = "idle";
    callId = null;
    activePeer = null;
    pendingRemoteIceCandidates = [];
    callRecordCreated = false;

    cleanupUI();

    if (showToastAfter) {
      showToast("Вызов завершён");
    }

    scheduleButtonUpdate();
  }

  function handleDocumentClick(event) {
    const api = getCallUIApi();

    if (api && typeof api.handleDocumentClick === "function") {
      const handled = api.handleDocumentClick(event);

      if (handled) {
        return;
      }
    }

    const oldTestButton = event.target.closest("#klevby-chat-call");

    if (oldTestButton) {
      safeStopEvent(event);
      oldTestButton.remove();
      return;
    }

    const callButton = event.target.closest("#klevby-call-btn");

    if (callButton) {
      safeStopEvent(event);
      unlockAudioForMobile();
      startCall();
    }
  }

  function handleTouchStart(event) {
    const api = getCallUIApi();

    if (api && typeof api.handleTouchStart === "function") {
      api.handleTouchStart(event);
    }
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;

    const api = getCallUIApi();
    const hasOverlay =
      api && typeof api.hasCallOverlay === "function"
        ? api.hasCallOverlay()
        : Boolean($("#klevbyCallOverlay") || $("#klevbyIncomingCallOverlay"));

    if (hasOverlay) {
      endCall("ended");
    }
  }

  function handleVisibilityChange() {
    markKlevbyResumeDebug("calls.resume.listener", "visibilitychange", { visibilityState: document.visibilityState });
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

  function injectStyles() {
    const api = window.KlevbyCallStyles || null;

    if (api && typeof api.injectStyles === "function") {
      api.injectStyles();
      return;
    }

    warn("assets/js/call-styles.js не подключён. Стили звонков не загружены.");
  }

  async function init() {
    injectStyles();
    initCallAudioBridge();
    initCallUIBridge();
    initCallRealtimeBridge();
    removeOldTestCallButton();

    log("script loaded", "v9 realtime module bridge");

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

  window.addEventListener("klevby-auth-changed", async (event) => {
    const eventUser = event?.detail?.user || null;

    if (eventUser && eventUser.id) {
      currentUser = eventUser;
      lastUserRefreshAt = Date.now();
    } else if (isCentralAuthGuestAuthoritative()) {
      currentUser = null;
      lastUserRefreshAt = Date.now();
    } else {
      const centralUser = getCentralUser();
      currentUser = centralUser && centralUser.id ? centralUser : null;
      lastUserRefreshAt = Date.now();
    }

    await resetPersonalChannel();
    await ensurePersonalChannel({ force: true });
    scheduleButtonUpdate();
  });

  window.addEventListener("pageshow", () => {
    markKlevbyResumeDebug("calls.resume.listener", "pageshow", { trigger: "pageshow" });
    ensurePersonalChannel();
    scheduleButtonUpdate();

    if (callState !== "idle") {
      unlockAudioForMobile();
      tryPlayRemoteAudio();
      startRemoteAudioRetry();
    }
  });

  window.addEventListener("focus", () => {
    markKlevbyResumeDebug("calls.resume.listener", "focus", { trigger: "focus" });
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
