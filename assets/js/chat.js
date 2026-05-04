(function () {
  const VAPID_PUBLIC_KEY = "BBZPSipFkHsboxaQ7UmJvZ2TJqXQa5JE59HuwS1oq-3WWhwfBtjSfrFwKe6eJvE2NoqGCEXkInaGH4nElgWsXNM";

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

    let publicSubscription = null;
    let privateSubscription = null;
    let presenceChannel = null;

    let unreadPrivateCount = 0;
    let replyTarget = null;

    let lastRenderedDateKey = "";
    let lastRenderedMessageMeta = null;

    let contextMessageData = null;
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
    const sentLocalMessages = new Set();

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
      });
    }

    window.addEventListener("klevby-auth-changed", async (event) => {
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
    });

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

      if (!currentChatUser) return;

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

          if (profile.id && name) {
            userProfiles.set(String(profile.id), name);
          }
        });
      } catch (error) {
        console.warn("Профили не загружены:", error);
      }
    }

    function rememberFallbackProfile(userId, name) {
      const id = String(userId || "");
      const cleanName = cleanDisplayName(name);

      if (!id || !cleanName) return;

      if (!userProfiles.has(id)) {
        userProfiles.set(id, cleanName);
      }
    }

    function getProfileName(userId, fallback = "Рыбак") {
      const id = String(userId || "");

      if (id && userProfiles.has(id)) {
        return userProfiles.get(id) || cleanDisplayName(fallback) || "Рыбак";
      }

      return cleanDisplayName(fallback) || "Рыбак";
    }

    function getReadStorageKey(peerId) {
      const myId = currentChatUser?.id || "guest";
      return `klevby_private_read_${myId}_${peerId}`;
    }

    function getPeerReadTime(peerId) {
      return Number(localStorage.getItem(getReadStorageKey(peerId)) || "0");
    }

    function markPeerAsRead(peerId) {
      localStorage.setItem(getReadStorageKey(peerId), String(Date.now()));
    }

    function escapeHtml(text) {
      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(value);
      }

      return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

    function getInitials(name) {
      const clean = String(name || "Рыбак").trim();
      return (clean[0] || "Р").toUpperCase();
    }

    function getMessageTime(createdAt) {
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
      const time = new Date(createdAt || Date.now()).getTime();
      return Number.isFinite(time) ? time : Date.now();
    }

    function getDateKey(createdAt) {
      try {
        return new Date(createdAt || Date.now()).toISOString().slice(0, 10);
      } catch {
        return "";
      }
    }

    function getDateLabel(createdAt) {
      try {
        const date = new Date(createdAt);
        const today = new Date();
        const yesterday = new Date();

        yesterday.setDate(today.getDate() - 1);

        const dateKey = date.toISOString().slice(0, 10);
        const todayKey = today.toISOString().slice(0, 10);
        const yesterdayKey = yesterday.toISOString().slice(0, 10);

        if (dateKey === todayKey) return "Сегодня";
        if (dateKey === yesterdayKey) return "Вчера";

        return date.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "long",
          year: "numeric"
        });
      } catch {
        return "";
      }
    }

    function renderDateDivider(createdAt) {
      const key = getDateKey(createdAt);

      if (!key || key === lastRenderedDateKey) return;

      lastRenderedDateKey = key;
      lastRenderedMessageMeta = null;

      const divider = document.createElement("div");
      divider.className = "klevby-date-divider";
      divider.textContent = getDateLabel(createdAt);

      messagesContainer.appendChild(divider);
    }

    function resetRenderState() {
      lastRenderedDateKey = "";
      lastRenderedMessageMeta = null;
    }

    function clearMessages() {
      messagesContainer.innerHTML = "";
      resetRenderState();
      hideMessageMenu();
    }

    function scrollChatToBottom() {
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }

    function showEmptyState(text) {
      clearMessages();

      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          ${escapeHtml(text)}
        </div>
      `;
    }

    function parseReplyContent(content) {
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

    function getLocalMessageKey(message) {
      return `${message.user_name || ""}__${message.content || ""}`;
    }

    function isMyPublicMessage(message) {
      const myUserId = currentChatUser?.id || null;
      const messageUserId = message.user_id || null;

      if (myUserId && messageUserId && String(myUserId) === String(messageUserId)) {
        return true;
      }

      if (!messageUserId && cleanDisplayName(message.user_name) === getCurrentChatName()) {
        return true;
      }

      if (sentLocalMessages.has(getLocalMessageKey(message))) {
        return true;
      }

      return false;
    }

    function isMyPrivateMessage(message) {
      return currentChatUser?.id && String(message.sender_id) === String(currentChatUser.id);
    }

    function shouldGroupWithPrevious(meta) {
      if (!lastRenderedMessageMeta) return false;
      if (lastRenderedMessageMeta.type !== meta.type) return false;
      if (lastRenderedMessageMeta.authorKey !== meta.authorKey) return false;
      if (lastRenderedMessageMeta.isMine !== meta.isMine) return false;

      return Math.abs(meta.timeStamp - lastRenderedMessageMeta.timeStamp) <= 5 * 60 * 1000;
    }

    function updatePreviousGroupClass(groupedWithPrevious) {
      if (!groupedWithPrevious) return;

      const rows = messagesContainer.querySelectorAll(".chat-message-row");
      const previousRow = rows[rows.length - 1];

      if (previousRow) {
        previousRow.classList.add("grouped-with-next");
      }
    }

    function renderMessageActions(message, type, isMine) {
      const id = message.id ? escapeHtml(message.id) : "";

      return `
        <div class="klevby-message-actions">
          <button class="klevby-message-action reply-message-btn" type="button" data-type="${type}" data-id="${id}">↩</button>
          ${isMine && id ? `<button class="klevby-message-action delete-message-btn" type="button" data-type="${type}" data-id="${id}">🗑</button>` : ""}
        </div>
      `;
    }

    function buildMessageRow({ message, type, isMine, author, authorKey }) {
      renderDateDivider(message.created_at);

      const parsed = parseReplyContent(message.content || "");
      const time = getMessageTime(message.created_at);
      const timeStamp = getTimestamp(message.created_at);

      const meta = {
        type,
        authorKey,
        isMine,
        timeStamp
      };

      const groupedWithPrevious = shouldGroupWithPrevious(meta);
      updatePreviousGroupClass(groupedWithPrevious);

      const row = document.createElement("div");

      row.className = [
        "chat-message-row",
        isMine ? "my-message-row" : "other-message-row",
        groupedWithPrevious ? "grouped-with-prev" : "first-in-group"
      ].join(" ");

      row.dataset.messageId = message.id || "";
      row.dataset.messageType = type;
      row.dataset.author = author;
      row.dataset.content = parsed.mainText || "";
      row.dataset.isMine = isMine ? "1" : "0";

      const avatar = document.createElement("div");
      avatar.className = "klevby-message-avatar";
      avatar.textContent = getInitials(author);

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      bubble.innerHTML = `
        ${!groupedWithPrevious && !isMine ? `<span class="chat-message-author">${escapeHtml(author)}</span>` : ""}
        ${parsed.reply ? `<div class="klevby-message-reply">${escapeHtml(parsed.reply)}</div>` : ""}
        <span class="chat-message-text">${escapeHtml(parsed.mainText || "")}</span>
        <div class="klevby-message-footer">
          ${time ? `<span class="chat-message-time">${escapeHtml(time)}</span>` : ""}
          ${isMine ? `<span class="klevby-checks">✓✓</span>` : ""}
        </div>
        ${renderMessageActions(message, type, isMine)}
      `;

      if (!isMine) row.appendChild(avatar);
      row.appendChild(bubble);

      lastRenderedMessageMeta = meta;

      return row;
    }

    function renderPublicMessage(message) {
      if (message.user_id && message.user_name) {
        rememberFallbackProfile(message.user_id, message.user_name);
      }

      const isMine = isMyPublicMessage(message);
      const author = isMine ? "Вы" : getProfileName(message.user_id, message.user_name || "Рыбак");
      const authorKey = message.user_id || message.user_name || author;

      const row = buildMessageRow({
        message,
        type: "public",
        isMine,
        author,
        authorKey: String(authorKey)
      });

      messagesContainer.appendChild(row);
      scrollChatToBottom();
    }

    function renderPrivateMessage(message) {
      if (message.sender_id && message.sender_name) {
        rememberFallbackProfile(message.sender_id, message.sender_name);
      }

      const isMine = isMyPrivateMessage(message);
      const author = isMine ? "Вы" : getProfileName(message.sender_id, message.sender_name || selectedPeer?.name || "Рыбак");
      const authorKey = message.sender_id || author;

      const row = buildMessageRow({
        message,
        type: "private",
        isMine,
        author,
        authorKey: String(authorKey)
      });

      messagesContainer.appendChild(row);
      scrollChatToBottom();
    }

    function renderMessageList(data, renderFn) {
      clearMessages();

      (data || []).forEach((message) => {
        renderFn(message);
      });

      scrollChatToBottom();
    }

    function findMessageDataFromRow(row) {
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
      const data = findMessageDataFromRow(row);
      if (!data) return;

      contextMessageData = data;
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
      contextMessageData = null;
      messageContextMenu.classList.add("hidden");
      messageContextMenu.style.left = "";
      messageContextMenu.style.top = "";
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

    function isPushSupported() {
      return Boolean(
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
      );
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      return outputArray;
    }

    async function getReadyServiceWorkerRegistration() {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker не поддерживается.");
      }

      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (existing) {
          await existing.update().catch(() => {});
        }
      } catch (error) {}

      return await navigator.serviceWorker.ready;
    }

    async function savePushSubscriptionToSupabase(subscription) {
      await refreshCurrentUser();

      if (!currentChatUser) {
        throw new Error("Для уведомлений нужно войти в аккаунт.");
      }

      const json = subscription.toJSON();
      const keys = json.keys || {};

      if (!json.endpoint || !keys.p256dh || !keys.auth) {
        throw new Error("Браузер не выдал данные подписки.");
      }

      const payload = {
        user_id: currentChatUser.id,
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        subscription: json,
        user_agent: navigator.userAgent || "",
        updated_at: new Date().toISOString()
      };

      const { error } = await getMainSupabaseClient()
        .from("push_subscriptions")
        .upsert([payload], { onConflict: "endpoint" });

      if (error) {
        console.error("Ошибка сохранения push-подписки:", error);
        throw new Error("Не удалось сохранить подписку в Supabase.");
      }

      return payload;
    }

    async function refreshPushButtonState() {
      if (!pushBtn) return;

      if (!isPushSupported()) {
        pushBtn.classList.add("hidden");
        return;
      }

      pushBtn.classList.remove("hidden");
      pushBtn.classList.remove("enabled", "blocked");

      if (Notification.permission === "granted") {
        pushBtn.classList.add("enabled");
        pushBtn.textContent = "🔔";
        pushBtn.title = "Уведомления включены";
        pushBtn.setAttribute("aria-label", "Уведомления включены");
        return;
      }

      if (Notification.permission === "denied") {
        pushBtn.classList.add("blocked");
        pushBtn.textContent = "🔕";
        pushBtn.title = "Уведомления заблокированы в браузере";
        pushBtn.setAttribute("aria-label", "Уведомления заблокированы");
        return;
      }

      pushBtn.textContent = "🔔";
      pushBtn.title = "Включить уведомления";
      pushBtn.setAttribute("aria-label", "Включить уведомления");
    }

    async function saveExistingPushSubscriptionIfPossible() {
      if (!isPushSupported()) return;
      if (Notification.permission !== "granted") return;

      await refreshCurrentUser();

      if (!currentChatUser) return;

      try {
        const registration = await getReadyServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await savePushSubscriptionToSupabase(subscription);
        }

        await refreshPushButtonState();
      } catch (error) {
        console.warn("Не удалось обновить существующую push-подписку:", error);
      }
    }

    async function enablePushNotifications() {
      if (!isPushSupported()) {
        alert("Этот браузер не поддерживает push-уведомления.");
        return;
      }

      await refreshCurrentUser({ force: true });

      if (!currentChatUser) {
        alert("Сначала войди в аккаунт. Уведомления привязываются к твоему профилю.");
        return;
      }

      if (Notification.permission === "denied") {
        alert("Уведомления заблокированы в браузере. Нужно открыть настройки сайта и разрешить уведомления для klevby.com.");
        await refreshPushButtonState();
        return;
      }

      try {
        let permission = Notification.permission;

        if (permission !== "granted") {
          permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
          await refreshPushButtonState();
          alert("Уведомления не включены. Нужно нажать «Разрешить» в окне браузера.");
          return;
        }

        const registration = await getReadyServiceWorkerRegistration();

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }

        await savePushSubscriptionToSupabase(subscription);
        await refreshPushButtonState();

        alert("Уведомления включены. Теперь устройство сохранено для push-уведомлений.");
      } catch (error) {
        console.error("Ошибка включения push:", error);
        alert(error.message || "Не удалось включить уведомления.");
        await refreshPushButtonState();
      }
    }

    async function sendPushToUser(receiverUserId, senderName, messageText) {
      if (!receiverUserId) return;

      try {
        const shortText = String(messageText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);

        const body = {
          user_id: String(receiverUserId),
          title: "Klevby",
          message: `${cleanDisplayName(senderName) || "Новое сообщение"}: ${shortText || "Новое личное сообщение"}`,
          url: "https://klevby.com/"
        };

        const fnClient = getMainSupabaseClient();

        if (fnClient?.functions && typeof fnClient.functions.invoke === "function") {
          const { data, error } = await fnClient.functions.invoke("send-push", {
            body
          });

          if (error) {
            console.warn("Push через functions.invoke не отправлен:", error);
          } else {
            console.log("Klevby push отправлен:", data);
          }
        }
      } catch (error) {
        console.warn("Push уведомление не отправлено:", error);
      }
    }

    function setupPresence() {
      if (presenceChannel) {
        presenceChannel.track({
          user_id: currentChatUser?.id || null,
          name: getCurrentChatName(),
          online_at: new Date().toISOString()
        });

        return;
      }

      presenceChannel = getMainSupabaseClient().channel("klevby_presence", {
        config: {
          presence: {
            key: currentChatUser?.id || getGuestName()
          }
        }
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          onlineUsers.clear();

          const state = presenceChannel.presenceState();

          Object.values(state).forEach((items) => {
            (items || []).forEach((item) => {
              if (item.user_id) {
                onlineUsers.set(String(item.user_id), item);

                if (item.name) {
                  userProfiles.set(String(item.user_id), cleanDisplayName(item.name));
                }
              }
            });
          });

          updateSelectedPeerStatus();

          document.querySelectorAll(".klevby-private-dialog-item").forEach((button) => {
            const peerId = button.dataset.peerId;
            const dot = button.querySelector(".klevby-private-status");

            if (dot) {
              dot.classList.toggle("online", isOnline(peerId));
            }
          });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await refreshCurrentUser();
            await ensureCurrentUserProfile({ soft: true });

            presenceChannel.track({
              user_id: currentChatUser?.id || null,
              name: getCurrentChatName(),
              online_at: new Date().toISOString()
            });
          }
        });
    }

    async function loadPublicMessages(navToken = beginChatNavigation()) {
      activeMode = "public";
      selectedPeer = null;
      clearReply();

      chatWindow.classList.remove("klevby-dialog-screen");
      chatWindow.classList.remove("klevby-private-list-screen");

      publicTab.classList.add("active");
      privateTab.classList.remove("active");
      privatePeople.classList.add("hidden");
      backBtn.classList.add("hidden");

      chatAvatar.textContent = "🎣";
      chatTitle.textContent = "Чат рыбаков";
      chatSubtitle.textContent = "Общий разговор Klevby";
      input.placeholder = "Напиши сообщение...";
      input.disabled = false;
      sendBtn.disabled = false;

      syncSelectedPeerForCalls();
      clearMessages();

      let data = null;
      let error = null;

      try {
        const result = await getMainSupabaseClient()
          .from("messages")
          .select("*")
          .order("created_at", { ascending: true });

        if (isStaleNavigation(navToken)) return;

        data = result.data;
        error = result.error;
      } catch (queryError) {
        if (isStaleNavigation(navToken)) return;
        error = queryError;
      }

      if (isStaleNavigation(navToken)) return;

      if (error) {
        console.error("Ошибка загрузки общего чата:", error);
        showEmptyState("Не удалось загрузить общий чат. Проверь интернет и обнови приложение.");
        finishChatNavigation(navToken);
        return;
      }

      (data || []).forEach((message) => {
        if (message.user_id && message.user_name) {
          rememberFallbackProfile(message.user_id, message.user_name);
        }
      });

      await loadProfilesByIds((data || []).map((message) => message.user_id));

      if (isStaleNavigation(navToken)) return;

      if (!data || !data.length) {
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
        finishChatNavigation(navToken);
        return;
      }

      renderMessageList(data, renderPublicMessage);
      finishChatNavigation(navToken);
    }

    async function loadPrivatePeople(navToken = beginChatNavigation()) {
      await refreshCurrentUser();

      if (isStaleNavigation(navToken)) return;

      await ensureCurrentUserProfile({ soft: true });

      if (isStaleNavigation(navToken)) return;

      activeMode = "private";
      selectedPeer = null;
      clearReply();

      chatWindow.classList.remove("klevby-dialog-screen");
      chatWindow.classList.add("klevby-private-list-screen");

      publicTab.classList.remove("active");
      privateTab.classList.add("active");
      privatePeople.classList.add("hidden");
      backBtn.classList.add("hidden");

      chatAvatar.textContent = "✉";
      chatTitle.textContent = "Личные сообщения";
      chatSubtitle.textContent = currentChatUser ? "Выбери диалог" : "Для лички нужен вход";
      input.placeholder = "Выбери диалог...";
      input.disabled = true;
      sendBtn.disabled = true;

      syncSelectedPeerForCalls();
      clearMessages();

      if (!currentChatUser) {
        showEmptyState("Чтобы пользоваться личными сообщениями, войди или зарегистрируйся на сайте.");
        finishChatNavigation(navToken);
        return;
      }

      const myId = String(currentChatUser.id);
      const peersMap = new Map();

      function addPeer(id, name, message = null) {
        if (!id) return;

        const peerId = String(id);
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
        const { data: privateUsers, error: privateUsersError } = await getMainSupabaseClient()
          .from("private_messages")
          .select("sender_id,receiver_id,sender_name,content,created_at")
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order("created_at", { ascending: false });

        if (isStaleNavigation(navToken)) return;

        if (privateUsersError) {
          console.warn("Не удалось загрузить пользователей из лички:", privateUsersError);
        }

        (privateUsers || []).forEach((item) => {
          if (item.sender_id && item.sender_name) {
            rememberFallbackProfile(item.sender_id, item.sender_name);
          }
        });

        await loadProfilesByIds(
          (privateUsers || []).flatMap((item) => [item.sender_id, item.receiver_id])
        );

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
        const { data: publicUsers } = await getMainSupabaseClient()
          .from("messages")
          .select("user_id,user_name")
          .not("user_id", "is", null);

        if (isStaleNavigation(navToken)) return;

        (publicUsers || []).forEach((item) => {
          rememberFallbackProfile(item.user_id, item.user_name || "Рыбак");
        });

        await loadProfilesByIds((publicUsers || []).map((item) => item.user_id));

        if (isStaleNavigation(navToken)) return;

        (publicUsers || []).forEach((item) => {
          addPeer(item.user_id, getProfileName(item.user_id, item.user_name || "Рыбак"), null);
        });
      } catch (error) {
        if (isStaleNavigation(navToken)) return;
        console.warn("Не удалось загрузить пользователей из общего чата:", error);
      }

      try {
        const { data: postUsers } = await getMainSupabaseClient()
          .from("posts")
          .select("owner_id,name")
          .not("owner_id", "is", null);

        if (isStaleNavigation(navToken)) return;

        (postUsers || []).forEach((item) => {
          rememberFallbackProfile(item.owner_id, item.name || "Рыбак");
        });

        await loadProfilesByIds((postUsers || []).map((item) => item.owner_id));

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

      unreadPrivateCount = peers.reduce((sum, peer) => sum + peer.unreadCount, 0);
      updateUnreadBadge();

      if (!peers.length) {
        showEmptyState("Пока нет собеседников. Пользователь должен быть автором объявления или написать в общий чат.");
        finishChatNavigation(navToken);
        return;
      }

      const list = document.createElement("div");
      list.className = "klevby-private-dialog-list";

      list.innerHTML = peers.map(peer => {
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
      messagesContainer.appendChild(list);
      finishChatNavigation(navToken);
    }

    async function openPrivateDialog(peerId, peerName, navToken = beginChatNavigation()) {
      await refreshCurrentUser();

      if (isStaleNavigation(navToken)) return;

      await ensureCurrentUserProfile({ soft: true });

      if (isStaleNavigation(navToken)) return;

      if (!currentChatUser) {
        showEmptyState("Для личных сообщений нужно войти.");
        finishChatNavigation(navToken);
        return;
      }

      await loadProfilesByIds([peerId]);

      if (isStaleNavigation(navToken)) return;

      selectedPeer = {
        id: String(peerId),
        name: getProfileName(peerId, peerName || "Рыбак")
      };

      activeMode = "private";

      chatWindow.classList.add("klevby-dialog-screen");
      chatWindow.classList.remove("klevby-private-list-screen");

      clearReply();

      chatAvatar.textContent = getInitials(selectedPeer.name);
      chatTitle.textContent = selectedPeer.name;
      chatSubtitle.textContent = getUserStatusText(selectedPeer.id);
      input.placeholder = "Напиши личное сообщение...";
      input.disabled = false;
      sendBtn.disabled = false;

      backBtn.classList.remove("hidden");

      syncSelectedPeerForCalls();
      markPeerAsRead(peerId);

      clearMessages();

      const { data, error } = await getMainSupabaseClient()
        .from("private_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentChatUser.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentChatUser.id})`)
        .order("created_at", { ascending: true });

      if (isStaleNavigation(navToken)) return;

      if (error) {
        console.error("Ошибка загрузки лички:", error);
        showEmptyState("Не удалось загрузить личку. Проверь private_messages и RLS.");
        finishChatNavigation(navToken);
        return;
      }

      (data || []).forEach((message) => {
        if (message.sender_id && message.sender_name) {
          rememberFallbackProfile(message.sender_id, message.sender_name);
        }
      });

      await loadProfilesByIds(
        (data || []).flatMap((message) => [message.sender_id, message.receiver_id])
      );

      if (isStaleNavigation(navToken)) return;

      selectedPeer.name = getProfileName(peerId, selectedPeer.name);
      chatAvatar.textContent = getInitials(selectedPeer.name);
      chatTitle.textContent = selectedPeer.name;

      syncSelectedPeerForCalls();

      unreadPrivateCount = Math.max(0, unreadPrivateCount - 1);
      updateUnreadBadge();

      if (!data || !data.length) {
        showEmptyState("Личных сообщений пока нет. Напиши первым.");
        finishChatNavigation(navToken);
        return;
      }

      renderMessageList(data, renderPrivateMessage);
      finishChatNavigation(navToken);
    }

    async function sendPublicMessage() {
      const rawVal = input.value.trim();
      if (!rawVal) return;

      await refreshCurrentUser();
      await ensureCurrentUserProfile({ soft: true });

      sendBtn.disabled = true;

      const userId = currentChatUser?.id || null;
      const userName = getCurrentChatName();
      const content = buildMessageContent(rawVal);

      const payload = {
        user_name: userName,
        content
      };

      if (userId) {
        payload.user_id = userId;
      }

      sentLocalMessages.add(`${userName}__${content}`);

      const { error } = await getMainSupabaseClient().from("messages").insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error("Ошибка отправки общего сообщения:", error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return;
      }

      input.value = "";
      clearReply();

      setTimeout(() => {
        sentLocalMessages.delete(`${userName}__${content}`);
      }, 30000);
    }

    async function sendPrivateMessage() {
      const rawVal = input.value.trim();
      if (!rawVal) return;

      await refreshCurrentUser();
      await ensureCurrentUserProfile({ soft: true });

      if (!currentChatUser) {
        alert("Для личных сообщений нужно войти.");
        return;
      }

      if (!selectedPeer) {
        alert("Сначала выбери собеседника.");
        return;
      }

      sendBtn.disabled = true;

      const senderName = getCurrentChatName();
      const messageContent = buildMessageContent(rawVal);

      const payload = {
        sender_id: currentChatUser.id,
        receiver_id: selectedPeer.id,
        sender_name: senderName,
        content: messageContent
      };

      const { error } = await getMainSupabaseClient().from("private_messages").insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error("Ошибка отправки личного сообщения:", error);
        alert("Не получилось отправить личное сообщение. Проверь private_messages и RLS.");
        return;
      }

      await sendPushToUser(selectedPeer.id, senderName, rawVal);

      input.value = "";
      clearReply();
      markPeerAsRead(selectedPeer.id);
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
        if (!currentChatUser) {
          alert("Удалять личные сообщения можно только после входа.");
          return;
        }

        result = await getMainSupabaseClient()
          .from("private_messages")
          .delete()
          .eq("id", id)
          .eq("sender_id", currentChatUser.id);
      } else {
        if (currentChatUser) {
          result = await getMainSupabaseClient()
            .from("messages")
            .delete()
            .eq("id", id)
            .eq("user_id", currentChatUser.id);
        } else {
          result = await getMainSupabaseClient()
            .from("messages")
            .delete()
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

    async function cleanupRealtimeConnections() {
      const channels = [
        publicSubscription,
        privateSubscription,
        presenceChannel
      ].filter(Boolean);

      publicSubscription = null;
      privateSubscription = null;
      presenceChannel = null;
      onlineUsers.clear();

      await Promise.all(
        channels.map(async (channel) => {
          try {
            await getMainSupabaseClient().removeChannel(channel);
          } catch (error) {
            console.warn("Не удалось удалить старый realtime channel:", error);
          }
        })
      );
    }

    async function reconnectRealtimeConnections() {
      await cleanupRealtimeConnections();
      setupPresence();
      setupRealtime();
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

        if (savedMode === "private" && savedPeer) {
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

    function setupRealtime() {
      if (publicSubscription || privateSubscription) return;

      publicSubscription = getMainSupabaseClient()
        .channel("klevby_public_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            if (activeMode !== "public") return;

            const emptyState = messagesContainer.querySelector(".chat-empty-state");
            if (emptyState) clearMessages();

            await refreshCurrentUser();

            if (payload.new?.user_id && payload.new?.user_name) {
              rememberFallbackProfile(payload.new.user_id, payload.new.user_name);
            }

            await loadProfilesByIds([payload.new?.user_id]);
            renderPublicMessage(payload.new);
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages" },
          (payload) => {
            const id = payload.old?.id;
            if (!id) return;

            const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="public"]`);
            if (row) row.remove();
          }
        )
        .subscribe();

      privateSubscription = getMainSupabaseClient()
        .channel("klevby_private_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "private_messages" },
          async (payload) => {
            await refreshCurrentUser();

            const msg = payload.new;
            const myId = String(currentChatUser?.id || "");

            if (!myId) return;

            if (msg.sender_id && msg.sender_name) {
              rememberFallbackProfile(msg.sender_id, msg.sender_name);
            }

            await loadProfilesByIds([msg.sender_id, msg.receiver_id]);

            const isForMe = String(msg.receiver_id) === myId;
            const senderId = String(msg.sender_id || "");

            if (isForMe) {
              const alreadyInThisDialog =
                activeMode === "private" &&
                selectedPeer &&
                String(selectedPeer.id) === senderId;

              if (!alreadyInThisDialog) {
                unreadPrivateCount += 1;
                updateUnreadBadge();
              }

              if (activeMode === "private" && !selectedPeer) {
                await loadPrivatePeople();
                return;
              }
            }

            if (!currentChatUser || activeMode !== "private" || !selectedPeer) return;

            const peerId = String(selectedPeer.id);

            const belongsToDialog =
              (String(msg.sender_id) === myId && String(msg.receiver_id) === peerId) ||
              (String(msg.sender_id) === peerId && String(msg.receiver_id) === myId);

            if (!belongsToDialog) return;

            markPeerAsRead(peerId);

            const emptyState = messagesContainer.querySelector(".chat-empty-state");
            if (emptyState) clearMessages();

            renderPrivateMessage(msg);
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "private_messages" },
          (payload) => {
            const id = payload.old?.id;
            if (!id) return;

            const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="private"]`);
            if (row) row.remove();
          }
        )
        .subscribe();
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
        if (contextMessageData) {
          setReplyTarget(contextMessageData);
        }
        return;
      }

      if (event.target.closest("#contextDeleteBtn")) {
        if (contextMessageData) {
          await deleteMessage(contextMessageData.type, contextMessageData.id);
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

  function setupViewportFix() {
    if (window.__klevbyViewportFixReady) return;

    window.__klevbyViewportFixReady = true;

    updateViewportVars();

    window.addEventListener(
      "resize",
      () => {
        updateViewportVars();

        const modal = document.getElementById("klevby-chat-modal");
        const messages = document.getElementById("chat-messages");

        if (modal && modal.classList.contains("open") && messages) {
          requestAnimationFrame(() => {
            messages.scrollTop = messages.scrollHeight;
          });
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(updateViewportVars, 250);
      },
      { passive: true }
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        () => {
          updateViewportVars();

          const modal = document.getElementById("klevby-chat-modal");
          const messages = document.getElementById("chat-messages");

          if (modal && modal.classList.contains("open") && messages) {
            requestAnimationFrame(() => {
              messages.scrollTop = messages.scrollHeight;
            });
          }
        },
        { passive: true }
      );

      window.visualViewport.addEventListener(
        "scroll",
        () => {
          updateViewportVars();
        },
        { passive: true }
      );
    }
  }

  function updateViewportVars() {
    const vv = window.visualViewport;

    let height = vv ? vv.height : window.innerHeight;
    let width = vv ? vv.width : window.innerWidth;
    let offsetTop = vv ? vv.offsetTop : 0;
    let offsetLeft = vv ? vv.offsetLeft : 0;

    const lastGoodHeight = Number(document.documentElement.dataset.klevbyGoodHeight || "0");
    const lastGoodWidth = Number(document.documentElement.dataset.klevbyGoodWidth || "0");

    if (!Number.isFinite(height) || height < 420) {
      height = lastGoodHeight || window.innerHeight || screen.height || 720;
    }

    if (!Number.isFinite(width) || width < 280) {
      width = lastGoodWidth || window.innerWidth || screen.width || 390;
    }

    if (!Number.isFinite(height) || height < 420) {
      height = 720;
    }

    if (!Number.isFinite(width) || width < 280) {
      width = 390;
    }

    if (!Number.isFinite(offsetTop) || offsetTop < 0) {
      offsetTop = 0;
    }

    if (!Number.isFinite(offsetLeft) || offsetLeft < 0) {
      offsetLeft = 0;
    }

    document.documentElement.dataset.klevbyGoodHeight = String(height);
    document.documentElement.dataset.klevbyGoodWidth = String(width);

    document.documentElement.style.setProperty("--klevby-vvh", `${height}px`);
    document.documentElement.style.setProperty("--klevby-vvw", `${width}px`);
    document.documentElement.style.setProperty("--klevby-vtop", `${offsetTop}px`);
    document.documentElement.style.setProperty("--klevby-vleft", `${offsetLeft}px`);
  }

  function lockChatPage() {
    document.documentElement.classList.add("klevby-chat-lock");
    document.body.classList.add("klevby-chat-lock");
  }

  function unlockChatPage() {
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
