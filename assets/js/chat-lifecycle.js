(function () {
  let lifecycleApi = null;

  function init(options = {}) {
    // Lifecycle/resume ownership:
    // - open/close sequencing
    // - resume debouncing/recovery after background/foreground
    // - lightweight timeout guards around chat steps
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


    const recoverSupabaseClient =
      typeof options.recoverSupabaseClient === "function"
        ? options.recoverSupabaseClient
        : async () => false;

    const CHAT_STEP_TIMEOUT_MS = 7000;

    const lifecycleOptionalSkipLogState = {
      shown: false,
      steps: new Set()
    };

    function logLifecycleOptionalSkip(stepName, reason = "open") {
      const key = `${reason}:${stepName}`;

      if (!lifecycleOptionalSkipLogState.steps.has(key)) {
        lifecycleOptionalSkipLogState.steps.add(key);
        console.debug("[KlevbyChatLifecycle] optional chat step detail", {
          step: stepName,
          reason
        });
      }

      if (lifecycleOptionalSkipLogState.shown) return;

      lifecycleOptionalSkipLogState.shown = true;
      console.info("[KlevbyChatLifecycle] optional chat step skipped");
    }

    function getSupabaseClientExists() {
      try {
        if (typeof window.klevbyGetSupabase === "function") {
          return Boolean(window.klevbyGetSupabase());
        }
      } catch (error) {
        return false;
      }

      return Boolean(window.klevbySupabase || window.supabaseClient);
    }

    function createStepTimeoutError(stepName, timeoutMs, reason) {
      const error = new Error(`Klevby chat: step "${stepName}" timed out after ${timeoutMs}ms (${reason}).`);
      error.name = "KlevbyChatStepTimeoutError";
      error.code = "CHAT_STEP_TIMEOUT";
      error.step = stepName;
      error.reason = reason;
      error.timeoutMs = timeoutMs;
      return error;
    }

    async function withChatStepTimeout(stepName, runner, opts = {}) {
      const timeoutMs = Number(opts.timeoutMs || CHAT_STEP_TIMEOUT_MS);
      const reason = String(opts.reason || "open");
      const silent = opts.silent === true;
      const startedAt = Date.now();

      if (!silent) {
        console.info("[KlevbyChatLifecycle] chat open step start", {
          step: stepName,
          reason,
          timeoutMs,
          supabaseClientExists: getSupabaseClientExists()
        });
      }

      let timer = null;

      try {
        const result = await Promise.race([
          Promise.resolve().then(runner),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(createStepTimeoutError(stepName, timeoutMs, reason));
            }, timeoutMs);
          })
        ]);

        if (!silent) {
          console.info("[KlevbyChatLifecycle] chat open step end", {
            step: stepName,
            reason,
            durationMs: Date.now() - startedAt,
            supabaseClientExists: getSupabaseClientExists()
          });
        }

        return result;
      } catch (error) {
        if (!silent) {
          const durationMs = Date.now() - startedAt;

          if (error && error.code === "CHAT_STEP_TIMEOUT") {
            console.warn("[KlevbyChatLifecycle] chat open step timeout", {
              step: stepName,
              reason,
              durationMs,
              timeoutMs,
              supabaseClientExists: getSupabaseClientExists()
            });
          } else {
            console.warn("[KlevbyChatLifecycle] chat open step fail", {
              step: stepName,
              reason,
              durationMs,
              supabaseClientExists: getSupabaseClientExists(),
              error: String(error?.message || error)
            });
          }
        }

        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async function tryRecoverSupabaseAfterTimeout(reason, error) {
      if (!error || error.code !== "CHAT_STEP_TIMEOUT") return false;

      try {
        console.warn("[KlevbyChatLifecycle] trying Supabase recovery after timeout", {
          reason,
          step: error.step,
          supabaseClientExists: getSupabaseClientExists()
        });

        return Boolean(await recoverSupabaseClient({ reason, step: error.step, error }));
      } catch (recoverError) {
        console.warn("[KlevbyChatLifecycle] Supabase recovery failed", recoverError);
        return false;
      }
    }

    async function runOptionalChatStep(stepName, runner, opts = {}) {
      const timeoutMs = Number(opts.timeoutMs || 3000);
      const reason = String(opts.reason || "open");

      try {
        await withChatStepTimeout(stepName, runner, { ...opts, timeoutMs, reason, silent: true });
        return true;
      } catch (_) {
        logLifecycleOptionalSkip(stepName, reason);
        return false;
      }
    }

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

    function resetGhostChatUiState({ keepChatOpen = false } = {}) {
      const html = document.documentElement;
      const body = document.body;

      if (html) {
        html.classList.remove("klevby-chat-lock", "klevby-chat-mobile-lock");
      }

      if (body) {
        body.classList.remove(
          "klevby-chat-lock",
          "klevby-chat-mobile-lock",
          "klevby-chat-keyboard-open"
        );
      }

      if (!modal) return;

      if (!keepChatOpen) {
        modal.classList.remove("open");
        modal.classList.add("hidden");
      } else if (modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
        modal.classList.add("open");
      }
    }

    async function reloadChatAfterResume(reason = "resume") {
      const now = Date.now();

      if (klevbyResumeInProgress) return;
      if (now - klevbyLastResumeAt < 2500) return;

      klevbyResumeInProgress = true;
      klevbyLastResumeAt = now;

      try {
        updateViewportVars();

        await withChatStepTimeout("refreshCurrentUser", () => refreshCurrentUser(), { reason });
        await runOptionalChatStep("ensureCurrentUserProfile", () => ensureCurrentUserProfile({ soft: true }), {
          reason,
          timeoutMs: 3000
        });
        await withChatStepTimeout("reconnectRealtimeConnections", () => reconnectRealtimeConnections(), { reason });
        await runOptionalChatStep("saveExistingPushSubscriptionIfPossible", () => saveExistingPushSubscriptionIfPossible(), { reason });

        const isChatOpen = modal && modal.classList.contains("open");

        if (!isChatOpen) {
          resetGhostChatUiState({ keepChatOpen: false });
          unlockChatPage();
          return;
        }

        const savedMode = getActiveMode();
        const selectedPeer = getSelectedPeer();
        const savedPeer = selectedPeer ? { ...selectedPeer } : null;

        if (savedMode === "private" && savedPeer && isValidSupabaseUuid(savedPeer.id)) {
          await withChatStepTimeout("openPrivateDialog", () => openPrivateDialog(savedPeer.id, savedPeer.name), { reason });
        } else if (savedMode === "private") {
          await withChatStepTimeout("loadPrivatePeople", () => loadPrivatePeople(), { reason });
        } else {
          await withChatStepTimeout("loadPublicMessages", () => loadPublicMessages(), { reason });
        }

        syncSelectedPeerForCalls();

        setTimeout(() => {
          updateViewportVars();
          scrollChatToBottom();
        }, 150);
      } catch (error) {
        await tryRecoverSupabaseAfterTimeout(reason, error);
        console.warn("Не удалось восстановить чат после возврата в приложение:", reason, error);
        setChatTabsLoading(false);
        unlockChatPage();
        showEmptyState("Чат временно недоступен после возврата. Попробуй открыть снова.");
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
      const reason = "open";
      try {
        if (!modal) {
          console.warn("Klevby chat: modal не найден для открытия чата.");
          return;
        }

        resetGhostChatUiState({ keepChatOpen: false });
        updateViewportVars();
        lockChatPage();

        modal.classList.remove("hidden");
        modal.classList.add("open");

        await withChatStepTimeout("refreshCurrentUser", () => refreshCurrentUser(), { reason });
        await runOptionalChatStep("ensureCurrentUserProfile", () => ensureCurrentUserProfile({ soft: true }), {
          reason,
          timeoutMs: 3000
        });
        await withChatStepTimeout("reconnectRealtimeConnections", () => reconnectRealtimeConnections(), { reason });
        await withChatStepTimeout("loadPublicMessages", () => loadPublicMessages(), { reason });
        await runOptionalChatStep("refreshPushButtonState", () => refreshPushButtonState(), { reason });
        await runOptionalChatStep("saveExistingPushSubscriptionIfPossible", () => saveExistingPushSubscriptionIfPossible(), { reason });

        syncSelectedPeerForCalls();

        setTimeout(() => {
          updateViewportVars();
          scrollChatToBottom();
        }, 150);
      } catch (error) {
        await tryRecoverSupabaseAfterTimeout(reason, error);
        console.error("Klevby chat: ошибка открытия чата:", error);
        if (modal) {
          modal.classList.remove("open");
          modal.classList.add("hidden");
        }
        resetGhostChatUiState({ keepChatOpen: false });
        unlockChatPage();
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
      resetGhostChatUiState({ keepChatOpen: false });
    }

    window.klevbyDebugChatUiState = function klevbyDebugChatUiState() {
      const html = document.documentElement;
      const body = document.body;
      const centerX = Math.round(window.innerWidth / 2);
      const centerY = Math.round(window.innerHeight / 2);
      const modalComputed = modal ? window.getComputedStyle(modal) : null;
      const stack = document
        .elementsFromPoint(centerX, centerY)
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName,
          id: element.id || null,
          className: element.className || "",
          pointerEvents: window.getComputedStyle(element).pointerEvents,
          zIndex: window.getComputedStyle(element).zIndex
        }));

      const snapshot = {
        htmlClassName: html ? html.className : "",
        bodyClassName: body ? body.className : "",
        chatOpen: Boolean(modal && modal.classList.contains("open")),
        chatHidden: Boolean(modal && modal.classList.contains("hidden")),
        hasChatLockWhenClosed:
          Boolean(body && body.classList.contains("klevby-chat-lock")) &&
          Boolean(modal && !modal.classList.contains("open")),
        modal: modal
          ? {
              display: modalComputed.display,
              visibility: modalComputed.visibility,
              opacity: modalComputed.opacity,
              pointerEvents: modalComputed.pointerEvents,
              zIndex: modalComputed.zIndex
            }
          : null,
        elementsFromCenter: stack
      };

      console.group("klevbyDebugChatUiState");
      console.log(snapshot);
      console.groupEnd();
      return snapshot;
    };

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
