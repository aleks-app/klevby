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

  function createTimeoutError(stepName, timeoutMs) {
    const error = new Error(`Klevby chat public: step "${stepName}" timed out after ${timeoutMs}ms.`);
    error.name = "KlevbyChatPublicTimeoutError";
    error.code = "CHAT_PUBLIC_TIMEOUT";
    error.step = stepName;
    error.timeoutMs = timeoutMs;
    return error;
  }

  async function runWithAbortableTimeout(stepName, timeoutMs, runner) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const startedAt = Date.now();
    let timer = null;

    console.info("[KlevbyChatPublic] step start", { step: stepName, timeoutMs });

    try {
      const result = await Promise.race([
        Promise.resolve().then(() => runner(controller?.signal || null)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            if (controller) {
              try {
                controller.abort();
              } catch (_) {}
            }
            reject(createTimeoutError(stepName, timeoutMs));
          }, timeoutMs);
        })
      ]);

      console.info("[KlevbyChatPublic] step end", {
        step: stepName,
        durationMs: Date.now() - startedAt
      });

      return result;
    } catch (error) {
      console.warn("[KlevbyChatPublic] step fail", {
        step: stepName,
        durationMs: Date.now() - startedAt,
        code: error?.code || null,
        message: String(error?.message || error)
      });
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
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
      console.info("[KlevbyChatPublic] loadPublicMessages start");
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

      const result = await runWithAbortableTimeout("messages select", 6500, (signal) => {
        const query = client
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (signal && typeof query.abortSignal === "function") {
          query.abortSignal(signal);
        }

        return query;
      });

      if (isStaleNavigation(navToken)) return;

      if (result.error) {
        console.error("Ошибка загрузки общего чата:", result.error);
        showEmptyState("Не удалось загрузить общий чат. Проверь интернет и обнови приложение.");
        return;
      }

      const data = Array.isArray(result.data) ? result.data.slice().reverse() : [];

      data.forEach((message) => {
        if (message.user_id && message.user_name) {
          rememberFallbackProfile(message.user_id, message.user_name);
        }
      });

      await runWithAbortableTimeout("profiles select", 5000, async () => {
        return loadProfilesByIds(data.map((message) => message.user_id));
      });

      if (isStaleNavigation(navToken)) return;

      if (!data.length) {
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
        return;
      }

      await runWithAbortableTimeout("render", 3000, async () => {
        renderMessageList(data, renderPublicMessage);
      });
    } catch (error) {
      if (!isStaleNavigation(navToken)) {
        console.error("Ошибка загрузки общего чата:", error);
        if (error?.code === "CHAT_PUBLIC_TIMEOUT" && error?.step === "messages select") {
          showEmptyState("Чат временно недоступен (таймаут загрузки). Закрой и открой чат ещё раз.");
        } else {
          showEmptyState("Не удалось загрузить общий чат. Проверь интернет и обнови приложение.");
        }
      }
    } finally {
      console.info("[KlevbyChatPublic] loadPublicMessages end");
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
