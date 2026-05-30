(function () {
  if (window.KlevbyChatUser) {
    return;
  }

  let ctx = null;

  let userRefreshPromise = null;
  let lastUserRefreshAt = 0;
  let profileSavePromise = null;
  let lastProfileSaveAt = 0;

  const CHAT_AUTH_REFRESH_THROTTLE_MS = 3000;
  const PROFILE_SAVE_THROTTLE_MS = 7000;
  const guestNameKey = "klevby_chat_guest_name";

  const fallbackProfiles = new Map();

  function init(options = {}) {
    ctx = options || {};
  }

  function getCtx() {
    if (!ctx) {
      throw new Error("KlevbyChatUser не инициализирован. Проверь подключение chat-user.js перед chat.js");
    }

    return ctx;
  }

  function getMainSupabaseClient() {
    return getCtx().getMainSupabaseClient ? getCtx().getMainSupabaseClient() : null;
  }

  function getProfilesMap() {
    return getCtx().userProfiles || fallbackProfiles;
  }

  function getCurrentUser() {
    return getCtx().getCurrentUser ? getCtx().getCurrentUser() : null;
  }

  function setCurrentUser(user) {
    if (getCtx().setCurrentUser) {
      getCtx().setCurrentUser(user || null);
    }
  }


  function isMainAuthGuestAuthoritative() {
    const recentLogout =
      typeof window.isAuthLogoutGuardActive === "function"
        ? window.isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);

    return Boolean(
      (recentLogout || window.klevbyAuthReady) &&
      !window.currentUser &&
      !window.klevbyCurrentUser &&
      !window.klevbyUser
    );
  }

  function getUserFromMainSite() {
    const fromGetter =
      typeof window.klevbyGetCurrentUser === "function"
        ? window.klevbyGetCurrentUser()
        : null;

    return (
      fromGetter ||
      window.klevbyCurrentUser ||
      window.currentUser ||
      window.klevbyUser ||
      null
    );
  }

  function syncGlobalChatUser() {
    const user = getCurrentUser();

    if (!user || !user.id) return;
  }

  function isAuthLockError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("lock") && message.includes("auth-token");
  }

  function isValidSupabaseUuid(value) {
    const id = String(value || "").trim();

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  function getValidProfileIds(ids = []) {
    return [...new Set(
      (ids || [])
        .map((id) => String(id || "").trim())
        .filter((id) => isValidSupabaseUuid(id))
    )];
  }

  function getGuestName() {
    let name = "";

    try {
      name = localStorage.getItem(guestNameKey);
    } catch {
      name = "";
    }

    if (!name) {
      name = "Рыбак-" + Math.floor(1000 + Math.random() * 9000);

      try {
        localStorage.setItem(guestNameKey, name);
      } catch {
        // localStorage может быть недоступен в некоторых режимах браузера.
      }
    }

    return name;
  }

  function cleanDisplayName(value) {
    let name = String(value || "").trim();

    if (!name) return "";

    if (name.includes("@")) {
      name = name.split("@")[0];
    }

    name = name
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return name.slice(0, 32);
  }

  function getMetadataName(user = getCurrentUser()) {
    const meta = user?.user_metadata || {};

    return cleanDisplayName(
      meta.nickname ||
      meta.username ||
      meta.display_name ||
      meta.name ||
      meta.full_name ||
      ""
    );
  }

  async function refreshCurrentUser(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();
    const mainUser = getUserFromMainSite();

    if (!mainUser && isMainAuthGuestAuthoritative()) {
      setCurrentUser(null);
      lastUserRefreshAt = now;
      return null;
    }

    if (mainUser && mainUser.id) {
      setCurrentUser(mainUser);
      lastUserRefreshAt = now;
      return mainUser;
    }

    const currentUser = getCurrentUser();

    if (!force && currentUser && currentUser.id && now - lastUserRefreshAt < CHAT_AUTH_REFRESH_THROTTLE_MS) {
      return currentUser;
    }

    if (!force && userRefreshPromise) {
      return userRefreshPromise;
    }

    const mainClient = getMainSupabaseClient();

    if (!mainClient?.auth?.getUser) {
      const fallbackUser = isMainAuthGuestAuthoritative() ? null : (getUserFromMainSite() || currentUser || null);
      setCurrentUser(fallbackUser);
      return fallbackUser;
    }

    lastUserRefreshAt = now;

    userRefreshPromise = (async () => {
      try {
        const { data, error } = await mainClient.auth.getUser();

        if (error) {
          if (!isAuthLockError(error)) {
            console.warn("Не удалось получить пользователя из основного клиента:", error);
          }

          const fallbackUser = isMainAuthGuestAuthoritative() ? null : (getUserFromMainSite() || getCurrentUser() || null);
          setCurrentUser(fallbackUser);
          return fallbackUser;
        }

        if (data?.user && !isMainAuthGuestAuthoritative()) {
          setCurrentUser(data.user);
          syncGlobalChatUser();
          return data.user;
        }
      } catch (error) {
        if (!isAuthLockError(error)) {
          console.warn("Не удалось получить пользователя из основного клиента:", error);
        }
      } finally {
        userRefreshPromise = null;
      }

      const fallbackUser = isMainAuthGuestAuthoritative() ? null : (getUserFromMainSite() || getCurrentUser() || null);
      setCurrentUser(fallbackUser);
      return fallbackUser;
    })();

    return userRefreshPromise;
  }

  function getCurrentChatName() {
    const currentUser = getCurrentUser();
    const nickname = getMetadataName(currentUser);

    if (nickname) {
      return nickname;
    }

    let savedName = "";

    try {
      savedName =
        cleanDisplayName(localStorage.getItem("klevby_chat_username")) ||
        cleanDisplayName(localStorage.getItem("klevby_author_name"));
    } catch {
      savedName = "";
    }

    if (savedName) {
      return savedName;
    }

    if (currentUser?.email) {
      return cleanDisplayName(currentUser.email);
    }

    return getGuestName();
  }

  async function ensureCurrentUserProfile(options = {}) {
    const force = Boolean(options.force);
    const soft = options.soft !== false;
    const now = Date.now();

    await refreshCurrentUser({ force: false });

    const currentUser = getCurrentUser();

    if (!currentUser || !isValidSupabaseUuid(currentUser.id)) return;

    const nickname = getCurrentChatName();
    const profiles = getProfilesMap();

    if (currentUser.id && nickname) {
      profiles.set(String(currentUser.id), nickname);
    }

    if (!force && now - lastProfileSaveAt < PROFILE_SAVE_THROTTLE_MS) {
      return;
    }

    if (!force && profileSavePromise) {
      return profileSavePromise;
    }

    const client = getMainSupabaseClient();
    if (!client?.from) return;

    lastProfileSaveAt = now;

    profileSavePromise = (async () => {
      try {
        const { error } = await client.from("profiles").upsert(
          [
            {
              id: currentUser.id,
              nickname: nickname,
              username: nickname,
              display_name: nickname,
              email: currentUser.email || "",
              updated_at: new Date().toISOString()
            }
          ],
          { onConflict: "id" }
        );

        if (error) {
          if (!soft) throw error;
          console.warn("Профиль пользователя не сохранён:", error);
        }
      } catch (error) {
        if (!soft) throw error;
        console.warn("Профиль пользователя не сохранён:", error);
      } finally {
        profileSavePromise = null;
      }
    })();

    return profileSavePromise;
  }

  async function loadProfilesByIds(ids = []) {
    const uniqueIds = getValidProfileIds(ids);

    if (!uniqueIds.length) return;

    const client = getMainSupabaseClient();

    if (!client?.from) return;

    try {
      const { data, error } = await client
        .from("public_profiles")
        .select("id,nickname,username,display_name,avatar_url")
        .in("id", uniqueIds);

      if (error) {
        console.warn("Публичные профили не загружены:", error);
        return;
      }

      const profiles = getProfilesMap();

      (data || []).forEach((profile) => {
        const name = cleanDisplayName(
          profile.nickname ||
          profile.username ||
          profile.display_name ||
          "Рыбак"
        );

        if (profile.id && name && isValidSupabaseUuid(profile.id)) {
          profiles.set(String(profile.id), name);
        }
      });
    } catch (error) {
      console.warn("Публичные профили не загружены:", error);
    }
  }

  function rememberFallbackProfile(userId, name) {
    const id = String(userId || "").trim();
    const cleanName = cleanDisplayName(name);

    if (!id || !cleanName) return;
    if (!isValidSupabaseUuid(id)) return;

    const profiles = getProfilesMap();

    if (!profiles.has(id)) {
      profiles.set(id, cleanName);
    }
  }

  function getProfileName(userId, fallback = "Рыбак") {
    const id = String(userId || "").trim();
    const profiles = getProfilesMap();

    if (id && profiles.has(id)) {
      return profiles.get(id) || cleanDisplayName(fallback) || "Рыбак";
    }

    return cleanDisplayName(fallback) || "Рыбак";
  }

  window.KlevbyChatUser = {
    init,
    getUserFromMainSite,
    syncGlobalChatUser,
    isAuthLockError,
    isValidSupabaseUuid,
    getValidProfileIds,
    getGuestName,
    cleanDisplayName,
    getMetadataName,
    refreshCurrentUser,
    getCurrentChatName,
    ensureCurrentUserProfile,
    loadProfilesByIds,
    rememberFallbackProfile,
    getProfileName
  };
})();
