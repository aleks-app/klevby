(function initKlevbySupabaseAuthService(global) {
  const state = {
    bound: false,
    unsubscribe: null,
    client: null
  };

  function cleanupPreviousSubscription() {
    if (typeof state.unsubscribe === "function") {
      try {
        state.unsubscribe();
      } catch (_) {
        // no-op
      }
    }

    state.unsubscribe = null;
    state.client = null;
    state.bound = false;
  }

  function bindAuthStateListener(options = {}) {
    const safeOptions = options || {};
    const client = safeOptions.client || null;
    const callback = safeOptions.callback;

    if (!client || !client.auth || typeof client.auth.onAuthStateChange !== "function") {
      return false;
    }

    if (typeof callback !== "function") {
      return false;
    }

    if (state.bound && state.client === client) {
      return true;
    }

    cleanupPreviousSubscription();

    const subscriptionResult = client.auth.onAuthStateChange(callback);
    const unsubscribe =
      subscriptionResult?.data?.subscription?.unsubscribe ||
      subscriptionResult?.data?.unsubscribe ||
      subscriptionResult?.unsubscribe ||
      null;

    if (typeof unsubscribe === "function") {
      state.unsubscribe = unsubscribe.bind(
        subscriptionResult?.data?.subscription ||
        subscriptionResult?.data ||
        subscriptionResult
      );
    }

    state.client = client;
    state.bound = true;
    return true;
  }

  function unbindAuthStateListener() {
    cleanupPreviousSubscription();
    return true;
  }

  function isAuthStateListenerBound() {
    return state.bound;
  }

  function getAuthStateListenerStatus() {
    return {
      bound: state.bound,
      hasClient: Boolean(state.client),
      hasUnsubscribe: typeof state.unsubscribe === "function"
    };
  }

  global.KlevbySupabaseAuthService = {
    bindAuthStateListener,
    unbindAuthStateListener,
    isAuthStateListenerBound,
    getAuthStateListenerStatus
  };
})(window);
