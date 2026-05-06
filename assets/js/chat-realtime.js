(function () {
  if (window.KlevbyChatRealtime) {
    return;
  }

  let ctx = null;

  let publicSubscription = null;
  let privateSubscription = null;
  let presenceChannel = null;

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

  function setupPresence() {
    try {
      const client = getClient();

      if (!client || typeof client.channel !== "function") return;

      const currentUser = getCurrentUser();
      const onlineUsers = ctx && ctx.onlineUsers ? ctx.onlineUsers : null;
      const userProfiles = ctx && ctx.userProfiles ? ctx.userProfiles : null;

      if (presenceChannel) {
        presenceChannel.track({
          user_id: currentUser?.id || null,
          name: safeCall("getCurrentChatName") || "Рыбак",
          online_at: new Date().toISOString()
        });

        return;
      }

      presenceChannel = client.channel("klevby_presence", {
        config: {
          presence: {
            key: currentUser?.id || safeCall("getGuestName") || "guest"
          }
        }
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          if (onlineUsers && typeof onlineUsers.clear === "function") {
            onlineUsers.clear();
          }

          const state = presenceChannel.presenceState();

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
            await safeAsyncCall("refreshCurrentUser");
            await safeAsyncCall("ensureCurrentUserProfile", { soft: true });

            const freshUser = getCurrentUser();

            presenceChannel.track({
              user_id: freshUser?.id || null,
              name: safeCall("getCurrentChatName") || "Рыбак",
              online_at: new Date().toISOString()
            });
          }
        });
    } catch (error) {
      console.warn("Klevby chat: presence не запущен:", error);
    }
  }

  function setupRealtime() {
    const client = getClient();

    if (!client || typeof client.channel !== "function") return;
    if (publicSubscription || privateSubscription) return;

    publicSubscription = client
      .channel("klevby_public_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          try {
            if (getActiveMode() !== "public") return;

            const messagesContainer = getMessagesContainer();
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
            safeCall("renderPublicMessage", payload.new);
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
      )
      .subscribe();

    privateSubscription = client
      .channel("klevby_private_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        async (payload) => {
          try {
            await safeAsyncCall("refreshCurrentUser");

            const currentUser = getCurrentUser();
            const msg = payload.new;
            const myId = String(currentUser?.id || "");

            if (!myId || !isValidSupabaseUuid(myId)) return;

            if (msg.sender_id && msg.sender_name) {
              safeCall("rememberFallbackProfile", msg.sender_id, msg.sender_name);
            }

            await safeAsyncCall("loadProfilesByIds", [msg.sender_id, msg.receiver_id]);

            const activeMode = getActiveMode();
            const selectedPeer = getSelectedPeer();

            const isForMe = String(msg.receiver_id) === myId;
            const senderId = String(msg.sender_id || "");

            if (isForMe) {
              const alreadyInThisDialog =
                activeMode === "private" &&
                selectedPeer &&
                String(selectedPeer.id) === senderId;

              if (!alreadyInThisDialog) {
                safeCall("incrementUnreadPrivateCount", 1);
              }

              if (activeMode === "private" && !selectedPeer) {
                await safeAsyncCall("loadPrivatePeople");
                return;
              }
            }

            if (!currentUser || activeMode !== "private" || !selectedPeer) return;

            const peerId = String(selectedPeer.id);

            if (!isValidSupabaseUuid(peerId)) return;

            const belongsToDialog =
              (String(msg.sender_id) === myId && String(msg.receiver_id) === peerId) ||
              (String(msg.sender_id) === peerId && String(msg.receiver_id) === myId);

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
      )
      .subscribe();
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

    if (ctx && ctx.onlineUsers && typeof ctx.onlineUsers.clear === "function") {
      ctx.onlineUsers.clear();
    }

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
    setupPresence();
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
