(function () {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  const initInterval = setInterval(() => {
    if (window.supabase) {
      clearInterval(initInterval);
      const chatDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      setupChat(chatDb);
    }
  }, 500);

  function setupChat(chatDb) {
    let currentChatUser = null;
    let activeMode = "public";
    let selectedPeer = null;
    let publicSubscription = null;
    let privateSubscription = null;
    let presenceChannel = null;
    let typingTimer = null;
    let typingSendTimer = null;
    let replyTarget = null;
    let lastRenderedDateKey = "";
    let unreadPrivateCount = 0;

    const onlineUsers = new Map();
    const guestNameKey = "klevby_chat_guest_name";
    const sentLocalMessages = new Set();

    injectExtraChatStyles();

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
        console.warn("Не удалось проверить пользователя чата:", error);
        currentChatUser = null;
        return null;
      }
    }

    refreshCurrentUser().then(() => {
      setupPresence();
    });

    chatDb.auth.onAuthStateChange((_event, session) => {
      currentChatUser = session?.user || null;
      setupPresence();
    });

    const chatHTML = `
      <div id="chat-desktop-btn" title="Открыть чат">💬</div>

      <div id="klevby-chat-modal" class="hidden">
        <div id="chat-window" class="klevby-chat-window">
          <div id="chat-header" class="klevby-chat-header">
            <button id="back-chat" class="klevby-chat-back hidden" type="button">‹</button>

            <div class="klevby-chat-head-main">
              <div class="klevby-chat-avatar" id="chatAvatar">🎣</div>
              <div class="klevby-chat-title-wrap">
                <div class="klevby-chat-title" id="chatTitle">Чат рыбаков 🎣</div>
                <div class="klevby-chat-subtitle" id="chatSubtitle">Общий разговор Klevby</div>
              </div>
            </div>

            <button id="call-chat" class="klevby-chat-call hidden" type="button" title="Позвонить">☎</button>
            <button id="close-chat" class="klevby-chat-close">&times;</button>
          </div>

          <div class="klevby-chat-pinned" id="pinnedPublicChat" type="button">
            <div class="klevby-pinned-icon">📌</div>
            <div>
              <div class="klevby-pinned-title">Общий чат закреплён</div>
              <div class="klevby-pinned-text">Быстрый доступ к разговору всех рыбаков</div>
            </div>
          </div>

          <div class="klevby-chat-tabs">
            <button id="publicChatTab" class="klevby-chat-tab active" type="button">Общий чат</button>
            <button id="privateChatTab" class="klevby-chat-tab" type="button">
              Личка <span id="privateUnreadBadge" class="klevby-unread-badge hidden">0</span>
            </button>
          </div>

          <div id="privateChatPeople" class="klevby-private-people hidden"></div>

          <div id="chat-messages" class="klevby-chat-messages"></div>

          <div id="replyPreview" class="klevby-reply-preview hidden">
            <div class="klevby-reply-line"></div>
            <div class="klevby-reply-body">
              <div class="klevby-reply-author" id="replyAuthor">Ответ</div>
              <div class="klevby-reply-text" id="replyText">Сообщение</div>
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

          <audio id="remoteAudio" autoplay playsinline></audio>
        </div>
      </div>
    `;

    if (!document.getElementById("klevby-chat-modal")) {
      document.body.insertAdjacentHTML("beforeend", chatHTML);
    }

    const modal = document.getElementById("klevby-chat-modal");
    const messagesContainer = document.getElementById("chat-messages");
    const input = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const publicTab = document.getElementById("publicChatTab");
    const privateTab = document.getElementById("privateChatTab");
    const privatePeople = document.getElementById("privateChatPeople");
    const chatTitle = document.getElementById("chatTitle");
    const chatSubtitle = document.getElementById("chatSubtitle");
    const chatAvatar = document.getElementById("chatAvatar");
    const backBtn = document.getElementById("back-chat");
    const callBtn = document.getElementById("call-chat");
    const pinnedPublicChat = document.getElementById("pinnedPublicChat");
    const replyPreview = document.getElementById("replyPreview");
    const replyAuthor = document.getElementById("replyAuthor");
    const replyText = document.getElementById("replyText");
    const cancelReply = document.getElementById("cancelReply");
    const privateUnreadBadge = document.getElementById("privateUnreadBadge");

    function escapeHtml(text) {
      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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

    function getDateKey(createdAt) {
      if (!createdAt) return "";

      try {
        const d = new Date(createdAt);
        return d.toISOString().slice(0, 10);
      } catch {
        return "";
      }
    }

    function getDateLabel(createdAt) {
      if (!createdAt) return "";

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

      const divider = document.createElement("div");
      divider.className = "klevby-date-divider";
      divider.textContent = getDateLabel(createdAt);

      messagesContainer.appendChild(divider);
    }

    function resetDateDividers() {
      lastRenderedDateKey = "";
    }

    function getInitials(name) {
      const clean = String(name || "Рыбак").trim();
      const first = clean[0] || "Р";
      return first.toUpperCase();
    }

    function getCurrentChatName() {
      const userEmail = currentChatUser?.email || "";

      if (userEmail) {
        return userEmail.split("@")[0];
      }

      return getGuestName();
    }

    function getLocalMessageKey(message) {
      return `${message.user_name || ""}__${message.content || ""}`;
    }

    function isMyPublicMessage(message) {
      const myUserId = currentChatUser?.id || null;
      const messageUserId = message.user_id || null;

      if (myUserId && messageUserId && String(messageUserId) === String(myUserId)) {
        return true;
      }

      const localName = getCurrentChatName();
      const messageName = message.user_name || "";

      if (!messageUserId && messageName && messageName === localName) {
        return true;
      }

      const localKey = getLocalMessageKey(message);

      if (sentLocalMessages.has(localKey)) {
        return true;
      }

      return false;
    }

    function isMyPrivateMessage(message) {
      const myUserId = currentChatUser?.id || null;
      return myUserId && String(message.sender_id) === String(myUserId);
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

    function playBubbleSound() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(420, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.09);

        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

        oscillator.connect(gain);
        gain.connect(audioCtx.destination);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.16);

        setTimeout(() => {
          audioCtx.close();
        }, 260);
      } catch (error) {
        console.warn("Звук чата не сработал:", error);
      }
    }

    function clearMessages() {
      if (!messagesContainer) return;
      messagesContainer.innerHTML = "";
      resetDateDividers();
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

    function clearReply() {
      replyTarget = null;
      replyPreview.classList.add("hidden");
      replyAuthor.textContent = "";
      replyText.textContent = "";
    }

    function setReplyTarget(message, type, isMine) {
      const author =
        isMine
          ? "Вы"
          : type === "private"
            ? (message.sender_name || selectedPeer?.name || "Рыбак")
            : (message.user_name || "Рыбак");

      replyTarget = {
        id: message.id || null,
        type,
        author,
        text: message.content || ""
      };

      replyAuthor.textContent = "Ответ: " + author;
      replyText.textContent = message.content || "";
      replyPreview.classList.remove("hidden");
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

      const replyLine = parts[0].replace("↩ Ответ ", "");
      const mainText = parts.slice(1).join("\n");

      return {
        reply: replyLine,
        mainText
      };
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

    function renderPublicMessage(message) {
      if (!messagesContainer || !message) return;

      renderDateDivider(message.created_at);

      const isMine = isMyPublicMessage(message);
      const author = isMine ? "Вы" : (message.user_name || "Рыбак");
      const time = getMessageTime(message.created_at);
      const parsed = parseReplyContent(message.content || "");

      const row = document.createElement("div");
      row.className = `chat-message-row ${isMine ? "my-message-row" : "other-message-row"}`;
      row.dataset.messageId = message.id || "";
      row.dataset.messageType = "public";

      const avatar = document.createElement("div");
      avatar.className = "klevby-message-avatar";
      avatar.textContent = getInitials(author);

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      bubble.innerHTML = `
        <div class="chat-message-author">${escapeHtml(author)}</div>
        ${parsed.reply ? `<div class="klevby-message-reply">${escapeHtml(parsed.reply)}</div>` : ""}
        <div class="chat-message-text">${escapeHtml(parsed.mainText || "")}</div>
        <div class="klevby-message-footer">
          ${time ? `<span class="chat-message-time">${escapeHtml(time)}</span>` : ""}
          ${isMine ? `<span class="klevby-checks">✓✓</span>` : ""}
        </div>
        ${renderMessageActions(message, "public", isMine)}
      `;

      if (!isMine) row.appendChild(avatar);
      row.appendChild(bubble);
      if (isMine) row.appendChild(avatar);

      messagesContainer.appendChild(row);
      scrollChatToBottom();
    }

    function renderPrivateMessage(message) {
      if (!messagesContainer || !message) return;

      renderDateDivider(message.created_at);

      const isMine = isMyPrivateMessage(message);
      const author = isMine ? "Вы" : (message.sender_name || selectedPeer?.name || "Рыбак");
      const time = getMessageTime(message.created_at);
      const parsed = parseReplyContent(message.content || "");

      const row = document.createElement("div");
      row.className = `chat-message-row ${isMine ? "my-message-row" : "other-message-row"}`;
      row.dataset.messageId = message.id || "";
      row.dataset.messageType = "private";

      const avatar = document.createElement("div");
      avatar.className = "klevby-message-avatar";
      avatar.textContent = getInitials(author);

      const bubble = document.createElement("div");
      bubble.className = `chat-message-bubble ${isMine ? "my-message" : "other-message"}`;

      bubble.innerHTML = `
        <div class="chat-message-author">${escapeHtml(author)}</div>
        ${parsed.reply ? `<div class="klevby-message-reply">${escapeHtml(parsed.reply)}</div>` : ""}
        <div class="chat-message-text">${escapeHtml(parsed.mainText || "")}</div>
        <div class="klevby-message-footer">
          ${time ? `<span class="chat-message-time">${escapeHtml(time)}</span>` : ""}
          ${isMine ? `<span class="klevby-checks">✓✓</span>` : ""}
        </div>
        ${renderMessageActions(message, "private", isMine)}
      `;

      if (!isMine) row.appendChild(avatar);
      row.appendChild(bubble);
      if (isMine) row.appendChild(avatar);

      messagesContainer.appendChild(row);
      scrollChatToBottom();
    }

    async function loadPublicMessages() {
      activeMode = "public";
      selectedPeer = null;
      clearReply();

      publicTab.classList.add("active");
      privateTab.classList.remove("active");
      privatePeople.classList.add("hidden");
      backBtn.classList.add("hidden");
      callBtn.classList.add("hidden");
      pinnedPublicChat.classList.remove("hidden");

      chatAvatar.textContent = "🎣";
      chatTitle.textContent = "Чат рыбаков 🎣";
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

      clearMessages();
      data.forEach(renderPublicMessage);
      scrollChatToBottom();
    }

    async function loadPrivatePeople() {
      await refreshCurrentUser();

      activeMode = "private";
      clearReply();

      publicTab.classList.remove("active");
      privateTab.classList.add("active");
      privatePeople.classList.remove("hidden");
      backBtn.classList.add("hidden");
      callBtn.classList.add("hidden");
      pinnedPublicChat.classList.add("hidden");

      chatAvatar.textContent = "✉";
      chatTitle.textContent = "Личные сообщения";
      chatSubtitle.textContent = currentChatUser ? "Выбери собеседника" : "Для лички нужен вход";
      input.placeholder = "Выбери собеседника...";
      selectedPeer = null;

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
        privatePeople.innerHTML = "";
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

      clearReply();

      chatAvatar.textContent = getInitials(selectedPeer.name);
      chatTitle.textContent = selectedPeer.name;
      chatSubtitle.textContent = getUserStatusText(selectedPeer.id);
      input.placeholder = "Напиши личное сообщение...";

      backBtn.classList.remove("hidden");
      callBtn.classList.remove("hidden");
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
        showEmptyState("Не удалось загрузить личку. Проверь таблицу private_messages и RLS.");
        return;
      }

      if (!data || !data.length) {
        showEmptyState("Личных сообщений пока нет. Напиши первым.");
        return;
      }

      clearMessages();
      data.forEach(renderPrivateMessage);
      scrollChatToBottom();
    }

    async function sendPublicMessage() {
      const rawVal = input.value.trim();
      if (!rawVal) return;

      await refreshCurrentUser();

      sendBtn.disabled = true;

      const userId = currentChatUser?.id || null;
      const userName = getCurrentChatName();
      const val = buildMessageContent(rawVal);

      const payload = {
        user_name: userName,
        content: val
      };

      if (userId) {
        payload.user_id = userId;
      }

      sentLocalMessages.add(`${userName}__${val}`);

      const { error } = await chatDb
        .from("messages")
        .insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return;
      }

      input.value = "";
      clearReply();
      playBubbleSound();

      setTimeout(() => {
        sentLocalMessages.delete(`${userName}__${val}`);
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

      const { error } = await chatDb
        .from("private_messages")
        .insert([payload]);

      sendBtn.disabled = false;

      if (error) {
        console.error(error);
        alert("Не получилось отправить личное сообщение. Проверь private_messages и RLS.");
        return;
      }

      input.value = "";
      clearReply();
      playBubbleSound();
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
        alert("Не получилось удалить. Проверь RLS delete для таблицы сообщений.");
        return;
      }

      const row = messagesContainer.querySelector(`[data-message-id="${CSS.escape(id)}"][data-message-type="${type}"]`);
      if (row) row.remove();
    }

    function findMessageDataFromRow(row) {
      if (!row) return null;

      const type = row.dataset.messageType || "public";
      const id = row.dataset.messageId || "";
      const author = row.querySelector(".chat-message-author")?.textContent || "Рыбак";
      const text = row.querySelector(".chat-message-text")?.textContent || "";
      const isMine = row.classList.contains("my-message-row");

      return {
        id,
        type,
        author,
        content: text,
        isMine
      };
    }

    async function openChat() {
      modal.classList.remove("hidden");
      modal.classList.add("open");

      await refreshCurrentUser();
      await loadPublicMessages();

      setTimeout(() => {
        input.focus();
      }, 150);
    }

    function closeChat() {
      modal.classList.remove("open");
      modal.classList.add("hidden");
      clearReply();
    }

    function sendTypingSignal() {
      if (!presenceChannel) return;
      if (activeMode !== "private") return;
      if (!currentChatUser || !selectedPeer) return;

      clearTimeout(typingSendTimer);

      typingSendTimer = setTimeout(() => {
        presenceChannel.send({
          type: "broadcast",
          event: "typing",
          payload: {
            sender_id: currentChatUser.id,
            receiver_id: selectedPeer.id,
            sender_name: getCurrentChatName(),
            created_at: new Date().toISOString()
          }
        });
      }, 250);
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
            if (dot) dot.classList.toggle("online", isOnline(peerId));
          });
        })
        .on("broadcast", { event: "typing" }, (event) => {
          const payload = event.payload || {};
          const senderId = String(payload.sender_id || "");
          const receiverId = String(payload.receiver_id || "");
          const myId = String(currentChatUser?.id || "");

          if (!myId || receiverId !== myId) return;
          if (activeMode !== "private" || !selectedPeer) return;
          if (String(selectedPeer.id) !== senderId) return;

          chatSubtitle.textContent = "Печатает...";

          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => {
            updateSelectedPeerStatus();
          }, 2200);
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

    document.addEventListener("click", async (e) => {
      if (e.target.closest("#nav-chat") || e.target.closest("#chat-desktop-btn")) {
        openChat();
      }

      if (e.target.id === "close-chat" || e.target.id === "klevby-chat-modal") {
        closeChat();
      }

      if (e.target.closest("#publicChatTab") || e.target.closest("#pinnedPublicChat")) {
        await loadPublicMessages();
      }

      if (e.target.closest("#privateChatTab")) {
        await loadPrivatePeople();
      }

      if (e.target.closest("#back-chat")) {
        await loadPrivatePeople();
      }

      if (e.target.closest("#cancelReply")) {
        clearReply();
      }

      if (e.target.closest("#call-chat")) {
        alert("Звонок можно включить отдельным модулем WebRTC. Сейчас добавлена кнопка под будущий вызов.");
      }

      const personButton = e.target.closest(".klevby-private-person");
      if (personButton) {
        await openPrivateDialog(personButton.dataset.peerId, personButton.dataset.peerName);
      }

      const replyButton = e.target.closest(".reply-message-btn");
      if (replyButton) {
        const row = replyButton.closest(".chat-message-row");
        const messageData = findMessageDataFromRow(row);

        if (messageData) {
          setReplyTarget(
            {
              id: messageData.id,
              content: messageData.content,
              user_name: messageData.author,
              sender_name: messageData.author
            },
            messageData.type,
            messageData.isMine
          );
        }
      }

      const deleteButton = e.target.closest(".delete-message-btn");
      if (deleteButton) {
        await deleteMessage(deleteButton.dataset.type, deleteButton.dataset.id);
      }
    });

    sendBtn.onclick = send;

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    };

    input.oninput = () => {
      sendTypingSignal();
    };

    publicSubscription = chatDb
      .channel("public_messages_channel")
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
      .subscribe();

    privateSubscription = chatDb
      .channel("private_messages_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        async (payload) => {
          await refreshCurrentUser();

          const msg = payload.new;
          const myId = String(currentChatUser?.id || "");

          if (!myId) return;

          const isForMe = String(msg.receiver_id) === myId;
          const isFromMe = String(msg.sender_id) === myId;

          if (isForMe && (activeMode !== "private" || !selectedPeer || String(selectedPeer.id) !== String(msg.sender_id))) {
            unreadPrivateCount += 1;
            updateUnreadBadge();
            playBubbleSound();
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
      .subscribe();
  }

  function injectExtraChatStyles() {
    if (document.getElementById("klevby-chat-extra-styles")) return;

    const style = document.createElement("style");
    style.id = "klevby-chat-extra-styles";
    style.textContent = `
      #chat-header,
      .klevby-chat-header {
        gap: 10px !important;
      }

      .klevby-chat-head-main {
        min-width: 0;
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .klevby-chat-avatar {
        flex: 0 0 40px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background:
          radial-gradient(circle at 30% 10%, rgba(87,230,178,0.28), transparent 44%),
          rgba(255,255,255,0.075);
        border: 1px solid rgba(255,255,255,0.10);
        color: #d7ffe8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        font-weight: 900;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .klevby-chat-title-wrap {
        min-width: 0;
      }

      .klevby-chat-title,
      .klevby-chat-subtitle {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .klevby-chat-back,
      .klevby-chat-call {
        flex: 0 0 38px;
        width: 38px;
        height: 38px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 50%;
        background: rgba(255,255,255,0.055);
        color: rgba(255,255,255,0.82);
        cursor: pointer;
        font-size: 28px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .klevby-chat-call {
        font-size: 18px;
        color: #03150c;
        background: linear-gradient(135deg, #57e6b2, #28c990);
        border-color: rgba(87,230,178,0.28);
      }

      .klevby-chat-pinned {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        background: rgba(87,230,178,0.075);
        color: #f4fbf7;
        cursor: pointer;
      }

      .klevby-pinned-icon {
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        border-radius: 12px;
        background: rgba(87,230,178,0.14);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .klevby-pinned-title {
        font-size: 13px;
        font-weight: 900;
        line-height: 1.15;
      }

      .klevby-pinned-text {
        margin-top: 2px;
        color: rgba(244,251,247,0.56);
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
      }

      #chat-input-area,
      .klevby-chat-inputbar {
        align-items: center !important;
      }

      #send-btn,
      .klevby-chat-send {
        flex: 0 0 48px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      #message-input,
      .klevby-chat-input {
        margin: 0 !important;
      }

      .klevby-chat-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 10px;
        background: rgba(255,255,255,0.025);
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }

      .klevby-chat-tab {
        position: relative;
        min-height: 38px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        background: rgba(255,255,255,0.055);
        color: rgba(244,251,247,0.62);
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .klevby-chat-tab.active {
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
        border-color: rgba(87,230,178,0.28);
      }

      .klevby-unread-badge {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: #e45858;
        color: #fff;
        font-size: 10px;
        line-height: 18px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 5px;
      }

      .klevby-private-people {
        display: flex;
        gap: 8px;
        padding: 10px;
        overflow-x: auto;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        background: rgba(255,255,255,0.025);
        -webkit-overflow-scrolling: touch;
      }

      .klevby-private-person {
        position: relative;
        flex: 0 0 auto;
        min-height: 42px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.055);
        color: #f4fbf7;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }

      .klevby-private-person.active {
        background: rgba(87,230,178,0.16);
        border-color: rgba(87,230,178,0.32);
        color: #d7ffe8;
      }

      .klevby-private-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(87,230,178,0.14);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 900;
      }

      .klevby-private-name {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .klevby-private-status {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: rgba(255,255,255,0.20);
      }

      .klevby-private-status.online {
        background: #57e6b2;
        box-shadow: 0 0 10px rgba(87,230,178,0.65);
      }

      .klevby-date-divider {
        align-self: center;
        margin: 8px 0;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        color: rgba(244,251,247,0.64);
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
      }

      .chat-message-row {
        align-items: flex-end;
        gap: 7px;
      }

      .klevby-message-avatar {
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background:
          radial-gradient(circle at 30% 10%, rgba(87,230,178,0.24), transparent 44%),
          rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.08);
        color: #d7ffe8;
        font-size: 12px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .my-message-row .klevby-message-avatar {
        background: rgba(40,201,144,0.22);
        color: #03150c;
      }

      .chat-message-bubble {
        position: relative;
      }

      .klevby-message-reply {
        margin: 2px 0 7px;
        padding: 7px 9px;
        border-left: 3px solid rgba(3,21,12,0.30);
        border-radius: 10px;
        background: rgba(255,255,255,0.16);
        color: inherit;
        opacity: 0.86;
        font-size: 12px;
        line-height: 1.3;
        font-weight: 800;
        max-height: 52px;
        overflow: hidden;
      }

      .other-message .klevby-message-reply {
        border-left-color: rgba(87,230,178,0.55);
        background: rgba(87,230,178,0.10);
      }

      .klevby-message-footer {
        margin-top: 5px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
      }

      .chat-message-time {
        margin-top: 0 !important;
      }

      .klevby-checks {
        font-size: 11px;
        line-height: 1;
        font-weight: 900;
        opacity: 0.68;
      }

      .klevby-message-actions {
        position: absolute;
        top: -12px;
        right: 8px;
        display: flex;
        gap: 4px;
        opacity: 0;
        pointer-events: none;
        transition: 0.18s ease;
      }

      .chat-message-bubble:hover .klevby-message-actions {
        opacity: 1;
        pointer-events: auto;
      }

      .klevby-message-action {
        width: 24px;
        height: 24px;
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 50%;
        background: rgba(5,14,16,0.90);
        color: #f4fbf7;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .klevby-message-action:hover {
        background: rgba(87,230,178,0.22);
      }

      .klevby-reply-preview {
        display: grid;
        grid-template-columns: 4px 1fr 34px;
        align-items: center;
        gap: 9px;
        padding: 9px 10px;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: rgba(87,230,178,0.08);
      }

      .klevby-reply-line {
        width: 4px;
        height: 36px;
        border-radius: 999px;
        background: #57e6b2;
      }

      .klevby-reply-body {
        min-width: 0;
      }

      .klevby-reply-author {
        color: #d7ffe8;
        font-size: 12px;
        line-height: 1.2;
        font-weight: 900;
      }

      .klevby-reply-text {
        margin-top: 2px;
        color: rgba(244,251,247,0.62);
        font-size: 12px;
        line-height: 1.2;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .klevby-reply-cancel {
        width: 34px;
        height: 34px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 50%;
        background: rgba(255,255,255,0.055);
        color: rgba(255,255,255,0.74);
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
      }

      @media (max-width: 768px) {
        .klevby-message-actions {
          opacity: 1;
          pointer-events: auto;
          top: -10px;
        }

        .klevby-message-avatar {
          width: 24px;
          height: 24px;
          flex-basis: 24px;
          font-size: 10px;
        }

        .klevby-chat-call,
        .klevby-chat-back {
          width: 36px;
          height: 36px;
          flex-basis: 36px;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
