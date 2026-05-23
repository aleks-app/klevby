(function () {
  if (window.KlevbyChatPrivateUtils) return;

  function escapeCssUrl(value) {
    return String(value || "")
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "")
      .replaceAll("\r", "")
      .replaceAll('"', "%22")
      .replaceAll("'", "%27")
      .trim();
  }

  function normalizePrivateAvatarUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/")) return url;
    return "";
  }

  function createPrivateTimeoutError(step, timeoutMs) {
    const error = new Error(`Klevby private: step "${step}" timed out after ${timeoutMs}ms.`);
    error.name = "KlevbyPrivateTimeoutError";
    error.code = "PRIVATE_STEP_TIMEOUT";
    error.step = step;
    error.timeoutMs = timeoutMs;
    return error;
  }

  async function withPrivateStepTimeout(step, runner, timeoutMs, options = {}) {
    const startedAt = Date.now();
    const silent = options?.silent === true;

    if (!silent) {
      console.info("[KlevbyPrivate] step start", { step, timeoutMs });
    }

    let timer = null;
    try {
      const result = await Promise.race([
        Promise.resolve().then(runner),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(createPrivateTimeoutError(step, timeoutMs)), timeoutMs);
        })
      ]);

      if (!silent) {
        console.info("[KlevbyPrivate] step end", { step, durationMs: Date.now() - startedAt });
      }

      return result;
    } catch (error) {
      if (!silent) {
        const level = error?.code === "PRIVATE_STEP_TIMEOUT" ? "warn" : "error";
        console[level]("[KlevbyPrivate] step fail", {
          step,
          durationMs: Date.now() - startedAt,
          error: String(error?.message || error),
          code: error?.code || null
        });
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function runPrivateStepTimeout(step, timeoutMs, runner) {
    const controller = new AbortController();
    try {
      return await withPrivateStepTimeout(step, () => runner(controller.signal), timeoutMs);
    } finally {
      controller.abort();
    }
  }

  function getPrivateAccessTokenQuick({ getMainSupabaseClient }) {
    try {
      const client = getMainSupabaseClient ? getMainSupabaseClient() : null;
      const session = client?.auth?.session?.();
      const accessToken = session?.access_token;
      if (accessToken) return String(accessToken);
    } catch (_) {}

    try {
      const config = window.KLEVB_CONFIG || {};
      const storageKey = String(
        config.SUPABASE_STORAGE_KEY ||
          window.SUPABASE_STORAGE_KEY ||
          "sb-oecdshvozssadztcokog-auth-token"
      ).trim();
      if (!storageKey) return "";
      const raw = localStorage.getItem(storageKey);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      const accessToken = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
      return accessToken ? String(accessToken) : "";
    } catch (_) {
      return "";
    }
  }

  function getCurrentUserIdQuick({ getCurrentUser, isValidSupabaseUuid, getPrivateAccessTokenQuickFn }) {
    const directId = String(getCurrentUser?.()?.id || "").trim();
    if (isValidSupabaseUuid?.(directId)) return directId;

    const accessToken = getPrivateAccessTokenQuickFn ? getPrivateAccessTokenQuickFn() : "";
    if (!accessToken) return "";

    try {
      const payloadPart = accessToken.split(".")[1] || "";
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
      const parsed = JSON.parse(decoded);
      const sub = String(parsed?.sub || "").trim();
      return isValidSupabaseUuid?.(sub) ? sub : "";
    } catch (_) {
      return "";
    }
  }

  window.KlevbyChatPrivateUtils = {
    escapeCssUrl,
    normalizePrivateAvatarUrl,
    withPrivateStepTimeout,
    runPrivateStepTimeout,
    getPrivateAccessTokenQuick,
    getCurrentUserIdQuick
  };
})();
