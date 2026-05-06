(function () {
  if (window.__klevbyChatLoaded) {
    return;
  }

  window.__klevbyChatLoaded = true;

  function getSharedSupabaseClient() {
    return (
      window.klevbySupabase ||
      window.supabaseClient ||
      (typeof window.klevbyGetSupabase === "function" ? window.klevbyGetSupabase() : null) ||
      null
    );
  }

  function waitForSharedSupabaseClient() {
    return new Promise((resolve, reject) => {
      let tries = 0;

      const timer = setInterval(() => {
        tries += 1;

        const client = getSharedSupabaseClient();

        if (client) {
          clearInterval(timer);
          resolve(client);
          return;
        }

        if (tries > 120) {
          clearInterval(timer);
          reject(new Error("Основной Supabase client не найден для chat.js"));
        }
      }, 100);
    });
  }

  waitForSharedSupabaseClient()
    .then((client) => setupChat(client))
    .catch((error) => {
      console.error("Klevby chat: не удалось запустить чат:", error);
    });

  function setupChat(chatDb) {
    injectExtraChatStyles();
    setupViewportFix();

    let currentChatUser = null;
    let activeMode = "public";
    let selectedPeer = null;

    const onlineUsers = new Map();
    const userProfiles = new Map();

    const shell = mountChatShell();

    if (!shell) {
      console.error("Klevby chat: assets/js/chat-shell.js не подключён или не запустился.");
      return;
    }

    const modal = shell.modal;
    const chatWindow = shell.chatWindow;
    const messagesContainer = shell.messagesContainer;
    const input = shell.input;
    const sendBtn = shell.sendBtn;

    const publicTab = shell.publicTab;
    const privateTab = shell.privateTab;
    const privatePeople = shell.privatePeople;
    const privateUnreadBadge = shell.privateUnreadBadge;

    const chatTitle = shell.chatTitle;
    const chatSubtitle = shell.chatSubtitle;
    const chatAvatar = shell.chatAvatar;

    const backBtn = shell.backBtn;
    const pushBtn = shell.pushBtn;
    const replyPreview = shell.replyPreview;
    const replyAuthor = shell.replyAuthor;
    const replyText = shell.replyText;

    const messageContextMenu = shell.messageContextMenu;
    const contextDeleteBtn = shell.contextDeleteBtn;

    initChatStateBridge();
    initChatUserBridge();
    initChatRenderBridge();
    initChatReplyBridge();
    initChatMessageActionsBridge();
    initChatPushBridge();
    initChatPublicBridge();
    initChatPrivateBridge();
    initChatRealtimeBridge();
    initChatLifecycleBridge();
    initChatAuthEventsBridge();
    initChatEventsBridge();

    refreshCurrentUser().then(async () => {
      await ensureCurrentUserProfile({ soft: true });
      setupPresence();
      setupRealtime();
      syncSelectedPeerForCalls();
      await refreshPushButtonState();
      await saveExistingPushSubscriptionIfPossible();
    }).catch((error) => {
      console.warn("Klevby chat: стартовая проверка пользователя пропущена:", error);
      setupPresence();
      setupRealtime();
      syncSelectedPeerForCalls();
      refreshPushButtonState();
    });

    function callApi(getApi, name, fallback, ...args) {
      const api = getApi();

      if (api && typeof api[name] === "function") {
        return api[name](...args);
      }

      return typeof fallback === "function" ? fallback(...args) : fallback;
    }

    function getChatAuthEventsApi() {
      return window.KlevbyChatAuthEvents || null;
    }

    function getChatLifecycleApi() {
      return window.KlevbyChatLifecycle || null;
    }

    function getChatStateApi() {
      return window.KlevbyChatState || null;
    }

    function getChatEventsApi() {
      return window.KlevbyChatEvents || null;
    }

    function getChatUserApi() {
      return window.KlevbyChatUser || null;
    }

    function getChatRenderApi() {
      return window.KlevbyChatRender || null;
    }

    function getChatReplyApi() {
      return window.KlevbyChatReply || null;
    }

    function getChatMessageActionsApi() {
      return window.KlevbyChatMessageActions || null;
    }

    function getChatPushApi() {
      return window.KlevbyChatPush || null;
    }

    function getChatPublicApi() {
      return window.KlevbyChatPublic || null;
    }

    function getChatPrivateApi() {
      return window.KlevbyChatPrivate || null;
    }

    function getChatRealtimeApi() {
      return window.KlevbyChatRealtime || null;
    }

    function callChatUser(name, fallback, ...args) {
      return callApi(getChatUserApi, name, fallback, ...args);
    }

    function callChatPush(name, fallback, ...args) {
      return callApi(getChatPushApi, name, fallback, ...args);
    }

    function callChatState(name, fallback, ...args) {
      return callApi(getChatStateApi, name, fallback, ...args);
    }

    function callChatRender(name, fallback, ...args) {
      return callApi(getChatRenderApi, name, fallback, ...args);
    }

    function callChatReply(name, fallback, ...args) {
      return callApi(getChatReplyApi, name, fallback, ...args);
    }

    function callChatMessageActions(name, fallback, ...args) {
      return callApi(getChatMessageActionsApi, name, fallback, ...args);
    }

    function callChatRealtime(name, fallback, ...args) {
      return callApi(getChatRealtimeApi, name, fallback, ...args);
    }

    function callChatLifecycle(name, fallback, ...args) {
      return callApi(getChatLifecycleApi, name, fallback, ...args);
    }

    function callChatPublic(name, fallback, ...args) {
      return callApi(getChatPublicApi, name, fallback, ...args);
    }

    function callChatPrivate(name, fallback, ...args) {
      return callApi(getChatPrivateApi, name, fallback, ...args);
    }

    function initChatAuthEventsBridge() {
      const api = getChatAuthEventsApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-auth-events.js не подключён.");
        return;
      }

      api.init({
        chatDb,

        elements: {
          modal
        },

        getCurrentUser: () => currentChatUser,
        setCurrentUser: (user) => {
          currentChatUser = user || null;
        },

        getUserFromMainSite,
        syncGlobalChatUser,
        ensureCurrentUserProfile,

        setupPresence,
        syncSelectedPeerForCalls,

        refreshPushButtonState,
        saveExistingPushSubscriptionIfPossible,

        getActiveMode: () => activeMode,
        getSelectedPeer: () => selectedPeer,

        openPrivateDialog,
        loadPrivatePeople,

        setChatTabsLoading
      });
    }

    function initChatLifecycleBridge() {
      const api = getChatLifecycleApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-lifecycle.js не подключён.");
        return;
      }

      api.init({
        elements: {
          modal
        },

        getActiveMode: () => activeMode,
        setActiveMode: (mode) => {
          activeMode = mode || "public";
        },

        getSelectedPeer: () => selectedPeer,
        setSelectedPeer: (peer) => {
          selectedPeer = peer || null;
        },

        updateViewportVars,
        lockChatPage,
        unlockChatPage,

        refreshCurrentUser,
        ensureCurrentUserProfile,
        reconnectRealtimeConnections,

        loadPublicMessages,
        loadPrivatePeople,
        openPrivateDialog,

        refreshPushButtonState,
        saveExistingPushSubscriptionIfPossible,

        syncSelectedPeerForCalls,
        clearReply,
        hideMessageMenu,

        setChatTabsLoading,
        cancelChatNavigation,

        isValidSupabaseUuid,
        scrollChatToBottom,
        showEmptyState
      });
    }

    function initChatStateBridge() {
      const api = getChatStateApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-state.js не подключён.");
        return;
      }

      api.init({
        elements: {
          publicTab,
          privateTab,
          backBtn,
          chatWindow,
          privateUnreadBadge
        }
      });
    }

    function initChatEventsBridge() {
      const api = getChatEventsApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-events.js не подключён.");
        return;
      }

      api.init({
        elements: {
          modal,
          messagesContainer,
          input,
          sendBtn
        },

        getChatLoading,

        openChat,
        closeChat,
        enablePushNotifications,
        loadPublicMessages,
        loadPrivatePeople,
        openPrivateDialog,
        clearReply,
        getContextMessageData,
        setReplyTarget,
        deleteMessage,
        findMessageDataFromRow,
        hideMessageMenu,
        showMessageMenu,
        send,
        updateViewportVars,
        scrollChatToBottom,
        scheduleChatResume,
        setChatTabsLoading
      });
    }

    function initChatUserBridge() {
      const api = getChatUserApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-user.js не подключён.");
        return;
      }

      api.init({
        getMainSupabaseClient,
        getCurrentUser: () => currentChatUser,
        setCurrentUser: (user) => {
          currentChatUser = user || null;
        },
        userProfiles
      });
    }

    function initChatRenderBridge() {
      const api = getChatRenderApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-render.js не подключён.");
        return;
      }

      api.init({
        elements: {
          messagesContainer,
          messageContextMenu,
          contextDeleteBtn
        },

        getCurrentUser: () => currentChatUser,
        getSelectedPeer: () => selectedPeer,
        getProfileName,
        rememberFallbackProfile,
        isMyPublicMessage,
        scrollChatToBottom
      });
    }

    function initChatReplyBridge() {
      const api = getChatReplyApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-reply.js не подключён.");
        return;
      }

      api.init({
        elements: {
          replyPreview,
          replyAuthor,
          replyText,
          input
        },
        hideMessageMenu
      });
    }

    function initChatMessageActionsBridge() {
      const api = getChatMessageActionsApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-message-actions.js не подключён.");
        return;
      }

      api.init({
        elements: {
          messagesContainer,
          messageContextMenu,
          contextDeleteBtn
        },

        getCurrentUser: () => currentChatUser,
        refreshCurrentUser,
        getMainSupabaseClient,
        getCurrentChatName,
        cleanDisplayName,
        isValidSupabaseUuid,
        cssEscape
      });
    }

    function initChatPushBridge() {
      const api = getChatPushApi();

      if (!api || typeof api.init !== "function") {
        if (pushBtn) {
          pushBtn.classList.add("hidden");
        }

        return;
      }

      api.init({
        pushButton: pushBtn,
        getCurrentUser: () => currentChatUser,
        refreshCurrentUser,
        getSupabaseClient: getMainSupabaseClient,
        cleanDisplayName,
        isValidSupabaseUuid
      });
    }

    function initChatPublicBridge() {
      const api = getChatPublicApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-public.js не подключён.");
        return;
      }

      api.init({
        getMainSupabaseClient,
        getCurrentUser: () => currentChatUser,
        setActiveMode: (mode) => {
          activeMode = mode;
        },
        setSelectedPeer: (peer) => {
          selectedPeer = peer;
        },

        elements: {
          chatWindow,
          messagesContainer,
          input,
          sendBtn,
          publicTab,
          privateTab,
          privatePeople,
          backBtn,
          chatAvatar,
          chatTitle,
          chatSubtitle
        },

        beginChatNavigation,
        isStaleNavigation,
        finishChatNavigation,
        refreshCurrentUser,
        ensureCurrentUserProfile,
        loadProfilesByIds,
        rememberFallbackProfile,
        renderPublicMessage,
        renderMessageList,
        clearMessages,
        showEmptyState,
        clearReply,
        syncSelectedPeerForCalls,
        getCurrentChatName,
        cleanDisplayName,
        isValidSupabaseUuid,
        buildMessageContent
      });
    }

    function initChatPrivateBridge() {
      const api = getChatPrivateApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-private.js не подключён.");
        return;
      }

      api.init({
        getMainSupabaseClient,
        getCurrentUser: () => currentChatUser,
        getSelectedPeer: () => selectedPeer,
        getUnreadPrivateCount,
        setActiveMode: (mode) => {
          activeMode = mode;
        },
        setSelectedPeer: (peer) => {
          selectedPeer = peer;
        },
        setUnreadPrivateCount,

        elements: {
          chatWindow,
          messagesContainer,
          input,
          sendBtn,
          publicTab,
          privateTab,
          privatePeople,
          backBtn,
          chatAvatar,
          chatTitle,
          chatSubtitle
        },

        beginChatNavigation,
        isStaleNavigation,
        finishChatNavigation,
        refreshCurrentUser,
        ensureCurrentUserProfile,
        getCurrentChatName,
        cleanDisplayName,
        isValidSupabaseUuid,
        getProfileName,
        rememberFallbackProfile,
        loadProfilesByIds,
        clearMessages,
        showEmptyState,
        clearReply,
        renderPrivateMessage,
        renderMessageList,
        parseReplyContent,
        getTimestamp,
        getMessageTime,
        getInitials,
        escapeHtml,
        isOnline,
        getUserStatusText,
        updateUnreadBadge,
        syncSelectedPeerForCalls,
        buildMessageContent,
        sendPushToUser
      });
    }

    function initChatRealtimeBridge() {
      const api = getChatRealtimeApi();

      if (!api || typeof api.init !== "function") {
        console.warn("Klevby chat: assets/js/chat-realtime.js не подключён.");
        return;
      }

      api.init({
        getSupabaseClient: getMainSupabaseClient,
        getCurrentUser: () => currentChatUser,
        getActiveMode: () => activeMode,
        getSelectedPeer: () => selectedPeer,
        getMessagesContainer: () => messagesContainer,
        getChatSubtitle: () => chatSubtitle,

        onlineUsers,
        userProfiles,

        refreshCurrentUser,
        ensureCurrentUserProfile,
        getCurrentChatName,
        getGuestName,
        cleanDisplayName,
        isValidSupabaseUuid,

        clearMessages,
        renderPublicMessage,
        renderPrivateMessage,
        loadProfilesByIds,
        rememberFallbackProfile,
        loadPrivatePeople,
        markPeerAsRead,

        incrementUnreadPrivateCount
      });
    }

    async function refreshPushButtonState() {
      return await callChatPush("refreshPushButtonState", () => {
        if (pushBtn) {
          pushBtn.classList.add("hidden");
        }
      });
    }

    async function saveExistingPushSubscriptionIfPossible() {
      return await callChatPush("saveExistingPushSubscriptionIfPossible");
    }

    async function enablePushNotifications() {
      return await callChatPush("enablePushNotifications", () => {
        alert("Push-уведомления сейчас не подключены. Проверь assets/js/chat-push.js.");
      });
    }

    async function sendPushToUser(receiverUserId, senderName, messageText) {
      return await callChatPush(
        "sendPushToUser",
        undefined,
        receiverUserId,
        senderName,
        messageText
      );
    }

    function setupPresence() {
      callChatRealtime("setupPresence");
    }

    function setupRealtime() {
      callChatRealtime("setupRealtime");
    }

    async function cleanupRealtimeConnections() {
      return await callChatRealtime("cleanupRealtimeConnections");
    }

    async function reconnectRealtimeConnections() {
      return await callChatRealtime("reconnectRealtimeConnections", async () => {
        setupPresence();
        setupRealtime();
      });
    }

    async function loadPublicMessages(navToken = beginChatNavigation()) {
      return await callChatPublic("loadPublicMessages", async (token) => {
        try {
          showEmptyState("Общий чат сейчас не подключён. Проверь assets/js/chat-public.js.");
        } finally {
          finishChatNavigation(token);
        }
      }, navToken);
    }

    async function sendPublicMessage() {
      return await callChatPublic("sendPublicMessage", () => {
        alert("Общий чат сейчас не подключён. Проверь assets/js/chat-public.js.");
      });
    }

    function isMyPublicMessage(message) {
      return Boolean(callChatPublic("isMyPublicMessage", false, message));
    }

    async function loadPrivatePeople(navToken = beginChatNavigation()) {
      return await callChatPrivate("loadPrivatePeople", async (token) => {
        try {
          showEmptyState("Личные сообщения сейчас не подключены. Проверь assets/js/chat-private.js.");
        } finally {
          finishChatNavigation(token);
        }
      }, navToken);
    }

    async function openPrivateDialog(peerId, peerName, navToken = beginChatNavigation()) {
      return await callChatPrivate("openPrivateDialog", async (id, name, token) => {
        try {
          showEmptyState("Личный диалог сейчас не подключён. Проверь assets/js/chat-private.js.");
        } finally {
          finishChatNavigation(token);
        }
      }, peerId, peerName, navToken);
    }

    async function sendPrivateMessage() {
      return await callChatPrivate("sendPrivateMessage", () => {
        alert("Личные сообщения сейчас не подключены. Проверь assets/js/chat-private.js.");
      });
    }

    function markPeerAsRead(peerId) {
      callChatPrivate("markPeerAsRead", undefined, peerId);
    }

    function getChatLoading() {
      return Boolean(callChatState("getChatLoading", false));
    }

    function beginChatNavigation() {
      return callChatState("beginChatNavigation", Date.now());
    }

    function cancelChatNavigation() {
      return callChatState("cancelChatNavigation", Date.now());
    }

    function isStaleNavigation(token) {
      return Boolean(callChatState("isStaleNavigation", false, token));
    }

    function finishChatNavigation(token) {
      callChatState("finishChatNavigation", undefined, token);
    }

    function setChatTabsLoading(isLoading) {
      callChatState("setChatTabsLoading", undefined, isLoading);
    }

    function getUnreadPrivateCount() {
      return Number(callChatState("getUnreadPrivateCount", 0)) || 0;
    }

    function setUnreadPrivateCount(value) {
      callChatState("setUnreadPrivateCount", undefined, value);
    }

    function incrementUnreadPrivateCount(amount = 1) {
      callChatState("incrementUnreadPrivateCount", undefined, amount);
    }

    function updateUnreadBadge() {
      callChatState("updateUnreadBadge");
    }

    function syncSelectedPeerForCalls() {
      if (
        activeMode === "private" &&
        selectedPeer &&
        selectedPeer.id &&
        isValidSupabaseUuid(selectedPeer.id) &&
        chatWindow.classList.contains("klevby-dialog-screen")
      ) {
        const peerPayload = {
          id: String(selectedPeer.id),
          name: cleanDisplayName(selectedPeer.name) || "Собеседник"
        };

        window.klevbySelectedPeer = peerPayload;
        window.selectedPeer = peerPayload;

        chatWindow.dataset.peerId = peerPayload.id;
        chatWindow.dataset.peerName = peerPayload.name;

        window.dispatchEvent(new CustomEvent("klevby-peer-selected", {
          detail: peerPayload
        }));
      } else {
        window.klevbySelectedPeer = null;
        window.selectedPeer = null;

        delete chatWindow.dataset.peerId;
        delete chatWindow.dataset.peerName;

        window.dispatchEvent(new CustomEvent("klevby-peer-selected", {
          detail: null
        }));
      }
    }

    function getMainSupabaseClient() {
      return getSharedSupabaseClient() || chatDb;
    }

    function getUserFromMainSite() {
      return callChatUser("getUserFromMainSite", () => (
        window.klevbyCurrentUser ||
        window.currentUser ||
        window.klevbyUser ||
        null
      ));
    }

    function syncGlobalChatUser() {
      return callChatUser("syncGlobalChatUser", () => {
        if (!currentChatUser || !currentChatUser.id) return;

        window.klevbyCurrentUser = currentChatUser;
        window.currentUser = currentChatUser;
        window.klevbyUser = currentChatUser;
      });
    }

    function isAuthLockError(error) {
      return callChatUser("isAuthLockError", () => {
        const message = String(error?.message || error || "").toLowerCase();
        return message.includes("lock") && message.includes("auth-token");
      }, error);
    }

    function isValidSupabaseUuid(value) {
      return callChatUser("isValidSupabaseUuid", () => {
        const id = String(value || "").trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      }, value);
    }

    function getValidProfileIds(ids = []) {
      return callChatUser("getValidProfileIds", () => (
        [...new Set(
          (ids || [])
            .map((id) => String(id || "").trim())
            .filter((id) => isValidSupabaseUuid(id))
        )]
      ), ids);
    }

    function getGuestName() {
      return callChatUser("getGuestName", () => {
        let name = "";

        try {
          name = localStorage.getItem("klevby_chat_guest_name") || "";
        } catch {
          name = "";
        }

        if (!name) {
          name = "Рыбак-" + Math.floor(1000 + Math.random() * 9000);

          try {
            localStorage.setItem("klevby_chat_guest_name", name);
          } catch {
            // localStorage может быть недоступен.
          }
        }

        return name;
      });
    }

    function cleanDisplayName(value) {
      return callChatUser("cleanDisplayName", () => {
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
      }, value);
    }

    function getMetadataName(user = currentChatUser) {
      return callChatUser("getMetadataName", () => {
        const meta = user?.user_metadata || {};

        return cleanDisplayName(
          meta.nickname ||
          meta.username ||
          meta.display_name ||
          meta.name ||
          meta.full_name ||
          ""
        );
      }, user);
    }

    async function refreshCurrentUser(options = {}) {
      const user = await callChatUser(
        "refreshCurrentUser",
        () => getUserFromMainSite() || currentChatUser || null,
        options
      );

      currentChatUser = user || null;
      return currentChatUser;
    }

    function getCurrentChatName() {
      return callChatUser("getCurrentChatName", () => {
        const nickname = getMetadataName(currentChatUser);

        if (nickname) return nickname;

        if (currentChatUser?.email) {
          return cleanDisplayName(currentChatUser.email);
        }

        return getGuestName();
      });
    }

    async function ensureCurrentUserProfile(options = {}) {
      return await callChatUser("ensureCurrentUserProfile", undefined, options);
    }

    async function loadProfilesByIds(ids = []) {
      return await callChatUser("loadProfilesByIds", undefined, ids);
    }

    function rememberFallbackProfile(userId, name) {
      return callChatUser("rememberFallbackProfile", () => {
        const id = String(userId || "").trim();
        const cleanName = cleanDisplayName(name);

        if (!id || !cleanName) return;
        if (!isValidSupabaseUuid(id)) return;

        if (!userProfiles.has(id)) {
          userProfiles.set(id, cleanName);
        }
      }, userId, name);
    }

    function getProfileName(userId, fallback = "Рыбак") {
      return callChatUser("getProfileName", () => {
        const id = String(userId || "").trim();

        if (id && userProfiles.has(id)) {
          return userProfiles.get(id) || cleanDisplayName(fallback) || "Рыбак";
        }

        return cleanDisplayName(fallback) || "Рыбак";
      }, userId, fallback);
    }

    function escapeHtml(text) {
      return callChatRender("escapeHtml", () => String(text || ""), text);
    }

    function cssEscape(value) {
      return callChatRender("cssEscape", () => String(value || ""), value);
    }

    function getInitials(name) {
      return callChatRender("getInitials", "Р", name);
    }

    function getMessageTime(createdAt) {
      return callChatRender("getMessageTime", "", createdAt);
    }

    function getTimestamp(createdAt) {
      return callChatRender("getTimestamp", Date.now(), createdAt);
    }

    function parseReplyContent(content) {
      return callChatRender("parseReplyContent", () => ({
        reply: null,
        mainText: String(content || "")
      }), content);
    }

    function clearMessages() {
      callChatRender("clearMessages");
    }

    function scrollChatToBottom() {
      callApi(getChatViewportApi, "scrollChatToBottom");
    }

    function showEmptyState(text) {
      callChatRender("showEmptyState", undefined, text);
    }

    function renderPublicMessage(message) {
      callChatRender("renderPublicMessage", () => {
        showEmptyState("Отрисовка общего чата не подключена. Проверь assets/js/chat-render.js.");
      }, message);
    }

    function renderPrivateMessage(message) {
      callChatRender("renderPrivateMessage", () => {
        showEmptyState("Отрисовка лички не подключена. Проверь assets/js/chat-render.js.");
      }, message);
    }

    function renderMessageList(data, renderFn) {
      callChatRender("renderMessageList", undefined, data, renderFn);
    }

    function findMessageDataFromRow(row) {
      const fromActions = callChatMessageActions("findMessageDataFromRow", null, row);

      if (fromActions) {
        return fromActions;
      }

      return callChatRender("findMessageDataFromRow", null, row);
    }

    function showMessageMenu(row) {
      callChatMessageActions("showMessageMenu", undefined, row);
    }

    function hideMessageMenu() {
      callChatMessageActions("hideMessageMenu");
    }

    function getContextMessageData() {
      return callChatMessageActions("getContextMessageData", null);
    }

    function clearReply() {
      callChatReply("clearReply");
    }

    function setReplyTarget(messageData) {
      callChatReply("setReplyTarget", undefined, messageData);
    }

    function buildMessageContent(value) {
      return callChatReply("buildMessageContent", value, value);
    }

    function isOnline(userId) {
      return Boolean(callChatRealtime("isOnline", false, userId));
    }

    function getUserStatusText(userId) {
      return callChatRealtime("getUserStatusText", "Был недавно", userId);
    }

    function updateSelectedPeerStatus() {
      callChatRealtime("updateSelectedPeerStatus");
    }

    async function send() {
      if (activeMode === "private") {
        await sendPrivateMessage();
      } else {
        await sendPublicMessage();
      }
    }

    async function deleteMessage(type, id) {
      return await callChatMessageActions("deleteMessage", () => {
        alert("Удаление сообщений сейчас не подключено. Проверь assets/js/chat-message-actions.js.");
      }, type, id);
    }

    async function reloadChatAfterResume(reason = "resume") {
      return await callChatLifecycle("reloadChatAfterResume", () => {
        console.warn("Klevby chat: chat-lifecycle.js не подключён, восстановление чата пропущено.");
      }, reason);
    }

    function scheduleChatResume(reason = "resume") {
      callChatLifecycle("scheduleChatResume", () => {
        console.warn("Klevby chat: chat-lifecycle.js не подключён, scheduleChatResume пропущен.");
      }, reason);
    }

    async function openChat() {
      return await callChatLifecycle("openChat", () => {
        console.warn("Klevby chat: chat-lifecycle.js не подключён, чат не открыт.");
      });
    }

    function closeChat() {
      callChatLifecycle("closeChat", () => {
        cancelChatNavigation();

        modal.classList.remove("open");
        modal.classList.add("hidden");

        selectedPeer = null;
        activeMode = "public";

        syncSelectedPeerForCalls();
        clearReply();
        hideMessageMenu();
        unlockChatPage();
      });
    }
  }

  function mountChatShell() {
    const api = window.KlevbyChatShell || null;

    if (!api || typeof api.mount !== "function") {
      return null;
    }

    return api.mount();
  }

  function getChatViewportApi() {
    return window.KlevbyChatViewport || null;
  }

  function setupViewportFix() {
    const api = getChatViewportApi();

    if (api && typeof api.init === "function") {
      api.init();
    }
  }

  function updateViewportVars() {
    const api = getChatViewportApi();

    if (api && typeof api.updateViewportVars === "function") {
      api.updateViewportVars();
    }
  }

  function lockChatPage() {
    const api = getChatViewportApi();

    if (api && typeof api.lockChatPage === "function") {
      api.lockChatPage();
    }
  }

  function unlockChatPage() {
    const api = getChatViewportApi();

    if (api && typeof api.unlockChatPage === "function") {
      api.unlockChatPage();
    }
  }

  function injectExtraChatStyles() {
    const oldStyle = document.getElementById("klevby-chat-extra-styles");

    if (oldStyle) {
      oldStyle.remove();
    }

    document.documentElement.classList.add("klevby-chat-css-ready");
  }
})();
