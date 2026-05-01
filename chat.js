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

          <button class="klevby-chat-pinned" id="pinnedPublicChat" type="button">
            <span class="klevby-pinned-icon">📌</span>
            <span class="klevby-pinned-copy">
              <span class="klevby-pinned-title">Общий чат закреплён</span>
              <span class="klevby-pinned-text">Быстрый доступ к разговору всех рыбаков</span>
            </span>
          </button>

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
            <button id="attach-btn" class="klevby-chat-attach" type="button" title="Вложение">＋</button>
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

    refreshCurrentUser().then(() => {
      setupPresence();
      setupRealtime();
    });

    chatDb.auth.onAuthStateChange((_event, session) => {
      currentChatUser = session?.user || null;
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
      const email = currentChatUser?.email || "";

      if (email) {
        return email.split("@")[0];
      }

      return getGuestName();
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
      const author = isMine ? "Вы" : (message.user_name || "Рыбак");
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
      const author = isMine ? "Вы" : (message.sender_name || selectedPeer?.name || "Рыбак");
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
      if (presenceChannel) return;

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
              }
            });
          });

          updateSelectedPeerStatus();

          document.querySelectorAll(".klevby-private-person").forEach((button) => {
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

      publicTab.classList.add("active");
      privateTab.classList.remove("active");
      privatePeople.classList.add("hidden");
      backBtn.classList.add("hidden");
      pinnedPublicChat.classList.remove("hidden");

      chatAvatar.textContent = "🎣";
      chatTitle.textContent = "Чат рыбаков";
      chatSubtitle.textContent = "Общий разговор Klevby";
      input.placeholder = "Напиши сообщение...";

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

      if (!data || !data.length) {
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
        return;
      }

      renderMessageList(data, renderPublicMessage);
    }

    async function loadPrivatePeople() {
      await refreshCurrentUser();

      activeMode = "private";
      selectedPeer = null;
      clearReply();

      chatWindow.classList.remove("klevby-dialog-screen");

      publicTab.classList.remove("active");
      privateTab.classList.add("active");
      privatePeople.classList.remove("hidden");
      backBtn.classList.add("hidden");
      pinnedPublicChat.classList.add("hidden");

      chatAvatar.textContent = "✉";
      chatTitle.textContent = "Личные сообщения";
      chatSubtitle.textContent = currentChatUser ? "Выбери собеседника" : "Для лички нужен вход";
      input.placeholder = "Выбери собеседника...";

      unreadPrivateCount = 0;
      updateUnreadBadge();

      clearMessages();
      privatePeople.innerHTML = "";

      if (!currentChatUser) {
        showEmptyState("Чтобы пользоваться личными сообщениями, войди или зарегистрируйся на сайте.");
        return;
      }

      const peersMap = new Map();

      try {
        const { data: publicUsers } = await chatDb
          .from("messages")
          .select("user_id,user_name")
          .not("user_id", "is", null);

        (publicUsers || []).forEach((item) => {
          if (!item.user_id) return;
          if (String(item.user_id) === String(currentChatUser.id)) return;

          peersMap.set(String(item.user_id), {
            id: item.user_id,
            name: item.user_name || "Рыбак"
          });
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из общего чата:", error);
      }

      try {
        const { data: postUsers } = await chatDb
          .from("posts")
          .select("owner_id,name")
          .not("owner_id", "is", null);

        (postUsers || []).forEach((item) => {
          if (!item.owner_id) return;
          if (String(item.owner_id) === String(currentChatUser.id)) return;

          if (!peersMap.has(String(item.owner_id))) {
            peersMap.set(String(item.owner_id), {
              id: item.owner_id,
              name: item.name || "Рыбак"
            });
          }
        });
      } catch (error) {
        console.warn("Не удалось загрузить пользователей из объявлений:", error);
      }

      const peers = Array.from(peersMap.values());

      if (!peers.length) {
        showEmptyState("Пока нет собеседников. Пользователь должен быть автором объявления или написать в общий чат.");
        return;
      }

      privatePeople.innerHTML = peers.map(peer => `
        <button class="klevby-private-person" type="button" data-peer-id="${escapeHtml(peer.id)}" data-peer-name="${escapeHtml(peer.name)}">
          <span class="klevby-private-avatar">${escapeHtml(getInitials(peer.name))}</span>
          <span class="klevby-private-name">${escapeHtml(peer.name)}</span>
          <span class="klevby-private-status ${isOnline(peer.id) ? "online" : ""}"></span>
        </button>
      `).join("");

      showEmptyState("Выбери рыбака сверху, чтобы открыть личную переписку.");
    }

    async function openPrivateDialog(peerId, peerName) {
      await refreshCurrentUser();

      if (!currentChatUser) {
        showEmptyState("Для личных сообщений нужно войти.");
        return;
      }

      selectedPeer = {
        id: peerId,
        name: peerName || "Рыбак"
      };

      chatWindow.classList.add("klevby-dialog-screen");

      clearReply();

      chatAvatar.textContent = getInitials(selectedPeer.name);
      chatTitle.textContent = selectedPeer.name;
      chatSubtitle.textContent = getUserStatusText(selectedPeer.id);
      input.placeholder = "Напиши личное сообщение...";

      backBtn.classList.remove("hidden");
      pinnedPublicChat.classList.add("hidden");

      document.querySelectorAll(".klevby-private-person").forEach((button) => {
        button.classList.toggle("active", String(button.dataset.peerId) === String(peerId));
      });

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
        alert("Не получилось удалить сообщение. Проверь RLS delete.");
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

            const msg = payload.new;
            const myId = String(currentChatUser?.id || "");

            if (!myId) return;

            const isForMe = String(msg.receiver_id) === myId;

            if (
              isForMe &&
              (activeMode !== "private" || !selectedPeer || String(selectedPeer.id) !== String(msg.sender_id))
            ) {
              unreadPrivateCount += 1;
              updateUnreadBadge();
            }

            if (!currentChatUser || activeMode !== "private" || !selectedPeer) return;

            const peerId = String(selectedPeer.id);

            const belongsToDialog =
              (String(msg.sender_id) === myId && String(msg.receiver_id) === peerId) ||
              (String(msg.sender_id) === peerId && String(msg.receiver_id) === myId);

            if (!belongsToDialog) return;

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

      const personButton = event.target.closest(".klevby-private-person");

      if (personButton) {
        await openPrivateDialog(personButton.dataset.peerId, personButton.dataset.peerName);
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
      * {
        box-sizing: border-box !important;
      }

      .hidden {
        display: none !important;
      }

      #chat-desktop-btn,
      .klevby-chat-launcher {
        position: fixed !important;
        right: 24px !important;
        bottom: 24px !important;
        width: 56px !important;
        height: 56px !important;
        border-radius: 50% !important;
        border: 1px solid rgba(58, 180, 130, 0.28) !important;
        background: #101918 !important;
        color: #ffffff !important;
        font-size: 25px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 999998 !important;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.42) !important;
      }

      #klevby-chat-modal {
        position: fixed !important;
        inset: 0 !important;
        z-index: 999999 !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(0, 0, 0, 0.62) !important;
        padding: 0 !important;
      }

      #klevby-chat-modal.open {
        display: flex !important;
      }

      #klevby-chat-modal.hidden {
        display: none !important;
      }

      #chat-window,
      .klevby-chat-window {
        width: min(96vw, 460px) !important;
        height: min(86vh, 700px) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        border-radius: 18px !important;
        background: #07100f !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.58) !important;
        color: #f4f7f5 !important;
      }

      #chat-header,
      .klevby-chat-header {
        height: 58px !important;
        min-height: 58px !important;
        padding: 8px 10px !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        background: #0b1514 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        flex: 0 0 auto !important;
      }

      .klevby-chat-head-main {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        gap: 9px !important;
      }

      .klevby-chat-avatar {
        width: 36px !important;
        height: 36px !important;
        flex: 0 0 36px !important;
        border-radius: 50% !important;
        background: #1b2b28 !important;
        color: #b8f5d6 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      .klevby-chat-title-wrap {
        min-width: 0 !important;
      }

      .klevby-chat-title {
        font-size: 15px !important;
        line-height: 1.15 !important;
        font-weight: 800 !important;
        color: #ffffff !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .klevby-chat-subtitle {
        margin-top: 2px !important;
        font-size: 11px !important;
        line-height: 1.15 !important;
        font-weight: 500 !important;
        color: rgba(244, 247, 245, 0.48) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      #back-chat,
      #close-chat,
      .klevby-chat-back,
      .klevby-chat-close {
        width: 34px !important;
        height: 34px !important;
        flex: 0 0 34px !important;
        border-radius: 50% !important;
        border: 0 !important;
        background: transparent !important;
        color: rgba(255, 255, 255, 0.72) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 24px !important;
        line-height: 1 !important;
        cursor: pointer !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      #back-chat:hover,
      #close-chat:hover {
        background: rgba(255, 255, 255, 0.06) !important;
        color: #ffffff !important;
      }

      .klevby-chat-pinned {
        height: 30px !important;
        min-height: 30px !important;
        padding: 0 12px !important;
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
        background: #0a1211 !important;
        border: 0 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.045) !important;
        color: rgba(244, 247, 245, 0.42) !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        text-align: left !important;
        flex: 0 0 auto !important;
      }

      .klevby-pinned-icon {
        width: auto !important;
        height: auto !important;
        flex: 0 0 auto !important;
        background: transparent !important;
        font-size: 12px !important;
      }

      .klevby-pinned-copy {
        min-width: 0 !important;
        display: block !important;
      }

      .klevby-pinned-title {
        display: inline !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        line-height: 1 !important;
        color: rgba(244, 247, 245, 0.48) !important;
      }

      .klevby-pinned-text {
        display: none !important;
      }

      .klevby-chat-tabs {
        height: 44px !important;
        min-height: 44px !important;
        padding: 6px 10px !important;
        display: flex !important;
        gap: 6px !important;
        background: #07100f !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.045) !important;
        flex: 0 0 auto !important;
      }

      .klevby-chat-tab {
        flex: 1 1 0 !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: transparent !important;
        color: rgba(244, 247, 245, 0.48) !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        min-height: 32px !important;
      }

      .klevby-chat-tab.active {
        background: #162320 !important;
        color: #dfffee !important;
      }

      .klevby-unread-badge {
        min-width: 17px !important;
        height: 17px !important;
        padding: 0 5px !important;
        margin-left: 4px !important;
        border-radius: 999px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #d84d4d !important;
        color: #ffffff !important;
        font-size: 10px !important;
        line-height: 17px !important;
        font-weight: 800 !important;
      }

      .klevby-private-people {
        min-height: 42px !important;
        padding: 6px 10px !important;
        display: flex !important;
        gap: 6px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        background: #07100f !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.045) !important;
        flex: 0 0 auto !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .klevby-private-person {
        min-height: 30px !important;
        padding: 4px 9px !important;
        border-radius: 999px !important;
        border: 0 !important;
        background: #111b19 !important;
        color: rgba(244, 247, 245, 0.72) !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        flex: 0 0 auto !important;
      }

      .klevby-private-person.active {
        background: rgba(58, 180, 130, 0.18) !important;
        color: #dfffee !important;
      }

      .klevby-private-avatar {
        width: 22px !important;
        height: 22px !important;
        border-radius: 50% !important;
        background: #1b2b28 !important;
        color: #b8f5d6 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 11px !important;
        font-weight: 800 !important;
      }

      .klevby-private-name {
        max-width: 115px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 12px !important;
      }

      .klevby-private-status {
        width: 7px !important;
        height: 7px !important;
        border-radius: 50% !important;
        background: rgba(255, 255, 255, 0.18) !important;
      }

      .klevby-private-status.online {
        background: #49d69b !important;
      }

      #chat-messages,
      .klevby-chat-messages {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        padding: 10px 10px 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        background: #030707 !important;
        color: #f4f7f5 !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .klevby-date-divider {
        align-self: center !important;
        margin: 8px 0 6px !important;
        padding: 4px 9px !important;
        border-radius: 999px !important;
        background: rgba(255, 255, 255, 0.06) !important;
        color: rgba(244, 247, 245, 0.46) !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        border: 0 !important;
        line-height: 1 !important;
      }

      .chat-message-row {
        width: 100% !important;
        display: flex !important;
        align-items: flex-end !important;
        gap: 6px !important;
        margin-top: 8px !important;
        animation: chatMessageIn 0.18s ease both !important;
      }

      .chat-message-row.grouped-with-prev {
        margin-top: 2px !important;
      }

      .other-message-row {
        justify-content: flex-start !important;
      }

      .my-message-row {
        justify-content: flex-end !important;
      }

      .klevby-message-avatar {
        width: 28px !important;
        height: 28px !important;
        flex: 0 0 28px !important;
        border-radius: 50% !important;
        background: #17221f !important;
        color: #9de8c4 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      .my-message-row .klevby-message-avatar {
        display: none !important;
      }

      .chat-message-row.grouped-with-prev .klevby-message-avatar {
        visibility: hidden !important;
      }

      .chat-message-bubble {
        position: relative !important;
        max-width: 75% !important;
        min-width: 42px !important;
        padding: 7px 9px 5px !important;
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
        box-shadow: none !important;
      }

      .other-message {
        background: #151c1b !important;
        color: #edf5f1 !important;
        border-radius: 15px 15px 15px 4px !important;
        border: 0 !important;
      }

      .my-message {
        background: linear-gradient(135deg, #2d9d72, #227a5d) !important;
        color: #f3fff8 !important;
        border-radius: 15px 15px 4px 15px !important;
        border: 0 !important;
      }

      .chat-message-author {
        display: inline !important;
        margin: 0 6px 0 0 !important;
        color: #6ee0ad !important;
        font-size: 11px !important;
        line-height: 1.25 !important;
        font-weight: 700 !important;
        opacity: 1 !important;
      }

      .chat-message-text {
        display: inline !important;
        font-size: 14px !important;
        line-height: 1.35 !important;
        font-weight: 400 !important;
        white-space: pre-wrap !important;
        color: inherit !important;
      }

      .klevby-message-footer {
        margin-top: 3px !important;
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 3px !important;
      }

      .chat-message-time {
        color: rgba(255, 255, 255, 0.46) !important;
        font-size: 10px !important;
        line-height: 1 !important;
        font-weight: 500 !important;
        margin: 0 !important;
        opacity: 1 !important;
      }

      .my-message .chat-message-time,
      .my-message .klevby-checks {
        color: rgba(255, 255, 255, 0.62) !important;
      }

      .klevby-checks {
        color: rgba(255, 255, 255, 0.62) !important;
        font-size: 10px !important;
        line-height: 1 !important;
      }

      .klevby-message-reply {
        display: block !important;
        margin: 1px 0 5px !important;
        padding: 5px 7px !important;
        border-left: 2px solid rgba(110, 224, 173, 0.68) !important;
        border-radius: 8px !important;
        background: rgba(255, 255, 255, 0.06) !important;
        color: rgba(244, 247, 245, 0.72) !important;
        font-size: 11px !important;
        line-height: 1.25 !important;
        max-height: 44px !important;
        overflow: hidden !important;
      }

      .klevby-message-actions {
        display: none !important;
      }

      .chat-message-bubble:hover .klevby-message-actions {
        position: absolute !important;
        top: -24px !important;
        right: 6px !important;
        display: flex !important;
        gap: 4px !important;
      }

      .klevby-message-action {
        width: 23px !important;
        height: 23px !important;
        border-radius: 50% !important;
        border: 0 !important;
        background: rgba(20, 28, 27, 0.96) !important;
        color: rgba(255, 255, 255, 0.78) !important;
        font-size: 11px !important;
        cursor: pointer !important;
      }

      .klevby-message-menu {
        position: fixed !important;
        z-index: 1000001 !important;
        width: 170px !important;
        padding: 6px !important;
        border-radius: 16px !important;
        background: rgba(12, 24, 27, 0.96) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        box-shadow: 0 18px 46px rgba(0,0,0,0.42) !important;
        backdrop-filter: blur(18px) !important;
        -webkit-backdrop-filter: blur(18px) !important;
      }

      .klevby-message-menu button {
        width: 100% !important;
        min-height: 38px !important;
        border: 0 !important;
        border-radius: 11px !important;
        background: transparent !important;
        color: #f4fbf7 !important;
        font-size: 14px !important;
        font-weight: 800 !important;
        text-align: left !important;
        padding: 0 10px !important;
        cursor: pointer !important;
      }

      .chat-empty-state {
        margin: auto !important;
        max-width: 260px !important;
        text-align: center !important;
        color: rgba(244, 247, 245, 0.42) !important;
        font-size: 13px !important;
        line-height: 1.45 !important;
      }

      .klevby-reply-preview {
        min-height: 42px !important;
        padding: 6px 10px !important;
        display: grid !important;
        grid-template-columns: 3px 1fr 28px !important;
        align-items: center !important;
        gap: 8px !important;
        background: #0b1514 !important;
        border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
        flex: 0 0 auto !important;
      }

      .klevby-reply-line {
        width: 3px !important;
        height: 28px !important;
        border-radius: 999px !important;
        background: #49d69b !important;
      }

      .klevby-reply-body {
        min-width: 0 !important;
      }

      .klevby-reply-author {
        font-size: 11px !important;
        font-weight: 700 !important;
        color: #74e0b1 !important;
        line-height: 1.2 !important;
      }

      .klevby-reply-text {
        margin-top: 1px !important;
        font-size: 11px !important;
        color: rgba(244, 247, 245, 0.48) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.2 !important;
      }

      .klevby-reply-cancel {
        width: 28px !important;
        height: 28px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: transparent !important;
        color: rgba(255, 255, 255, 0.56) !important;
        font-size: 20px !important;
        cursor: pointer !important;
      }

      #chat-input-area,
      .klevby-chat-inputbar {
        min-height: 54px !important;
        padding: 7px 9px !important;
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
        background: #0b1514 !important;
        border-top: 1px solid rgba(255, 255, 255, 0.055) !important;
        flex: 0 0 auto !important;
      }

      #attach-btn,
      .klevby-chat-attach {
        width: 34px !important;
        height: 34px !important;
        flex: 0 0 34px !important;
        border-radius: 50% !important;
        border: 0 !important;
        background: transparent !important;
        color: rgba(244, 247, 245, 0.54) !important;
        font-size: 25px !important;
        line-height: 1 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      #message-input,
      .klevby-chat-input {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        height: 38px !important;
        min-height: 38px !important;
        max-height: 38px !important;
        padding: 0 13px !important;
        border-radius: 999px !important;
        border: 0 !important;
        outline: none !important;
        background: #151c1b !important;
        color: #ffffff !important;
        font-size: 14px !important;
        line-height: 38px !important;
        margin: 0 !important;
        box-shadow: none !important;
      }

      #message-input::placeholder,
      .klevby-chat-input::placeholder {
        color: rgba(255, 255, 255, 0.36) !important;
      }

      #send-btn,
      .klevby-chat-send {
        width: 38px !important;
        height: 38px !important;
        flex: 0 0 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
        max-width: 38px !important;
        max-height: 38px !important;
        border-radius: 50% !important;
        border: 0 !important;
        background: #2d9d72 !important;
        color: #ffffff !important;
        font-size: 17px !important;
        font-weight: 800 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
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

        #chat-desktop-btn {
          display: none !important;
        }

        #klevby-chat-modal {
          position: fixed !important;
          top: var(--klevby-vtop, 0px) !important;
          left: 0 !important;
          right: 0 !important;
          bottom: auto !important;
          width: 100vw !important;
          height: var(--klevby-vvh, 100dvh) !important;
          background: #030707 !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 0 !important;
          touch-action: none !important;
        }

        #klevby-chat-modal.open {
          display: block !important;
        }

        #chat-window,
        .klevby-chat-window {
          position: fixed !important;
          top: var(--klevby-vtop, 0px) !important;
          left: 0 !important;
          right: 0 !important;
          bottom: auto !important;
          width: 100vw !important;
          height: var(--klevby-vvh, 100dvh) !important;
          min-width: 100vw !important;
          min-height: 0 !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          display: flex !important;
          flex-direction: column !important;
          background: #030707 !important;
        }

        #chat-header,
        .klevby-chat-header {
          height: calc(56px + env(safe-area-inset-top)) !important;
          min-height: calc(56px + env(safe-area-inset-top)) !important;
          padding: calc(8px + env(safe-area-inset-top)) 10px 8px !important;
        }

        .klevby-chat-avatar {
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
          font-size: 14px !important;
        }

        .klevby-chat-pinned {
          height: 28px !important;
          min-height: 28px !important;
          padding: 0 10px !important;
        }

        .klevby-chat-tabs {
          height: 42px !important;
          min-height: 42px !important;
          padding: 6px 8px !important;
        }

        .klevby-private-people {
          min-height: 40px !important;
          padding: 5px 8px !important;
        }

        #chat-messages,
        .klevby-chat-messages {
          padding: 9px 8px 10px !important;
        }

        .chat-message-bubble {
          max-width: 78% !important;
        }

        .klevby-message-avatar {
          width: 26px !important;
          height: 26px !important;
          flex: 0 0 26px !important;
          font-size: 10px !important;
        }

        .klevby-message-actions {
          display: none !important;
        }

        #chat-input-area,
        .klevby-chat-inputbar {
          min-height: calc(54px + env(safe-area-inset-bottom)) !important;
          padding: 7px 9px calc(7px + env(safe-area-inset-bottom)) !important;
        }

        .klevby-dialog-screen .klevby-chat-pinned,
        .klevby-dialog-screen .klevby-chat-tabs,
        .klevby-dialog-screen .klevby-private-people {
          display: none !important;
        }

        .klevby-dialog-screen #back-chat {
          display: flex !important;
        }
      }

      @keyframes chatMessageIn {
        from {
          opacity: 0;
          transform: translateY(4px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
