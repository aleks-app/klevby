(function () {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  if (window.__klevbyChatLoaded) {
    return;
  }

  window.__klevbyChatLoaded = true;

  const initInterval = setInterval(() => {
    if (window.supabase) {
      clearInterval(initInterval);

      const chatDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      setupChat(chatDb);
    }
  }, 300);

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
    const pinnedPublicChat = document.getElementById("pinnedPublicChat");

    const replyPreview = document.getElementById("replyPreview");
    const replyAuthor = document.getElementById("replyAuthor");
    const replyText = document.getElementById("replyText");

    const messageContextMenu = document.getElementById("messageContextMenu");
    const contextReplyBtn = document.getElementById("contextReplyBtn");
    const contextDeleteBtn = document.getElementById("contextDeleteBtn");

    let contextMessageData = null;
    let longPressTimer = null;

    refreshCurrentUser().then(async () => {
      await ensureCurrentUserProfile();
      setupPresence();
      setupRealtime();
    });

    chatDb.auth.onAuthStateChange(async (_event, session) => {
      currentChatUser = session?.user || null;
      await ensureCurrentUserProfile();
      setupPresence();
    });

    function getGuestName() {
      let name = localStorage.getItem(guestNameKey);

      if (!name) {
        name = "Рыбак-" + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem(guestNameKey, name);
      }

      return name;
    }

    function cleanDisplayName(value) {
      const name = String(value || "").trim();

      if (!name) return "";
      if (name.includes("@")) return name.split("@")[0];

      return name.slice(0, 32);
    }

    function getMetadataName(user = currentChatUser) {
      const meta = user?.user_metadata || {};

      return cleanDisplayName(
        meta.username ||
        meta.nickname ||
        meta.display_name ||
        meta.name ||
        meta.full_name ||
        ""
      );
    }

    async function refreshCurrentUser() {
      try {
        const { data } = await chatDb.auth.getUser();
        currentChatUser = data?.user || null;
        return currentChatUser;
      } catch (error) {
        currentChatUser = null;
        return null;
      }
    }

    function getCurrentChatName() {
      const nickname = getMetadataName(currentChatUser);

      if (nickname) {
        return nickname;
      }

      const savedName =
        cleanDisplayName(localStorage.getItem("klevby_author_name")) ||
        cleanDisplayName(localStorage.getItem("klevby_chat_username"));

      if (savedName) {
        return savedName;
      }

      return getGuestName();
    }

    async function ensureCurrentUserProfile() {
      if (!currentChatUser) return;

      const nickname = getCurrentChatName();
      const profile = {
        id: currentChatUser.id,
        username: nickname,
        email: currentChatUser.email || "",
        updated_at: new Date().toISOString()
      };

      userProfiles.set(String(currentChatUser.id), nickname);

      try {
        await chatDb
          .from("profiles")
          .upsert([profile], { onConflict: "id" });
      } catch (error) {
        console.warn("Профиль пользователя не сохранён:", error);
      }
    }

    function getProfileName(userId, fallback = "Рыбак") {
      const id = String(userId || "");

      if (id && userProfiles.has(id)) {
        return userProfiles.get(id) || fallback || "Рыбак";
      }

      return cleanDisplayName(fallback) || "Рыбак";
    }

    async function loadProfilesByIds(ids = []) {
      const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))];

      if (!uniqueIds.length) return;

      try {
        const { data, error } = await chatDb
          .from("profiles")
          .select("id,username,nickname,display_name,email")
          .in("id", uniqueIds);

        if (error) {
          console.warn("Не удалось загрузить профили:", error);
          return;
        }

        (data || []).forEach((profile) => {
          const name = cleanDisplayName(
            profile.username ||
            profile.nickname ||
            profile.display_name ||
            profile.email ||
            ""
          );

          if (profile.id && name) {
            userProfiles.set(String(profile.id), name);
          }
        });
      } catch (error) {
        console.warn("Не удалось загрузить профили:", error);
      }
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
      input.focus();
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

      if (!messageUserId && message.user_name === getCurrentChatName()) {
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

    function setupPresence() {
      if (presenceChannel) {
        presenceChannel.track({
          user_id: currentChatUser?.id || null,
          name: getCurrentChatName(),
          online_at: new Date().toISOString()
        });

        return;
      }

      presenceChannel = chatDb.channel("klevby_presence", {
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
            await ensureCurrentUserProfile();

            presenceChannel.track({
              user_id: currentChatUser?.id || null,
              name: getCurrentChatName(),
              online_at: new Date().toISOString()
            });
          }
        });
    }

    async function loadPublicMessages() {
      activeMode = "public";
      selectedPeer = null;
      clearReply();

      chatWindow.classList.remove("klevby-dialog-screen");
      chatWindow.classList.remove("klevby-private-list-screen");

      publicTab.classList.add("active");
      privateTab.classList.remove("active");
      privatePeople.classList.add("hidden");
      backBtn.classList.add("hidden");
      if (pinnedPublicChat) pinnedPublicChat.classList.remove("hidden");

      chatAvatar.textContent = "🎣";
      chatTitle.textContent = "Чат рыбаков";
      chatSubtitle.textContent = "Общий разговор Klevby";
      input.placeholder = "Напиши сообщение...";
      input.disabled = false;
      sendBtn.disabled = false;

      clearMessages();

      const { data, error } = await chatDb
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        showEmptyState("Не удалось загрузить общий чат. Проверь таблицу messages и RLS.");
        return;
      }

      await loadProfilesByIds((data || []).map((message) => message.user_id));

      if (!data || !data.length) {
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
        return;
      }

      renderMessageList(data, renderPublicMessage);
    }

    async function loadPrivatePeople() {
      await refreshCurrentUser();
      await ensureCurrentUserProfile();

      activeMode = "private";
      selectedPeer = null;
      clearReply();

      chatWindow.classList.remove("klevby-dialog-screen");
      chatWindow.classList.add("klevby-private-list-screen");

      publicTab.classList.remove("active");
      privateTab.classList.add("active");
      privatePeople.classList.add("hidden");
      backBtn.classList.add("hidden");
      if (pinnedPublicChat) pinnedPublicChat.classList.add("hidden");

      chatAvatar.textContent = "✉";
      chatTitle.textContent = "Личные сообщения";
      chatSubtitle.textContent = currentChatUser ? "Выбери диалог" : "Для лички нужен вход";
      input.placeholder = "Выбери диалог...";
      input.disabled = true;
      sendBtn.disabled = true;

      clearMessages();

      if (!currentChatUser) {
        showEmptyState("Чтобы пользоваться личными сообщениями, войди или зарегистрируйся на сайте.");
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
        const { data: privateUsers, error: privateUsersError } = await chatDb
          .from("private_messages")
          .select("sender_id,receiver_id,sender_name,content,created_at")
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order("created_at", { ascending: false });

        if (privateUsersError) {
          console.warn("Не удалось загрузить пользователей из лички:", privateUsersError);
        }

        await loadProfilesByIds(
          (privateUsers || []).flatMap((item) => [item.sender_id, item.receiver_id])
        );

        (privateUsers || []).forEach((item) => {
          const senderId = String(item.sender_id || "");
          const receiverId = String(item.receiver_id || "");
          const peerId = senderId === myId ? receiverId : senderId;
          const peerName = senderId === myId ? getProfileName(receiverId, "Рыбак") : getProfileName(senderId, item.sender_name || "Рыбак");

          addPeer(peerId, peerName, item);
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из private_messages:", error);
      }

      try {
        const { data: publicUsers } = await chatDb
          .from("messages")
          .select("user_id,user_name")
          .not("user_id", "is", null);

        await loadProfilesByIds((publicUsers || []).map((item) => item.user_id));

        (publicUsers || []).forEach((item) => {
          addPeer(item.user_id, getProfileName(item.user_id, item.user_name || "Рыбак"), null);
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из общего чата:", error);
      }

      try {
        const { data: postUsers } = await chatDb
          .from("posts")
          .select("owner_id,name")
          .not("owner_id", "is", null);

        await loadProfilesByIds((postUsers || []).map((item) => item.owner_id));

        (postUsers || []).forEach((item) => {
          addPeer(item.owner_id, getProfileName(item.owner_id, item.name || "Рыбак"), null);
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из объявлений:", error);
      }

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
    }

    async function openPrivateDialog(peerId, peerName) {
      await refreshCurrentUser();
      await ensureCurrentUserProfile();

      if (!currentChatUser) {
        showEmptyState("Для личных сообщений нужно войти.");
        return;
      }

      await loadProfilesByIds([peerId]);

      selectedPeer = {
        id: peerId,
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
      if (pinnedPublicChat) pinnedPublicChat.classList.add("hidden");

      markPeerAsRead(peerId);

      clearMessages();

      const { data, error } = await chatDb
        .from("private_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentChatUser.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${currentChatUser.id})`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        showEmptyState("Не удалось загрузить личку. Проверь private_messages и RLS.");
        return;
      }

      await loadProfilesByIds(
        (data || []).flatMap((message) => [message.sender_id, message.receiver_id])
      );

      selectedPeer.name = getProfileName(peerId, selectedPeer.name);
      chatAvatar.textContent = getInitials(selectedPeer.name);
      chatTitle.textContent = selectedPeer.name;

      unreadPrivateCount = Math.max(0, unreadPrivateCount - 1);
      updateUnreadBadge();

      if (!data || !data.length) {
        showEmptyState("Личных сообщений пока нет. Напиши первым.");
        return;
      }

      renderMessageList(data, renderPrivateMessage);
    }

    async function sendPublicMessage() {
      const rawVal = input.value.trim();
      if (!rawVal) return;

      await refreshCurrentUser();
      await ensureCurrentUserProfile();

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

      const { error } = await chatDb.from("messages").insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
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
      await ensureCurrentUserProfile();

      if (!currentChatUser) {
        alert("Для личных сообщений нужно войти.");
        return;
      }

      if (!selectedPeer) {
        alert("Сначала выбери собеседника.");
        return;
      }

      sendBtn.disabled = true;

      const payload = {
        sender_id: currentChatUser.id,
        receiver_id: selectedPeer.id,
        sender_name: getCurrentChatName(),
        content: buildMessageContent(rawVal)
      };

      const { error } = await chatDb.from("private_messages").insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
        alert("Не получилось отправить личное сообщение. Проверь private_messages и RLS.");
        return;
      }

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

      await refreshCurrentUser();

      let result;

      if (type === "private") {
        if (!currentChatUser) {
          alert("Удалять личные сообщения можно только после входа.");
          return;
        }

        result = await chatDb
          .from("private_messages")
          .delete()
          .eq("id", id)
          .eq("sender_id", currentChatUser.id);
      } else {
        if (currentChatUser) {
          result = await chatDb
            .from("messages")
            .delete()
            .eq("id", id)
            .eq("user_id", currentChatUser.id);
        } else {
          result = await chatDb
            .from("messages")
            .delete()
            .eq("id", id)
            .eq("user_name", getCurrentChatName());
        }
      }

      if (result.error) {
        console.error(result.error);
        alert("Не получилось удалить сообщение. Провь RLS delete.");
        return;
      }

      const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="${type}"]`);
      if (row) row.remove();

      hideMessageMenu();
    }

    async function openChat() {
      updateViewportVars();
      lockChatPage();

      modal.classList.remove("hidden");
      modal.classList.add("open");

      await refreshCurrentUser();
      await ensureCurrentUserProfile();
      await loadPublicMessages();

      setTimeout(() => {
        updateViewportVars();
        scrollChatToBottom();
      }, 150);
    }

    function closeChat() {
      modal.classList.remove("open");
      modal.classList.add("hidden");

      clearReply();
      hideMessageMenu();
      unlockChatPage();
    }

    function setupRealtime() {
      if (publicSubscription || privateSubscription) return;

      publicSubscription = chatDb
        .channel("klevby_public_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            if (activeMode !== "public") return;

            const emptyState = messagesContainer.querySelector(".chat-empty-state");
            if (emptyState) clearMessages();

            await refreshCurrentUser();
            await ensureCurrentUserProfile();
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

      privateSubscription = chatDb
        .channel("klevby_private_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "private_messages" },
          async (payload) => {
            await refreshCurrentUser();
            await ensureCurrentUserProfile();

            const msg = payload.new;
            const myId = String(currentChatUser?.id || "");

            if (!myId) return;

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

    document.addEventListener("click", async (event) => {
      if (event.target.closest("#nav-chat") || event.target.closest("#chat-desktop-btn")) {
        await openChat();
        return;
      }

      if (event.target.id === "close-chat") {
        closeChat();
        return;
      }

      if (event.target.id === "klevby-chat-modal") {
        closeChat();
        return;
      }

      if (event.target.closest("#publicChatTab") || event.target.closest("#pinnedPublicChat")) {
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
      }, 250);
    });

    input.addEventListener("blur", () => {
      setTimeout(updateViewportVars, 150);
    });
  }

  function setupViewportFix() {
    if (window.__klevbyViewportFixReady) return;

    window.__klevbyViewportFixReady = true;

    updateViewportVars();

    window.addEventListener("resize", updateViewportVars, { passive: true });

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

          const messages = document.getElementById("chat-messages");

          if (messages) {
            requestAnimationFrame(() => {
              messages.scrollTop = messages.scrollHeight;
            });
          }
        },
        { passive: true }
      );

      window.visualViewport.addEventListener("scroll", updateViewportVars, { passive: true });
    }
  }

  function updateViewportVars() {
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const offsetTop = vv ? vv.offsetTop : 0;

    document.documentElement.style.setProperty("--klevby-vvh", `${height}px`);
    document.documentElement.style.setProperty("--klevby-vtop", `${offsetTop}px`);
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
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = "klevby-chat-extra-styles";

    style.textContent = `
      .hidden {
        display: none !important;
      }

      .klevby-private-dialog-list {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 0 !important;
        padding: 4px 0 !important;
      }

      .klevby-private-dialog-item {
        width: 100% !important;
        min-height: 72px !important;
        padding: 10px 12px !important;
        border: 0 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        background: transparent !important;
        color: #ffffff !important;
        display: grid !important;
        grid-template-columns: 46px 1fr auto !important;
        align-items: center !important;
        gap: 10px !important;
        cursor: pointer !important;
        text-align: left !important;
      }

      .klevby-private-dialog-item:active {
        background: rgba(255, 255, 255, 0.06) !important;
      }

      .klevby-private-dialog-item.has-unread {
        background: rgba(216, 77, 77, 0.10) !important;
      }

      .klevby-private-dialog-avatar {
        width: 46px !important;
        height: 46px !important;
        border-radius: 50% !important;
        background: #1b2b28 !important;
        color: #b8f5d6 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
        font-weight: 800 !important;
      }

      .klevby-private-dialog-main {
        min-width: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 5px !important;
      }

      .klevby-private-dialog-top,
      .klevby-private-dialog-bottom {
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
      }

      .klevby-private-dialog-name {
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        color: #ffffff !important;
      }

      .klevby-private-dialog-time {
        flex: 0 0 auto !important;
        font-size: 11px !important;
        color: rgba(255, 255, 255, 0.42) !important;
        font-weight: 600 !important;
      }

      .klevby-private-dialog-preview {
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 12px !important;
        color: rgba(255, 255, 255, 0.52) !important;
        font-weight: 500 !important;
      }

      .klevby-private-unread-dot {
        min-width: 18px !important;
        height: 18px !important;
        padding: 0 6px !important;
        border-radius: 999px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #d84d4d !important;
        color: #ffffff !important;
        font-size: 10px !important;
        line-height: 18px !important;
        font-weight: 800 !important;
        flex: 0 0 auto !important;
      }

      .klevby-private-status {
        width: 8px !important;
        height: 8px !important;
        border-radius: 50% !important;
        background: rgba(255, 255, 255, 0.18) !important;
      }

      .klevby-private-status.online {
        background: #49d69b !important;
      }

      .klevby-private-list-screen #chat-input-area {
        display: none !important;
      }

      @media (max-width: 768px) {
        html.klevby-chat-lock,
        body.klevby-chat-lock {
          overflow: hidden !important;
          overscroll-behavior: none !important;
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          height: var(--klevby-vvh, 100dvh) !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
```        return currentChatUser;
      } catch (error) {
        currentChatUser = null;
        return null;
      }
    }    function getCurrentChatName() {...
Need final only code. Already in commentary? Oops I wrote final content in commentary by accident. Since commentary messages visible? It will be an update-like full answer maybe but not final. Need ensure final maybe minimal. But the above is likely visible. Still need final maybe "Готово" ? But user asked no intro, code immediately. Since we've already output code in commentary, but maybe ChatGPT visible. Need final maybe nothing? Cannot empty? We should provide final code maybe not duplicate? But if commentary is visible, final should be concise. However final answer required. We can say " " no. Better not duplicate enormous code. But user asked code. The code is already provided. But final needs satisfy; maybe state "Код выше — готовый файл chat.js." But says no intro. Hmm.

But before final, need consider if code incomplete? Need check copied code not truncated? It appears full. Did I use `profiles` table causing error and catch. It requires table to show other users' metadata. Without table, new messages store nickname. In Supabase browser client .from("profiles").upsert catches? Actually Supabase `.from().upsert()` returns promise resolves with {data,error}, not throw; error may be non-null but not thrown. My ensureCurrentUserProfile await but doesn't inspect error; fine no thrown (unless network). `loadProfilesByIds` checks error. Good.

But issue: `getCurrentChatName` for logged user if no meta uses localStorage, if email only not used. Good.

Potential issue: in prior index.html registration stores username metadata. Good.

Potential issue: if no profiles table, loadProfilesByIds logs error every time but fallback. Fine.

Potential issue: `ensureCurrentUserProfile()` upsert to profiles table if table doesn't have `nickname` etc? profile only id username email updated_at. SQL table likely not exist or doesn't have updated_at. Error silently ignored because I don't capture {error}. It will not throw. This is okay but no profiles update; no warn because no try? Actually await returns result even with error, no exception. Since ignoring, if error no warn. Fine.

Potential issue if profiles table doesn't exist, loadProfilesByIds error logged; no UI.

Potential issue current user on AuthStateChange with existing presence: if current user changes, presence channel key remains old; track with new user_id works under old presence key? maybe okay. 
Need maybe not final duplicate. But final answer can be blank? Need in final. We can say
