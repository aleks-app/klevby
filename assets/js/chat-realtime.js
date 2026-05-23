(function () {
  if (window.KlevbyChatRealtime) {
    return;
  }

  let ctx = null;

  let publicSubscription = null;
  let privateSubscription = null;
  let presenceChannel = null;
  let presenceChannelKey = "";
  let presenceRecreatePromise = null;
  let reconnectDebounceTimer = null;
  let reconnectInFlightPromise = null;
  const RECONNECT_DEBOUNCE_MS = 800;

  function getClient() {
    return ctx && typeof ctx.getSupabaseClient === "function"
      ? ctx.getSupabaseClient()
      : null;
  }

  function getCurrentUser() {
    return ctx && typeof ctx.getCurrentUser === "function"
      ? ctx.getCurrentUser()
      : null;
  }

  function getActiveMode() {
    return ctx && typeof ctx.getActiveMode === "function"
      ? ctx.getActiveMode()
      : "public";
  }

  function getSelectedPeer() {
    return ctx && typeof ctx.getSelectedPeer === "function"
      ? ctx.getSelectedPeer()
      : null;
  }

  function getMessagesContainer() {
    return ctx && typeof ctx.getMessagesContainer === "function"
      ? ctx.getMessagesContainer()
      : document.getElementById("chat-messages");
  }

  function getChatSubtitle() {
    return ctx && typeof ctx.getChatSubtitle === "function"
      ? ctx.getChatSubtitle()
      : null;
  }

  function safeCall(name, ...args) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;

    try {
      return ctx[name](...args);
    } catch (error) {
      console.warn("KlevbyChatRealtime:", name, "ошибка:", error);
      return undefined;
    }
  }

  async function safeAsyncCall(name, ...args) {
    if (!ctx || typeof ctx[name] !== "function") return undefined;

    try {
      return await ctx[name](...args);
    } catch (error) {
      console.warn("KlevbyChatRealtime:", name, "ошибка:", error);
      return undefined;
    }
  }

  function runAsync(name, ...args) {
    if (!ctx || typeof ctx[name] !== "function") return;

    Promise.resolve()
      .then(() => ctx[name](...args))
      .catch((error) => {
        console.warn("KlevbyChatRealtime:", name, "ошибка:", error);
      });
  }

  function isValidSupabaseUuid(value) {
    if (ctx && typeof ctx.isValidSupabaseUuid === "function") {
      return ctx.isValidSupabaseUuid(value);
    }

    const id = String(value || "").trim();

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function hasMessageRow(messageType, messageId) {
    const id = String(messageId || "").trim();
    if (!id) return false;

    const messagesContainer = getMessagesContainer();
    if (!messagesContainer) return false;

    return Boolean(
      messagesContainer.querySelector(
        `[data-message-id="${cssEscape(id)}"][data-message-type="${cssEscape(messageType)}"]`
      )
    );
  }

  function isTerminalRealtimeStatus(status) {
    return (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    );
  }

  function scheduleReconnect(source) {
    if (reconnectInFlightPromise) {
      console.info("[KlevbyRealtime] reconnect skipped because already scheduled/running", {
        source,
        reason: "running"
      });
      return;
    }

    if (reconnectDebounceTimer) {
      console.info("[KlevbyRealtime] reconnect skipped because already scheduled/running", {
        source,
        reason: "scheduled"
      });
      return;
    }

    console.info("[KlevbyRealtime] reconnect requested", { source });

    reconnectDebounceTimer = setTimeout(() => {
      reconnectDebounceTimer = null;

      reconnectInFlightPromise = Promise.resolve()
        .then(() => reconnectRealtimeConnections())
        .then(() => {
          console.info("[KlevbyRealtime] reconnect completed", { source });
        })
        .catch((error) => {
          console.warn("[KlevbyRealtime] reconnect failed", { source, error });
        })
        .finally(() => {
          reconnectInFlightPromise = null;
        });
    }, RECONNECT_DEBOUNCE_MS);
  }

  function getPresenceUserId() {
    const userId = String(getCurrentUser()?.id || "").trim();
    return isValidSupabaseUuid(userId) ? userId : "";
  }

  function getPresenceKey() {
    const userId = getPresenceUserId();

    if (userId) return userId;

    return String(safeCall("getGuestName") || "guest").trim() || "guest";
  }

  function isOnline(userId) {
    if (!userId) return false;

    const onlineUsers = ctx && ctx.onlineUsers ? ctx.onlineUsers : null;

    return Boolean(
      onlineUsers &&
      typeof onlineUsers.has === "function" &&
      onlineUsers.has(String(userId))
    );
  }

  function getUserStatusText(userId) {
    if (!userId) return "Был недавно";
    return isOnline(userId) ? "Онлайн" : "Был недавно";
  }

  function updateSelectedPeerStatus() {
    const activeMode = getActiveMode();
    const selectedPeer = getSelectedPeer();

    if (activeMode !== "private" || !selectedPeer) return;

    const chatSubtitle = getChatSubtitle();

    if (!chatSubtitle) return;

    chatSubtitle.textContent = getUserStatusText(selectedPeer.id);
  }

  async function removePresenceChannel(reason = "cleanup") {
    const client = getClient();
    const channel = presenceChannel;

    presenceChannel = null;
    presenceChannelKey = "";

    if (!channel || !client || typeof client.removeChannel !== "function") return;

    try {
      console.info("[KlevbyRealtime] presence remove", { reason });
      await client.removeChannel(channel);
    } catch (error) {
      console.warn("Не удалось удалить старый presence channel:", error);
    }
  }

  function trackPresence() {
    if (!presenceChannel) return;

    const user = getCurrentUser();
    const userId = isValidSupabaseUuid(user?.id) ? String(user.id) : null;

    console.info("[KlevbyRealtime] presence track", {
      channelKey: presenceChannelKey,
      userId,
      activeMode: getActiveMode(),
      selectedPeerId: getSelectedPeer()?.id || null
    });

    presenceChannel.track({
      user_id: userId,
      name: safeCall("getCurrentChatName") || "Рыбак",
      online_at: new Date().toISOString()
    });

    updateSelectedPeerStatus();
  }

  async function setupPresence() {
    try {
      const client = getClient();

      if (!client || typeof client.channel !== "function") return;

      const currentKey = getPresenceKey();
      const currentUserId = getPresenceUserId();

      if (
        presenceChannel &&
        currentUserId &&
        presenceChannelKey &&
        presenceChannelKey !== currentUserId
      ) {
        if (!presenceRecreatePromise) {
          presenceRecreatePromise = (async () => {
            await removePresenceChannel("presence key changed");
            presenceRecreatePromise = null;
            await setupPresence();
          })();
        }

        return;
      }

      const onlineUsers = ctx && ctx.onlineUsers ? ctx.onlineUsers : null;
      const userProfiles = ctx && ctx.userProfiles ? ctx.userProfiles : null;

      if (presenceChannel) {
        trackPresence();
        return;
      }

      presenceChannelKey = currentKey;

      console.info("[KlevbyRealtime] presence create", {
        key: presenceChannelKey,
        userId: currentUserId || null
      });

      presenceChannel = client.channel("klevby_presence", {
        config: {
          presence: {
            key: presenceChannelKey
          }
        }
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          if (onlineUsers && typeof onlineUsers.clear === "function") {
            onlineUsers.clear();
          }

          const state = presenceChannel ? presenceChannel.presenceState() : {};

          Object.values(state).forEach((items) => {
            (items || []).forEach((item) => {
              if (item.user_id && isValidSupabaseUuid(item.user_id)) {
                if (onlineUsers && typeof onlineUsers.set === "function") {
                  onlineUsers.set(String(item.user_id), item);
                }

                if (item.name && userProfiles && typeof userProfiles.set === "function") {
                  userProfiles.set(String(item.user_id), safeCall("cleanDisplayName", item.name) || item.name);
                }
              }
            });
          });

          console.info("[KlevbyRealtime] presence sync", {
            channelKey: presenceChannelKey,
            onlineCount: onlineUsers && typeof onlineUsers.size === "number" ? onlineUsers.size : null,
            activeMode: getActiveMode(),
            selectedPeerId: getSelectedPeer()?.id || null
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
          console.info("[KlevbyRealtime] presence subscribe", {
            status,
            channelKey: presenceChannelKey,
            userId: getPresenceUserId() || null
          });

          if (status === "SUBSCRIBED") {
            await safeAsyncCall("refreshCurrentUser");
            await safeAsyncCall("ensureCurrentUserProfile", { soft: true });

            const freshUserId = getPresenceUserId();

            if (
              freshUserId &&
              presenceChannel &&
              presenceChannelKey &&
              presenceChannelKey !== freshUserId
            ) {
              await setupPresence();
              return;
            }

            trackPresence();
          }

          if (isTerminalRealtimeStatus(status)) {
            await removePresenceChannel(`presence ${status}`);
            scheduleReconnect(`presence:${status}`);
          }
        });
    } catch (error) {
      console.warn("Klevby chat: presence не запущен:", error);
    }
  }

  function setupRealtime() {
    const client = getClient();

    if (!client || typeof client.channel !== "function") return;

    if (!publicSubscription) {
      const publicChannel = client
        .channel("klevby_public_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            try {
              const activeMode = getActiveMode();
              const messagesContainer = getMessagesContainer();
              const messageId = payload.new?.id;
              const messageUserId = payload.new?.user_id;

              console.info("[KlevbyRealtimeDebug] public INSERT callback fired", {
                messageId,
                userId: messageUserId,
                activeMode,
                hasMessagesContainer: Boolean(messagesContainer),
                href: window.location?.href || null,
                appVersion:
                  window.KlevbyApp?.version ||
                  document.documentElement?.dataset?.version ||
                  null
              });

              if (activeMode !== "public") {
                console.info("[KlevbyRealtimeDebug] public INSERT skipped: activeMode is not public", {
                  messageId,
                  activeMode
                });
                return;
              }

              const emptyState = messagesContainer
                ? messagesContainer.querySelector(".chat-empty-state")
                : null;

              if (emptyState) {
                safeCall("clearMessages");
              }

              await safeAsyncCall("refreshCurrentUser");

              if (payload.new?.user_id && payload.new?.user_name) {
                safeCall("rememberFallbackProfile", payload.new.user_id, payload.new.user_name);
              }

              await safeAsyncCall("loadProfilesByIds", [payload.new?.user_id]);

              const isDuplicate = hasMessageRow("public", messageId);
              if (isDuplicate) {
                console.info("[KlevbyRealtimeDebug] public INSERT skipped: duplicate row detected", {
                  messageId,
                  activeMode
                });
                return;
              }

              console.info("[KlevbyRealtimeDebug] public INSERT render about to run", {
                messageId,
                activeMode
              });
              safeCall("renderPublicMessage", payload.new);
              console.info("[KlevbyRealtimeDebug] public INSERT render called", {
                messageId,
                rowExistsAfterRender: hasMessageRow("public", messageId)
              });
            } catch (error) {
              console.warn("Realtime public message skipped:", error);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages" },
          (payload) => {
            const id = payload.old?.id;
            if (!id) return;

            const messagesContainer = getMessagesContainer();
            if (!messagesContainer) return;

            const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="public"]`);
            if (row) row.remove();
          }
        );

      publicSubscription = publicChannel;

      publicChannel.subscribe((status) => {
        console.info("[KlevbyRealtime] public subscribe", {
          status,
          activeMode: getActiveMode(),
          userId: getPresenceUserId() || null
        });

        if (isTerminalRealtimeStatus(status)) {
          if (publicSubscription === publicChannel) {
            publicSubscription = null;
          }
          scheduleReconnect(`public:${status}`);
        }
      });
    }

    if (!privateSubscription) {
      const privateChannel = client
        .channel("klevby_private_messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "private_messages" },
          async (payload) => {
            try {
              const msg = payload.new || {};
              const currentUser = getCurrentUser();
              const myId = String(currentUser?.id || "");

              if (!myId || !isValidSupabaseUuid(myId)) {
                runAsync("refreshCurrentUser");
                return;
              }

              const activeMode = getActiveMode();
              const selectedPeer = getSelectedPeer();
              const senderId = String(msg.sender_id || "");
              const receiverId = String(msg.receiver_id || "");
              const isForMe = receiverId === myId;

              if (msg.sender_id && msg.sender_name) {
                safeCall("rememberFallbackProfile", msg.sender_id, msg.sender_name);
              }

              runAsync("loadProfilesByIds", [msg.sender_id, msg.receiver_id]);

              if (isForMe) {
                const alreadyInThisDialog =
                  activeMode === "private" &&
                  selectedPeer &&
                  String(selectedPeer.id) === senderId;

                if (!alreadyInThisDialog) {
                  safeCall("incrementUnreadPrivateCount", 1);
                }

                if (activeMode === "private" && !selectedPeer) {
                  runAsync("loadPrivatePeople");
                  return;
                }
              }

              if (!currentUser || activeMode !== "private" || !selectedPeer) return;

              const peerId = String(selectedPeer.id);

              if (!isValidSupabaseUuid(peerId)) return;

              const belongsToDialog =
                (senderId === myId && receiverId === peerId) ||
                (senderId === peerId && receiverId === myId);

              if (!belongsToDialog) return;

              safeCall("markPeerAsRead", peerId);

              const messagesContainer = getMessagesContainer();
              const emptyState = messagesContainer
                ? messagesContainer.querySelector(".chat-empty-state")
                : null;

              if (emptyState) {
                safeCall("clearMessages");
              }

              safeCall("renderPrivateMessage", msg);
            } catch (error) {
              console.warn("Realtime private message skipped:", error);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "private_messages" },
          (payload) => {
            const id = payload.old?.id;
            if (!id) return;

            const messagesContainer = getMessagesContainer();
            if (!messagesContainer) return;

            const row = messagesContainer.querySelector(`[data-message-id="${cssEscape(id)}"][data-message-type="private"]`);
            if (row) row.remove();
          }
        );

      privateSubscription = privateChannel;

      privateChannel.subscribe((status) => {
        console.info("[KlevbyRealtime] private subscribe", {
          status,
          activeMode: getActiveMode(),
          userId: getPresenceUserId() || null,
          selectedPeerId: getSelectedPeer()?.id || null
        });

        if (isTerminalRealtimeStatus(status)) {
          if (privateSubscription === privateChannel) {
            privateSubscription = null;
          }
          scheduleReconnect(`private:${status}`);
        }
      });
    }
  }

  async function cleanupRealtimeConnections() {
    const client = getClient();

    const channels = [
      publicSubscription,
      privateSubscription,
      presenceChannel
    ].filter(Boolean);

    publicSubscription = null;
    privateSubscription = null;
    presenceChannel = null;
    presenceChannelKey = "";
    presenceRecreatePromise = null;

    if (ctx && ctx.onlineUsers && typeof ctx.onlineUsers.clear === "function") {
      ctx.onlineUsers.clear();
    }

    updateSelectedPeerStatus();

    if (!client || typeof client.removeChannel !== "function") return;

    await Promise.all(
      channels.map(async (channel) => {
        try {
          await client.removeChannel(channel);
        } catch (error) {
          console.warn("Не удалось удалить старый realtime channel:", error);
        }
      })
    );
  }

  async function reconnectRealtimeConnections() {
    await cleanupRealtimeConnections();
    await setupPresence();
    setupRealtime();
  }

  function init(context) {
    ctx = context || null;
  }

  window.KlevbyChatRealtime = {
    init,
    setupPresence,
    setupRealtime,
    cleanupRealtimeConnections,
    reconnectRealtimeConnections,
    isOnline,
    getUserStatusText,
    updateSelectedPeerStatus
  };
})();
