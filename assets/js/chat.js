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

    let unreadPrivateCountFallback = 0;
    let replyTargetFallback = null;
    let contextMessageDataFallback = null;

    let chatNavigationTokenFallback = 0;
    let chatLoadingFallback = false;

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

    if (chatDb.auth && typeof chatDb.auth.onAuthStateChange === "function") {
      chatDb.auth.onAuthStateChange(async (_event, session) => {
        try {
          currentChatUser =
            session?.user ||
            getUserFromMainSite() ||
            currentChatUser ||
            null;

          syncGlobalChatUser();
          await ensureCurrentUserProfile({ force: true, soft: true });
          setupPresence();
          syncSelectedPeerForCalls();
          await refreshPushButtonState();
          await saveExistingPushSubscriptionIfPossible();
        } catch (error) {
          console.warn("Klevby chat: auth-change обработан с предупреждением:", error);
        }
      });
    }

    window.addEventListener("klevby-auth-changed", async (event) => {
      try {
        currentChatUser =
          event?.detail?.user ||
          getUserFromMainSite() ||
          currentChatUser ||
          null;

        syncGlobalChatUser();
        await ensureCurrentUserProfile({ force: true, soft: true });

        if (activeMode === "private" && modal && modal.classList.contains("open")) {
          if (selectedPeer) {
            await openPrivateDialog(selectedPeer.id, selectedPeer.name);
          } else {
            await loadPrivatePeople();
          }
        }

        syncSelectedPeerForCalls();
        await refreshPushButtonState();
        await saveExistingPushSubscriptionIfPossible();
      } catch (error) {
        console.warn("Klevby chat: klevby-auth-changed обработан с предупреждением:", error);
        setChatTabsLoading(false);
      }
    });

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

        updateSelectedPeerStatus,
        incrementUnreadPrivateCount
      });
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

      return chatLoadingFallback;
    }

    function beginChatNavigation() {
      const api = getChatStateApi();

      if (api && typeof api.beginChatNavigation === "function") {
        return api.beginChatNavigation();
      }

      chatNavigationTokenFallback += 1;
      setChatTabsLoading(true);
      return chatNavigationTokenFallback;
    }

    function cancelChatNavigation() {
      const api = getChatStateApi();

      if (api && typeof api.cancelChatNavigation === "function") {
        return api.cancelChatNavigation();
      }

      chatNavigationTokenFallback += 1;
      setChatTabsLoading(false);
      return chatNavigationTokenFallback;
    }

    function isStaleNavigation(token) {
      const api = getChatStateApi();

      if (api && typeof api.isStaleNavigation === "function") {
        return api.isStaleNavigation(token);
      }

      return token !== chatNavigationTokenFallback;
    }

    function finishChatNavigation(token) {
      const api = getChatStateApi();

      if (api && typeof api.finishChatNavigation === "function") {
        api.finishChatNavigation(token);
        return;
      }

      if (!isStaleNavigation(token)) {
        setChatTabsLoading(false);
      }
    }

    function setChatTabsLoading(isLoading) {
      const api = getChatStateApi();

      if (api && typeof api.setChatTabsLoading === "function") {
        api.setChatTabsLoading(isLoading);
        return;
      }

      chatLoadingFallback = Boolean(isLoading);

      if (publicTab) {
        publicTab.disabled = chatLoadingFallback;
        publicTab.classList.toggle("loading", chatLoadingFallback);
      }

      if (privateTab) {
        privateTab.disabled = chatLoadingFallback;
        privateTab.classList.toggle("loading", chatLoadingFallback);
      }

      if (backBtn) {
        backBtn.disabled = chatLoadingFallback;
        backBtn.classList.toggle("loading", chatLoadingFallback);
      }

      if (chatWindow) {
        chatWindow.classList.toggle("klevby-chat-loading", chatLoadingFallback);
      }
    }

    function getUnreadPrivateCount() {
      const api = getChatStateApi();

      if (api && typeof api.getUnreadPrivateCount === "function") {
        return api.getUnreadPrivateCount();
      }

      return unreadPrivateCountFallback;
    }

    function setUnreadPrivateCount(value) {
      const api = getChatStateApi();

      if (api && typeof api.setUnreadPrivateCount === "function") {
        api.setUnreadPrivateCount(value);
        return;
      }

      unreadPrivateCountFallback = Math.max(0, Number(value) || 0);
      updateUnreadBadge();
    }

    function incrementUnreadPrivateCount(amount = 1) {
      const api = getChatStateApi();

      if (api && typeof api.incrementUnreadPrivateCount === "function") {
        api.incrementUnreadPrivateCount(amount);
        return;
      }

      unreadPrivateCountFallback += Number(amount) || 1;
      updateUnreadBadge();
    }

    function updateUnreadBadge() {
      const api = getChatStateApi();

      if (api && typeof api.updateUnreadBadge === "function") {
        api.updateUnreadBadge();
        return;
      }

      if (!privateUnreadBadge) return;

      if (unreadPrivateCountFallback <= 0) {
        privateUnreadBadge.classList.add("hidden");
        privateUnreadBadge.textContent = "0";
        return;
      }

      privateUnreadBadge.classList.remove("hidden");
      privateUnreadBadge.textContent = String(Math.min(unreadPrivateCountFallback, 99));
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
      const api = getChatUserApi();

      if (api && typeof api.getUserFromMainSite === "function") {
        return api.getUserFromMainSite();
      }

      const fromGetter =
        typeof window.klevbyGetCurrentUser === "function"
          ? window.klevbyGetCurrentUser()
          : null;

      return (
        fromGetter ||
        window.klevbyCurrentUser ||
        window.currentUser ||
        window.klevbyUser ||
        null
      );
    }

    function syncGlobalChatUser() {
      const api = getChatUserApi();

      if (api && typeof api.syncGlobalChatUser === "function") {
        api.syncGlobalChatUser();
        return;
      }

      if (!currentChatUser || !currentChatUser.id) return;

      window.klevbyCurrentUser = currentChatUser;
      window.currentUser = currentChatUser;
      window.klevbyUser = currentChatUser;
    }

    function isAuthLockError(error) {
      const api = getChatUserApi();

      if (api && typeof api.isAuthLockError === "function") {
        return api.isAuthLockError(error);
      }

      const message = String(error?.message || error || "").toLowerCase();
      return message.includes("lock") && message.includes("auth-token");
    }

    function isValidSupabaseUuid(value) {
      const api = getChatUserApi();

      if (api && typeof api.isValidSupabaseUuid === "function") {
        return api.isValidSupabaseUuid(value);
      }

      const id = String(value || "").trim();

      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    function getValidProfileIds(ids = []) {
      const api = getChatUserApi();

      if (api && typeof api.getValidProfileIds === "function") {
        return api.getValidProfileIds(ids);
      }

      return [...new Set(
        (ids || [])
          .map((id) => String(id || "").trim())
          .filter((id) => isValidSupabaseUuid(id))
      )];
    }

    function getGuestName() {
      const api = getChatUserApi();

      if (api && typeof api.getGuestName === "function") {
        return api.getGuestName();
      }

      let name = localStorage.getItem("klevby_chat_guest_name");

      if (!name) {
        name = "Рыбак-" + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem("klevby_chat_guest_name", name);
      }

      return name;
    }

    function cleanDisplayName(value) {
      const api = getChatUserApi();

      if (api && typeof api.cleanDisplayName === "function") {
        return api.cleanDisplayName(value);
      }

      let name = String(value || "").trim();

      if (!name) return "";

      if (name.includes("@")) {
        name = name.split("@")[0];
      }

      name = name
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      return name.slice(0, 32);
    }

    function getMetadataName(user = currentChatUser) {
      const api = getChatUserApi();

      if (api && typeof api.getMetadataName === "function") {
        return api.getMetadataName(user);
      }

      const meta = user?.user_metadata || {};

      return cleanDisplayName(
        meta.nickname ||
        meta.username ||
        meta.display_name ||
        meta.name ||
        meta.full_name ||
        ""
      );
    }

    async function refreshCurrentUser(options = {}) {
      const api = getChatUserApi();

      if (api && typeof api.refreshCurrentUser === "function") {
        const user = await api.refreshCurrentUser(options);
        currentChatUser = user || null;
        return currentChatUser;
      }

      currentChatUser = getUserFromMainSite() || currentChatUser || null;
      return currentChatUser;
    }

    function getCurrentChatName() {
      const api = getChatUserApi();

      if (api && typeof api.getCurrentChatName === "function") {
        return api.getCurrentChatName();
      }

      const nickname = getMetadataName(currentChatUser);

      if (nickname) {
        return nickname;
      }

      if (currentChatUser?.email) {
        return cleanDisplayName(currentChatUser.email);
      }

      return getGuestName();
    }

    async function ensureCurrentUserProfile(options = {}) {
      const api = getChatUserApi();

      if (api && typeof api.ensureCurrentUserProfile === "function") {
        return await api.ensureCurrentUserProfile(options);
      }
    }

    async function loadProfilesByIds(ids = []) {
      const api = getChatUserApi();

      if (api && typeof api.loadProfilesByIds === "function") {
        return await api.loadProfilesByIds(ids);
      }

      const uniqueIds = getValidProfileIds(ids);

      if (!uniqueIds.length) return;
    }

    function rememberFallbackProfile(userId, name) {
      const api = getChatUserApi();

      if (api && typeof api.rememberFallbackProfile === "function") {
        api.rememberFallbackProfile(userId, name);
        return;
      }

      const id = String(userId || "").trim();
      const cleanName = cleanDisplayName(name);

      if (!id || !cleanName) return;
      if (!isValidSupabaseUuid(id)) return;

      if (!userProfiles.has(id)) {
        userProfiles.set(id, cleanName);
      }
    }

    function getProfileName(userId, fallback = "Рыбак") {
      const api = getChatUserApi();

      if (api && typeof api.getProfileName === "function") {
        return api.getProfileName(userId, fallback);
      }

      const id = String(userId || "").trim();

      if (id && userProfiles.has(id)) {
        return userProfiles.get(id) || cleanDisplayName(fallback) || "Рыбак";
      }

      return cleanDisplayName(fallback) || "Рыбак";
    }

    function escapeHtml(text) {
      const api = getChatRenderApi();

      if (api && typeof api.escapeHtml === "function") {
        return api.escapeHtml(text);
      }

      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function cssEscape(value) {
      const api = getChatRenderApi();

      if (api && typeof api.cssEscape === "function") {
        return api.cssEscape(value);
      }

      if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(value);
      }

      return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

    function getInitials(name) {
      const api = getChatRenderApi();

      if (api && typeof api.getInitials === "function") {
        return api.getInitials(name);
      }

      const clean = String(name || "Рыбак").trim();
      return (clean[0] || "Р").toUpperCase();
    }

    function getMessageTime(createdAt) {
      const api = getChatRenderApi();

      if (api && typeof api.getMessageTime === "function") {
        return api.getMessageTime(createdAt);
      }

      if (!createdAt) return "";

      try {
        return new Date(createdAt).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch {
        return "";
      }
    }

    function getTimestamp(createdAt) {
      const api = getChatRenderApi();

      if (api && typeof api.getTimestamp === "function") {
        return api.getTimestamp(createdAt);
      }

      const time = new Date(createdAt || Date.now()).getTime();
      return Number.isFinite(time) ? time : Date.now();
    }

    function parseReplyContent(content) {
      const api = getChatRenderApi();

      if (api && typeof api.parseReplyContent === "function") {
        return api.parseReplyContent(content);
      }

      const text = String(content || "");

      if (!text.startsWith("↩ Ответ ")) {
        return {
          reply: null,
          mainText: text
        };
      }

      const parts = text.split("\n");

      if (parts.length < 2) {
        return {
          reply: null,
          mainText: text
        };
      }

      return {
        reply: parts[0].replace("↩ Ответ ", ""),
        mainText: parts.slice(1).join("\n")
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
      const api = getChatRenderApi();

      if (api && typeof api.findMessageDataFromRow === "function") {
        return api.findMessageDataFromRow(row);
      }

      if (!row) return null;

      return {
        id: row.dataset.messageId || "",
        type: row.dataset.messageType || "public",
        author: row.dataset.author || "Рыбак",
        content: row.dataset.content || "",
        isMine: row.dataset.isMine === "1"
      };
    }

    function showMessageMenu(row) {
      const api = getChatMessageActionsApi();

      if (api && typeof api.showMessageMenu === "function") {
        api.showMessageMenu(row);
        return;
      }

      const renderApi = getChatRenderApi();

      if (renderApi && typeof renderApi.showMessageMenu === "function") {
        renderApi.showMessageMenu(row);
        return;
      }

      const data = findMessageDataFromRow(row);
      if (!data) return;

      contextMessageDataFallback = data;
      contextDeleteBtn.classList.toggle("hidden", !data.isMine || !data.id);
      messageContextMenu.classList.remove("hidden");

      const rect = row.getBoundingClientRect();
      const menuWidth = 170;
      const menuHeight = 92;

      let left = Math.min(
        Math.max(12, rect.left + rect.width / 2 - menuWidth / 2),
        window.innerWidth - menuWidth - 12
      );

      let top = rect.top - menuHeight - 8;

      if (top < 12) {
        top = rect.bottom + 8;
      }

      messageContextMenu.style.left = `${left}px`;
      messageContextMenu.style.top = `${top}px`;
    }

    function hideMessageMenu() {
      const api = getChatMessageActionsApi();

      if (api && typeof api.hideMessageMenu === "function") {
        api.hideMessageMenu();
        return;
      }

      const renderApi = getChatRenderApi();

      if (renderApi && typeof renderApi.hideMessageMenu === "function") {
        renderApi.hideMessageMenu();
        return;
      }

      contextMessageDataFallback = null;
      messageContextMenu.classList.add("hidden");
      messageContextMenu.style.left = "";
      messageContextMenu.style.top = "";
    }

    function getContextMessageData() {
      const api = getChatMessageActionsApi();

      if (api && typeof api.getContextMessageData === "function") {
        return api.getContextMessageData();
      }

      const renderApi = getChatRenderApi();

      if (renderApi && typeof renderApi.getContextMessageData === "function") {
        return renderApi.getContextMessageData();
      }

      return contextMessageDataFallback;
    }

    function clearReply() {
      const api = getChatReplyApi();

      if (api && typeof api.clearReply === "function") {
        api.clearReply();
        return;
      }

      replyTargetFallback = null;
      replyPreview.classList.add("hidden");
      replyAuthor.textContent = "";
      replyText.textContent = "";
    }

    function setReplyTarget(messageData) {
      const api = getChatReplyApi();

      if (api && typeof api.setReplyTarget === "function") {
        api.setReplyTarget(messageData);
        return;
      }

      replyTargetFallback = {
        author: messageData.isMine ? "Вы" : messageData.author,
        text: messageData.content || ""
      };

      replyAuthor.textContent = "Ответ: " + replyTargetFallback.author;
      replyText.textContent = replyTargetFallback.text;

      replyPreview.classList.remove("hidden");
      hideMessageMenu();

      requestAnimationFrame(() => {
        input.focus();
      });
    }

    function buildMessageContent(value) {
      const api = getChatReplyApi();

      if (api && typeof api.buildMessageContent === "function") {
        return api.buildMessageContent(value);
      }

      if (!replyTargetFallback) return value;

      const quoted = String(replyTargetFallback.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      return `↩ Ответ ${replyTargetFallback.author}: ${quoted}\n${value}`;
    }

    function isOnline(userId) {
      if (!userId) return false;
      return onlineUsers.has(String(userId));
    }

    function getUserStatusText(userId) {
      if (!userId) return "Был недавно";
      return isOnline(userId) ? "Онлайн" : "Был недавно";
    }

    function updateSelectedPeerStatus() {
      if (activeMode !== "private" || !selectedPeer) return;
      chatSubtitle.textContent = getUserStatusText(selectedPeer.id);
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

      if (!id) return;

      if (!confirm("Удалить сообщение?")) return;

      await refreshCurrentUser({ force: true });

      let result;

      if (type === "private") {
        if (!currentChatUser || !isValidSupabaseUuid(currentChatUser.id)) {
          alert("Удалять личные сообщения можно только после входа.");
          return;
        }

        result = await getMainSupabaseClient()
          .from("private_messages")
          .delete()
          .eq("id", id)
          .eq("sender_id", currentChatUser.id);
      } else {
        if (currentChatUser && isValidSupabaseUuid(currentChatUser.id)) {
          result = await getMainSupabaseClient()
            .from("messages")
            .delete()
            .eq("id", id)
            .eq("user_id", currentChatUser.id);
        } else {
          result = await getMainSupabaseClient()
            .from("messages")
            .delete()
            .eq("id", id)
            .eq("user_name", getCurrentChatName());
        }
      }

      if (result.error) {
        console.error("Ошибка удаления сообщения:", result.error);
        alert("Не получилось удалить сообщение. Проверь RLS delete.");
        return;
      }

      const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="${type}"]`);
      if (row) row.remove();

      hideMessageMenu();
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
