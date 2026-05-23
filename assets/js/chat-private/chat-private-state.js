(function () {
  if (window.KlevbyChatPrivateState) return;

  function beginNavigationIfNeeded(navToken, helpers = {}) {
    if (navToken) return navToken;
    return helpers.beginChatNavigation ? helpers.beginChatNavigation() : Date.now();
  }

  function isStaleNavigation(navToken, helpers = {}) {
    return helpers.isStaleNavigation ? helpers.isStaleNavigation(navToken) : false;
  }

  function finishChatNavigation(navToken, helpers = {}) {
    if (helpers.finishChatNavigation) {
      helpers.finishChatNavigation(navToken);
    }
  }

  function getUnreadPrivateCount(helpers = {}) {
    return Number(helpers.getUnreadPrivateCount ? helpers.getUnreadPrivateCount() : 0) || 0;
  }

  function setUnreadPrivateCount(value, helpers = {}) {
    if (helpers.setUnreadPrivateCount) {
      helpers.setUnreadPrivateCount(Math.max(0, Number(value) || 0));
    }
  }

  function getReadStorageKey(peerId, myId) {
    return `klevby_private_read_${myId || "guest"}_${peerId}`;
  }

  function getPeerReadTime(peerId, myId) {
    try {
      return Number(localStorage.getItem(getReadStorageKey(peerId, myId)) || "0");
    } catch {
      return 0;
    }
  }

  function markPeerAsRead(peerId, helpers = {}) {
    if (!helpers.isValidSupabaseUuid?.(peerId)) return;

    try {
      const myId = helpers.getCurrentUser?.()?.id;
      localStorage.setItem(getReadStorageKey(peerId, myId), String(Date.now()));
    } catch (error) {
      console.warn("Klevby private: не удалось сохранить статус прочтения:", error);
    }
  }

  window.KlevbyChatPrivateState = {
    beginNavigationIfNeeded,
    isStaleNavigation,
    finishChatNavigation,
    getUnreadPrivateCount,
    setUnreadPrivateCount,
    getReadStorageKey,
    getPeerReadTime,
    markPeerAsRead
  };
})();
