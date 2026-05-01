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

    let peerConnection = null;
    let localStream = null;
    let currentCallId = null;
    let currentCallRole = null;
    let pendingIncomingCall = null;
    let callsSubscription = null;
    let iceSubscription = null;
    let pendingLocalIceCandidates = [];
    let pendingRemoteIceCandidates = [];
    let addedIceCandidateIds = new Set();
    let callAnswerApplied = false;

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
      setupCallRealtime();
    });

    chatDb.auth.onAuthStateChange((_event, session) => {
      currentChatUser = session?.user || null;
      setupPresence();
      setupCallRealtime();
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

          <div id="callStatusBar" class="klevby-call-status-bar hidden">
            <div>
              <div class="klevby-call-status-title" id="callStatusTitle">Звонок</div>
              <div class="klevby-call-status-text" id="callStatusText">Подключение...</div>
            </div>
            <button id="endCallBtn" class="klevby-call-end" type="button">Завершить</button>
          </div>

          <div id="incomingCallPanel" class="klevby-incoming-call hidden">
            <div class="klevby-incoming-icon">☎</div>
            <div class="klevby-incoming-info">
              <div class="klevby-incoming-title" id="incomingCallTitle">Входящий звонок</div>
              <div class="klevby-incoming-text" id="incomingCallText">Рыбак звонит тебе</div>
            </div>
            <div class="klevby-incoming-actions">
              <button id="acceptCallBtn" class="klevby-call-accept" type="button">Ответить</button>
              <button id="rejectCallBtn" class="klevby-call-reject" type="button">Сбросить</button>
            </div>
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
    const chatWindow = document.getElementById("chat-window");
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
    const remoteAudio = document.getElementById("remoteAudio");
    const callStatusBar = document.getElementById("callStatusBar");
    const callStatusTitle = document.getElementById("callStatusTitle");
    const callStatusText = document.getElementById("callStatusText");
    const incomingCallPanel = document.getElementById("incomingCallPanel");
    const incomingCallTitle = document.getElementById("incomingCallTitle");
    const incomingCallText = document.getElementById("incomingCallText");
    const acceptCallBtn = document.getElementById("acceptCallBtn");
    const rejectCallBtn = document.getElementById("rejectCallBtn");
    const endCallBtn = document.getElementById("endCallBtn");

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

      chatWindow.classList.remove("klevby-dialog-screen");

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

      chatWindow.classList.remove("klevby-dialog-screen");

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

      chatWindow.classList.add("klevby-dialog-screen");

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

      const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="${type}"]`);
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

    function showCallStatus(title, text) {
      callStatusTitle.textContent = title;
      callStatusText.textContent = text;
      callStatusBar.classList.remove("hidden");
    }

    function hideCallStatus() {
      callStatusBar.classList.add("hidden");
      callStatusTitle.textContent = "Звонок";
      callStatusText.textContent = "Подключение...";
    }

    function showIncomingCall(call) {
      pendingIncomingCall = call;

      modal.classList.remove("hidden");
      modal.classList.add("open");

      incomingCallTitle.textContent = "Входящий звонок";
      incomingCallText.textContent = `${call.caller_name || "Рыбак"} звонит тебе`;
      incomingCallPanel.classList.remove("hidden");
      playBubbleSound();
    }

    function hideIncomingCall() {
      incomingCallPanel.classList.add("hidden");
      incomingCallTitle.textContent = "Входящий звонок";
      incomingCallText.textContent = "Рыбак звонит тебе";
      pendingIncomingCall = null;
    }

    function ensureWebRtcSupport() {
      return Boolean(
        window.RTCPeerConnection &&
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      );
    }

    async function getLocalAudioStream() {
      if (localStream) return localStream;

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      return localStream;
    }

    function createPeerConnection() {
      if (peerConnection) {
        try {
          peerConnection.close();
        } catch (error) {
          console.warn("Не удалось закрыть старый PeerConnection:", error);
        }
      }

      callAnswerApplied = false;
      pendingRemoteIceCandidates = [];
      addedIceCandidateIds = new Set();

      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" }
        ]
      });

      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await sendIceCandidate(event.candidate);
        }
      };

      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch(() => {});
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection?.connectionState || "";

        if (state === "connected") {
          showCallStatus("Идёт звонок", selectedPeer ? `Разговор с ${selectedPeer.name}` : "Соединение установлено");
        }

        if (state === "disconnected") {
          showCallStatus("Звонок", "Связь прерывается...");
        }

        if (state === "failed") {
          showCallStatus("Звонок завершён", "Соединение не удалось установить");
          setTimeout(() => endCall(false), 800);
        }

        if (state === "closed") {
          hideCallStatus();
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection?.iceConnectionState || "";

        if (state === "failed") {
          showCallStatus("Звонок", "Проблема с соединением");
        }
      };

      return peerConnection;
    }

    async function attachLocalTracks() {
      const stream = await getLocalAudioStream();
      stream.getTracks().forEach((track) => {
        const alreadyAdded = peerConnection
          .getSenders()
          .some((sender) => sender.track && sender.track.id === track.id);

        if (!alreadyAdded) {
          peerConnection.addTrack(track, stream);
        }
      });
    }

    async function sendIceCandidate(candidate) {
      const userId = currentChatUser?.id || null;
      const candidateJson = typeof candidate.toJSON === "function" ? candidate.toJSON() : candidate;

      if (!userId) return;

      if (!currentCallId) {
        pendingLocalIceCandidates.push(candidateJson);
        return;
      }

      const { error } = await chatDb
        .from("call_ice_candidates")
        .insert([{
          call_id: currentCallId,
          user_id: userId,
          candidate: candidateJson
        }]);

      if (error) {
        console.error("ICE candidate insert error:", error);
      }
    }

    async function flushPendingLocalIceCandidates() {
      if (!currentCallId || !currentChatUser || !pendingLocalIceCandidates.length) return;

      const candidates = pendingLocalIceCandidates.splice(0).map((candidate) => ({
        call_id: currentCallId,
        user_id: currentChatUser.id,
        candidate
      }));

      const { error } = await chatDb
        .from("call_ice_candidates")
        .insert(candidates);

      if (error) {
        console.error("ICE candidates flush error:", error);
      }
    }

    async function addRemoteIceCandidate(candidateRow) {
      if (!candidateRow || !candidateRow.candidate || !peerConnection) return;
      if (!currentChatUser) return;
      if (String(candidateRow.user_id) === String(currentChatUser.id)) return;

      const candidateId = String(candidateRow.id || JSON.stringify(candidateRow.candidate));
      if (addedIceCandidateIds.has(candidateId)) return;
      addedIceCandidateIds.add(candidateId);

      if (!peerConnection.remoteDescription) {
        pendingRemoteIceCandidates.push(candidateRow);
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateRow.candidate));
      } catch (error) {
        console.warn("Не удалось добавить ICE candidate:", error);
      }
    }

    async function flushPendingRemoteIceCandidates() {
      if (!peerConnection || !peerConnection.remoteDescription) return;

      const queue = [...pendingRemoteIceCandidates];
      pendingRemoteIceCandidates = [];

      for (const item of queue) {
        await addRemoteIceCandidate(item);
      }
    }

    async function loadExistingIceCandidates(callId) {
      if (!callId) return;

      const { data, error } = await chatDb
        .from("call_ice_candidates")
        .select("*")
        .eq("call_id", callId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Не удалось загрузить ICE candidates:", error);
        return;
      }

      for (const item of data || []) {
        await addRemoteIceCandidate(item);
      }
    }

    async function startCall() {
      await refreshCurrentUser();

      if (!currentChatUser) {
        alert("Для звонка нужно войти на сайт.");
        return;
      }

      if (activeMode !== "private" || !selectedPeer) {
        alert("Сначала выбери собеседника в личке.");
        return;
      }

      if (!ensureWebRtcSupport()) {
        alert("Твой браузер не поддерживает звонки WebRTC.");
        return;
      }

      if (currentCallId) {
        alert("Звонок уже идёт.");
        return;
      }

      try {
        currentCallRole = "caller";
        pendingLocalIceCandidates = [];

        showCallStatus("Исходящий звонок", `Звоним ${selectedPeer.name}...`);

        const pc = createPeerConnection();
        await attachLocalTracks();

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });

        await pc.setLocalDescription(offer);

        const { data, error } = await chatDb
          .from("calls")
          .insert([{
            caller_id: currentChatUser.id,
            receiver_id: selectedPeer.id,
            caller_name: getCurrentChatName(),
            status: "ringing",
            offer: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription
          }])
          .select("*")
          .single();

        if (error) {
          console.error(error);
          alert("Не получилось начать звонок. Проверь таблицы calls и RLS.");
          await cleanupCall(false);
          return;
        }

        currentCallId = data.id;
        await flushPendingLocalIceCandidates();
      } catch (error) {
        console.error("startCall error:", error);
        alert("Не получилось начать звонок. Разреши доступ к микрофону.");
        await cleanupCall(false);
      }
    }

    async function answerCall() {
      await refreshCurrentUser();

      if (!currentChatUser) {
        alert("Для звонка нужно войти на сайт.");
        return;
      }

      if (!pendingIncomingCall) {
        return;
      }

      if (!ensureWebRtcSupport()) {
        alert("Твой браузер не поддерживает звонки WebRTC.");
        return;
      }

      const call = pendingIncomingCall;

      try {
        currentCallId = call.id;
        currentCallRole = "receiver";
        pendingLocalIceCandidates = [];

        hideIncomingCall();
        showCallStatus("Входящий звонок", `Соединяем с ${call.caller_name || "рыбаком"}...`);

        const pc = createPeerConnection();
        await attachLocalTracks();

        await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        await flushPendingRemoteIceCandidates();
        await loadExistingIceCandidates(call.id);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const { error } = await chatDb
          .from("calls")
          .update({
            status: "answered",
            answer: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription
          })
          .eq("id", call.id);

        if (error) {
          console.error(error);
          alert("Не получилось ответить на звонок.");
          await cleanupCall(false);
          return;
        }

        await flushPendingLocalIceCandidates();
        showCallStatus("Идёт звонок", `Разговор с ${call.caller_name || "рыбаком"}`);
      } catch (error) {
        console.error("answerCall error:", error);
        alert("Не получилось ответить на звонок. Разреши доступ к микрофону.");
        await cleanupCall(true);
      }
    }

    async function rejectCall() {
      if (!pendingIncomingCall) return;

      const callId = pendingIncomingCall.id;
      hideIncomingCall();

      try {
        await chatDb
          .from("calls")
          .update({ status: "rejected" })
          .eq("id", callId);
      } catch (error) {
        console.warn("rejectCall error:", error);
      }

      await cleanupCall(false);
    }

    async function endCall(updateRemote = true) {
      const callId = currentCallId || pendingIncomingCall?.id || null;

      if (updateRemote && callId) {
        try {
          await chatDb
            .from("calls")
            .update({ status: "ended" })
            .eq("id", callId);
        } catch (error) {
          console.warn("endCall update error:", error);
        }
      }

      await cleanupCall(false);
    }

    async function cleanupCall() {
      hideIncomingCall();
      hideCallStatus();

      if (peerConnection) {
        try {
          peerConnection.onicecandidate = null;
          peerConnection.ontrack = null;
          peerConnection.onconnectionstatechange = null;
          peerConnection.oniceconnectionstatechange = null;
          peerConnection.close();
        } catch (error) {
          console.warn("PeerConnection close error:", error);
        }
      }

      peerConnection = null;

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      }

      localStream = null;

      if (remoteAudio) {
        remoteAudio.srcObject = null;
      }

      currentCallId = null;
      currentCallRole = null;
      pendingIncomingCall = null;
      pendingLocalIceCandidates = [];
      pendingRemoteIceCandidates = [];
      addedIceCandidateIds = new Set();
      callAnswerApplied = false;
    }

    async function handleCallInsert(call) {
      await refreshCurrentUser();

      if (!currentChatUser || !call) return;

      const myId = String(currentChatUser.id);

      if (String(call.receiver_id) === myId && call.status === "ringing") {
        if (currentCallId) {
          await chatDb
            .from("calls")
            .update({ status: "busy" })
            .eq("id", call.id);
          return;
        }

        showIncomingCall(call);
      }
    }

    async function handleCallUpdate(call) {
      await refreshCurrentUser();

      if (!currentChatUser || !call) return;

      const myId = String(currentChatUser.id);
      const isMyCall =
        String(call.caller_id) === myId ||
        String(call.receiver_id) === myId;

      if (!isMyCall) return;

      if (pendingIncomingCall && String(pendingIncomingCall.id) === String(call.id)) {
        if (["ended", "rejected", "cancelled", "busy"].includes(call.status)) {
          hideIncomingCall();
        }
      }

      if (!currentCallId || String(call.id) !== String(currentCallId)) return;

      if (["ended", "rejected", "cancelled", "busy"].includes(call.status)) {
        showCallStatus("Звонок завершён", call.status === "busy" ? "Собеседник занят" : "Соединение завершено");
        setTimeout(() => cleanupCall(false), 700);
        return;
      }

      if (
        currentCallRole === "caller" &&
        call.status === "answered" &&
        call.answer &&
        peerConnection &&
        !callAnswerApplied
      ) {
        try {
          callAnswerApplied = true;
          await peerConnection.setRemoteDescription(new RTCSessionDescription(call.answer));
          await flushPendingRemoteIceCandidates();
          await loadExistingIceCandidates(call.id);
          showCallStatus("Идёт звонок", selectedPeer ? `Разговор с ${selectedPeer.name}` : "Соединение установлено");
        } catch (error) {
          console.error("set answer error:", error);
          await cleanupCall(true);
        }
      }
    }

    async function handleIceInsert(candidateRow) {
      if (!candidateRow || !currentCallId) return;
      if (String(candidateRow.call_id) !== String(currentCallId)) return;
      await addRemoteIceCandidate(candidateRow);
    }

    function setupCallRealtime() {
      if (callsSubscription && iceSubscription) return;

      callsSubscription = chatDb
        .channel("klevby_calls_channel")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "calls" },
          async (payload) => {
            await handleCallInsert(payload.new);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "calls" },
          async (payload) => {
            await handleCallUpdate(payload.new);
          }
        )
        .subscribe();

      iceSubscription = chatDb
        .channel("klevby_call_ice_channel")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_ice_candidates" },
          async (payload) => {
            await handleIceInsert(payload.new);
          }
        )
        .subscribe();
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
        await startCall();
      }

      if (e.target.closest("#acceptCallBtn")) {
        await answerCall();
      }

      if (e.target.closest("#rejectCallBtn")) {
        await rejectCall();
      }

      if (e.target.closest("#endCallBtn")) {
        await endCall(true);
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
          radial-gradient(circle at 30% 10%, rgba(87,230,178,0.35), transparent 44%),
          linear-gradient(135deg, rgba(87,230,178,0.26), rgba(40,201,144,0.12));
        border: 1px solid rgba(87,230,178,0.22);
        color: #d7ffe8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        font-weight: 900;
        box-shadow:
          0 10px 28px rgba(0,0,0,0.28),
          inset 0 1px 0 rgba(255,255,255,0.10);
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
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 50%;
        background: rgba(255,255,255,0.055);
        color: rgba(255,255,255,0.82);
        cursor: pointer;
        font-size: 30px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .klevby-chat-call {
        font-size: 19px;
        color: #57e6b2;
        background: rgba(87,230,178,0.10);
        border-color: rgba(87,230,178,0.20);
        box-shadow: 0 0 22px rgba(87,230,178,0.10);
      }

      .klevby-call-status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(87,230,178,0.09);
      }

      .klevby-call-status-title {
        color: #d7ffe8;
        font-size: 13px;
        font-weight: 900;
        line-height: 1.15;
      }

      .klevby-call-status-text {
        margin-top: 2px;
        color: rgba(244,251,247,0.62);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
      }

      .klevby-call-end,
      .klevby-call-reject {
        min-height: 34px;
        padding: 0 12px;
        border: 0;
        border-radius: 999px;
        background: rgba(228,88,88,0.94);
        color: #fff;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .klevby-incoming-call {
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 10px;
        padding: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        background:
          radial-gradient(circle at 10% 0%, rgba(87,230,178,0.16), transparent 40%),
          rgba(255,255,255,0.045);
      }

      .klevby-incoming-icon {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 900;
        box-shadow: 0 12px 30px rgba(87,230,178,0.20);
      }

      .klevby-incoming-info {
        min-width: 0;
      }

      .klevby-incoming-title {
        color: #ffffff;
        font-size: 14px;
        font-weight: 900;
        line-height: 1.2;
      }

      .klevby-incoming-text {
        margin-top: 3px;
        color: rgba(244,251,247,0.62);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
      }

      .klevby-incoming-actions {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .klevby-call-accept {
        min-height: 38px;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
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
        margin: 10px 0;
        padding: 6px 13px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(244,251,247,0.76);
        font-size: 12px;
        font-weight: 800;
        line-height: 1;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
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
        #chat-desktop-btn {
          display: none !important;
        }

        #klevby-chat-modal.open {
          display: flex !important;
        }

        #klevby-chat-modal {
          padding: 0 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          background:
            radial-gradient(circle at 80% 8%, rgba(87,230,178,0.16), transparent 30%),
            radial-gradient(circle at 20% 0%, rgba(88,183,255,0.08), transparent 34%),
            #020b0c !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .klevby-chat-window,
        #chat-window {
          position: relative !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          background:
            radial-gradient(circle at 75% 18%, rgba(87,230,178,0.14), transparent 32%),
            radial-gradient(circle at 10% 0%, rgba(87,230,178,0.08), transparent 28%),
            linear-gradient(180deg, #061719 0%, #020909 46%, #010505 100%) !important;
        }

        .klevby-chat-header,
        #chat-header {
          min-height: 92px !important;
          padding: calc(18px + env(safe-area-inset-top)) 18px 14px !important;
          background:
            radial-gradient(circle at 70% 0%, rgba(87,230,178,0.11), transparent 38%),
            rgba(3, 15, 16, 0.76) !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          backdrop-filter: blur(22px) !important;
          -webkit-backdrop-filter: blur(22px) !important;
        }

        .klevby-chat-title {
          font-size: 20px !important;
          line-height: 1.08 !important;
          letter-spacing: -0.35px !important;
        }

        .klevby-chat-subtitle {
          margin-top: 5px !important;
          font-size: 13px !important;
        }

        .klevby-chat-avatar {
          width: 48px !important;
          height: 48px !important;
          flex: 0 0 48px !important;
          font-size: 20px !important;
        }

        .klevby-chat-pinned {
          padding: 12px 18px !important;
          background: rgba(87,230,178,0.075) !important;
        }

        .klevby-chat-tabs {
          padding: 12px 18px !important;
          gap: 12px !important;
        }

        .klevby-chat-tab {
          min-height: 54px !important;
          border-radius: 22px !important;
          font-size: 16px !important;
        }

        .klevby-private-people {
          padding: 12px 18px !important;
          gap: 10px !important;
        }

        .klevby-private-person {
          min-height: 50px !important;
          padding: 7px 14px !important;
          border-radius: 999px !important;
          font-size: 15px !important;
        }

        .klevby-private-avatar {
          width: 34px !important;
          height: 34px !important;
          font-size: 15px !important;
        }

        #chat-messages,
        .klevby-chat-messages {
          flex: 1 !important;
          padding: 16px 18px 18px !important;
          gap: 12px !important;
          background: transparent !important;
        }

        .chat-message-bubble {
          max-width: 82% !important;
        }

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
          width: 40px;
          height: 40px;
          flex-basis: 40px;
        }

        #chat-input-area,
        .klevby-chat-inputbar {
          min-height: 88px !important;
          padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) !important;
          gap: 12px !important;
          background:
            linear-gradient(180deg, rgba(3,15,16,0.72), rgba(3,15,16,0.94)) !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(22px) !important;
          -webkit-backdrop-filter: blur(22px) !important;
        }

        #message-input,
        .klevby-chat-input {
          height: 58px !important;
          min-height: 58px !important;
          max-height: 58px !important;
          line-height: 58px !important;
          padding: 0 20px !important;
          border-radius: 26px !important;
          font-size: 17px !important;
          background: rgba(255,255,255,0.075) !important;
          border: 1px solid rgba(255,255,255,0.10) !important;
          color: #ffffff !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 10px 28px rgba(0,0,0,0.18) !important;
        }

        #send-btn,
        .klevby-chat-send {
          width: 58px !important;
          height: 58px !important;
          min-width: 58px !important;
          min-height: 58px !important;
          max-width: 58px !important;
          max-height: 58px !important;
          flex: 0 0 58px !important;
          border-radius: 50% !important;
          font-size: 23px !important;
          background: linear-gradient(135deg, #57e6b2, #28c990) !important;
          color: #03150c !important;
          box-shadow:
            0 14px 34px rgba(87,230,178,0.24),
            inset 0 1px 0 rgba(255,255,255,0.20) !important;
        }

        .klevby-dialog-screen::before {
          content: "";
          position: absolute;
          inset: 118px 0 88px;
          pointer-events: none;
          opacity: 0.11;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(87,230,178,0.18) 0 1px, transparent 2px),
            radial-gradient(circle at 70% 30%, rgba(255,255,255,0.10) 0 1px, transparent 2px);
          background-size: 58px 58px, 82px 82px;
        }

        .klevby-dialog-screen #chat-header,
        .klevby-dialog-screen .klevby-chat-header {
          min-height: 118px !important;
          padding: calc(30px + env(safe-area-inset-top)) 24px 18px !important;
          background:
            radial-gradient(circle at 70% 0%, rgba(87,230,178,0.14), transparent 38%),
            rgba(3, 15, 16, 0.72) !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          backdrop-filter: blur(22px) !important;
          -webkit-backdrop-filter: blur(22px) !important;
        }

        .klevby-dialog-screen .klevby-chat-pinned,
        .klevby-dialog-screen .klevby-chat-tabs,
        .klevby-dialog-screen .klevby-private-people,
        .klevby-dialog-screen #close-chat {
          display: none !important;
        }

        .klevby-dialog-screen #back-chat {
          display: flex !important;
          width: 52px !important;
          height: 52px !important;
          flex: 0 0 52px !important;
          font-size: 42px !important;
          color: #57e6b2 !important;
          background: rgba(255,255,255,0.055) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .klevby-dialog-screen #call-chat {
          display: flex !important;
          width: 52px !important;
          height: 52px !important;
          flex: 0 0 52px !important;
          font-size: 22px !important;
          color: #57e6b2 !important;
          background: rgba(87,230,178,0.10) !important;
          border-color: rgba(87,230,178,0.20) !important;
          box-shadow: 0 0 22px rgba(87,230,178,0.12) !important;
        }

        .klevby-dialog-screen .klevby-chat-head-main {
          gap: 14px !important;
        }

        .klevby-dialog-screen .klevby-chat-avatar {
          width: 58px !important;
          height: 58px !important;
          flex: 0 0 58px !important;
          font-size: 24px !important;
          background: linear-gradient(135deg, #57e6b2, #28c990) !important;
          color: #03150c !important;
          border-color: rgba(87,230,178,0.28) !important;
          box-shadow: 0 14px 32px rgba(87,230,178,0.18) !important;
        }

        .klevby-dialog-screen .klevby-chat-title {
          font-size: 24px !important;
          line-height: 1.05 !important;
          letter-spacing: -0.4px !important;
        }

        .klevby-dialog-screen .klevby-chat-subtitle {
          margin-top: 6px !important;
          font-size: 16px !important;
          color: #57e6b2 !important;
        }

        .klevby-dialog-screen #chat-messages,
        .klevby-dialog-screen .klevby-chat-messages {
          position: relative;
          flex: 1 !important;
          padding: 22px 18px 22px !important;
          gap: 14px !important;
          background: transparent !important;
        }

        .klevby-dialog-screen .chat-empty-state {
          background: rgba(255,255,255,0.055) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 22px !important;
          max-width: 310px !important;
          padding: 18px 20px !important;
          font-size: 15px !important;
          color: rgba(244,251,247,0.72) !important;
        }

        .klevby-dialog-screen .chat-message-row {
          gap: 8px !important;
          align-items: flex-end !important;
        }

        .klevby-dialog-screen .klevby-message-avatar {
          display: none !important;
        }

        .klevby-dialog-screen .chat-message-bubble {
          max-width: 76% !important;
          padding: 13px 15px 10px !important;
          border-radius: 24px !important;
          box-shadow: 0 14px 34px rgba(0,0,0,0.24) !important;
        }

        .klevby-dialog-screen .other-message {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.105), rgba(255,255,255,0.055)) !important;
          border: 1px solid rgba(255,255,255,0.09) !important;
          color: #f4fbf7 !important;
          border-radius: 24px 24px 24px 5px !important;
          backdrop-filter: blur(18px) !important;
          -webkit-backdrop-filter: blur(18px) !important;
        }

        .klevby-dialog-screen .my-message {
          background:
            linear-gradient(135deg, rgba(87,230,178,0.62), rgba(40,201,144,0.48)) !important;
          color: #eafff5 !important;
          border: 1px solid rgba(87,230,178,0.28) !important;
          border-radius: 24px 24px 5px 24px !important;
          box-shadow:
            0 14px 36px rgba(40,201,144,0.18),
            inset 0 1px 0 rgba(255,255,255,0.12) !important;
        }

        .klevby-dialog-screen .my-message .chat-message-author,
        .klevby-dialog-screen .my-message .chat-message-text,
        .klevby-dialog-screen .my-message .chat-message-time,
        .klevby-dialog-screen .my-message .klevby-checks {
          color: #eafff5 !important;
        }

        .klevby-dialog-screen .chat-message-author {
          margin-bottom: 4px !important;
          font-size: 12px !important;
          opacity: 0.66 !important;
        }

        .klevby-dialog-screen .chat-message-text {
          font-size: 18px !important;
          line-height: 1.35 !important;
          font-weight: 600 !important;
        }

        .klevby-dialog-screen .chat-message-time,
        .klevby-dialog-screen .klevby-checks {
          font-size: 13px !important;
          opacity: 0.62 !important;
        }

        .klevby-dialog-screen .klevby-date-divider {
          margin: 16px 0 !important;
          padding: 7px 14px !important;
          font-size: 14px !important;
          background: rgba(255,255,255,0.075) !important;
          color: rgba(244,251,247,0.84) !important;
        }

        .klevby-dialog-screen .klevby-message-actions {
          top: -13px !important;
          right: 10px !important;
          opacity: 0.78 !important;
          pointer-events: auto !important;
        }

        .klevby-dialog-screen .klevby-message-action {
          width: 27px !important;
          height: 27px !important;
          font-size: 13px !important;
          background: rgba(4,14,15,0.86) !important;
        }

        .klevby-dialog-screen #chat-input-area,
        .klevby-dialog-screen .klevby-chat-inputbar {
          min-height: 96px !important;
          padding: 14px 14px calc(14px + env(safe-area-inset-bottom)) !important;
          gap: 12px !important;
          background:
            linear-gradient(180deg, rgba(3,15,16,0.74), rgba(3,15,16,0.94)) !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(22px) !important;
          -webkit-backdrop-filter: blur(22px) !important;
        }

        .klevby-dialog-screen #message-input,
        .klevby-dialog-screen .klevby-chat-input {
          height: 60px !important;
          min-height: 60px !important;
          max-height: 60px !important;
          line-height: 60px !important;
          padding: 0 20px !important;
          border-radius: 28px !important;
          font-size: 18px !important;
          background: rgba(255,255,255,0.075) !important;
          border: 1px solid rgba(255,255,255,0.10) !important;
          color: #ffffff !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 10px 28px rgba(0,0,0,0.18) !important;
        }

        .klevby-dialog-screen #message-input::placeholder,
        .klevby-dialog-screen .klevby-chat-input::placeholder {
          color: rgba(255,255,255,0.34) !important;
        }

        .klevby-dialog-screen #send-btn,
        .klevby-dialog-screen .klevby-chat-send {
          width: 60px !important;
          height: 60px !important;
          min-width: 60px !important;
          min-height: 60px !important;
          max-width: 60px !important;
          max-height: 60px !important;
          flex: 0 0 60px !important;
          border-radius: 50% !important;
          font-size: 24px !important;
          background: linear-gradient(135deg, #57e6b2, #28c990) !important;
          color: #03150c !important;
          box-shadow:
            0 14px 34px rgba(87,230,178,0.24),
            inset 0 1px 0 rgba(255,255,255,0.20) !important;
        }

        .klevby-dialog-screen .klevby-reply-preview {
          background: rgba(87,230,178,0.10) !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
