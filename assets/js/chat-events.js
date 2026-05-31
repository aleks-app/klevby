(function () {
  function markKlevbyResumeDebug(source, reason, detail = {}) {
    const api = window.KlevbyResumeDebug;
    if (!api || typeof api.mark !== "function") return null;
    try {
      return api.mark(source, reason, detail);
    } catch (error) {
      return null;
    }
  }

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

  function getMenuActionFromEvent(event) {
    const actionButton = getClosest(event, ".klevby-message-menu button");
    if (!actionButton) return null;

    const actionId = String(actionButton.id || "").trim();
    const explicitAction = String(actionButton.dataset?.action || "").trim();
    const className = String(actionButton.className || "");
    const label = String(actionButton.textContent || "").trim().toLowerCase();

    if (explicitAction) return explicitAction;
    if (actionId === "contextReplyBtn") return "reply";
    if (actionId === "contextCopyBtn") return "copy";
    if (actionId === "contextDeleteBtn") return "delete";
    if (className.includes("delete")) return "delete";
    if (className.includes("reply")) return "reply";
    if (className.includes("copy")) return "copy";
    if (label.includes("удал")) return "delete";
    if (label.includes("ответ")) return "reply";
    if (label.includes("скоп")) return "copy";

    return null;
  }


  function getMenuActionTargetFromEvent(event) {
    const target = event?.target;
    if (!target) return null;

    const element =
      target.nodeType === 1
        ? target
        : target.parentElement || null;

    if (!element || typeof element.closest !== "function") {
      return null;
    }

    const contextDeleteButton = element.closest("#contextDeleteBtn");
    if (contextDeleteButton) return "delete";

    const menuButton = element.closest(".klevby-message-menu button");
    if (menuButton) {
      const actionId = String(menuButton.id || "").trim();
      const explicitAction = String(menuButton.dataset?.action || "").trim().toLowerCase();
      const className = String(menuButton.className || "").toLowerCase();
      const label = String(menuButton.textContent || "").trim().toLowerCase();

      if (explicitAction === "delete") return "delete";
      if (actionId === "contextDeleteBtn") return "delete";
      if (className.includes("delete")) return "delete";
      if (label.includes("удал")) return "delete";

      return "menu_action_other";
    }

    const deleteButton = element.closest(".delete-message-btn");
    if (deleteButton && deleteButton.closest(".chat-message-row") && deleteButton.closest("#messages-container, .chat-messages, .klevby-chat-messages")) {
      return "delete";
    }

    return null;
  }

  function init(options = {}) {
    // DOM/user events only:
    // - chat open/close clicks
    // - tab/dialog navigation clicks
    // - message row interactions (long press / context menu trigger)
    // - resume/focus/page visibility event wiring
    clearOldListeners();

    const elements = options.elements || {};

    const modal = elements.modal || null;
    const messagesContainer = elements.messagesContainer || null;
    const input = elements.input || null;
    const sendBtn = elements.sendBtn || null;
    const pushBtn =
      elements.pushBtn ||
      document.getElementById("klevby-push-btn") ||
      null;

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

    const copyMessageText =
      typeof options.copyMessageText === "function"
        ? options.copyMessageText
        : async () => {};

    const replyToSelectedMessage =
      typeof options.replyToSelectedMessage === "function"
        ? options.replyToSelectedMessage
        : () => null;

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
      markKlevbyResumeDebug("chat.events.listener", reason, { trigger: "klevby-app-resumed" });
      scheduleChatResume(reason);
    });

    addListener(document, "pointerdown", async (event) => {
      const captureAction = getMenuActionTargetFromEvent(event);
      if (captureAction !== "delete") return;

      console.info("[KlevbyDeleteRoute] capture delete action");
      event.preventDefault();
      event.stopPropagation();
      await deleteMessage();
    }, true);

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
          hideMessageMenu("close_chat");
          closeChat();
          return;
        }

        if (modal && event.target === modal) {
          hideMessageMenu("outside_tap");
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
          hideMessageMenu("tab_public");
          await loadPublicMessages();
          return;
        }

        if (getClosest(event, "#privateChatTab")) {
          hideMessageMenu("tab_private");
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
          hideMessageMenu("back_chat");
          await loadPrivatePeople();
          return;
        }

        if (getClosest(event, "#cancelReply")) {
          clearReply();
          return;
        }

        const menuAction = getMenuActionFromEvent(event);

        if (menuAction === "reply") {
          const selectedMessage = replyToSelectedMessage();
          if (selectedMessage) {
            setReplyTarget(selectedMessage);
          }
          return;
        }

        if (menuAction === "copy") {
          await copyMessageText();
          return;
        }

        if (menuAction === "delete") {
          await deleteMessage();
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
          hideMessageMenu("outside_tap");
        }
      } catch (error) {
        console.error("Klevby chat: ошибка клика:", error);
        setChatTabsLoading(false);
      }
    });

    if (pushBtn && !pushBtn.__klevbyPushFallbackBound) {
      const pushFallbackHandler = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.info("[KlevbyEvents] push button click");
        await enablePushNotifications();
      };

      pushBtn.__klevbyPushFallbackBound = true;

      addListener(pushBtn, "click", pushFallbackHandler);
      cleanupFns.push(() => {
        pushBtn.__klevbyPushFallbackBound = false;
      });
    }

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
      event.stopPropagation();
      showMessageMenu(row);
    });

    addListener(messagesContainer, "selectstart", (event) => {
      const row = getClosest(event, ".chat-message-row");
      if (!row) return;
      event.preventDefault();
    });

    addListener(messagesContainer, "scroll", () => {
      hideMessageMenu("scroll_messages");
    }, { passive: true });

    addListener(window, "scroll", () => hideMessageMenu("scroll_window"), { passive: true });
    addListener(window, "pagehide", () => hideMessageMenu("pagehide"));
    addListener(window, "pageshow", () => hideMessageMenu("pageshow_before_resume"));
    addListener(window, "focus", () => hideMessageMenu("focus_after_background"));
    addListener(document, "visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        hideMessageMenu("visibility_hidden");
        return;
      }
      hideMessageMenu("visibility_visible_before_resume");
    });

    addListener(sendBtn, "click", () => {
      send();
    });

    addListener(input, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });

    addListener(input, "focus", () => {
      hideMessageMenu("input_focus");
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
