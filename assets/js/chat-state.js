(function () {
  let elements = {};

  let chatNavigationToken = 0;
  let chatLoading = false;
  let unreadPrivateCount = 0;

  function init(options = {}) {
    elements = options.elements || {};
    setChatTabsLoading(chatLoading);
    updateUnreadBadge();
  }

  function getElement(name) {
    return elements && elements[name] ? elements[name] : null;
  }

  function getChatLoading() {
    return chatLoading;
  }

  function beginChatNavigation() {
    chatNavigationToken += 1;
    setChatTabsLoading(true);
    return chatNavigationToken;
  }

  function cancelChatNavigation() {
    chatNavigationToken += 1;
    setChatTabsLoading(false);
    return chatNavigationToken;
  }

  function isStaleNavigation(token) {
    return token !== chatNavigationToken;
  }

  function finishChatNavigation(token) {
    if (!isStaleNavigation(token)) {
      setChatTabsLoading(false);
    }
  }

  function setChatTabsLoading(isLoading) {
    chatLoading = Boolean(isLoading);

    const publicTab = getElement("publicTab");
    const privateTab = getElement("privateTab");
    const backBtn = getElement("backBtn");
    const chatWindow = getElement("chatWindow");

    if (publicTab) {
      publicTab.disabled = chatLoading;
      publicTab.classList.toggle("loading", chatLoading);
    }

    if (privateTab) {
      privateTab.disabled = chatLoading;
      privateTab.classList.toggle("loading", chatLoading);
    }

    if (backBtn) {
      backBtn.disabled = chatLoading;
      backBtn.classList.toggle("loading", chatLoading);
    }

    if (chatWindow) {
      chatWindow.classList.toggle("klevby-chat-loading", chatLoading);
    }
  }

  function getUnreadPrivateCount() {
    return unreadPrivateCount;
  }

  function setUnreadPrivateCount(value) {
    unreadPrivateCount = Math.max(0, Number(value) || 0);
    updateUnreadBadge();
  }

  function incrementUnreadPrivateCount(amount = 1) {
    unreadPrivateCount += Number(amount) || 1;
    updateUnreadBadge();
  }

  function updateUnreadBadge() {
    const privateUnreadBadge = getElement("privateUnreadBadge");

    if (!privateUnreadBadge) return;

    if (unreadPrivateCount <= 0) {
      privateUnreadBadge.classList.add("hidden");
      privateUnreadBadge.textContent = "0";
      return;
    }

    privateUnreadBadge.classList.remove("hidden");
    privateUnreadBadge.textContent = String(Math.min(unreadPrivateCount, 99));
  }

  window.KlevbyChatState = {
    init,
    getChatLoading,
    beginChatNavigation,
    cancelChatNavigation,
    isStaleNavigation,
    finishChatNavigation,
    setChatTabsLoading,
    getUnreadPrivateCount,
    setUnreadPrivateCount,
    incrementUnreadPrivateCount,
    updateUnreadBadge
  };
})();
