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

    let unreadPrivateCount = 0;
    let replyTarget = null;
    let contextMessageDataFallback = null;
    let longPressTimer = null;

    let klevbyResumeTimer = null;
    let klevbyResumeInProgress = false;
    let klevbyLastResumeAt = 0;

    let chatNavigationToken = 0;
    let chatLoading = false;

    let userRefreshPromise = null;
    let lastUserRefreshAt = 0;
    let profileSavePromise = null;
    let lastProfileSaveAt = 0;

    const CHAT_AUTH_REFRESH_THROTTLE_MS = 3000;
    const PROFILE_SAVE_THROTTLE_MS = 7000;

    const onlineUsers = new Map();
    const userProfiles = new Map();
    const guestNameKey = "klevby_chat_guest_name";

    const chatHTML = `
      <div id="chat-desktop-btn" class="klevby-chat-launcher" title="Открыть чат">💬</div>

      <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window" class="klevby-chat-window">
          <div id="chat-header" class="klevby-chat-header">
            <button id="back-chat" class="klevby-chat-back hidden" type="button" aria-label="Назад">‹</button>

            <div class="klevby-chat-head-main">
              <div class="klevby-chat-avatar" id="chatAvatar">🎣</div>
              <div class="klevby-chat-title-wrap">
                <div class="klevby-chat-title" id="chatTitle">Чат рыбаков</div>
                <div class="klevby-chat-subtitle" id="chatSubtitle">Общий разговор Klevby</div>
              </div>
            </div>

            <button id="klevby-push-btn" class="klevby-push-btn" type="button" aria-label="Включить уведомления" title="Включить уведомления">🔔</button>
            <button id="close-chat" class="klevby-chat-close" type="button" aria-label="Закрыть">×</button>
          </div>

          <div class="klevby-chat-tabs" role="tablist">
            <button id="publicChatTab" class="klevby-chat-tab active" type="button">Общий чат</button>
            <button id="privateChatTab" class="klevby-chat-tab" type="button">
              Личка <span id="privateUnreadBadge" class="klevby-unread-badge hidden">0</span>
            </button>
          </div>

          <div id="privateChatPeople" class="klevby-private-people hidden"></div>

          <div id="chat-messages" class="klevby-chat-messages"></div>

          <div id="messageContextMenu" class="klevby-message-menu hidden">
            <button id="contextReplyBtn" type="button">Ответить</button>
            <button id="contextDeleteBtn" type="button">Удалить</button>
          </div>

          <div id="replyPreview" class="klevby-reply-preview hidden">
            <div class="klevby-reply-line"></div>
            <div class="klevby-reply-body">
              <div class="klevby-reply-author" id="replyAuthor"></div>
              <div class="klevby-reply-text" id="replyText"></div>
            </div>
            <button id="cancelReply" class="klevby-reply-cancel" type="button">×</button>
          </div>

          <div id="chat-input-area" class="klevby-chat-inputbar">
            <input
              type="text"
              id="message-input"
              class="klevby-chat-input"
              placeholder="Напиши сообщение..."
              autocomplete="off"
            />
            <button id="send-btn" class="klevby-chat-send" type="button">➤</button>
          </div>
        </div>
      </div>
    `;

    const oldModal = document.getElementById("klevby-chat-modal");
    const oldLauncher = document.getElementById("chat-desktop-btn");

    if (oldModal) oldModal.remove();
    if (oldLauncher) oldLauncher.remove();

    document.body.insertAdjacentHTML("beforeend", chatHTML);

    const modal = document.getElementById("klevby-chat-modal");
    const chatWindow = document.getElementById("chat-window");
    const messagesContainer = document.getElementById("chat-messages");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");

    const publicTab = document.getElementById("publicChatTab");
    const privateTab = document.getElementById("privateChatTab");
    const privatePeople = document.getElementById("privateChatPeople");
    const privateUnreadBadge = document.getElementById("privateUnreadBadge");

    const chatTitle = document.getElementById("chatTitle");
    const chatSubtitle = document.getElementById("chatSubtitle");
    const chatAvatar = document.getElementById("chatAvatar");

    const backBtn = document.getElementById("back-chat");
    const pushBtn = document.getElementById("klevby-push-btn");
    const replyPreview = document.getElementById("replyPreview");
    const replyAuthor = document.getElementById("replyAuthor");
    const replyText = document.getElementById("replyText");

    const messageContextMenu = document.getElementById("messageContextMenu");
    const contextReplyBtn = document.getElementById("contextReplyBtn");
    const contextDeleteBtn = document.getElementById("contextDeleteBtn");

    initChatRenderBridge();
    initChatPushBridge();
    initChatPublicBridge();
    initChatPrivateBridge();
    initChatRealtimeBridge();

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
        getUnreadPrivateCount: () => unreadPrivateCount,
        setActiveMode: (mode) => {
          activeMode = mode;
        },
        setSelectedPeer: (peer) => {
          selectedPeer = peer;
        },
        setUnreadPrivateCount: (value) => {
          unreadPrivateCount = Math.max(0, Number(value) || 0);
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

    function beginChatNavigation() {
      chatNavigationToken += 1;
      setChatTabsLoading(true);
      return chatNavigationToken;
    }

    function isStaleNavigation(token) {
      return token !== chatNavigationToken;
    }

    function finishChatNavigation(token) {
      if (!isStaleNavigation(token)) {
        setChatTabsLoading(false);
      }
    }

    function setChatTabsLoading(isLoading) {
      chatLoading = Boolean(isLoading);

      if (publicTab) {
        publicTab.disabled = chatLoading;
        publicTab.classList.toggle("loading", chatLoading);
      }

      if (privateTab) {
        privateTab.disabled = chatLoading;
        privateTab.classList.toggle("loading", chatLoading);
      }

      if (backBtn) {
        backBtn.disabled = chatLoading;
        backBtn.classList.toggle("loading", chatLoading);
      }

      if (chatWindow) {
        chatWindow.classList.toggle("klevby-chat-loading", chatLoading);
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
      if (!currentChatUser || !currentChatUser.id) return;

      window.klevbyCurrentUser = currentChatUser;
      window.currentUser = currentChatUser;
      window.klevbyUser = currentChatUser;
    }

    function isAuthLockError(error) {
      const message = String(error?.message || error || "").toLowerCase();
      return message.includes("lock") && message.includes("auth-token");
    }

    function isValidSupabaseUuid(value) {
      const id = String(value || "").trim();

      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    }

    function getValidProfileIds(ids = []) {
      return [...new Set(
        (ids || [])
          .map((id) => String(id || "").trim())
          .filter((id) => isValidSupabaseUuid(id))
      )];
    }

    function getGuestName() {
      let name = localStorage.getItem(guestNameKey);

      if (!name) {
        name = "Рыбак-" + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem(guestNameKey, name);
      }

      return name;
    }

    function cleanDisplayName(value) {
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
      const force = Boolean(options.force);
      const now = Date.now();
      const mainUser = getUserFromMainSite();

      if (mainUser && mainUser.id) {
        currentChatUser = mainUser;
        lastUserRefreshAt = now;
        return currentChatUser;
      }

      if (!force && currentChatUser && currentChatUser.id && now - lastUserRefreshAt < CHAT_AUTH_REFRESH_THROTTLE_MS) {
        return currentChatUser;
      }

      if (!force && userRefreshPromise) {
        return userRefreshPromise;
      }

      const mainClient = getMainSupabaseClient();

      if (!mainClient?.auth?.getUser) {
        currentChatUser = getUserFromMainSite() || currentChatUser || null;
        return currentChatUser;
      }

      lastUserRefreshAt = now;

      userRefreshPromise = (async () => {
        try {
          const { data, error } = await mainClient.auth.getUser();

          if (error) {
            if (!isAuthLockError(error)) {
              console.warn("Не удалось получить пользователя из основного клиента:", error);
            }

            currentChatUser = getUserFromMainSite() || currentChatUser || null;
            return currentChatUser;
          }

          if (data?.user) {
            currentChatUser = data.user;
            syncGlobalChatUser();
            return currentChatUser;
          }
        } catch (error) {
          if (!isAuthLockError(error)) {
            console.warn("Не удалось получить пользователя из основного клиента:", error);
          }
        } finally {
          userRefreshPromise = null;
        }

        currentChatUser = getUserFromMainSite() || currentChatUser || null;
        return currentChatUser;
      })();

      return userRefreshPromise;
    }

    function getCurrentChatName() {
      const nickname = getMetadataName(currentChatUser);

      if (nickname) {
        return nickname;
      }

      const savedName =
        cleanDisplayName(localStorage.getItem("klevby_chat_username")) ||
        cleanDisplayName(localStorage.getItem("klevby_author_name"));

      if (savedName) {
        return savedName;
      }

      if (currentChatUser?.email) {
        return cleanDisplayName(currentChatUser.email);
      }

      return getGuestName();
    }

    async function ensureCurrentUserProfile(options = {}) {
      const force = Boolean(options.force);
      const soft = options.soft !== false;
      const now = Date.now();

      await refreshCurrentUser({ force: false });

      if (!currentChatUser || !isValidSupabaseUuid(currentChatUser.id)) return;

      const nickname = getCurrentChatName();

      if (currentChatUser.id && nickname) {
        userProfiles.set(String(currentChatUser.id), nickname);
      }

      if (!force && now - lastProfileSaveAt < PROFILE_SAVE_THROTTLE_MS) {
        return;
      }

      if (!force && profileSavePromise) {
        return profileSavePromise;
      }

      const client = getMainSupabaseClient();
      if (!client?.from) return;

      lastProfileSaveAt = now;

      profileSavePromise = (async () => {
        try {
          const { error } = await client.from("profiles").upsert(
            [
              {
                id: currentChatUser.id,
                nickname: nickname,
                username: nickname,
                display_name: nickname,
                email: currentChatUser.email || "",
                updated_at: new Date().toISOString()
              }
            ],
            { onConflict: "id" }
          );

          if (error) {
            if (!soft) throw error;
            console.warn("Профиль пользователя не сохранён:", error);
          }
        } catch (error) {
          if (!soft) throw error;
          console.warn("Профиль пользователя не сохранён:", error);
        } finally {
          profileSavePromise = null;
        }
      })();

      return profileSavePromise;
    }

    async function loadProfilesByIds(ids = []) {
      const uniqueIds = getValidProfileIds(ids);

      if (!uniqueIds.length) return;

      try {
        const { data, error } = await getMainSupabaseClient()
          .from("profiles")
          .select("id,nickname,username,display_name,email")
          .in("id", uniqueIds);

        if (error) {
          console.warn("Профили не загружены:", error);
          return;
        }

        (data || []).forEach((profile) => {
          const name = cleanDisplayName(
            profile.nickname ||
            profile.username ||
            profile.display_name ||
            profile.email ||
            ""
          );

          if (profile.id && name && isValidSupabaseUuid(profile.id)) {
            userProfiles.set(String(profile.id), name);
          }
        });
      } catch (error) {
        console.warn("Профили не загружены:", error);
      }
    }

    function rememberFallbackProfile(userId, name) {
      const id = String(userId || "").trim();
      const cleanName = cleanDisplayName(name);

      if (!id || !cleanName) return;
      if (!isValidSupabaseUuid(id)) return;

      if (!userProfiles.has(id)) {
        userProfiles.set(id, cleanName);
      }
    }

    function getProfileName(userId, fallback = "Рыбак") {
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
      const api = getChatRenderApi();

      if (api && typeof api.showMessageMenu === "function") {
        api.showMessageMenu(row);
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
      const api = getChatRenderApi();

      if (api && typeof api.hideMessageMenu === "function") {
        api.hideMessageMenu();
        return;
      }

      contextMessageDataFallback = null;
      messageContextMenu.classList.add("hidden");
      messageContextMenu.style.left = "";
      messageContextMenu.style.top = "";
    }

    function getContextMessageData() {
      const api = getChatRenderApi();

      if (api && typeof api.getContextMessageData === "function") {
        return api.getContextMessageData();
      }

      return contextMessageDataFallback;
    }

    function clearReply() {
      replyTarget = null;
      replyPreview.classList.add("hidden");
      replyAuthor.textContent = "";
      replyText.textContent = "";
    }

    function setReplyTarget(messageData) {
      replyTarget = {
        author: messageData.isMine ? "Вы" : messageData.author,
        text: messageData.content || ""
      };

      replyAuthor.textContent = "Ответ: " + replyTarget.author;
      replyText.textContent = replyTarget.text;

      replyPreview.classList.remove("hidden");
      hideMessageMenu();

      requestAnimationFrame(() => {
        input.focus();
      });
    }

    function buildMessageContent(value) {
      if (!replyTarget) return value;

      const quoted = String(replyTarget.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      return `↩ Ответ ${replyTarget.author}: ${quoted}\n${value}`;
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

    function incrementUnreadPrivateCount(amount = 1) {
      unreadPrivateCount += Number(amount) || 1;
      updateUnreadBadge();
    }

    function updateUnreadBadge() {
      if (!privateUnreadBadge) return;

      if (unreadPrivateCount <= 0) {
        privateUnreadBadge.classList.add("hidden");
        privateUnreadBadge.textContent = "0";
        return;
      }

      privateUnreadBadge.classList.remove("hidden");
      privateUnreadBadge.textContent = String(Math.min(unreadPrivateCount, 99));
    }

    async function send() {
      if (activeMode === "private") {
        await sendPrivateMessage();
      } else {
        await sendPublicMessage();
      }
    }

    async function deleteMessage(type, id) {
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
      const now = Date.now();

      if (klevbyResumeInProgress) return;
      if (now - klevbyLastResumeAt < 2500) return;

      klevbyResumeInProgress = true;
      klevbyLastResumeAt = now;

      try {
        updateViewportVars();

        await refreshCurrentUser();
        await ensureCurrentUserProfile({ soft: true });
        await reconnectRealtimeConnections();
        await saveExistingPushSubscriptionIfPossible();

        const isChatOpen = modal && modal.classList.contains("open");

        if (!isChatOpen) {
          return;
        }

        const savedMode = activeMode;
        const savedPeer = selectedPeer ? { ...selectedPeer } : null;

        if (savedMode === "private" && savedPeer && isValidSupabaseUuid(savedPeer.id)) {
          await openPrivateDialog(savedPeer.id, savedPeer.name);
        } else if (savedMode === "private") {
          await loadPrivatePeople();
        } else {
          await loadPublicMessages();
        }

        syncSelectedPeerForCalls();

        setTimeout(() => {
          updateViewportVars();
          scrollChatToBottom();
        }, 150);
      } catch (error) {
        console.warn("Не удалось восстановить чат после возврата в приложение:", reason, error);
        setChatTabsLoading(false);
      } finally {
        klevbyResumeInProgress = false;
      }
    }

    function scheduleChatResume(reason = "resume") {
      clearTimeout(klevbyResumeTimer);

      klevbyResumeTimer = setTimeout(() => {
        reloadChatAfterResume(reason);
      }, 700);
    }

    async function openChat() {
      try {
        updateViewportVars();
        lockChatPage();

        modal.classList.remove("hidden");
        modal.classList.add("open");

        await refreshCurrentUser();
        await ensureCurrentUserProfile({ soft: true });
        await reconnectRealtimeConnections();
        await loadPublicMessages();
        await refreshPushButtonState();
        await saveExistingPushSubscriptionIfPossible();

        syncSelectedPeerForCalls();

        setTimeout(() => {
          updateViewportVars();
          scrollChatToBottom();
        }, 150);
      } catch (error) {
        console.error("Klevby chat: ошибка открытия чата:", error);
        setChatTabsLoading(false);
        showEmptyState("Не удалось открыть чат. Обнови страницу или проверь Console.");
      }
    }

    function closeChat() {
      chatNavigationToken += 1;
      setChatTabsLoading(false);

      modal.classList.remove("open");
      modal.classList.add("hidden");

      selectedPeer = null;
      activeMode = "public";

      syncSelectedPeerForCalls();
      clearReply();
      hideMessageMenu();
      unlockChatPage();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleChatResume("visibilitychange");
      }
    });

    window.addEventListener("pageshow", () => {
      scheduleChatResume("pageshow");
    });

    window.addEventListener("focus", () => {
      scheduleChatResume("focus");
    });

    window.addEventListener("online", () => {
      scheduleChatResume("online");
    });

    document.addEventListener("click", async (event) => {
      try {
        if (event.target.closest("#nav-chat") || event.target.closest("#chat-desktop-btn")) {
          event.preventDefault();
          event.stopPropagation();
          await openChat();
          return;
        }

        if (event.target.closest("#klevby-push-btn")) {
          event.preventDefault();
          event.stopPropagation();
          await enablePushNotifications();
          return;
        }

        if (event.target.id === "close-chat" || event.target.closest("#close-chat")) {
          event.preventDefault();
          event.stopPropagation();
          closeChat();
          return;
        }

        if (event.target.id === "klevby-chat-modal") {
          closeChat();
          return;
        }

        if (
          chatLoading &&
          event.target.closest("#publicChatTab, #privateChatTab, #back-chat, .klevby-private-dialog-item")
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (event.target.closest("#publicChatTab")) {
          await loadPublicMessages();
          return;
        }

        if (event.target.closest("#privateChatTab")) {
          await loadPrivatePeople();
          return;
        }

        if (event.target.closest("#back-chat")) {
          await loadPrivatePeople();
          return;
        }

        if (event.target.closest("#cancelReply")) {
          clearReply();
          return;
        }

        if (event.target.closest("#contextReplyBtn")) {
          const data = getContextMessageData();

          if (data) {
            setReplyTarget(data);
          }

          return;
        }

        if (event.target.closest("#contextDeleteBtn")) {
          const data = getContextMessageData();

          if (data) {
            await deleteMessage(data.type, data.id);
          }

          return;
        }

        const dialogButton = event.target.closest(".klevby-private-dialog-item");

        if (dialogButton) {
          await openPrivateDialog(dialogButton.dataset.peerId, dialogButton.dataset.peerName);
          return;
        }

        const replyButton = event.target.closest(".reply-message-btn");

        if (replyButton) {
          const row = replyButton.closest(".chat-message-row");
          const data = findMessageDataFromRow(row);

          if (data) {
            setReplyTarget(data);
          }

          return;
        }

        const deleteButton = event.target.closest(".delete-message-btn");

        if (deleteButton) {
          await deleteMessage(deleteButton.dataset.type, deleteButton.dataset.id);
          return;
        }

        if (!event.target.closest(".klevby-message-menu") && !event.target.closest(".chat-message-row")) {
          hideMessageMenu();
        }
      } catch (error) {
        console.error("Klevby chat: ошибка клика:", error);
        setChatTabsLoading(false);
      }
    });

    messagesContainer.addEventListener("pointerdown", (event) => {
      const row = event.target.closest(".chat-message-row");
      if (!row) return;

      clearTimeout(longPressTimer);

      longPressTimer = setTimeout(() => {
        showMessageMenu(row);
      }, 520);
    });

    messagesContainer.addEventListener("pointerup", () => {
      clearTimeout(longPressTimer);
    });

    messagesContainer.addEventListener("pointermove", () => {
      clearTimeout(longPressTimer);
    });

    messagesContainer.addEventListener("contextmenu", (event) => {
      const row = event.target.closest(".chat-message-row");
      if (!row) return;

      event.preventDefault();
      showMessageMenu(row);
    });

    sendBtn.addEventListener("click", send);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });

    input.addEventListener("focus", () => {
      updateViewportVars();

      setTimeout(() => {
        updateViewportVars();
        scrollChatToBottom();
      }, 120);

      setTimeout(() => {
        updateViewportVars();
        scrollChatToBottom();
      }, 350);
    });

    input.addEventListener("blur", () => {
      setTimeout(updateViewportVars, 150);
    });
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
