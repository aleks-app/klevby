(function () {
  let cleanupFns = [];

  function clearOldListeners() {
    cleanupFns.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {}
    });

    cleanupFns = [];
  }

  function addCleanup(cleanup) {
    if (typeof cleanup === "function") {
      cleanupFns.push(cleanup);
    }
  }

  function init(options = {}) {
    clearOldListeners();

    const chatDb = options.chatDb || null;
    const elements = options.elements || {};
    const modal = elements.modal || null;

    const getCurrentUser =
      typeof options.getCurrentUser === "function"
        ? options.getCurrentUser
        : () => null;

    const setCurrentUser =
      typeof options.setCurrentUser === "function"
        ? options.setCurrentUser
        : () => {};

    const getUserFromMainSite =
      typeof options.getUserFromMainSite === "function"
        ? options.getUserFromMainSite
        : () => null;

    const syncGlobalChatUser =
      typeof options.syncGlobalChatUser === "function"
        ? options.syncGlobalChatUser
        : () => {};

    const ensureCurrentUserProfile =
      typeof options.ensureCurrentUserProfile === "function"
        ? options.ensureCurrentUserProfile
        : async () => {};

    const setupPresence =
      typeof options.setupPresence === "function"
        ? options.setupPresence
        : () => {};

    const syncSelectedPeerForCalls =
      typeof options.syncSelectedPeerForCalls === "function"
        ? options.syncSelectedPeerForCalls
        : () => {};

    const refreshPushButtonState =
      typeof options.refreshPushButtonState === "function"
        ? options.refreshPushButtonState
        : async () => {};

    const saveExistingPushSubscriptionIfPossible =
      typeof options.saveExistingPushSubscriptionIfPossible === "function"
        ? options.saveExistingPushSubscriptionIfPossible
        : async () => {};

    const getActiveMode =
      typeof options.getActiveMode === "function"
        ? options.getActiveMode
        : () => "public";

    const getSelectedPeer =
      typeof options.getSelectedPeer === "function"
        ? options.getSelectedPeer
        : () => null;

    const openPrivateDialog =
      typeof options.openPrivateDialog === "function"
        ? options.openPrivateDialog
        : async () => {};

    const loadPrivatePeople =
      typeof options.loadPrivatePeople === "function"
        ? options.loadPrivatePeople
        : async () => {};

    const setChatTabsLoading =
      typeof options.setChatTabsLoading === "function"
        ? options.setChatTabsLoading
        : () => {};

    async function handleAuthUserChange(user, source = "auth-change") {
      try {
        const nextUser =
          user ||
          getUserFromMainSite() ||
          getCurrentUser() ||
          null;

        setCurrentUser(nextUser);

        syncGlobalChatUser();
        await ensureCurrentUserProfile({ force: true, soft: true });

        setupPresence();
        syncSelectedPeerForCalls();

        if (getActiveMode() === "private" && modal && modal.classList.contains("open")) {
          const selectedPeer = getSelectedPeer();

          if (selectedPeer) {
            await openPrivateDialog(selectedPeer.id, selectedPeer.name);
          } else {
            await loadPrivatePeople();
          }
        }

        await refreshPushButtonState();
        await saveExistingPushSubscriptionIfPossible();
      } catch (error) {
        console.warn(`Klevby chat: ${source} обработан с предупреждением:`, error);
        setChatTabsLoading(false);
      }
    }

    if (chatDb && chatDb.auth && typeof chatDb.auth.onAuthStateChange === "function") {
      const authResult = chatDb.auth.onAuthStateChange(async (_event, session) => {
        await handleAuthUserChange(session?.user || null, "auth-change");
      });

      const subscription =
        authResult?.data?.subscription ||
        authResult?.subscription ||
        null;

      if (subscription && typeof subscription.unsubscribe === "function") {
        addCleanup(() => {
          subscription.unsubscribe();
        });
      }
    }

    const authChangedHandler = async (event) => {
      await handleAuthUserChange(event?.detail?.user || null, "klevby-auth-changed");
    };

    window.addEventListener("klevby-auth-changed", authChangedHandler);

    addCleanup(() => {
      window.removeEventListener("klevby-auth-changed", authChangedHandler);
    });
  }

  window.KlevbyChatAuthEvents = {
    init
  };
})();
