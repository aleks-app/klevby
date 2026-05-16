(function () {
  if (window.KlevbyChatRender) {
    return;
  }

  let ctx = null;
  let lastRenderedDateKey = "";
  let lastRenderedMessageMeta = null;
  let contextMessageData = null;

  function init(options = {}) {
    ctx = options || {};
    resetRenderState();
    contextMessageData = null;
  }

  function getCtx() {
    if (!ctx) {
      throw new Error("KlevbyChatRender не инициализирован. Проверь подключение chat-render.js перед chat.js");
    }

    return ctx;
  }

  function getElement(name) {
    return getCtx().elements?.[name] || null;
  }

  function getMessagesContainer() {
    return getElement("messagesContainer");
  }

  function getMessageContextMenu() {
    return getElement("messageContextMenu");
  }

  function getContextDeleteBtn() {
    return getElement("contextDeleteBtn");
  }

  function getCurrentUser() {
    return getCtx().getCurrentUser ? getCtx().getCurrentUser() : null;
  }

  function getSelectedPeer() {
    return getCtx().getSelectedPeer ? getCtx().getSelectedPeer() : null;
  }

  function rememberFallbackProfile(userId, name) {
    if (getCtx().rememberFallbackProfile) {
      getCtx().rememberFallbackProfile(userId, name);
    }
  }

  function getProfileName(userId, fallback = "Рыбак") {
    return getCtx().getProfileName ? getCtx().getProfileName(userId, fallback) : cleanDisplayName(fallback) || "Рыбак";
  }

  function isMyPublicMessage(message) {
    if (getCtx().isMyPublicMessage) {
      return getCtx().isMyPublicMessage(message);
    }

    return false;
  }

  function isMyPrivateMessage(message) {
    const currentChatUser = getCurrentUser();
    return currentChatUser?.id && String(message.sender_id) === String(currentChatUser.id);
  }

  function scrollChatToBottom() {
    if (getCtx().scrollChatToBottom) {
      getCtx().scrollChatToBottom();
      return;
    }

    const messagesContainer = getMessagesContainer();

    if (!messagesContainer) return;

    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
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
    const messagesContainer = getMessagesContainer();
    if (!messagesContainer) return;

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
    const messagesContainer = getMessagesContainer();

    if (messagesContainer) {
      messagesContainer.innerHTML = "";
    }

    resetRenderState();
    hideMessageMenu();
  }

  function showEmptyState(text) {
    const messagesContainer = getMessagesContainer();

    clearMessages();

    if (!messagesContainer) return;

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

  function shouldGroupWithPrevious(meta) {
    if (!lastRenderedMessageMeta) return false;
    if (lastRenderedMessageMeta.type !== meta.type) return false;
    if (lastRenderedMessageMeta.authorKey !== meta.authorKey) return false;
    if (lastRenderedMessageMeta.isMine !== meta.isMine) return false;

    return Math.abs(meta.timeStamp - lastRenderedMessageMeta.timeStamp) <= 5 * 60 * 1000;
  }

  function updatePreviousGroupClass(groupedWithPrevious) {
    if (!groupedWithPrevious) return;

    const messagesContainer = getMessagesContainer();
    if (!messagesContainer) return;

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
    const messagesContainer = getMessagesContainer();
    if (!messagesContainer) return;

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
    const messagesContainer = getMessagesContainer();
    if (!messagesContainer) return;
    const messageId = String(message?.id || "").trim();

    if (messageId) {
      const duplicateRow = messagesContainer.querySelector(
        `[data-message-type="private"][data-message-id="${cssEscape(messageId)}"]`
      );

      if (duplicateRow) {
        console.log("[KlevbyRender] duplicate private message skipped", messageId);
        return;
      }
    }

    const selectedPeer = getSelectedPeer();

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

    if (messageId) {
      row.dataset.messageType = "private";
      row.dataset.messageId = messageId;
    }

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
    const messageContextMenu = getMessageContextMenu();
    const contextDeleteBtn = getContextDeleteBtn();

    if (!messageContextMenu) return;

    const data = findMessageDataFromRow(row);
    if (!data) return;

    contextMessageData = data;

    if (contextDeleteBtn) {
      contextDeleteBtn.classList.toggle("hidden", !data.isMine || !data.id);
    }

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
    const messageContextMenu = getMessageContextMenu();

    contextMessageData = null;

    if (!messageContextMenu) return;

    messageContextMenu.classList.add("hidden");
    messageContextMenu.style.left = "";
    messageContextMenu.style.top = "";
  }

  function getContextMessageData() {
    return contextMessageData;
  }

  window.KlevbyChatRender = {
    init,
    escapeHtml,
    cssEscape,
    getInitials,
    getMessageTime,
    getTimestamp,
    parseReplyContent,
    clearMessages,
    showEmptyState,
    renderPublicMessage,
    renderPrivateMessage,
    renderMessageList,
    findMessageDataFromRow,
    showMessageMenu,
    hideMessageMenu,
    getContextMessageData
  };
})();
