(function () {
  if (window.KlevbyChatPublic) {
    return;
  }

  let ctx = null;
  const sentLocalMessages = new Set();

  function init(options = {}) {
    // Public chat ownership:
    // - public timeline loading/sending orchestration
    // - optional enrichment/profile hydration
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

  async function runWithAbortableTimeout(stepName, timeoutMs, runner, options = {}) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const startedAt = Date.now();
    const silent = options?.silent === true;
    let timer = null;

    if (!silent) {
      console.info("[KlevbyChatPublic] step start", { step: stepName, timeoutMs });
    }

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

      if (!silent) {
        console.info("[KlevbyChatPublic] step end", {
          step: stepName,
          durationMs: Date.now() - startedAt
        });
      }

      return result;
    } catch (error) {
      if (!silent) {
        console.warn("[KlevbyChatPublic] step fail", {
          step: stepName,
          durationMs: Date.now() - startedAt,
          code: error?.code || null,
          message: String(error?.message || error)
        });
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const publicOptionalSkipLogState = {
    shown: false,
    steps: new Set()
  };

  function logPublicOptionalSkip(step) {
    if (!publicOptionalSkipLogState.steps.has(step)) {
      publicOptionalSkipLogState.steps.add(step);
      console.debug("[KlevbyChatPublic] optional enrichment detail", { step });
    }

    if (publicOptionalSkipLogState.shown) return;

    publicOptionalSkipLogState.shown = true;
    console.info("[KlevbyChatPublic] optional enrichment skipped");
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
  function scrollChatToBottom() {
    if (getCtx().scrollChatToBottom) {
      getCtx().scrollChatToBottom();
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

  const PUBLIC_CACHE_VERSION = 1;
  const PUBLIC_CACHE_LIMIT = 80;
  const PUBLIC_CACHE_TTL_MS = 30 * 60 * 1000;
  const PUBLIC_CACHE_KEY_PREFIX = "klevby_chat_public_cache_v1";

  function getPublicCacheOwnerKey() {
    const currentUser = getCurrentUser();
    const userId = String(currentUser?.id || "").trim();

    if (isValidSupabaseUuid(userId)) {
      return userId;
    }

    return "guest";
  }

  function getPublicCacheKey() {
    return `${PUBLIC_CACHE_KEY_PREFIX}_${getPublicCacheOwnerKey()}`;
  }

  function normalizePublicMessageForCache(message) {
    if (!message || typeof message !== "object") return null;

    const content = String(message.content || "");
    const userName = String(message.user_name || "");
    const createdAt = String(message.created_at || "");

    if (!content || !createdAt) return null;

    return {
      id: message.id || null,
      created_at: createdAt,
      user_id: message.user_id || null,
      user_name: userName,
      content
    };
  }

  function normalizePublicMessagesForCache(messages) {
    if (!Array.isArray(messages)) return [];

    return messages
      .map(normalizePublicMessageForCache)
      .filter(Boolean)
      .slice(-PUBLIC_CACHE_LIMIT);
  }

  function readPublicMessagesCache() {
    try {
      const raw = localStorage.getItem(getPublicCacheKey());
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed?.savedAt || 0);
      const version = Number(parsed?.version || 0);

      if (version !== PUBLIC_CACHE_VERSION || !savedAt) {
        localStorage.removeItem(getPublicCacheKey());
        return [];
      }

      if (Date.now() - savedAt > PUBLIC_CACHE_TTL_MS) {
        localStorage.removeItem(getPublicCacheKey());
        return [];
      }

      const messages = normalizePublicMessagesForCache(parsed?.messages || []);
      if (!messages.length) return [];

      return messages;
    } catch (error) {
      try {
        localStorage.removeItem(getPublicCacheKey());
      } catch (_) {}
      console.debug("[KlevbyChatPublic] public cache read skipped", {
        error: String(error?.message || error)
      });
      return [];
    }
  }

  function savePublicMessagesCache(messages) {
    try {
      const normalized = normalizePublicMessagesForCache(messages);
      if (!normalized.length) return;

      localStorage.setItem(getPublicCacheKey(), JSON.stringify({
        version: PUBLIC_CACHE_VERSION,
        savedAt: Date.now(),
        count: normalized.length,
        messages: normalized
      }));
    } catch (error) {
      console.debug("[KlevbyChatPublic] public cache save skipped", {
        error: String(error?.message || error)
      });
    }
  }

  function rememberPublicFallbackProfiles(messages) {
    (messages || []).forEach((message) => {
      if (message.user_id && message.user_name) {
        rememberFallbackProfile(message.user_id, message.user_name);
      }
    });
  }

  function renderPublicMessages(data, { source = "rest" } = {}) {
    if (!Array.isArray(data) || !data.length) return false;

    rememberPublicFallbackProfiles(data);
    clearMessages();
    renderMessageList(data, renderPublicMessage);
    scrollChatToBottom();

    console.info("[KlevbyChatPublic] public render", {
      source,
      rows: data.length
    });

    return true;
  }


  async function loadPublicMessagesViaRest(signal) {
    const config = window.KLEVB_CONFIG || {};
    const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");
    const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase REST config не найден для общего чата.");
    }

    const endpoint =
      `${supabaseUrl}/rest/v1/messages?select=id,created_at,user_id,user_name,content&order=created_at.desc&limit=100`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      },
      signal: signal || undefined
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (_) {}
      throw new Error(`Supabase REST messages failed: ${response.status} ${response.statusText} ${errorText}`.trim());
    }

    const data = await response.json();
    return { data, error: null };
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
      if (chatSubtitle) chatSubtitle.textContent = "Общий разговор Klevgo";

      if (input) {
        input.placeholder = "Напиши сообщение...";
        input.disabled = false;
      }

      if (sendBtn) {
        sendBtn.disabled = false;
      }

      syncSelectedPeerForCalls();
      clearMessages();

      const cachedMessages = readPublicMessagesCache();
      const hasCachedMessages = Boolean(cachedMessages.length);

      if (hasCachedMessages && !isStaleNavigation(navToken)) {
        console.info("[KlevbyChatPublic] public cache render start", {
          rows: cachedMessages.length
        });
        renderPublicMessages(cachedMessages, { source: "cache" });
        console.info("[KlevbyChatPublic] public cache render end");
      }

      const result = await runWithAbortableTimeout("messages REST", 6500, (signal) =>
        loadPublicMessagesViaRest(signal)
      );

      if (isStaleNavigation(navToken)) return;

      if (result.error) {
        console.error("Ошибка загрузки общего чата:", result.error);
        if (!hasCachedMessages) {
          showEmptyState("Не удалось загрузить общий чат. Проверь интернет и обнови приложение.");
        }
        return;
      }

      const data = Array.isArray(result.data) ? result.data.slice().reverse() : [];

      if (!data.length) {
        clearMessages();
        showEmptyState("Пока сообщений нет. Напиши первым 🎣");
      } else {
        console.info("[KlevbyChatPublic] public render first start");
        await runWithAbortableTimeout("render", 3000, async () => {
          renderPublicMessages(data, { source: "rest" });
        });
        savePublicMessagesCache(data);
        console.info("[KlevbyChatPublic] public render first end");
      }

      Promise.resolve()
        .then(async () => {
          console.info("[KlevbyChatPublic] public profile enrichment start");
          await runWithAbortableTimeout("profiles select", 3000, async () => {
            return loadProfilesByIds(data.map((message) => message.user_id));
          }, { silent: true });
          console.info("[KlevbyChatPublic] public profile enrichment end");
        })
        .catch(() => {
          logPublicOptionalSkip("profiles select");
        });
    } catch (error) {
      if (!isStaleNavigation(navToken)) {
        console.error("Ошибка загрузки общего чата:", error);
        if (error?.code === "CHAT_PUBLIC_TIMEOUT" && error?.step === "messages REST") {
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

      Promise.resolve()
        .then(() => ensureCurrentUserProfile({ soft: true }))
        .catch((error) => {
          console.warn("[KlevbyChatPublic] ensureCurrentUserProfile skipped", {
            error: String(error?.message || error)
          });
        });

      sentLocalMessages.add(`${userName}__${content}`);

      const config = window.KLEVB_CONFIG || {};
      const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "")
        .trim()
        .replace(/\/$/, "");
      const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();

      if (!supabaseUrl || !supabaseAnonKey) {
        alert("Supabase REST config для общего чата не найден.");
        return;
      }

      const endpoint = `${supabaseUrl}/rest/v1/messages`;
      const startedAt = Date.now();
      console.info("[KlevbyChatPublic] send REST start", { endpoint });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
      const durationMs = Date.now() - startedAt;
      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (_) {
        responseBody = null;
      }
      console.info("[KlevbyChatPublic] send REST end", { status: response.status, durationMs });

      if (!response.ok) {
        console.error("Ошибка отправки общего сообщения:", { status: response.status, durationMs, responseBody });
        alert("Не получилось отправить сообщение. Проверь таблицу messages и RLS.");
        return;
      }

      const insertedMessage = Array.isArray(responseBody) ? (responseBody[0] || null) : responseBody;
      const uiMessage = insertedMessage || {
        id: `local-public-${Date.now()}`,
        user_id: payload.user_id || null,
        user_name: payload.user_name,
        content: payload.content,
        created_at: new Date().toISOString()
      };

      console.info("[KlevbyChatPublic] append sent message start", { hasInsertedMessage: Boolean(insertedMessage) });
      try {
        renderPublicMessage(uiMessage);
        scrollChatToBottom();
        console.info("[KlevbyChatPublic] append sent message end");
      } catch (appendError) {
        console.error("[KlevbyChatPublic] append sent message fail", { error: String(appendError?.message || appendError) });
      }

      if (input) input.value = "";
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
