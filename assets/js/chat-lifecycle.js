(function () {
  let lifecycleApi = null;

  function init(options = {}) {
    const elements = options.elements || {};
    const modal = elements.modal || null;

    let klevbyResumeTimer = null;
    let klevbyResumeInProgress = false;
    let klevbyLastResumeAt = 0;

    const getActiveMode =
      typeof options.getActiveMode === "function"
        ? options.getActiveMode
        : () => "public";

    const setActiveMode =
      typeof options.setActiveMode === "function"
        ? options.setActiveMode
        : () => {};

    const getSelectedPeer =
      typeof options.getSelectedPeer === "function"
        ? options.getSelectedPeer
        : () => null;

    const setSelectedPeer =
      typeof options.setSelectedPeer === "function"
        ? options.setSelectedPeer
        : () => {};

    const updateViewportVars =
      typeof options.updateViewportVars === "function"
        ? options.updateViewportVars
        : () => {};

    const lockChatPage =
      typeof options.lockChatPage === "function"
        ? options.lockChatPage
        : () => {};

    const unlockChatPage =
      typeof options.unlockChatPage === "function"
        ? options.unlockChatPage
        : () => {};

    const refreshCurrentUser =
      typeof options.refreshCurrentUser === "function"
        ? options.refreshCurrentUser
        : async () => null;

    const ensureCurrentUserProfile =
      typeof options.ensureCurrentUserProfile === "function"
        ? options.ensureCurrentUserProfile
        : async () => {};

    const reconnectRealtimeConnections =
      typeof options.reconnectRealtimeConnections === "function"
        ? options.reconnectRealtimeConnections
        : async () => {};

    const loadPublicMessages =
      typeof options.loadPublicMessages === "function"
        ? options.loadPublicMessages
        : async () => {};

    const loadPrivatePeople =
      typeof options.loadPrivatePeople === "function"
        ? options.loadPrivatePeople
        : async () => {};

    const openPrivateDialog =
      typeof options.openPrivateDialog === "function"
        ? options.openPrivateDialog
        : async () => {};

    const refreshPushButtonState =
      typeof options.refreshPushButtonState === "function"
        ? options.refreshPushButtonState
        : async () => {};

    const saveExistingPushSubscriptionIfPossible =
      typeof options.saveExistingPushSubscriptionIfPossible === "function"
        ? options.saveExistingPushSubscriptionIfPossible
        : async () => {};

    const syncSelectedPeerForCalls =
      typeof options.syncSelectedPeerForCalls === "function"
        ? options.syncSelectedPeerForCalls
        : () => {};

    const clearReply =
      typeof options.clearReply === "function"
        ? options.clearReply
        : () => {};

    const hideMessageMenu =
      typeof options.hideMessageMenu === "function"
        ? options.hideMessageMenu
        : () => {};

    const setChatTabsLoading =
      typeof options.setChatTabsLoading === "function"
        ? options.setChatTabsLoading
        : () => {};

    const cancelChatNavigation =
      typeof options.cancelChatNavigation === "function"
        ? options.cancelChatNavigation
        : () => {};

    const isValidSupabaseUuid =
      typeof options.isValidSupabaseUuid === "function"
        ? options.isValidSupabaseUuid
        : (value) => Boolean(value);

    const scrollChatToBottom =
      typeof options.scrollChatToBottom === "function"
        ? options.scrollChatToBottom
        : () => {};

    const showEmptyState =
      typeof options.showEmptyState === "function"
        ? options.showEmptyState
        : () => {};

    async function reloadChatAfterResume(reason = "resume") {
      const now = Date.now();

      if (klevbyResumeInProgress) return;
      if (now - klevbyLastResumeAt < 2500) return;

      klevbyResumeInProgress = true;
      klevbyLastResumeAt = now;

      try {
        updateViewportVars();

        await refreshCurrentUser();
        await ensureCurrentUserProfile({ soft: true });
        await reconnectRealtimeConnections();
        await saveExistingPushSubscriptionIfPossible();

        const isChatOpen = modal && modal.classList.contains("open");

        if (!isChatOpen) {
          return;
        }

        const savedMode = getActiveMode();
        const selectedPeer = getSelectedPeer();
        const savedPeer = selectedPeer ? { ...selectedPeer } : null;

        if (savedMode === "private" && savedPeer && isValidSupabaseUuid(savedPeer.id)) {
          await openPrivateDialog(savedPeer.id, savedPeer.name);
        } else if (savedMode === "private") {
          await loadPrivatePeople();
        } else {
          await loadPublicMessages();
        }

        syncSelectedPeerForCalls();

        setTimeout(() => {
          updateViewportVars();
          scrollChatToBottom();
        }, 150);
      } catch (error) {
        console.warn("Не удалось восстановить чат после возврата в приложение:", reason, error);
        setChatTabsLoading(false);
      } finally {
        klevbyResumeInProgress = false;
      }
    }

    function scheduleChatResume(reason = "resume") {
      clearTimeout(klevbyResumeTimer);

      klevbyResumeTimer = setTimeout(() => {
        reloadChatAfterResume(reason);
      }, 700);
    }

    async function openChat() {
      try {
        if (!modal) {
          console.warn("Klevby chat: modal не найден для открытия чата.");
          return;
        }

        updateViewportVars();
        lockChatPage();

        modal.classList.remove("hidden");
        modal.classList.add("open");

        await refreshCurrentUser();
        await ensureCurrentUserProfile({ soft: true });
        await reconnectRealtimeConnections();
        await loadPublicMessages();
        await refreshPushButtonState();
        await saveExistingPushSubscriptionIfPossible();

        syncSelectedPeerForCalls();

        setTimeout(() => {
          updateViewportVars();
          scrollChatToBottom();
        }, 150);
      } catch (error) {
        console.error("Klevby chat: ошибка открытия чата:", error);
        setChatTabsLoading(false);
        showEmptyState("Не удалось открыть чат. Обнови страницу или проверь Console.");
      }
    }

    function closeChat() {
      if (!modal) return;

      cancelChatNavigation();

      modal.classList.remove("open");
      modal.classList.add("hidden");

      setSelectedPeer(null);
      setActiveMode("public");

      syncSelectedPeerForCalls();
      clearReply();
      hideMessageMenu();
      unlockChatPage();
    }

    lifecycleApi = {
      openChat,
      closeChat,
      reloadChatAfterResume,
      scheduleChatResume
    };

    return lifecycleApi;
  }

  window.KlevbyChatLifecycle = {
    init,

    openChat(...args) {
      if (lifecycleApi && typeof lifecycleApi.openChat === "function") {
        return lifecycleApi.openChat(...args);
      }
    },

    closeChat(...args) {
      if (lifecycleApi && typeof lifecycleApi.closeChat === "function") {
        return lifecycleApi.closeChat(...args);
      }
    },

    reloadChatAfterResume(...args) {
      if (lifecycleApi && typeof lifecycleApi.reloadChatAfterResume === "function") {
        return lifecycleApi.reloadChatAfterResume(...args);
      }
    },

    scheduleChatResume(...args) {
      if (lifecycleApi && typeof lifecycleApi.scheduleChatResume === "function") {
        return lifecycleApi.scheduleChatResume(...args);
      }
    }
  };
})();
