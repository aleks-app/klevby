(function () {
  let cleanupFns = [];
  let longPressTimer = null;

  function clearOldListeners() {
    clearTimeout(longPressTimer);
    longPressTimer = null;

    cleanupFns.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {}
    });

    cleanupFns = [];
  }

  function addListener(target, eventName, handler, options) {
    if (!target || typeof target.addEventListener !== "function") return;

    target.addEventListener(eventName, handler, options);

    cleanupFns.push(() => {
      target.removeEventListener(eventName, handler, options);
    });
  }

  function getClosest(event, selector) {
    const target = event?.target || null;

    if (!target) return null;

    const element =
      target.nodeType === 1
        ? target
        : target.parentElement || null;

    if (!element || typeof element.closest !== "function") {
      return null;
    }

    return element.closest(selector);
  }

  function init(options = {}) {
    clearOldListeners();

    const elements = options.elements || {};

    const modal = elements.modal || null;
    const messagesContainer = elements.messagesContainer || null;
    const input = elements.input || null;
    const sendBtn = elements.sendBtn || null;

    const getChatLoading =
      typeof options.getChatLoading === "function"
        ? options.getChatLoading
        : () => false;

    const openChat =
      typeof options.openChat === "function"
        ? options.openChat
        : async () => {};

    const closeChat =
      typeof options.closeChat === "function"
        ? options.closeChat
        : () => {};

    const enablePushNotifications =
      typeof options.enablePushNotifications === "function"
        ? options.enablePushNotifications
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

    const clearReply =
      typeof options.clearReply === "function"
        ? options.clearReply
        : () => {};

    const getContextMessageData =
      typeof options.getContextMessageData === "function"
        ? options.getContextMessageData
        : () => null;

    const setReplyTarget =
      typeof options.setReplyTarget === "function"
        ? options.setReplyTarget
        : () => {};

    const deleteMessage =
      typeof options.deleteMessage === "function"
        ? options.deleteMessage
        : async () => {};

    const findMessageDataFromRow =
      typeof options.findMessageDataFromRow === "function"
        ? options.findMessageDataFromRow
        : () => null;

    const hideMessageMenu =
      typeof options.hideMessageMenu === "function"
        ? options.hideMessageMenu
        : () => {};

    const showMessageMenu =
      typeof options.showMessageMenu === "function"
        ? options.showMessageMenu
        : () => {};

    const send =
      typeof options.send === "function"
        ? options.send
        : async () => {};

    const updateViewportVars =
      typeof options.updateViewportVars === "function"
        ? options.updateViewportVars
        : () => {};

    const scrollChatToBottom =
      typeof options.scrollChatToBottom === "function"
        ? options.scrollChatToBottom
        : () => {};

    const scheduleChatResume =
      typeof options.scheduleChatResume === "function"
        ? options.scheduleChatResume
        : () => {};

    const setChatTabsLoading =
      typeof options.setChatTabsLoading === "function"
        ? options.setChatTabsLoading
        : () => {};

    const getActiveMode =
      typeof options.getActiveMode === "function"
        ? options.getActiveMode
        : () => null;

    const getSelectedPeer =
      typeof options.getSelectedPeer === "function"
        ? options.getSelectedPeer
        : () => null;

    addListener(window, "klevby-app-resumed", (event) => {
      const reason = String(event?.detail?.reason || "app_resumed");
      scheduleChatResume(reason);
    });

    if (!window.__klevbyCentralResumeRouter) {
      addListener(document, "visibilitychange", () => {
        if (document.visibilityState === "visible") {
          scheduleChatResume("visibilitychange");
        }
      });

      addListener(window, "pageshow", () => {
        scheduleChatResume("pageshow");
      });

      addListener(window, "focus", () => {
        scheduleChatResume("focus");
      });

      addListener(window, "online", () => {
        scheduleChatResume("online");
      });
    }

    addListener(document, "click", async (event) => {
      try {
        if (getClosest(event, "#nav-chat") || getClosest(event, "#chat-desktop-btn")) {
          event.preventDefault();
          event.stopPropagation();
          await openChat();
          return;
        }

        if (getClosest(event, "#klevby-push-btn")) {
          event.preventDefault();
          event.stopPropagation();
          await enablePushNotifications();
          return;
        }

        if (
          event.target?.id === "close-chat" ||
          getClosest(event, "#close-chat")
        ) {
          event.preventDefault();
          event.stopPropagation();
          closeChat();
          return;
        }

        if (modal && event.target === modal) {
          closeChat();
          return;
        }

        if (
          getChatLoading() &&
          getClosest(event, "#publicChatTab, #privateChatTab, #back-chat, .klevby-private-dialog-item")
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (getClosest(event, "#publicChatTab")) {
          await loadPublicMessages();
          return;
        }

        if (getClosest(event, "#privateChatTab")) {
          console.info("[KlevbyPrivate] private tab click start", {
            activeModeBefore: getActiveMode(),
            selectedPeerBefore: getSelectedPeer()
          });
          await loadPrivatePeople();
          console.info("[KlevbyPrivate] private tab click end", {
            activeModeAfter: getActiveMode(),
            selectedPeerAfter: getSelectedPeer()
          });
          return;
        }

        if (getClosest(event, "#back-chat")) {
          await loadPrivatePeople();
          return;
        }

        if (getClosest(event, "#cancelReply")) {
          clearReply();
          return;
        }

        if (getClosest(event, "#contextReplyBtn")) {
          const data = getContextMessageData();

          if (data) {
            setReplyTarget(data);
          }

          return;
        }

        if (getClosest(event, "#contextDeleteBtn")) {
          const data = getContextMessageData();

          if (data) {
            await deleteMessage(data.type, data.id);
          }

          return;
        }

        const dialogButton = getClosest(event, ".klevby-private-dialog-item");

        if (dialogButton) {
          await openPrivateDialog(dialogButton.dataset.peerId, dialogButton.dataset.peerName);
          return;
        }

        const replyButton = getClosest(event, ".reply-message-btn");

        if (replyButton) {
          const row = replyButton.closest(".chat-message-row");
          const data = findMessageDataFromRow(row);

          if (data) {
            setReplyTarget(data);
          }

          return;
        }

        const deleteButton = getClosest(event, ".delete-message-btn");

        if (deleteButton) {
          await deleteMessage(deleteButton.dataset.type, deleteButton.dataset.id);
          return;
        }

        if (!getClosest(event, ".klevby-message-menu") && !getClosest(event, ".chat-message-row")) {
          hideMessageMenu();
        }
      } catch (error) {
        console.error("Klevby chat: ошибка клика:", error);
        setChatTabsLoading(false);
      }
    });

    addListener(messagesContainer, "pointerdown", (event) => {
      const row = getClosest(event, ".chat-message-row");
      if (!row) return;

      clearTimeout(longPressTimer);

      longPressTimer = setTimeout(() => {
        showMessageMenu(row);
      }, 520);
    });

    addListener(messagesContainer, "pointerup", () => {
      clearTimeout(longPressTimer);
    });

    addListener(messagesContainer, "pointermove", () => {
      clearTimeout(longPressTimer);
    });

    addListener(messagesContainer, "contextmenu", (event) => {
      const row = getClosest(event, ".chat-message-row");
      if (!row) return;

      event.preventDefault();
      showMessageMenu(row);
    });

    addListener(sendBtn, "click", () => {
      const activeMode = getActiveMode();
      const selectedPeer = getSelectedPeer();
      const inputLength = String(input?.value || "").trim().length;
      const chatLoading = Boolean(getChatLoading());
      const isDisabled = Boolean(sendBtn?.disabled);

      console.info("[KlevbyChatEvents] send button click start", {
        activeMode,
        selectedPeerId: selectedPeer?.id || null,
        inputLength,
        sendBtnDisabled: isDisabled,
        chatLoading
      });

      if (isDisabled || chatLoading) {
        console.info("[KlevbyChatEvents] send button click ignored reason", {
          reason: isDisabled ? "sendBtn.disabled" : "chatLoading",
          activeMode,
          selectedPeerId: selectedPeer?.id || null,
          inputLength
        });
      }

      send();
    });

    addListener(input, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });

    addListener(input, "focus", () => {
      updateViewportVars();

      setTimeout(() => {
        updateViewportVars();
        scrollChatToBottom();
      }, 120);

      setTimeout(() => {
        updateViewportVars();
        scrollChatToBottom();
      }, 350);
    });

    addListener(input, "blur", () => {
      setTimeout(updateViewportVars, 150);
    });
  }

  window.KlevbyChatEvents = {
    init
  };
})();
