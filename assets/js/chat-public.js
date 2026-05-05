(function () {
  if (window.KlevbyChatPublic) {
    return;
  }

  let ctx = null;
  const sentLocalMessages = new Set();

  function init(options = {}) {
    ctx = options || {};
  }

  function getCtx() {
    if (!ctx) {
      throw new Error("KlevbyChatPublic не инициализирован. Проверь подключение chat-public.js перед chat.js");
    }

    return ctx;
  }

  function getElement(name) {
    return getCtx().elements?.[name] || null;
  }

  function getCurrentUser() {
    return getCtx().getCurrentUser ? getCtx().getCurrentUser() : null;
  }

  function setActiveMode(mode) {
    if (getCtx().setActiveMode) {
      getCtx().setActiveMode(mode);
    }
  }

  function setSelectedPeer(peer) {
    if (getCtx().setSelectedPeer) {
      getCtx().setSelectedPeer(peer);
    }
  }

  function beginNavigationIfNeeded(navToken) {
    if (navToken) return navToken;
    return getCtx().beginChatNavigation ? getCtx().beginChatNavigation() : Date.now();
  }

  function isStaleNavigation(navToken) {
    return getCtx().isStaleNavigation ? getCtx().isStaleNavigation(navToken) : false;
  }

  function finishChatNavigation(navToken) {
    if (getCtx().finishChatNavigation) {
      getCtx().finishChatNavigation(navToken);
    }
  }

  function getMainSupabaseClient() {
    return getCtx().getMainSupabaseClient ? getCtx().getMainSupabaseClient() : null;
  }

  async function refreshCurrentUser(options = {}) {
    if (getCtx().refreshCurrentUser) {
      return await getCtx().refreshCurrentUser(options);
    }

    return getCurrentUser();
  }

  async function ensureCurrentUserProfile(options = {}) {
    if (getCtx().ensureCurrentUserProfile) {
      return await getCtx().ensureCurrentUserProfile(options);
    }
  }

  async function loadProfilesByIds(ids = []) {
    if (getCtx().loadProfilesByIds) {
      return await getCtx().loadProfilesByIds(ids);
    }
  }

  function rememberFallbackProfile(userId, name) {
    if (getCtx().rememberFallbackProfile) {
      getCtx().rememberFallbackProfile(userId, name);
    }
  }

  function renderPublicMessage(message) {
    if (getCtx().renderPublicMessage) {
      getCtx().renderPublicMessage(message);
    }
  }

  function renderMessageList(data, renderFn) {
    if (getCtx().renderMessageList) {
      getCtx().renderMessageList(data, renderFn);
    }
  }

  function clearMessages() {
    if (getCtx().clearMessages) {
      getCtx().clearMessages();
    }
  }

  function showEmptyState(text) {
    if (getCtx().showEmptyState) {
      getCtx().showEmptyState(text);
    }
  }

  function clearReply() {
    if (getCtx().clearReply) {
      getCtx().clearReply();
    }
  }

  function syncSelectedPeerForCalls() {
    if (getCtx().syncSelectedPeerForCalls) {
      getCtx().syncSelectedPeerForCalls();
    }
  }

  function getCurrentChatName() {
    return getCtx().getCurrentChatName ? getCtx().getCurrentChatName() : "Рыбак";
  }

  function cleanDisplayName(value) {
    return getCtx().cleanDisplayName ? getCtx().cleanDisplayName(value) : String(value || "").trim();
  }

  function isValidSupabaseUuid(value) {
    return getCtx().isValidSupabaseUuid ? getCtx().isValidSupabaseUuid(value) : false;
  }

  function buildMessageContent(value) {
    return getCtx().buildMessageContent ? getCtx().buildMessageContent(value) : value;
  }

  function getLocalMessageKey(message) {
    return `${message.user_name || ""}__${message.content || ""}`;
  }

  function isMyPublicMessage(message) {
    const currentChatUser = getCurrentUser();
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

  async function loadPublicMessages(navToken) {
    navToken = beginNavigationIfNeeded(navToken);

    const chatWindow = getElement("chatWindow");
    const input = getElement("input");
    const sendBtn = getElement("sendBtn");
    const publicTab = getElement("publicTab");
    const privateTab = getElement("privateTab");
    const privatePeople = getElement("privatePeople");
    const backBtn = getElement("backBtn");
    const chatAvatar = getElement("chatAvatar");
    const chatTitle = getElement("chatTitle");
    const chatSubtitle = getElement("chatSubtitle");

    try {
      setActiveMode("public");
      setSelectedPeer(null);
      clearReply();

      if (chatWindow) {
        chatWindow.classList.remove("klevby-dialog-screen");
        chatWindow.classList.remove("klevby-private-list-screen");
      }

      if (publicTab) publicTab.classList.add("active");
      if (privateTab) privateTab.classList.remove("active");
      if (privatePeople) privatePeople.classList.add("hidden");
      if (backBtn) backBtn.classList.add("hidden");

      if (chatAvatar) chatAvatar.textContent = "🎣";
      if (chatTitle) chatTitle.textContent = "Чат рыбаков";
      if (chatSubtitle) chatSubtitle.textContent = "Общий разговор Klevby";

      if (input) {
        input.placeholder = "Напиши сообщение...";
        input.disabled = false;
      }

      if (sendBtn) {
        sendBtn.disabled = false;
      }

      syncSelectedPeerForCalls();
      clearMessages();

      const client = getMainSupabaseClient();

      if (!client?.from) {
        showEmptyState("Supabase client для общего чата не найден.");
        return;
      }

      const result = await client
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (isStaleNavigation(navToken)) return;

      if (result.error) {
        console.error("Ошибка загрузки общего чата:", result.error);
        showEmptyState("Не удалось загрузить общий чат. Проверь интернет и обнови приложение.");
        return;
      }

      const data = Array.isArray(result.data) ? result.data : [];

      data.forEach((message) => {
        if (message.user_id && message.user_name) {
          rememberFallbackProfile(message.user_id, message.user_name);
        }
      });

      await loadProfilesByIds(data.map((message) => message.user_id));

      if (isStaleNavigation(navToken)) return;

      if (!data.length) {
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
        return;
      }

      renderMessageList(data, renderPublicMessage);
    } catch (error) {
      if (!isStaleNavigation(navToken)) {
        console.error("Ошибка загрузки общего чата:", error);
        showEmptyState("Не удалось загрузить общий чат. Проверь интернет и обнови приложение.");
      }
    } finally {
      finishChatNavigation(navToken);
    }
  }

  async function sendPublicMessage() {
    const input = getElement("input");
    const sendBtn = getElement("sendBtn");
    const rawVal = String(input?.value || "").trim();

    if (!rawVal) return;

    try {
      await refreshCurrentUser();
      await ensureCurrentUserProfile({ soft: true });

      if (sendBtn) {
        sendBtn.disabled = true;
      }

      const currentChatUser = getCurrentUser();
      const userId = currentChatUser?.id || null;
      const userName = getCurrentChatName();
      const content = buildMessageContent(rawVal);

      const payload = {
        user_name: userName,
        content
      };

      if (userId && isValidSupabaseUuid(userId)) {
        payload.user_id = userId;
      }

      sentLocalMessages.add(`${userName}__${content}`);

      const client = getMainSupabaseClient();

      if (!client?.from) {
        alert("Supabase client для общего чата не найден.");
        return;
      }

      const { error } = await client.from("messages").insert([payload]);

      if (error) {
        console.error("Ошибка отправки общего сообщения:", error);
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return;
      }

      if (input) {
        input.value = "";
      }

      clearReply();

      setTimeout(() => {
        sentLocalMessages.delete(`${userName}__${content}`);
      }, 30000);
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
      }
    }
  }

  window.KlevbyChatPublic = {
    init,
    loadPublicMessages,
    sendPublicMessage,
    isMyPublicMessage
  };
})();
