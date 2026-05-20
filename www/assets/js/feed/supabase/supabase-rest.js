(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};
  const Auth = window.KlevbyFeedSupabaseAuth || {};

  async function restRequest(path, options = {}) {
    const config = Core.getConfig();
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const method = String(options.method || "GET").toUpperCase();
    const requireAuth = Boolean(options.requireAuth);
    const timeoutMs = Number(options.timeoutMs || Core.REST_TIMEOUT_MS);

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("REST Supabase не настроен.");
    }

    const authContext = await Auth.getAuthContext({
      requireAuth
    });

    if (requireAuth && !authContext.accessToken) {
      throw new Error("Сначала войди, чтобы выполнить действие.");
    }

    const query = options.query ? `?${String(options.query).replace(/^\?/, "")}` : "";
    const url = `${config.supabaseUrl}/rest/v1/${cleanPath}${query}`;

    const headers = {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${authContext.accessToken || config.supabaseAnonKey}`,
      Accept: "application/json"
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (options.prefer) {
      headers.Prefer = String(options.prefer);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, Math.max(1200, timeoutMs));

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      const text = await response.text();
      const data = text ? Core.safeJsonParse(text) : null;

      if (!response.ok) {
        const message =
          data?.message ||
          data?.error_description ||
          data?.error ||
          `Supabase REST ошибка ${response.status}`;

        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        error.code = data?.code || "";
        error.details = data?.details || "";
        error.hint = data?.hint || "";
        throw error;
      }

      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Supabase не ответил.");
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  window.KlevbyFeedSupabaseRest = {
    restRequest
  };
})();
