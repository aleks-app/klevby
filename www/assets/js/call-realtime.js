(function () {
  if (window.KlevbyCallRealtime) {
    return;
  }

  const DEFAULT_PERSONAL_CHANNEL_THROTTLE_MS = 1800;

  let context = {
    log: null,
    warn: null,

    getClient: null,
    refreshUser: null,
    getMyId: null,
    getCurrentUser: null,
    getCallState: null,

    onAnswer: null,
    onIce: null,
    onEnd: null,
    onIncomingCall: null,

    personalChannelThrottleMs: DEFAULT_PERSONAL_CHANNEL_THROTTLE_MS
  };

  let callChannel = null;
  let personalChannel = null;
  let personalChannelUserId = "";

  let personalChannelPromise = null;
  let lastPersonalChannelEnsureAt = 0;

  function init(options = {}) {
    context = {
      ...context,
      ...options
    };
  }

  function log(...args) {
    if (typeof context.log === "function") {
      context.log(...args);
      return;
    }

    console.log("Klevby calls:", ...args);
  }

  function warn(...args) {
    if (typeof context.warn === "function") {
      context.warn(...args);
      return;
    }

    console.warn("Klevby calls:", ...args);
  }

  function getClient() {
    if (typeof context.getClient === "function") {
      return context.getClient();
    }

    return null;
  }

  async function refreshUser(options = {}) {
    if (typeof context.refreshUser === "function") {
      return context.refreshUser(options);
    }

    return null;
  }

  function getMyId() {
    if (typeof context.getMyId === "function") {
      return String(context.getMyId() || "");
    }

    return "";
  }

  function getCurrentUser() {
    if (typeof context.getCurrentUser === "function") {
      return context.getCurrentUser();
    }

    return null;
  }

  function getCallState() {
    if (typeof context.getCallState === "function") {
      return context.getCallState();
    }

    return "idle";
  }

  function getPersonalThrottleMs() {
    return Number(context.personalChannelThrottleMs) || DEFAULT_PERSONAL_CHANNEL_THROTTLE_MS;
  }

  async function removeCallChannel() {
    const client = getClient();

    if (client && callChannel) {
      try {
        await client.removeChannel(callChannel);
      } catch (error) {
        warn("remove call channel skipped", error);
      }
    }

    callChannel = null;
  }

  async function resetPersonalChannel() {
    const client = getClient();

    if (client && personalChannel) {
      try {
        await client.removeChannel(personalChannel);
      } catch (error) {
        warn("remove personal channel skipped", error);
      }
    }

    personalChannel = null;
    personalChannelUserId = "";
    personalChannelPromise = null;
    lastPersonalChannelEnsureAt = 0;
  }

  async function createCallChannel(id) {
    const client = getClient();

    if (!client || !id) {
      throw new Error("Нет подключения к Supabase.");
    }

    await removeCallChannel();

    callChannel = client.channel(`klevby_call_${id}`, {
      config: {
        broadcast: {
          self: false,
          ack: true
        }
      }
    });

    callChannel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (!payload || payload.to !== getMyId()) return;
      if (typeof context.onAnswer !== "function") return;

      await context.onAnswer(payload);
    });

    callChannel.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (!payload || payload.to !== getMyId()) return;
      if (typeof context.onIce !== "function") return;

      await context.onIce(payload);
    });

    callChannel.on("broadcast", { event: "end" }, async ({ payload }) => {
      if (!payload || payload.to !== getMyId()) return;
      if (typeof context.onEnd !== "function") return;

      await context.onEnd(payload);
    });

    await new Promise((resolve, reject) => {
      let finished = false;

      const done = () => {
        if (finished) return false;
        finished = true;
        return true;
      };

      callChannel.subscribe((status) => {
        log("call channel status", status);

        if (status === "SUBSCRIBED" && done()) {
          resolve();
        }

        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && done()) {
          reject(new Error("Не удалось подключить канал звонка."));
        }
      });
    });

    return callChannel;
  }

  async function sendCallEvent(event, payload) {
    if (!callChannel) {
      throw new Error("Канал звонка ещё не готов.");
    }

    await callChannel.send({
      type: "broadcast",
      event,
      payload
    });
  }

  async function sendBusySignal(client, payload, myId) {
    if (!client || !payload?.callId || !payload?.from || !myId) return;

    const busyChannel = client.channel(`klevby_call_${payload.callId}`, {
      config: {
        broadcast: {
          self: false,
          ack: true
        }
      }
    });

    busyChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await busyChannel.send({
            type: "broadcast",
            event: "end",
            payload: {
              callId: payload.callId,
              from: myId,
              to: payload.from,
              reason: "busy"
            }
          });
        } catch (error) {
          warn("busy signal failed", error);
        }

        try {
          await client.removeChannel(busyChannel);
        } catch (error) {}
      }
    });
  }

  async function ensurePersonalChannel(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    if (!force && personalChannelPromise) {
      return personalChannelPromise;
    }

    if (
      !force &&
      personalChannel &&
      personalChannelUserId &&
      getMyId() &&
      personalChannelUserId === getMyId() &&
      now - lastPersonalChannelEnsureAt < getPersonalThrottleMs()
    ) {
      return;
    }

    personalChannelPromise = (async () => {
      lastPersonalChannelEnsureAt = Date.now();

      await refreshUser({ force });

      const client = getClient();
      const myId = getMyId();

      if (!client || !myId) return;

      if (personalChannel && personalChannelUserId === myId) {
        return;
      }

      await resetPersonalChannel();

      personalChannelUserId = myId;

      personalChannel = client.channel(`klevby_user_calls_${myId}`, {
        config: {
          broadcast: {
            self: false,
            ack: true
          }
        }
      });

      personalChannel.on("broadcast", { event: "incoming_call" }, async ({ payload }) => {
        if (!payload || payload.to !== myId) return;

        log("incoming_call received", payload.callId);

        await refreshUser();

        const currentUser = getCurrentUser();

        if (!currentUser || String(currentUser.id) !== myId) {
          return;
        }

        if (getCallState() !== "idle") {
          await sendBusySignal(client, payload, myId);
          return;
        }

        if (typeof context.onIncomingCall === "function") {
          await context.onIncomingCall(payload);
        }
      });

      personalChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          log("personal channel ready", myId);
        }
      });
    })();

    try {
      return await personalChannelPromise;
    } finally {
      personalChannelPromise = null;
    }
  }

  async function sendToPersonalChannel(userId, event, payload) {
    const client = getClient();

    if (!client || !userId) {
      throw new Error("Нет подключения к Supabase.");
    }

    const channel = client.channel(`klevby_user_calls_${userId}`, {
      config: {
        broadcast: {
          self: false,
          ack: true
        }
      }
    });

    await new Promise((resolve, reject) => {
      let finished = false;

      const done = () => {
        if (finished) return false;
        finished = true;
        return true;
      };

      channel.subscribe((status) => {
        log("temporary personal channel status", status);

        if (status === "SUBSCRIBED" && done()) {
          resolve();
        }

        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && done()) {
          reject(new Error("Собеседник сейчас недоступен."));
        }
      });
    });

    await channel.send({
      type: "broadcast",
      event,
      payload
    });

    log("personal event sent", event, userId);

    setTimeout(() => {
      try {
        client.removeChannel(channel);
      } catch (error) {}
    }, 1600);
  }

  function getPersonalChannelUserId() {
    return personalChannelUserId;
  }

  function hasCallChannel() {
    return Boolean(callChannel);
  }

  window.KlevbyCallRealtime = {
    init,

    createCallChannel,
    removeCallChannel,
    sendCallEvent,

    ensurePersonalChannel,
    resetPersonalChannel,
    sendToPersonalChannel,

    getPersonalChannelUserId,
    hasCallChannel
  };
})();
