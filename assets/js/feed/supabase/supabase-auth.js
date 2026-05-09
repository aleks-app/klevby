(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};

  function extractSession(value) {
    const parsed = Core.safeJsonParse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const candidates = [
      parsed,
      parsed.currentSession,
      parsed.session,
      parsed.data?.session,
      parsed.auth?.currentSession,
      parsed.auth?.session
    ].filter(Boolean);

    for (const candidate of candidates) {
      const accessToken =
        candidate.access_token ||
        candidate.accessToken ||
        candidate.provider_token ||
        "";

      if (!accessToken) continue;

      const user =
        candidate.user ||
        parsed.user ||
        parsed.currentUser ||
        parsed.data?.user ||
        null;

      const expiresAt = Number(candidate.expires_at || candidate.expiresAt || 0);

      return {
        accessToken: String(accessToken),
        refreshToken: String(candidate.refresh_token || candidate.refreshToken || ""),
        expiresAt,
        user
      };
    }

    return null;
  }

  function isSessionFresh(session, graceSeconds = Core.TOKEN_EXPIRY_GRACE_SECONDS) {
    if (!session || !session.accessToken) {
      return false;
    }

    const expiresAt = Number(session.expiresAt || 0);

    if (!expiresAt) {
      return true;
    }

    const expiresAtMs = expiresAt > 100000000000 ? expiresAt : expiresAt * 1000;
    const graceMs = Math.max(0, Number(graceSeconds || 0)) * 1000;

    return expiresAtMs - Date.now() > graceMs;
  }

  function getStoredSession() {
    const config = Core.getConfig();
    const directKeys = [
      config.supabaseStorageKey,
      "sb-klevby-auth-token"
    ].filter(Boolean);

    try {
      for (const key of directKeys) {
        const raw = localStorage.getItem(key);
        const session = extractSession(raw);

        if (session && session.accessToken) {
          return session;
        }
      }

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = String(localStorage.key(i) || "");

        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) {
          continue;
        }

        const raw = localStorage.getItem(key);
        const session = extractSession(raw);

        if (session && session.accessToken) {
          return session;
        }
      }
    } catch (error) {
      console.debug("Klevby feed: stored auth session skipped", error);
    }

    return null;
  }

  async function getAuthContext(options = {}) {
    const requireAuth = Boolean(options.requireAuth);

    if (!requireAuth) {
      return {
        accessToken: "",
        user: null,
        source: "anon_public"
      };
    }

    const storedSession = getStoredSession();

    if (isSessionFresh(storedSession)) {
      return {
        accessToken: storedSession.accessToken,
        user: storedSession.user || null,
        source: "storage"
      };
    }

    if (storedSession && storedSession.accessToken) {
      console.debug("Klevby feed: stored auth session expired/skipped");
    }

    const db = Core.getClient();

    if (db && db.auth && typeof db.auth.getSession === "function") {
      try {
        const sessionResult = await Core.withTimeout(
          db.auth.getSession(),
          Core.AUTH_TIMEOUT_MS,
          null
        );

        const session = sessionResult?.data?.session || null;

        if (
          session &&
          session.access_token &&
          isSessionFresh({
            accessToken: session.access_token,
            expiresAt: session.expires_at,
            user: session.user || null
          })
        ) {
          return {
            accessToken: String(session.access_token),
            user: session.user || null,
            source: "sdk_session"
          };
        }
      } catch (error) {
        console.debug("Klevby feed: auth session skipped", error);
      }
    }

    return {
      accessToken: "",
      user: null,
      source: "missing"
    };
  }

  function getCurrentUser() {
    if (window.currentUser) return window.currentUser;
    if (window.klevbyCurrentUser) return window.klevbyCurrentUser;
    if (window.klevbyUser) return window.klevbyUser;

    const storedSession = getStoredSession();

    if (storedSession?.user?.id) {
      return storedSession.user;
    }

    if (typeof window.klevbyGetCurrentUser === "function") {
      try {
        const user = window.klevbyGetCurrentUser();

        if (user && typeof user.then !== "function") {
          return user;
        }
      } catch (error) {
        console.debug("Klevby feed: current user getter skipped", error);
      }
    }

    return null;
  }

  async function getViewerUserId(db, options = {}) {
    const restore = Boolean(options.restore);

    let user = getCurrentUser();

    if (user && user.id) {
      return String(user.id);
    }

    if (restore && typeof window.restoreAuthState === "function") {
      try {
        await Core.withTimeout(
          window.restoreAuthState("feed_supabase_viewer", false),
          Core.AUTH_TIMEOUT_MS,
          null
        );
      } catch (error) {
        console.debug("Klevby feed: restore auth for viewer skipped", error);
      }

      user = getCurrentUser();

      if (user && user.id) {
        return String(user.id);
      }
    }

    if (db && db.auth && typeof db.auth.getUser === "function") {
      try {
        const result = await Core.withTimeout(
          db.auth.getUser(),
          Core.AUTH_TIMEOUT_MS,
          null
        );

        const authUser = result?.data?.user || null;

        if (authUser && authUser.id) {
          return String(authUser.id);
        }
      } catch (error) {
        console.debug("Klevby feed: auth.getUser skipped", error);
      }
    }

    return "";
  }

  async function ensureUser() {
    let user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    const storedSession = getStoredSession();

    if (storedSession?.user?.id) {
      return storedSession.user;
    }

    if (typeof window.restoreAuthState === "function") {
      try {
        await Core.withTimeout(
          window.restoreAuthState("feed_supabase_action", false),
          Core.AUTH_TIMEOUT_MS,
          null
        );
      } catch (error) {
        console.warn("Klevby feed: не удалось восстановить вход", error);
      }
    }

    user = getCurrentUser();

    if (user && user.id) {
      return user;
    }

    const db = Core.getClient();

    if (db && db.auth && typeof db.auth.getUser === "function") {
      try {
        const result = await Core.withTimeout(
          db.auth.getUser(),
          Core.AUTH_TIMEOUT_MS,
          null
        );

        const authUser = result?.data?.user || null;

        if (authUser && authUser.id) {
          return authUser;
        }
      } catch (error) {
        console.debug("Klevby feed: auth user fallback skipped", error);
      }
    }

    return null;
  }

  function readProfileData() {
    try {
      const raw = localStorage.getItem(Core.PROFILE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const user = getCurrentUser();
      const meta = user?.user_metadata || {};

      const fallbackName =
        localStorage.getItem(Core.PROFILE_NAME_KEY) ||
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        "";

      let avatar = "";

      try {
        avatar = localStorage.getItem(Core.PROFILE_AVATAR_KEY) || "";
      } catch (avatarError) {
        avatar = "";
      }

      return {
        name: String(parsed.name || fallbackName || "Рыбак").trim(),
        city: String(parsed.city || "").trim(),
        telegram: String(parsed.telegram || "").trim(),
        about: String(parsed.about || "").trim(),
        avatar: String(avatar || "").trim()
      };
    } catch (error) {
      console.warn("Klevby feed: не удалось прочитать данные профиля", error);

      return {
        name: "Рыбак",
        city: "",
        telegram: "",
        about: "",
        avatar: ""
      };
    }
  }

  window.KlevbyFeedSupabaseAuth = {
    extractSession,
    isSessionFresh,
    getStoredSession,
    getAuthContext,
    getCurrentUser,
    getViewerUserId,
    ensureUser,
    readProfileData
  };
})();
