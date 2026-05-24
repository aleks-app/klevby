(function initKlevbySupabaseCompat(global) {
  const core = global.KlevbySupabaseCore || {};

  function readClient() {
    if (typeof core.getClient === "function") {
      return core.getClient();
    }

    return null;
  }

  function syncCompatGlobals() {
    const client = readClient();
    global.klevbySupabase = client;
    global.supabaseClient = client;
    return client;
  }

  global.klevbyGetSupabase = function klevbyGetSupabase() {
    return syncCompatGlobals();
  };

  syncCompatGlobals();

  global.KlevbySupabaseCompatGlobals = {
    syncCompatGlobals
  };
})(window);
