(function initKlevbySupabaseCore(global) {
  const state = {
    client: null
  };

  function publishClient() {
    return state.client;
  }

  function hasClient() {
    return Boolean(state.client);
  }

  function getClient() {
    return state.client;
  }

  function initClient(options = {}) {
    if (state.client) {
      return state.client;
    }

    const safeOptions = options || {};
    const supabaseLib = safeOptions.supabaseLib || global.supabase;
    const url = safeOptions.url || "";
    const anonKey = safeOptions.anonKey || "";
    const clientOptions = safeOptions.options || {};

    if (!supabaseLib || typeof supabaseLib.createClient !== "function") {
      return null;
    }

    if (!url || !anonKey) {
      return null;
    }

    state.client = supabaseLib.createClient(url, anonKey, clientOptions);
    return state.client;
  }

  global.KlevbySupabaseCore = {
    initClient,
    getClient,
    hasClient,
    publishClient
  };
})(window);
