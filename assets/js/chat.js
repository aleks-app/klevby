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

    function getChatAuthEventsApi() {
      return window.KlevbyChatAuthEvents || null;
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

    function getChatLifecycleApi() {
      return window.KlevbyChatLifecycle || null;
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

    function getChatStateApi() {
      return window.KlevbyChatState || null;
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

    function getChatEventsApi() {
      return window.KlevbyChatEvents || null;
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

    function getChatUserApi() {
      return window.KlevbyChatUser || null;
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

    function getChatRenderApi() {
      return window.KlevbyChatRender || null;
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

    function getChatReplyApi() {
      return window.KlevbyChatReply || null;
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

    function getChatMessageActionsApi() {
      return window.KlevbyChatMessageActions || null;
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

    function getChatPushApi() {
      return window.KlevbyChatPush || null;
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

    function getChatPublicApi() {
      return window.KlevbyChatPublic || null;
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

    function getChatPrivateApi() {
      return window.KlevbyChatPrivate || null;
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

    function getChatRealtimeApi() {
      return window.KlevbyChatRealtime || null;
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

    function callChatUser(name, fallback, ...args) {
      const api = getChatUserApi();

      if (api && typeof api[name] === "function") {
        return api[name](...args);
      }

      return typeof fallback === "function" ? fallback(...args) : fallback;
    }

    async function refreshPushButtonState() {
      const api = getChatPushApi();

      if (api && typeof api.refreshPushButtonState === "function") {
        return await api.refreshPushButtonState();
      }

      if (pushBtn) {
        pushBtn.classList.add("hidden");
      }
    }

    async function saveExistingPushSubscriptionIfPossible() {
      const api = getChatPushApi();

      if (api && typeof api.saveExistingPushSubscriptionIfPossible === "function") {
        return await api.saveExistingPushSubscriptionIfPossible();
      }
    }

    async function enablePushNotifications() {
      const api = getChatPushApi();

      if (api && typeof api.enablePushNotifications === "function") {
        return await api.enablePushNotifications();
      }

      alert("Push-уведомления сейчас не подключены. Проверь assets/js/chat-push.js.");
    }

    async function sendPushToUser(receiverUserId, senderName, messageText) {
      const api = getChatPushApi();

      if (api && typeof api.sendPushToUser === "function") {
        return await api.sendPushToUser(receiverUserId, senderName, messageText);
      }
    }

    function setupPresence() {
      const api = getChatRealtimeApi();

      if (api && typeof api.setupPresence === "function") {
        api.setupPresence();
      }
    }

    function setupRealtime() {
      const api = getChatRealtimeApi();

      if (api && typeof api.setupRealtime === "function") {
        api.setupRealtime();
      }
    }

    async function cleanupRealtimeConnections() {
      const api = getChatRealtimeApi();

      if (api && typeof api.cleanupRealtimeConnections === "function") {
        await api.cleanupRealtimeConnections();
      }
    }

    async function reconnectRealtimeConnections() {
      const api = getChatRealtimeApi();

      if (api && typeof api.reconnectRealtimeConnections === "function") {
        await api.reconnectRealtimeConnections();
        return;
      }

      setupPresence();
      setupRealtime();
    }

    async function loadPublicMessages(navToken = beginChatNavigation()) {
      const api = getChatPublicApi();

      if (api && typeof api.loadPublicMessages === "function") {
        return await api.loadPublicMessages(navToken);
      }

      try {
        showEmptyState("Общий чат сейчас не подключён. Проверь assets/js/chat-public.js.");
      } finally {
        finishChatNavigation(navToken);
      }
    }

    async function sendPublicMessage() {
      const api = getChatPublicApi();

      if (api && typeof api.sendPublicMessage === "function") {
        return await api.sendPublicMessage();
      }

      alert("Общий чат сейчас не подключён. Проверь assets/js/chat-public.js.");
    }

    function isMyPublicMessage(message) {
      const api = getChatPublicApi();

      if (api && typeof api.isMyPublicMessage === "function") {
        return api.isMyPublicMessage(message);
      }

      const myUserId = currentChatUser?.id || null;
      const messageUserId = message.user_id || null;

      if (myUserId && messageUserId && String(myUserId) === String(messageUserId)) {
        return true;
      }

      if (!messageUserId && cleanDisplayName(message.user_name) === getCurrentChatName()) {
        return true;
      }

      return false;
    }

    async function loadPrivatePeople(navToken = beginChatNavigation()) {
      const api = getChatPrivateApi();

      if (api && typeof api.loadPrivatePeople === "function") {
        return await api.loadPrivatePeople(navToken);
      }

      try {
        showEmptyState("Личные сообщения сейчас не подключены. Проверь assets/js/chat-private.js.");
      } finally {
        finishChatNavigation(navToken);
      }
    }

    async function openPrivateDialog(peerId, peerName, navToken = beginChatNavigation()) {
      const api = getChatPrivateApi();

      if (api && typeof api.openPrivateDialog === "function") {
        return await api.openPrivateDialog(peerId, peerName, navToken);
      }

      try {
        showEmptyState("Личный диалог сейчас не подключён. Проверь assets/js/chat-private.js.");
      } finally {
        finishChatNavigation(navToken);
      }
    }

    async function sendPrivateMessage() {
      const api = getChatPrivateApi();

      if (api && typeof api.sendPrivateMessage === "function") {
        return await api.sendPrivateMessage();
      }

      alert("Личные сообщения сейчас не подключены. Проверь assets/js/chat-private.js.");
    }

    function markPeerAsRead(peerId) {
      const api = getChatPrivateApi();

      if (api && typeof api.markPeerAsRead === "function") {
        api.markPeerAsRead(peerId);
        return;
      }

      if (!isValidSupabaseUuid(peerId)) return;

      try {
        const myId = currentChatUser?.id || "guest";
        localStorage.setItem(`klevby_private_read_${myId}_${peerId}`, String(Date.now()));
      } catch (error) {
        console.warn("Klevby chat: не удалось сохранить статус прочтения:", error);
      }
    }

    function getChatLoading() {
      const api = getChatStateApi();

      if (api && typeof api.getChatLoading === "function") {
        return api.getChatLoading();
      }

      return false;
    }

    function beginChatNavigation() {
      const api = getChatStateApi();

      if (api && typeof api.beginChatNavigation === "function") {
        return api.beginChatNavigation();
      }

      return Date.now();
    }

    function cancelChatNavigation() {
      const api = getChatStateApi();

      if (api && typeof api.cancelChatNavigation === "function") {
        return api.cancelChatNavigation();
      }

      return Date.now();
    }

    function isStaleNavigation(token) {
      const api = getChatStateApi();

      if (api && typeof api.isStaleNavigation === "function") {
        return api.isStaleNavigation(token);
      }

      return false;
    }

    function finishChatNavigation(token) {
      const api = getChatStateApi();

      if (api && typeof api.finishChatNavigation === "function") {
        api.finishChatNavigation(token);
      }
    }

    function setChatTabsLoading(isLoading) {
      const api = getChatStateApi();

      if (api && typeof api.setChatTabsLoading === "function") {
        api.setChatTabsLoading(isLoading);
      }
    }

    function getUnreadPrivateCount() {
      const api = getChatStateApi();

      if (api && typeof api.getUnreadPrivateCount === "function") {
        return api.getUnreadPrivateCount();
      }

      return 0;
    }

    function setUnreadPrivateCount(value) {
      const api = getChatStateApi();

      if (api && typeof api.setUnreadPrivateCount === "function") {
        api.setUnreadPrivateCount(value);
      }
    }

    function incrementUnreadPrivateCount(amount = 1) {
      const api = getChatStateApi();

      if (api && typeof api.incrementUnreadPrivateCount === "function") {
        api.incrementUnreadPrivateCount(amount);
      }
    }

    function updateUnreadBadge() {
      const api = getChatStateApi();

      if (api && typeof api.updateUnreadBadge === "function") {
        api.updateUnreadBadge();
      }
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
      const user = await callChatUser("refreshCurrentUser", () => getUserFromMainSite() || currentChatUser || null, options);
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
      const api = getChatRenderApi();

      if (api && typeof api.escapeHtml === "function") {
        return api.escapeHtml(text);
      }

      return String(text || "");
    }

    function cssEscape(value) {
      const api = getChatRenderApi();

      if (api && typeof api.cssEscape === "function") {
        return api.cssEscape(value);
      }

      return String(value || "");
    }

    function getInitials(name) {
      const api = getChatRenderApi();

      if (api && typeof api.getInitials === "function") {
        return api.getInitials(name);
      }

      return "Р";
    }

    function getMessageTime(createdAt) {
      const api = getChatRenderApi();

      if (api && typeof api.getMessageTime === "function") {
        return api.getMessageTime(createdAt);
      }

      return "";
    }

    function getTimestamp(createdAt) {
      const api = getChatRenderApi();

      if (api && typeof api.getTimestamp === "function") {
        return api.getTimestamp(createdAt);
      }

      return Date.now();
    }

    function parseReplyContent(content) {
      const api = getChatRenderApi();

      if (api && typeof api.parseReplyContent === "function") {
        return api.parseReplyContent(content);
      }

      return {
        reply: null,
        mainText: String(content || "")
      };
    }

    function clearMessages() {
      const api = getChatRenderApi();

      if (api && typeof api.clearMessages === "function") {
        api.clearMessages();
        return;
      }

      messagesContainer.innerHTML = "";
      hideMessageMenu();
    }

    function scrollChatToBottom() {
      const api = window.KlevbyChatViewport;

      if (api && typeof api.scrollChatToBottom === "function") {
        api.scrollChatToBottom();
        return;
      }

      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }

    function showEmptyState(text) {
      const api = getChatRenderApi();

      if (api && typeof api.showEmptyState === "function") {
        api.showEmptyState(text);
        return;
      }

      clearMessages();

      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          ${escapeHtml(text)}
        </div>
      `;
    }

    function renderPublicMessage(message) {
      const api = getChatRenderApi();

      if (api && typeof api.renderPublicMessage === "function") {
        api.renderPublicMessage(message);
        return;
      }

      showEmptyState("Отрисовка общего чата не подключена. Проверь assets/js/chat-render.js.");
    }

    function renderPrivateMessage(message) {
      const api = getChatRenderApi();

      if (api && typeof api.renderPrivateMessage === "function") {
        api.renderPrivateMessage(message);
        return;
      }

      showEmptyState("Отрисовка лички не подключена. Проверь assets/js/chat-render.js.");
    }

    function renderMessageList(data, renderFn) {
      const api = getChatRenderApi();

      if (api && typeof api.renderMessageList === "function") {
        api.renderMessageList(data, renderFn);
        return;
      }

      clearMessages();

      (data || []).forEach((message) => {
        renderFn(message);
      });

      scrollChatToBottom();
    }

    function findMessageDataFromRow(row) {
      const api = getChatMessageActionsApi();

      if (api && typeof api.findMessageDataFromRow === "function") {
        return api.findMessageDataFromRow(row);
      }

      const renderApi = getChatRenderApi();

      if (renderApi && typeof renderApi.findMessageDataFromRow === "function") {
        return renderApi.findMessageDataFromRow(row);
      }

      return null;
    }

    function showMessageMenu(row) {
      const api = getChatMessageActionsApi();

      if (api && typeof api.showMessageMenu === "function") {
        api.showMessageMenu(row);
      }
    }

    function hideMessageMenu() {
      const api = getChatMessageActionsApi();

      if (api && typeof api.hideMessageMenu === "function") {
        api.hideMessageMenu();
      }
    }

    function getContextMessageData() {
      const api = getChatMessageActionsApi();

      if (api && typeof api.getContextMessageData === "function") {
        return api.getContextMessageData();
      }

      return null;
    }

    function clearReply() {
      const api = getChatReplyApi();

      if (api && typeof api.clearReply === "function") {
        api.clearReply();
      }
    }

    function setReplyTarget(messageData) {
      const api = getChatReplyApi();

      if (api && typeof api.setReplyTarget === "function") {
        api.setReplyTarget(messageData);
      }
    }

    function buildMessageContent(value) {
      const api = getChatReplyApi();

      if (api && typeof api.buildMessageContent === "function") {
        return api.buildMessageContent(value);
      }

      return value;
    }

    function isOnline(userId) {
      const api = getChatRealtimeApi();

      return Boolean(
        api &&
        typeof api.isOnline === "function" &&
        api.isOnline(userId)
      );
    }

    function getUserStatusText(userId) {
      const api = getChatRealtimeApi();

      if (api && typeof api.getUserStatusText === "function") {
        return api.getUserStatusText(userId);
      }

      return "Был недавно";
    }

    function updateSelectedPeerStatus() {
      const api = getChatRealtimeApi();

      if (api && typeof api.updateSelectedPeerStatus === "function") {
        api.updateSelectedPeerStatus();
      }
    }

    async function send() {
      if (activeMode === "private") {
        await sendPrivateMessage();
      } else {
        await sendPublicMessage();
      }
    }

    async function deleteMessage(type, id) {
      const api = getChatMessageActionsApi();

      if (api && typeof api.deleteMessage === "function") {
        return await api.deleteMessage(type, id);
      }

      alert("Удаление сообщений сейчас не подключено. Проверь assets/js/chat-message-actions.js.");
    }

    async function reloadChatAfterResume(reason = "resume") {
      const api = getChatLifecycleApi();

      if (api && typeof api.reloadChatAfterResume === "function") {
        return await api.reloadChatAfterResume(reason);
      }

      console.warn("Klevby chat: chat-lifecycle.js не подключён, восстановление чата пропущено.");
    }

    function scheduleChatResume(reason = "resume") {
      const api = getChatLifecycleApi();

      if (api && typeof api.scheduleChatResume === "function") {
        api.scheduleChatResume(reason);
        return;
      }

      console.warn("Klevby chat: chat-lifecycle.js не подключён, scheduleChatResume пропущен.");
    }

    async function openChat() {
      const api = getChatLifecycleApi();

      if (api && typeof api.openChat === "function") {
        return await api.openChat();
      }

      console.warn("Klevby chat: chat-lifecycle.js не подключён, чат не открыт.");
    }

    function closeChat() {
      const api = getChatLifecycleApi();

      if (api && typeof api.closeChat === "function") {
        api.closeChat();
        return;
      }

      cancelChatNavigation();

      modal.classList.remove("open");
      modal.classList.add("hidden");

      selectedPeer = null;
      activeMode = "public";

      syncSelectedPeerForCalls();
      clearReply();
      hideMessageMenu();
      unlockChatPage();
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
      return;
    }

    updateViewportVars();
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
      return;
    }

    document.documentElement.classList.add("klevby-chat-lock");
    document.body.classList.add("klevby-chat-lock");
  }

  function unlockChatPage() {
    const api = getChatViewportApi();

    if (api && typeof api.unlockChatPage === "function") {
      api.unlockChatPage();
      return;
    }

    document.documentElement.classList.remove("klevby-chat-lock");
    document.body.classList.remove("klevby-chat-lock");
  }

  function injectExtraChatStyles() {
    const oldStyle = document.getElementById("klevby-chat-extra-styles");

    if (oldStyle) {
      oldStyle.remove();
    }

    document.documentElement.classList.add("klevby-chat-css-ready");
  }
})();
