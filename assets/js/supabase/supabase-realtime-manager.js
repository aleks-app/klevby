(function initKlevbySupabaseRealtimeManager(global) {
  const channels = new Map();

  function makeKey(owner, channelName, purpose) {
    const safeOwner = String(owner || "");
    const safeChannelName = String(channelName || "");
    const safePurpose = String(purpose || "");
    return [safeOwner, safeChannelName, safePurpose].join("::");
  }

  function buildRecord(owner, channelName, purpose, channel) {
    return {
      owner: String(owner || ""),
      channelName: String(channelName || ""),
      purpose: String(purpose || ""),
      channel
    };
  }

  function registerChannel(params = {}) {
    const safeParams = params || {};
    const owner = safeParams.owner;
    const channelName = safeParams.channelName;
    const purpose = safeParams.purpose;
    const channel = safeParams.channel;
    const allowReplace = Boolean(safeParams.allowReplace);

    const key = makeKey(owner, channelName, purpose);
    const existing = channels.get(key);

    if (existing && !allowReplace) {
      console.info("[KlevbySupabaseRealtimeManager] Channel already registered, keeping existing:", key);
      return existing;
    }

    if (existing && allowReplace) {
      console.warn("[KlevbySupabaseRealtimeManager] Replacing registered channel:", key);
    }

    const record = buildRecord(owner, channelName, purpose, channel);
    channels.set(key, record);
    return record;
  }

  function getChannel(owner, channelName, purpose) {
    const key = makeKey(owner, channelName, purpose);
    return channels.get(key) || null;
  }

  function hasChannel(owner, channelName, purpose) {
    return Boolean(getChannel(owner, channelName, purpose));
  }

  function unregisterChannel(owner, channelName, purpose) {
    const key = makeKey(owner, channelName, purpose);
    const existing = channels.get(key) || null;

    if (!existing) {
      return null;
    }

    channels.delete(key);
    return existing;
  }

  function listChannels() {
    return Array.from(channels.values());
  }

  function clearOwner(owner) {
    const safeOwner = String(owner || "");
    const removed = [];

    channels.forEach(function eachRecord(record, key) {
      if (record.owner === safeOwner) {
        removed.push(record);
        channels.delete(key);
      }
    });

    return removed;
  }

  function clearAll() {
    const removed = listChannels();
    channels.clear();
    return removed;
  }

  global.KlevbySupabaseRealtimeManager = {
    makeKey,
    registerChannel,
    getChannel,
    hasChannel,
    unregisterChannel,
    listChannels,
    clearOwner,
    clearAll
  };
})(window);
