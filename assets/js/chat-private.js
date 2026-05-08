(function () {
  if (window.KlevbyChatPrivate) {
    return;
  }

  let ctx = null;

  function init(options = {}) {
    ctx = options || {};
  }

  function getCtx() {
    if (!ctx) {
      throw new Error("KlevbyChatPrivate не инициализирован. Проверь подключение chat-private.js перед chat.js");
    }

    return ctx;
  }

  function getElement(name) {
    return getCtx().elements?.[name] || null;
  }

  function getCurrentUser() {
    return getCtx().getCurrentUser ? getCtx().getCurrentUser() : null;
  }

  function getSelectedPeer() {
    return getCtx().getSelectedPeer ? getCtx().getSelectedPeer() : null;
  }

  function setSelectedPeer(peer) {
    if (getCtx().setSelectedPeer) {
      getCtx().setSelectedPeer(peer);
    }
  }

  function setActiveMode(mode) {
    if (getCtx().setActiveMode) {
      getCtx().setActiveMode(mode);
    }
  }

  function getUnreadPrivateCount() {
    return Number(getCtx().getUnreadPrivateCount ? getCtx().getUnreadPrivateCount() : 0) || 0;
  }

  function setUnreadPrivateCount(value) {
    if (getCtx().setUnreadPrivateCount) {
      getCtx().setUnreadPrivateCount(Math.max(0, Number(value) || 0));
    }
  }

  function beginNavigationIfNeeded(navToken) {
    if (navToken) return navToken;
    return getCtx().beginChatNavigation ? getCtx().beginChatNavigation() : Date.now();
  }

  function isStaleNavigation(navToken) {
    return getCtx().isStaleNavigation ? getCtx().isStaleNavigation(navToken) : false;
  }

  function finishChatNavigation(navToken) {
    if (getCtx().finishChatNavigation) {
      getCtx().finishChatNavigation(navToken);
    }
  }

  function getMainSupabaseClient() {
    return getCtx().getMainSupabaseClient ? getCtx().getMainSupabaseClient() : null;
  }

  function isValidSupabaseUuid(value) {
    return getCtx().isValidSupabaseUuid ? getCtx().isValidSupabaseUuid(value) : false;
  }

  function getProfileName(userId, fallback = "Рыбак") {
    return getCtx().getProfileName ? getCtx().getProfileName(userId, fallback) : fallback;
  }

  function rememberFallbackProfile(userId, name) {
    if (getCtx().rememberFallbackProfile) {
      getCtx().rememberFallbackProfile(userId, name);
    }
  }

  async function loadProfilesByIds(ids = []) {
    if (getCtx().loadProfilesByIds) {
      return await getCtx().loadProfilesByIds(ids);
    }
  }

  function clearMessages() {
    if (getCtx().clearMessages) {
      getCtx().clearMessages();
    }
  }

  function showEmptyState(text) {
    if (getCtx().showEmptyState) {
      getCtx().showEmptyState(text);
    }
  }

  function getCachedPrivateMessages(peerId) {
    if (getCtx().getCachedPrivateMessages) {
      return getCtx().getCachedPrivateMessages(peerId);
    }

    return null;
  }

  function setCachedPrivateMessages(peerId, messages) {
    if (getCtx().setCachedPrivateMessages) {
      getCtx().setCachedPrivateMessages(peerId, messages);
    }
  }

  function clearReply() {
    if (getCtx().clearReply) {
      getCtx().clearReply();
    }
  }

  function renderMessageList(data, renderFn) {
    if (getCtx().renderMessageList) {
      getCtx().renderMessageList(data, renderFn);
    }
  }

  function renderPrivateMessage(message) {
    if (getCtx().renderPrivateMessage) {
      getCtx().renderPrivateMessage(message);
    }
  }

  function parseReplyContent(content) {
    if (getCtx().parseReplyContent) {
      return getCtx().parseReplyContent(content);
    }

    return {
      reply: null,
      mainText: String(content || "")
    };
  }

  function getTimestamp(createdAt) {
    if (getCtx().getTimestamp) {
      return getCtx().getTimestamp(createdAt);
    }

    const time = new Date(createdAt || Date.now()).getTime();
    return Number.isFinite(time) ? time : Date.now();
  }

  function getMessageTime(createdAt) {
    if (getCtx().getMessageTime) {
      return getCtx().getMessageTime(createdAt);
    }

    return "";
  }

  function getInitials(name) {
    if (getCtx().getInitials) {
      return getCtx().getInitials(name);
    }

    return String(name || "Р").trim().slice(0, 1).toUpperCase() || "Р";
  }

  function escapeHtml(text) {
    if (getCtx().escapeHtml) {
      return getCtx().escapeHtml(text);
    }

    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isOnline(userId) {
    return getCtx().isOnline ? getCtx().isOnline(userId) : false;
  }

  function getUserStatusText(userId) {
    return getCtx().getUserStatusText ? getCtx().getUserStatusText(userId) : "Был недавно";
  }

  function updateUnreadBadge() {
    if (getCtx().updateUnreadBadge) {
      getCtx().updateUnreadBadge();
    }
  }

  function syncSelectedPeerForCalls() {
    if (getCtx().syncSelectedPeerForCalls) {
      getCtx().syncSelectedPeerForCalls();
    }
  }

  function buildMessageContent(value) {
    return getCtx().buildMessageContent ? getCtx().buildMessageContent(value) : value;
  }

  async function refreshCurrentUser(options = {}) {
    if (getCtx().refreshCurrentUser) {
      return await getCtx().refreshCurrentUser(options);
    }

    return getCurrentUser();
  }

  async function ensureCurrentUserProfile(options = {}) {
    if (getCtx().ensureCurrentUserProfile) {
      return await getCtx().ensureCurrentUserProfile(options);
    }
  }

  async function sendPushToUser(receiverUserId, senderName, messageText) {
    if (getCtx().sendPushToUser) {
      return await getCtx().sendPushToUser(receiverUserId, senderName, messageText);
    }
  }

  function getCurrentChatName() {
    return getCtx().getCurrentChatName ? getCtx().getCurrentChatName() : "Рыбак";
  }

  const PRIVATE_STEP_TIMEOUT_MS = 7000;
  const PRIVATE_OPTIONAL_STEP_TIMEOUT_MS = 3000;
  const PRIVATE_FALLBACK_MESSAGE = "Личка временно недоступна. Закрой и открой чат ещё раз.";

  function createPrivateTimeoutError(step, timeoutMs) {
    const error = new Error(`Klevby private: step "${step}" timed out after ${timeoutMs}ms.`);
    error.name = "KlevbyPrivateTimeoutError";
    error.code = "PRIVATE_STEP_TIMEOUT";
    error.step = step;
    error.timeoutMs = timeoutMs;
    return error;
  }

  async function withPrivateStepTimeout(step, runner, timeoutMs = PRIVATE_STEP_TIMEOUT_MS) {
    const startedAt = Date.now();
    console.info("[KlevbyPrivate] step start", { step, timeoutMs });
    let timer = null;
    try {
      const result = await Promise.race([
        Promise.resolve().then(runner),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(createPrivateTimeoutError(step, timeoutMs)), timeoutMs);
        })
      ]);
      console.info("[KlevbyPrivate] step end", { step, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      const level = error?.code === "PRIVATE_STEP_TIMEOUT" ? "warn" : "error";
      console[level]("[KlevbyPrivate] step fail", {
        step,
        durationMs: Date.now() - startedAt,
        error: String(error?.message || error),
        code: error?.code || null
      });
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function withPrivateOptionalStepTimeout(step, runner, timeoutMs = PRIVATE_OPTIONAL_STEP_TIMEOUT_MS) {
    try {
      return await withPrivateStepTimeout(step, runner, timeoutMs);
    } catch (error) {
      console.warn("[KlevbyPrivate] optional step skipped", { step, error: String(error?.message || error) });
      return null;
    }
  }



  async function runPrivateStepTimeout(step, timeoutMs, runner) {
    const controller = new AbortController();
    try {
      return await withPrivateStepTimeout(step, () => runner(controller.signal), timeoutMs);
    } finally {
      controller.abort();
    }
  }

  function getPrivateAccessTokenQuick() {
    try {
      const client = getMainSupabaseClient();
      const session = client?.auth?.session?.();
      const accessToken = session?.access_token;
      if (accessToken) return String(accessToken);
    } catch (_) {}

    try {
      const config = window.KLEVB_CONFIG || {};
      const storageKey = String(
        config.SUPABASE_STORAGE_KEY ||
        window.SUPABASE_STORAGE_KEY ||
        "sb-oecdshvozssadztcokog-auth-token"
      ).trim();
      if (!storageKey) return "";
      const raw = localStorage.getItem(storageKey);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      const accessToken = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
      return accessToken ? String(accessToken) : "";
    } catch (_) {
      return "";
    }
  }

  function getCurrentUserIdQuick() {
    const directId = String(getCurrentUser()?.id || "").trim();
    if (isValidSupabaseUuid(directId)) return directId;

    const accessToken = getPrivateAccessTokenQuick();
    if (!accessToken) return "";

    try {
      const payloadPart = accessToken.split(".")[1] || "";
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
      const parsed = JSON.parse(decoded);
      const sub = String(parsed?.sub || "").trim();
      return isValidSupabaseUuid(sub) ? sub : "";
    } catch (_) {
      return "";
    }
  }

  function scrollChatToBottom() {
    if (getCtx().scrollChatToBottom) {
      getCtx().scrollChatToBottom();
    }
  }

  async function loadPrivateMessagesViaRest(signal) {
    const config = window.KLEVB_CONFIG || {};
    const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();
    const accessToken = getPrivateAccessTokenQuick();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase REST config не найден для лички.");
    }

    if (!accessToken) {
      return { data: null, error: { code: "AUTH_REQUIRED", message: "access_token missing" }, status: 401 };
    }

    const myId = String(getCurrentUserIdQuick() || "").trim();
    if (!isValidSupabaseUuid(myId)) {
      return { data: null, error: { code: "AUTH_REQUIRED", message: "current_user_id missing" }, status: 401 };
    }
    const endpoint = `${supabaseUrl}/rest/v1/private_messages?select=sender_id,receiver_id,sender_name,content,created_at&or=(sender_id.eq.${encodeURIComponent(myId)},receiver_id.eq.${encodeURIComponent(myId)})&order=created_at.desc&limit=150`;

    console.info("[KlevbyPrivate] private_messages REST start", { endpoint, hasAccessToken: Boolean(accessToken) });
    const startedAt = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`
        },
        signal: signal || undefined
      });

      const durationMs = Date.now() - startedAt;
      if (!response.ok) {
        let errorText = "";
        try { errorText = await response.text(); } catch (_) {}
        console.warn("[KlevbyPrivate] private_messages REST fail", { durationMs, status: response.status, errorText });
        throw new Error(`Supabase REST private_messages failed: ${response.status} ${response.statusText} ${errorText}`.trim());
      }

      const data = await response.json();
      console.info("[KlevbyPrivate] private_messages REST end", { durationMs, status: response.status, rows: Array.isArray(data) ? data.length : 0 });
      return { data, error: null, status: response.status };
    } catch (error) {
      if (error?.name === "AbortError") {
        console.warn("[KlevbyPrivate] private_messages REST fail", { durationMs: Date.now() - startedAt, status: "aborted", error: String(error?.message || error) });
      }
      throw error;
    }
  }

  function getReadStorageKey(peerId) {
    const myId = getCurrentUser()?.id || "guest";
    return `klevby_private_read_${myId}_${peerId}`;
  }

  function getPeerReadTime(peerId) {
    try {
      return Number(localStorage.getItem(getReadStorageKey(peerId)) || "0");
    } catch {
      return 0;
    }
  }

  function markPeerAsRead(peerId) {
    if (!isValidSupabaseUuid(peerId)) return;

    try {
      localStorage.setItem(getReadStorageKey(peerId), String(Date.now()));
    } catch (error) {
      console.warn("Klevby private: не удалось сохранить статус прочтения:", error);
    }
  }

  async function loadPrivatePeople(navToken) {
    navToken = beginNavigationIfNeeded(navToken);

    const chatWindow = getElement("chatWindow");
    const messagesContainer = getElement("messagesContainer");
    const input = getElement("input");
    const sendBtn = getElement("sendBtn");
    const publicTab = getElement("publicTab");
    const privateTab = getElement("privateTab");
    const privatePeople = getElement("privatePeople");
    const backBtn = getElement("backBtn");
    const chatAvatar = getElement("chatAvatar");
    const chatTitle = getElement("chatTitle");
    const chatSubtitle = getElement("chatSubtitle");

    try {
      console.info("[KlevbyPrivate] loadPrivatePeople start", {
        navToken,
        activeModeBefore: getCtx().getActiveMode ? getCtx().getActiveMode() : null,
        selectedPeerBefore: getSelectedPeer()
      });
      const currentUserId = getCurrentUserIdQuick();
      let currentChatUser = getCurrentUser();
      Promise.resolve()
        .then(() => ensureCurrentUserProfile({ soft: true }))
        .catch((error) => {
          console.warn("[KlevbyPrivate] ensureCurrentUserProfile skipped", {
            scope: "loadPrivatePeople",
            error: String(error?.message || error)
          });
        });

      setActiveMode("private");
      console.info("[KlevbyPrivate] activeMode after private click", { activeMode: getCtx().getActiveMode ? getCtx().getActiveMode() : null });
      setSelectedPeer(null);
      clearReply();

      if (chatWindow) {
        chatWindow.classList.remove("klevby-dialog-screen");
        chatWindow.classList.add("klevby-private-list-screen");
      }

      if (publicTab) publicTab.classList.remove("active");
      if (privateTab) privateTab.classList.add("active");
      if (privatePeople) privatePeople.classList.add("hidden");
      if (backBtn) backBtn.classList.add("hidden");

      if (chatAvatar) chatAvatar.textContent = "✉";
      if (chatTitle) chatTitle.textContent = "Личные сообщения";
      if (chatSubtitle) chatSubtitle.textContent = currentChatUser ? "Выбери диалог" : "Для лички нужен вход";
      if (input) {
        input.placeholder = "Выбери диалог...";
        input.disabled = true;
      }
      if (sendBtn) sendBtn.disabled = true;

      syncSelectedPeerForCalls();
      clearMessages();

      if (!isValidSupabaseUuid(currentUserId)) {
        showEmptyState("Чтобы пользоваться личными сообщениями, войди или зарегистрируйся на сайте.");
        return;
      }

      const client = getMainSupabaseClient();

      if (!client?.from) {
        showEmptyState("Supabase client для личных сообщений не найден.");
        return;
      }

      const myId = String(currentUserId);
      const peersMap = new Map();

      function addPeer(id, name, message = null) {
        const peerId = String(id || "").trim();

        if (!peerId) return;
        if (!isValidSupabaseUuid(peerId)) return;
        if (peerId === myId) return;

        const peerName = getProfileName(peerId, name || "Рыбак");

        if (!peersMap.has(peerId)) {
          peersMap.set(peerId, {
            id: peerId,
            name: peerName,
            lastMessage: "",
            lastTime: "",
            lastTimeValue: 0,
            unreadCount: 0
          });
        }

        const peer = peersMap.get(peerId);
        peer.name = getProfileName(peerId, peer.name || peerName);

        if (message) {
          const messageTimeValue = getTimestamp(message.created_at);
          const isIncoming = String(message.receiver_id || "") === myId && String(message.sender_id || "") === peerId;
          const readTime = getPeerReadTime(peerId);

          if (messageTimeValue >= peer.lastTimeValue) {
            peer.lastMessage = message.content || "";
            peer.lastTime = getMessageTime(message.created_at);
            peer.lastTimeValue = messageTimeValue;
          }

          if (isIncoming && messageTimeValue > readTime) {
            peer.unreadCount += 1;
          }
        }
      }

      try {
        const { data: privateUsers, error: privateUsersError } = await runPrivateStepTimeout("private_messages REST", 6500, (signal) =>
          loadPrivateMessagesViaRest(signal)
        );

        if (isStaleNavigation(navToken)) return;

        if (privateUsersError?.code === "AUTH_REQUIRED") {
          showEmptyState("Войди в аккаунт, чтобы открыть личные сообщения.");
          return;
        }

        if (privateUsersError) {
          console.warn("Не удалось загрузить пользователей из лички:", privateUsersError);
          showEmptyState(PRIVATE_FALLBACK_MESSAGE);
          return;
        }

        (privateUsers || []).forEach((item) => {
          if (item.sender_id && item.sender_name) {
            rememberFallbackProfile(item.sender_id, item.sender_name);
          }
        });

        await withPrivateOptionalStepTimeout("profiles select for private_messages peers", () => loadProfilesByIds(
          (privateUsers || []).flatMap((item) => [item.sender_id, item.receiver_id])
        ));

        if (isStaleNavigation(navToken)) return;

        (privateUsers || []).forEach((item) => {
          const senderId = String(item.sender_id || "");
          const receiverId = String(item.receiver_id || "");
          const peerId = senderId === myId ? receiverId : senderId;
          const peerName = senderId === myId
            ? getProfileName(receiverId, "Рыбак")
            : getProfileName(senderId, item.sender_name || "Рыбак");

          addPeer(peerId, peerName, item);
        });
      } catch (error) {
        if (isStaleNavigation(navToken)) return;
        console.warn("Не удалось загрузить пользователей из private_messages:", error);
      }

      try {
        const { data: publicUsers } = await withPrivateOptionalStepTimeout("messages users select", () => client
          .from("messages")
          .select("user_id,user_name")
          .not("user_id", "is", null)) || {};

        if (isStaleNavigation(navToken)) return;

        (publicUsers || []).forEach((item) => {
          rememberFallbackProfile(item.user_id, item.user_name || "Рыбак");
        });

        await withPrivateOptionalStepTimeout("profiles select for messages users", () => loadProfilesByIds((publicUsers || []).map((item) => item.user_id)));

        if (isStaleNavigation(navToken)) return;

        (publicUsers || []).forEach((item) => {
          addPeer(item.user_id, getProfileName(item.user_id, item.user_name || "Рыбак"), null);
        });
      } catch (error) {
        if (isStaleNavigation(navToken)) return;
        console.warn("Не удалось загрузить пользователей из общего чата:", error);
      }

      try {
        const { data: postUsers } = await withPrivateOptionalStepTimeout("posts users select", () => client
          .from("posts")
          .select("owner_id,name")
          .not("owner_id", "is", null)) || {};

        if (isStaleNavigation(navToken)) return;

        (postUsers || []).forEach((item) => {
          rememberFallbackProfile(item.owner_id, item.name || "Рыбак");
        });

        await withPrivateOptionalStepTimeout("profiles select for posts users", () => loadProfilesByIds((postUsers || []).map((item) => item.owner_id)));

        if (isStaleNavigation(navToken)) return;

        (postUsers || []).forEach((item) => {
          addPeer(item.owner_id, getProfileName(item.owner_id, item.name || "Рыбак"), null);
        });
      } catch (error) {
        if (isStaleNavigation(navToken)) return;
        console.warn("Не удалось загрузить пользователей из объявлений:", error);
      }

      if (isStaleNavigation(navToken)) return;

      const peers = Array.from(peersMap.values()).map((peer) => ({
        ...peer,
        name: getProfileName(peer.id, peer.name)
      })).sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount <= 0) return -1;
        if (a.unreadCount <= 0 && b.unreadCount > 0) return 1;
        return b.lastTimeValue - a.lastTimeValue;
      });

      setUnreadPrivateCount(peers.reduce((sum, peer) => sum + peer.unreadCount, 0));
      updateUnreadBadge();

      if (!peers.length) {
        showEmptyState("Пока нет собеседников. Пользователь должен быть автором объявления или написать в общий чат.");
        return;
      }

      const list = document.createElement("div");
      list.className = "klevby-private-dialog-list";

      list.innerHTML = peers.map((peer) => {
        const preview = peer.lastMessage
          ? parseReplyContent(peer.lastMessage).mainText
          : "Нажми, чтобы открыть переписку";

        return `
          <button class="klevby-private-dialog-item ${peer.unreadCount > 0 ? "has-unread" : ""}" type="button" data-peer-id="${escapeHtml(peer.id)}" data-peer-name="${escapeHtml(peer.name)}">
            <span class="klevby-private-dialog-avatar">${escapeHtml(getInitials(peer.name))}</span>

            <span class="klevby-private-dialog-main">
              <span class="klevby-private-dialog-top">
                <span class="klevby-private-dialog-name">${escapeHtml(peer.name)}</span>
                <span class="klevby-private-dialog-time">${escapeHtml(peer.lastTime || "")}</span>
              </span>

              <span class="klevby-private-dialog-bottom">
                <span class="klevby-private-dialog-preview">${escapeHtml(preview)}</span>
                ${peer.unreadCount > 0 ? `<span class="klevby-private-unread-dot">${escapeHtml(peer.unreadCount)}</span>` : ""}
              </span>
            </span>

            <span class="klevby-private-status ${isOnline(peer.id) ? "online" : ""}"></span>
          </button>
        `;
      }).join("");

      clearMessages();
      if (messagesContainer) {
        messagesContainer.appendChild(list);
      }
      console.info("[KlevbyPrivate] loadPrivatePeople end", {
        navToken,
        activeModeAfter: getCtx().getActiveMode ? getCtx().getActiveMode() : null,
        selectedPeerAfter: getSelectedPeer(),
        peersCount: peers.length
      });
    } catch (error) {
      if (!isStaleNavigation(navToken)) {
        console.error("Ошибка загрузки личных сообщений:", error);
        showEmptyState(PRIVATE_FALLBACK_MESSAGE);
      }
    } finally {
      finishChatNavigation(navToken);
    }
  }

  async function openPrivateDialog(peerId, peerName, navToken) {
    navToken = beginNavigationIfNeeded(navToken);

    const chatWindow = getElement("chatWindow");
    const input = getElement("input");
    const sendBtn = getElement("sendBtn");
    const backBtn = getElement("backBtn");
    const chatAvatar = getElement("chatAvatar");
    const chatTitle = getElement("chatTitle");
    const chatSubtitle = getElement("chatSubtitle");

    try {
      console.info("[KlevbyPrivate] openPrivateDialog start", {
        peerId,
        peerName,
        navToken,
        activeModeBefore: getCtx().getActiveMode ? getCtx().getActiveMode() : null,
        selectedPeerBefore: getSelectedPeer()
      });
      const safePeerId = String(peerId || "").trim();

      const currentUserId = getCurrentUserIdQuick();
      let currentChatUser = getCurrentUser();
      Promise.resolve()
        .then(() => ensureCurrentUserProfile({ soft: true }))
        .catch((error) => {
          console.warn("[KlevbyPrivate] ensureCurrentUserProfile skipped", {
            scope: "openPrivateDialog",
            error: String(error?.message || error)
          });
        });

      if (!isValidSupabaseUuid(currentUserId)) {
        showEmptyState("Для личных сообщений нужно войти.");
        return;
      }

      if (!isValidSupabaseUuid(safePeerId)) {
        console.warn("Klevby chat: неверный peerId для лички:", safePeerId);
        showEmptyState("Этот диалог открыть нельзя: у пользователя повреждён id. Создай новый профиль или проверь owner_id в Supabase.");
        return;
      }

      await withPrivateOptionalStepTimeout("profiles select for selected peer", () => loadProfilesByIds([safePeerId]));

      if (isStaleNavigation(navToken)) return;

      const nextPeer = {
        id: safePeerId,
        name: getProfileName(safePeerId, peerName || "Рыбак")
      };

      setSelectedPeer(nextPeer);
      setActiveMode("private");

      if (chatWindow) {
        chatWindow.classList.add("klevby-dialog-screen");
        chatWindow.classList.remove("klevby-private-list-screen");
      }

      clearReply();

      if (chatAvatar) chatAvatar.textContent = getInitials(nextPeer.name);
      if (chatTitle) chatTitle.textContent = nextPeer.name;
      if (chatSubtitle) chatSubtitle.textContent = getUserStatusText(nextPeer.id);
      if (input) {
        input.placeholder = "Напиши личное сообщение...";
        input.disabled = false;
      }
      if (sendBtn) sendBtn.disabled = false;
      if (backBtn) backBtn.classList.remove("hidden");

      syncSelectedPeerForCalls();
      markPeerAsRead(safePeerId);

      clearMessages();

      const cachedMessages = getCachedPrivateMessages(safePeerId);
      console.info("[KlevbyPrivate] openPrivateDialog instant view", {
        peerId: safePeerId,
        hasCache: Array.isArray(cachedMessages) && cachedMessages.length > 0
      });

      if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
        renderMessageList(cachedMessages, renderPrivateMessage);
        scrollChatToBottom();
      } else {
        showEmptyState("Загружаем сообщения...");
      }

      const config = window.KLEVB_CONFIG || {};
      const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "").trim().replace(/\/$/, "");
      const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();
      const accessToken = getPrivateAccessTokenQuick();
      const endpoint =
        `${supabaseUrl}/rest/v1/private_messages?select=*` +
        `&or=(and(sender_id.eq.${encodeURIComponent(currentUserId)},receiver_id.eq.${encodeURIComponent(safePeerId)}),and(sender_id.eq.${encodeURIComponent(safePeerId)},receiver_id.eq.${encodeURIComponent(currentUserId)}))` +
        `&order=created_at.asc`;

      const { data, error } = await withPrivateStepTimeout("private_messages dialog REST", async () => {
        const startedAt = Date.now();
        console.info("[KlevbyPrivate] private_messages dialog REST start", { endpoint });
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken || supabaseAnonKey}`
          }
        });
        const durationMs = Date.now() - startedAt;
        let body = null;
        try { body = await response.json(); } catch (_) { body = null; }
        if (!response.ok) {
          console.warn("[KlevbyPrivate] private_messages dialog REST fail", { status: response.status, durationMs, body });
          return { data: null, error: { status: response.status, body } };
        }
        console.info("[KlevbyPrivate] private_messages dialog REST end", { status: response.status, durationMs, rows: Array.isArray(body) ? body.length : 0 });
        return { data: Array.isArray(body) ? body : [], error: null };
      });

      if (isStaleNavigation(navToken)) return;

      if (error) {
        console.error("Ошибка загрузки лички:", error);
        showEmptyState("Не удалось загрузить личку. Проверь private_messages и RLS.");
        return;
      }

      console.info("[KlevbyPrivate] openPrivateDialog REST render replace start", {
        peerId: safePeerId,
        rows: Array.isArray(data) ? data.length : 0
      });

      (data || []).forEach((message) => {
        if (message.sender_id && message.sender_name) {
          rememberFallbackProfile(message.sender_id, message.sender_name);
        }
      });

      setUnreadPrivateCount(getUnreadPrivateCount() - 1);
      updateUnreadBadge();

      if (!data || !data.length) {
        setCachedPrivateMessages(safePeerId, []);
        showEmptyState("Личных сообщений пока нет. Напиши первым.");
        console.info("[KlevbyPrivate] openPrivateDialog REST render replace end", { peerId: safePeerId, rows: 0, empty: true });
      } else {
        setCachedPrivateMessages(safePeerId, data);
        renderMessageList(data, renderPrivateMessage);
        scrollChatToBottom();
        console.info("[KlevbyPrivate] openPrivateDialog REST render replace end", { peerId: safePeerId, rows: data.length, empty: false });
      }

      const participantIds = (data || []).flatMap((message) => [message.sender_id, message.receiver_id]);
      Promise.resolve()
        .then(() => {
          console.info("[KlevbyPrivate] profile enrichment start", {
            scope: "dialog messages",
            peerId: safePeerId,
            idsCount: participantIds.length
          });
          return withPrivateOptionalStepTimeout("profiles select for dialog messages", () => loadProfilesByIds(participantIds));
        })
        .then(() => {
          if (isStaleNavigation(navToken)) return;

          const selectedPeer = getSelectedPeer() || nextPeer;
          selectedPeer.name = getProfileName(safePeerId, selectedPeer.name);
          setSelectedPeer(selectedPeer);

          if (chatAvatar) chatAvatar.textContent = getInitials(selectedPeer.name);
          if (chatTitle) chatTitle.textContent = selectedPeer.name;

          syncSelectedPeerForCalls();
          console.info("[KlevbyPrivate] profile enrichment end", {
            scope: "dialog messages",
            peerId: safePeerId,
            idsCount: participantIds.length
          });
        })
        .catch((error) => {
          console.warn("[KlevbyPrivate] profile enrichment fail", {
            scope: "dialog messages",
            peerId: safePeerId,
            idsCount: participantIds.length,
            error: String(error?.message || error)
          });
        });
      console.info("[KlevbyPrivate] openPrivateDialog end", {
        peerId: safePeerId,
        navToken,
        activeModeAfter: getCtx().getActiveMode ? getCtx().getActiveMode() : null,
        selectedPeerAfter: getSelectedPeer(),
        messagesCount: data.length
      });
    } catch (error) {
      if (!isStaleNavigation(navToken)) {
        console.error("Ошибка открытия личного диалога:", error);
        showEmptyState(PRIVATE_FALLBACK_MESSAGE);
      }
    } finally {
      finishChatNavigation(navToken);
    }
  }

  async function sendPrivateMessage() {
    const input = getElement("input");
    const sendBtn = getElement("sendBtn");
    const rawVal = String(input?.value || "").trim();

    if (!rawVal) return;

    try {
      const currentUserId = getCurrentUserIdQuick();
      const selectedPeer = getSelectedPeer();

      if (!isValidSupabaseUuid(currentUserId)) {
        alert("Для личных сообщений нужно войти.");
        return;
      }

      if (!selectedPeer || !isValidSupabaseUuid(selectedPeer.id)) {
        alert("Сначала выбери собеседника.");
        return;
      }

      if (sendBtn) sendBtn.disabled = true;

      const senderName = getCurrentChatName();
      const messageContent = buildMessageContent(rawVal);

      const payload = {
        sender_id: currentUserId,
        receiver_id: selectedPeer.id,
        sender_name: senderName,
        content: messageContent
      };

      const config = window.KLEVB_CONFIG || {};
      const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "").trim().replace(/\/$/, "");
      const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();
      const accessToken = getPrivateAccessTokenQuick();
      const endpoint = `${supabaseUrl}/rest/v1/private_messages`;
      const startedAt = Date.now();
      console.info("[KlevbyPrivate] send REST start", { endpoint, peerId: selectedPeer.id });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
      const durationMs = Date.now() - startedAt;
      let responseBody = null;
      try { responseBody = await response.json(); } catch (_) { responseBody = null; }
      console.info("[KlevbyPrivate] send REST end", { status: response.status, durationMs });

      if (!response.ok) {
        console.error("Ошибка отправки личного сообщения:", { status: response.status, durationMs, responseBody });
        alert("Не получилось отправить личное сообщение. Проверь private_messages и RLS.");
        return;
      }

      const insertedMessage = Array.isArray(responseBody) ? (responseBody[0] || null) : responseBody;
      const uiMessage = insertedMessage || {
        id: `local-private-${Date.now()}`,
        sender_id: payload.sender_id,
        receiver_id: payload.receiver_id,
        sender_name: payload.sender_name,
        content: payload.content,
        created_at: new Date().toISOString()
      };

      console.info("[KlevbyPrivate] append sent private message start", { hasInsertedMessage: Boolean(insertedMessage) });
      try {
        renderPrivateMessage(uiMessage);
        scrollChatToBottom();
        console.info("[KlevbyPrivate] append sent private message end");
      } catch (appendError) {
        console.error("[KlevbyPrivate] append sent private message fail", { error: String(appendError?.message || appendError) });
      }

      if (input) input.value = "";
      clearReply();
      markPeerAsRead(selectedPeer.id);
      Promise.resolve(sendPushToUser(selectedPeer.id, senderName, rawVal)).catch((error) => {
        console.warn("[KlevbyPrivate] push skipped", {
          peerId: selectedPeer.id,
          error: String(error?.message || error)
        });
      });
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  window.KlevbyChatPrivate = {
    init,
    loadPrivatePeople,
    openPrivateDialog,
    sendPrivateMessage,
    markPeerAsRead,
    getPeerReadTime
  };
})();
