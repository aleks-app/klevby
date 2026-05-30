(function () {
  function logFeedMarker(functionName, reason, detail = {}) {
    const api = window.KlevbyFeedMainDebug;
    if (!api || typeof api.log !== "function") return;
    try {
      api.log("full_refresh_marker", String(reason || ""), {
        source: "profile-core",
        function: String(functionName || "unknown"),
        action: String(detail.action || "profile_sync_refresh"),
        refreshKind: "full",
        delay: Number(detail.delay || 0),
        postId: detail.postId ? String(detail.postId) : "",
        visible: document.visibilityState !== "hidden"
      });
    } catch (_) {}
  }

  const KLEVB_PROFILE_STORAGE_KEY = "klevby_profile_settings";
  const KLEVB_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_PROFILE_PHOTOS_KEY = "klevby_profile_photos";

  const KLEVB_PROFILE_MAX_PHOTOS = 8;
  const KLEVB_PROFILE_AVATAR_BUCKET = "profile-avatars";
  const KLEVB_PROFILE_FEED_POSTS_TABLE = "feed_posts";
  const KLEVB_PROFILE_REST_TIMEOUT_MS = 12000;
  const KLEVB_PROFILE_TOKEN_EXPIRY_GRACE_SECONDS = 90;

  function getProfileUtils() {
    return window.KlevbyProfileUtils || {};
  }

  function requireProfileUtilsMethod(name) {
    const utils = getProfileUtils();

    if (utils && typeof utils[name] === "function") {
      return utils[name].bind(utils);
    }

    const error = new Error(`KlevbyProfileUtils.${name} is not available`);
    console.error("[KlevbyProfileCore] profile-utils.js не готов или функция не найдена:", name, error);
    throw error;
  }

  function getProfileStorage() {
    return window.KlevbyProfileStorage || {};
  }

  function requireProfileStorageMethod(name) {
    const storage = getProfileStorage();

    if (storage && typeof storage[name] === "function") {
      return storage[name].bind(storage);
    }

    const error = new Error(`KlevbyProfileStorage.${name} is not available`);
    console.error("[KlevbyProfileCore] profile-storage.js не готов или функция не найдена:", name, error);
    throw error;
  }

  function getDefaultProfileData() {
    return requireProfileStorageMethod("getDefaultProfileData")();
  }

  function escapeHtml(value) {
    return requireProfileUtilsMethod("escapeHtml")(value);
  }

  function formatTelegramLabel(value) {
    return requireProfileUtilsMethod("formatTelegramLabel")(value);
  }

  function isPublicUrl(value) {
    return requireProfileUtilsMethod("isPublicUrl")(value);
  }

  function waitForFrame() {
    return requireProfileUtilsMethod("waitForFrame")();
  }

  function parseProfileAuthStorageValue(raw) {
    return requireProfileUtilsMethod("parseProfileAuthStorageValue")(raw);
  }

  function decodeJwtPayload(token) {
    return requireProfileUtilsMethod("decodeJwtPayload")(token);
  }

  function getJwtExpiresAtMs(token) {
    return requireProfileUtilsMethod("getJwtExpiresAtMs")(token);
  }

  function isProfileAccessTokenUsable(token, graceSeconds = KLEVB_PROFILE_TOKEN_EXPIRY_GRACE_SECONDS) {
    return requireProfileUtilsMethod("isProfileAccessTokenUsable")(token, graceSeconds);
  }

  function encodeStoragePath(path) {
    return requireProfileUtilsMethod("encodeStoragePath")(path);
  }

  function promiseWithTimeout(promise, timeoutMs, message = "Timeout") {
    return requireProfileUtilsMethod("promiseWithTimeout")(promise, timeoutMs, message);
  }

  function fetchWithTimeout(url, options = {}, timeoutMs = KLEVB_PROFILE_REST_TIMEOUT_MS) {
    return requireProfileUtilsMethod("fetchWithTimeout")(url, options, timeoutMs);
  }

  function blobToDataUrl(blob) {
    return requireProfileUtilsMethod("blobToDataUrl")(blob);
  }

  function estimateDataUrlSizeKb(dataUrl) {
    return requireProfileUtilsMethod("estimateDataUrlSizeKb")(dataUrl);
  }

  // Auth ownership boundary (legacy fallback only — do not expand):
  // app.js and auth.js own login/logout, session restore, and global currentUser.
  // Profile must prefer klevbyGetCurrentUser / window.currentUser* first.
  // getProfileStoredAuthData* helpers read Supabase keys from localStorage only as a
  // last resort when globals or the Supabase client are not ready. Do not add new auth
  // flows here; extend app.js/auth.js instead.
  const KLEVB_PROFILE_STORED_AUTH_FALLBACK_BOUNDARY = "legacy-read-only";

  function getProfileStoredAuthData() {
    try {
      const preferredKeys = [
        "sb-klevby-auth-token",
        "supabase.auth.token"
      ];

      for (const key of preferredKeys) {
        const raw = localStorage.getItem(key);
        const parsed = parseProfileAuthStorageValue(raw);

        if (parsed) {
          return parsed;
        }
      }

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || "";

        if (!key.includes("auth-token") && !key.startsWith("sb-")) {
          continue;
        }

        const raw = localStorage.getItem(key);
        const parsed = parseProfileAuthStorageValue(raw);

        if (
          parsed?.access_token ||
          parsed?.currentSession?.access_token ||
          parsed?.session?.access_token
        ) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("[KlevbyProfileCore] Не удалось прочитать auth из localStorage.", error);
    }

    return null;
  }

  function getProfileSessionFromAuthData(authData) {
    if (!authData || typeof authData !== "object") {
      return null;
    }

    if (authData.currentSession?.access_token) {
      return authData.currentSession;
    }

    if (authData.session?.access_token) {
      return authData.session;
    }

    if (authData.data?.session?.access_token) {
      return authData.data.session;
    }

    if (authData.access_token) {
      return authData;
    }

    return null;
  }

  function getProfileAccessTokenFromStoredAuth() {
    const authData = getProfileStoredAuthData();
    const session = getProfileSessionFromAuthData(authData);
    const token = String(session?.access_token || "");

    return token;
  }

  function getProfileUserFromStoredAuth() {
    const authData = getProfileStoredAuthData();
    const session = getProfileSessionFromAuthData(authData);

    return (
      session?.user ||
      authData?.user ||
      authData?.currentSession?.user ||
      authData?.session?.user ||
      authData?.data?.session?.user ||
      null
    );
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

  function getCurrentProfileUser() {
    const mainUser =
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      null;

    if (mainUser || isMainAuthGuestAuthoritative()) {
      return mainUser;
    }

    // Stored-auth fallback only — see KLEVB_PROFILE_STORED_AUTH_FALLBACK_BOUNDARY above.
    return getProfileUserFromStoredAuth() || null;
  }

  function getProfileNameFromCurrentUser() {
    try {
      const user = getCurrentProfileUser();
      const meta = user?.user_metadata || {};

      return (
        meta.username ||
        meta.name ||
        meta.full_name ||
        user?.email?.split("@")?.[0] ||
        ""
      ).trim();
    } catch (_) {
      return "";
    }
  }

  function getProfileNameFromInputs() {
    const nameInput = document.getElementById("nameInput");
    const usernameInput = document.getElementById("usernameInput");

    const nameValue = nameInput && nameInput.value ? nameInput.value.trim() : "";
    const usernameValue = usernameInput && usernameInput.value ? usernameInput.value.trim() : "";

    return nameValue || usernameValue || "";
  }

  function readProfileData() {
    return requireProfileStorageMethod("readProfileData")();
  }

  function saveProfileData(data) {
    return requireProfileStorageMethod("saveProfileData")(data);
  }

  function readProfilePhotos() {
    return requireProfileStorageMethod("readProfilePhotos")();
  }

  function saveProfilePhotos(photos) {
    return requireProfileStorageMethod("saveProfilePhotos")(photos);
  }

  function getProfileFeedItems() {
    return requireProfileStorageMethod("getProfileFeedItems")();
  }

  function countUserPosts(profileName) {
    try {
      const postsArray = Array.isArray(window.posts) ? window.posts : [];
      const currentUser = getCurrentProfileUser();
      const ownerName = String(profileName || "").trim().toLowerCase();

      const userPosts = postsArray.filter((post) => {
        const postName = String(post?.name || "").trim().toLowerCase();
        const postOwnerId = post?.owner_id || post?.user_id || "";
        const currentUserId = currentUser?.id || "";

        if (currentUserId && postOwnerId && String(postOwnerId) === String(currentUserId)) {
          return true;
        }

        return postName && ownerName && postName === ownerName;
      });

      return userPosts.length || 0;
    } catch (_) {
      return 0;
    }
  }

  function makeLocalProfilePhoto(compressedPhoto, file, feedItem = null) {
    const uploadedUrl = feedItem?.imageUrl || feedItem?.image || "";

    return {
      id: `photo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      src: uploadedUrl || compressedPhoto.dataUrl,
      title: "Фото с рыбалки",
      createdAt: new Date().toISOString(),
      originalSizeKb: Math.round((file?.size || 0) / 1024),
      savedSizeKb: compressedPhoto.sizeKb,
      width: compressedPhoto.width,
      height: compressedPhoto.height,
      source: feedItem ? "supabase" : "local",
      feedPostId: feedItem?.id || "",
      feedImagePath: feedItem?.imagePath || "",
      feedImageUrl: uploadedUrl,
      feedSyncError: ""
    };
  }

  function updateLocalPhotoWithFeedItem(photo, feedItem) {
    if (!photo || !feedItem) return photo;

    const uploadedUrl = feedItem.imageUrl || feedItem.image || photo.feedImageUrl || "";

    return {
      ...photo,
      src: uploadedUrl || photo.src,
      source: "supabase",
      feedPostId: feedItem.id || photo.feedPostId || "",
      feedImagePath: feedItem.imagePath || photo.feedImagePath || "",
      feedImageUrl: uploadedUrl || photo.feedImageUrl || "",
      feedSyncError: ""
    };
  }

  function getProfileSupabaseClient() {
    if (
      window.KlevbyFeedSupabaseCore &&
      typeof window.KlevbyFeedSupabaseCore.getClient === "function"
    ) {
      return window.KlevbyFeedSupabaseCore.getClient();
    }

    return window.supabaseClient || window.klevbySupabase || null;
  }

  function getProfileSupabaseUrl() {
    const config = window.KLEVB_CONFIG || window.KlevbyConfig || {};
    const client = getProfileSupabaseClient();

    return String(
      config.SUPABASE_URL ||
      config.supabaseUrl ||
      config.supabase_url ||
      window.SUPABASE_URL ||
      client?.supabaseUrl ||
      ""
    ).replace(/\/+$/, "");
  }

  function getProfileSupabaseAnonKey() {
    const config = window.KLEVB_CONFIG || window.KlevbyConfig || {};
    const client = getProfileSupabaseClient();

    return String(
      config.SUPABASE_ANON_KEY ||
      config.supabaseAnonKey ||
      config.supabase_anon_key ||
      window.SUPABASE_ANON_KEY ||
      client?.supabaseKey ||
      ""
    );
  }

  async function resolveCurrentProfileUser(supabase = null) {
    const localUser =
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      null;

    if (localUser?.id) {
      return localUser;
    }

    const client = supabase || getProfileSupabaseClient();

    if (client?.auth && typeof client.auth.getUser === "function") {
      try {
        const { data, error } = await promiseWithTimeout(
          client.auth.getUser(),
          2500,
          "auth.getUser timeout"
        );

        if (!error && data?.user?.id) {
          return data.user;
        }

        if (error) {
          console.debug("[KlevbyProfileCore] auth.getUser не вернул пользователя.", error);
        }
      } catch (error) {
        console.debug("[KlevbyProfileCore] Ошибка auth.getUser.", error);
      }
    }

    // Stored-auth fallback only — see KLEVB_PROFILE_STORED_AUTH_FALLBACK_BOUNDARY above.
    const storedUser = getProfileUserFromStoredAuth();

    if (storedUser?.id) {
      return storedUser;
    }

    if (!client?.auth) {
      console.info("[KlevbyProfileCore] Пользователь не найден локально, Supabase auth недоступен.");
    }

    return null;
  }

  function dataUrlToBlobSafe(dataUrl) {
    if (
      window.KlevbyFeedSupabaseCore &&
      typeof window.KlevbyFeedSupabaseCore.dataUrlToBlob === "function"
    ) {
      return window.KlevbyFeedSupabaseCore.dataUrlToBlob(dataUrl);
    }

    const value = String(dataUrl || "");
    const parts = value.split(",");

    if (parts.length < 2) {
      throw new Error("Некорректный формат изображения.");
    }

    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "image/jpeg";

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }

  function getProfileRestAuthContext() {
    const supabaseUrl = getProfileSupabaseUrl();
    const anonKey = getProfileSupabaseAnonKey();
    const storedToken = getProfileAccessTokenFromStoredAuth();
    const accessToken = isProfileAccessTokenUsable(storedToken) ? storedToken : "";

    return {
      supabaseUrl,
      anonKey,
      accessToken
    };
  }

  async function getSessionFromSupabaseAuth(client, options = {}) {
    if (!client?.auth || typeof client.auth.getSession !== "function") {
      return null;
    }

    let session = null;

    try {
      const result = await promiseWithTimeout(
        client.auth.getSession(),
        3500,
        "Supabase auth.getSession timeout"
      );

      if (!result?.error && result?.data?.session?.access_token) {
        session = result.data.session;
      } else if (result?.error) {
        console.debug("[KlevbyProfileCore] auth.getSession вернул ошибку.", result.error);
      }
    } catch (error) {
      console.debug("[KlevbyProfileCore] auth.getSession не ответил.", error);
    }

    if (
      session?.access_token &&
      isProfileAccessTokenUsable(session.access_token, options.graceSeconds)
    ) {
      return session;
    }

    if (
      session?.access_token &&
      !isProfileAccessTokenUsable(session.access_token, options.graceSeconds) &&
      typeof client.auth.refreshSession === "function"
    ) {
      try {
        console.info("[KlevbyProfileCore] Supabase session устарела, пробую refreshSession.");

        const refreshResult = await promiseWithTimeout(
          client.auth.refreshSession(),
          4500,
          "Supabase auth.refreshSession timeout"
        );

        const refreshedSession = refreshResult?.data?.session || null;

        if (
          !refreshResult?.error &&
          refreshedSession?.access_token &&
          isProfileAccessTokenUsable(refreshedSession.access_token, options.graceSeconds)
        ) {
          console.info("[KlevbyProfileCore] Supabase session обновлена.");
          return refreshedSession;
        }

        if (refreshResult?.error) {
          console.warn("[KlevbyProfileCore] auth.refreshSession вернул ошибку.", refreshResult.error);
        }
      } catch (error) {
        console.warn("[KlevbyProfileCore] auth.refreshSession не ответил.", error);
      }
    }

    return null;
  }

  async function getFreshProfileRestAuthContext(options = {}) {
    const supabaseUrl = getProfileSupabaseUrl();
    const anonKey = getProfileSupabaseAnonKey();
    const requireAuth = options.requireAuth !== false;
    const graceSeconds = Number(options.graceSeconds || KLEVB_PROFILE_TOKEN_EXPIRY_GRACE_SECONDS);

    let accessToken = "";
    let user = null;

    const client = getProfileSupabaseClient();
    const authSession = await getSessionFromSupabaseAuth(client, {
      graceSeconds
    });

    if (authSession?.access_token && isProfileAccessTokenUsable(authSession.access_token, graceSeconds)) {
      accessToken = String(authSession.access_token || "");
      user = authSession.user || null;
    }

    if (!accessToken) {
      // Stored-auth fallback only — see KLEVB_PROFILE_STORED_AUTH_FALLBACK_BOUNDARY above.
      const storedAuthData = getProfileStoredAuthData();
      const storedSession = getProfileSessionFromAuthData(storedAuthData);
      const storedToken = String(storedSession?.access_token || "");

      if (storedToken && isProfileAccessTokenUsable(storedToken, graceSeconds)) {
        accessToken = storedToken;
        user = storedSession?.user || getProfileUserFromStoredAuth() || null;
      } else if (storedToken) {
        console.info("[KlevbyProfileCore] Старый access_token протух, не использую его для REST.");
      }
    }

    if (requireAuth && !accessToken) {
      throw new Error("Нет свежей Supabase-сессии для REST-запроса.");
    }

    return {
      supabaseUrl,
      anonKey,
      accessToken,
      user
    };
  }

  function makeProfilePublicAvatarUrl(supabaseUrl, avatarPath) {
    const cleanUrl = String(supabaseUrl || "").replace(/\/+$/, "");
    const encodedPath = encodeStoragePath(avatarPath);

    return `${cleanUrl}/storage/v1/object/public/${KLEVB_PROFILE_AVATAR_BUCKET}/${encodedPath}?v=${Date.now()}`;
  }

  async function uploadProfileAvatarByRest(avatarBlob, avatarPath) {
    const { supabaseUrl, anonKey, accessToken } = await getFreshProfileRestAuthContext({
      requireAuth: true
    });

    if (!supabaseUrl || !anonKey || !accessToken) {
      throw new Error("Нет Supabase URL, anon key или свежего access token для REST upload.");
    }

    const encodedPath = encodeStoragePath(avatarPath);
    const url = `${supabaseUrl}/storage/v1/object/${KLEVB_PROFILE_AVATAR_BUCKET}/${encodedPath}`;

    console.info("[KlevbyProfileCore] REST upload аватара старт.", {
      bucket: KLEVB_PROFILE_AVATAR_BUCKET,
      path: avatarPath,
      size: avatarBlob.size,
      type: avatarBlob.type || "image/jpeg"
    });

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": avatarBlob.type || "image/jpeg",
        "Cache-Control": "3600",
        "x-upsert": "true"
      },
      body: avatarBlob
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Storage REST upload failed ${response.status}: ${text || response.statusText}`);
    }

    console.info("[KlevbyProfileCore] REST upload аватара завершён.", {
      status: response.status,
      path: avatarPath
    });

    return {
      avatarUrl: makeProfilePublicAvatarUrl(supabaseUrl, avatarPath),
      avatarPath,
      responseText: text
    };
  }

  async function updateProfileAvatarRowByRest(userId, avatarUrl, avatarPath) {
    const { supabaseUrl, anonKey, accessToken } = await getFreshProfileRestAuthContext({
      requireAuth: true
    });

    if (!supabaseUrl || !anonKey || !accessToken || !userId) {
      throw new Error("Нет данных для REST update profiles.");
    }

    const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;

    const response = await fetchWithTimeout(url, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        avatar_url: avatarUrl,
        avatar_path: avatarPath,
        updated_at: new Date().toISOString()
      })
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`profiles REST update failed ${response.status}: ${text || response.statusText}`);
    }

    console.info("[KlevbyProfileCore] profiles.avatar_url/avatar_path обновлены через REST.", {
      avatarPath,
      avatarUrl
    });

    return true;
  }

  async function updateFeedPostsAuthorAvatarByRest(userId, avatarUrl) {
    const cleanUserId = String(userId || "").trim();
    const cleanAvatarUrl = String(avatarUrl || "").trim();

    if (!cleanUserId || !isPublicUrl(cleanAvatarUrl)) {
      return false;
    }

    const { supabaseUrl, anonKey, accessToken } = await getFreshProfileRestAuthContext({
      requireAuth: true
    });

    if (!supabaseUrl || !anonKey || !accessToken) {
      throw new Error("Нет данных для REST update feed_posts.author_avatar_url.");
    }

    const url = `${supabaseUrl}/rest/v1/${KLEVB_PROFILE_FEED_POSTS_TABLE}?user_id=eq.${encodeURIComponent(cleanUserId)}`;

    const response = await fetchWithTimeout(url, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        author_avatar_url: cleanAvatarUrl
      })
    }, 7000);

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`feed_posts REST avatar update failed ${response.status}: ${text || response.statusText}`);
    }

    console.info("[KlevbyProfileCore] feed_posts.author_avatar_url обновлён через REST.", {
      userId: cleanUserId,
      avatarUrl: cleanAvatarUrl
    });

    return true;
  }

  async function updateFeedPostsAuthorAvatarBySdk(userId, avatarUrl) {
    const cleanUserId = String(userId || "").trim();
    const cleanAvatarUrl = String(avatarUrl || "").trim();
    const supabase = getProfileSupabaseClient();

    if (!supabase || !cleanUserId || !isPublicUrl(cleanAvatarUrl)) {
      return false;
    }

    const updatePromise = supabase
      .from(KLEVB_PROFILE_FEED_POSTS_TABLE)
      .update({
        author_avatar_url: cleanAvatarUrl
      })
      .eq("user_id", cleanUserId);

    const { error } = await promiseWithTimeout(
      updatePromise,
      7000,
      "Supabase SDK feed_posts avatar update timeout"
    );

    if (error) {
      throw error;
    }

    console.info("[KlevbyProfileCore] feed_posts.author_avatar_url обновлён через SDK fallback.", {
      userId: cleanUserId,
      avatarUrl: cleanAvatarUrl
    });

    return true;
  }

  function notifyFeedAuthorAvatarUpdated(userId, avatarUrl) {
    const detail = {
      action: "profile_author_avatar_updated",
      userId: String(userId || ""),
      avatarUrl: String(avatarUrl || "")
    };

    try {
      window.dispatchEvent(new CustomEvent("klevby-feed-updated", {
        detail
      }));
    } catch (error) {
      console.debug("[KlevbyProfileCore] klevby-feed-updated не отправился.", error);
    }

    try {
      window.dispatchEvent(new CustomEvent("klevby-profile-avatar-updated", {
        detail
      }));
    } catch (error) {
      console.debug("[KlevbyProfileCore] klevby-profile-avatar-updated не отправился.", error);
    }

    setTimeout(() => {
      try {
        if (typeof window.refreshFeedNow === "function") {
          window.refreshFeedNow();
          return;
        }

        if (typeof window.renderProfileFeed === "function") {
          logFeedMarker("renderProfileFeed", "profile_sync_render", { action: "profile_sync_refresh" });
          window.renderProfileFeed();
        }
      } catch (error) {
        console.warn("[KlevbyProfileCore] Лента не обновилась после обновления аватара.", error);
      }
    }, 180);
  }

  async function syncFeedPostsAuthorAvatar(userId, avatarUrl) {
    const cleanUserId = String(userId || "").trim();
    const cleanAvatarUrl = String(avatarUrl || "").trim();

    if (!cleanUserId || !isPublicUrl(cleanAvatarUrl)) {
      return false;
    }

    try {
      const ok = await updateFeedPostsAuthorAvatarByRest(cleanUserId, cleanAvatarUrl);

      if (ok) {
        notifyFeedAuthorAvatarUpdated(cleanUserId, cleanAvatarUrl);
        return true;
      }
    } catch (restError) {
      console.warn("[KlevbyProfileCore] REST sync author_avatar_url в feed_posts не сработал, пробую SDK fallback.", restError);
    }

    try {
      const ok = await updateFeedPostsAuthorAvatarBySdk(cleanUserId, cleanAvatarUrl);

      if (ok) {
        notifyFeedAuthorAvatarUpdated(cleanUserId, cleanAvatarUrl);
        return true;
      }
    } catch (sdkError) {
      console.warn("[KlevbyProfileCore] SDK sync author_avatar_url в feed_posts не сработал.", sdkError);
    }

    return false;
  }

  async function syncFeedPostsAuthorAvatarSafe(userId, avatarUrl) {
    try {
      return await syncFeedPostsAuthorAvatar(userId, avatarUrl);
    } catch (error) {
      console.warn("[KlevbyProfileCore] Не удалось обновить аватар автора в старых постах ленты.", error);
      return false;
    }
  }

  async function readProfileAvatarRowByRest(userId) {
    const { supabaseUrl, anonKey, accessToken } = await getFreshProfileRestAuthContext({
      requireAuth: false
    });

    if (!supabaseUrl || !anonKey || !accessToken || !userId) {
      return "";
    }

    const url = `${supabaseUrl}/rest/v1/profiles?select=avatar_url&id=eq.${encodeURIComponent(userId)}&limit=1`;

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    }, 5000);

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`profiles REST read failed ${response.status}: ${text || response.statusText}`);
    }

    const rows = text ? JSON.parse(text) : [];
    const avatarUrl = String(rows?.[0]?.avatar_url || "").trim();

    return avatarUrl;
  }

  async function uploadProfileAvatarToSupabase(dataUrl) {
    const supabase = getProfileSupabaseClient();
    const currentUser = await resolveCurrentProfileUser(supabase);

    if (!currentUser?.id) {
      console.info("[KlevbyProfileCore] Пользователь недоступен, оставляем локальный аватар.");
      return null;
    }

    const avatarPath = `${currentUser.id}/avatar.jpg`;
    const avatarBlob = dataUrlToBlobSafe(dataUrl);

    try {
      const restResult = await uploadProfileAvatarByRest(avatarBlob, avatarPath);
      await updateProfileAvatarRowByRest(currentUser.id, restResult.avatarUrl, restResult.avatarPath);
      await syncFeedPostsAuthorAvatarSafe(currentUser.id, restResult.avatarUrl);

      return {
        avatarUrl: restResult.avatarUrl,
        avatarPath: restResult.avatarPath
      };
    } catch (restError) {
      console.warn("[KlevbyProfileCore] REST upload/update аватара не сработал.", restError);
    }

    if (!supabase?.storage) {
      console.info("[KlevbyProfileCore] Supabase Storage SDK недоступен, оставляем локальный аватар.");
      return null;
    }

    console.info("[KlevbyProfileCore] Пробуем fallback через Supabase SDK Storage.", {
      bucket: KLEVB_PROFILE_AVATAR_BUCKET,
      path: avatarPath,
      size: avatarBlob.size
    });

    const uploadPromise = supabase.storage
      .from(KLEVB_PROFILE_AVATAR_BUCKET)
      .upload(avatarPath, avatarBlob, {
        contentType: avatarBlob.type || "image/jpeg",
        cacheControl: "3600",
        upsert: true
      });

    const { error: uploadError } = await promiseWithTimeout(
      uploadPromise,
      KLEVB_PROFILE_REST_TIMEOUT_MS,
      "Supabase SDK avatar upload timeout"
    );

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(KLEVB_PROFILE_AVATAR_BUCKET)
      .getPublicUrl(avatarPath);

    const cleanAvatarUrl = publicData?.publicUrl || "";
    const avatarUrl = cleanAvatarUrl ? `${cleanAvatarUrl}?v=${Date.now()}` : "";

    if (!avatarUrl) {
      throw new Error("Не удалось получить public URL аватара.");
    }

    const updatePromise = supabase
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
        avatar_path: avatarPath,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentUser.id);

    const { error: profileError } = await promiseWithTimeout(
      updatePromise,
      7000,
      "Supabase SDK profile avatar update timeout"
    );

    if (profileError) {
      throw profileError;
    }

    await syncFeedPostsAuthorAvatarSafe(currentUser.id, avatarUrl);

    console.info("[KlevbyProfileCore] Аватар загружен через SDK fallback.", {
      avatarPath,
      avatarUrl
    });

    return {
      avatarUrl,
      avatarPath
    };
  }

  async function loadProfileAvatarFromSupabase() {
    const supabase = getProfileSupabaseClient();
    const currentUser = await resolveCurrentProfileUser(supabase);

    if (!currentUser?.id) {
      return null;
    }

    try {
      const avatarUrlFromRest = await readProfileAvatarRowByRest(currentUser.id);

      if (avatarUrlFromRest) {
        console.info("[KlevbyProfileCore] Загружен avatar_url из profiles через REST.");
        return avatarUrlFromRest;
      }
    } catch (restError) {
      console.warn("[KlevbyProfileCore] REST avatar_url read не сработал, пробуем SDK fallback.", restError);
    }

    if (!supabase) {
      return null;
    }

    const queryPromise = supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", currentUser.id)
      .maybeSingle();

    const { data, error } = await promiseWithTimeout(
      queryPromise,
      5000,
      "Supabase SDK avatar_url read timeout"
    );

    if (error) throw error;

    const avatarUrl = String(data?.avatar_url || "").trim();

    if (!avatarUrl) return null;

    console.info("[KlevbyProfileCore] Загружен avatar_url из profiles.");
    return avatarUrl;
  }

  function compressImageFile(file, options = {}) {
    const maxSide = Number(options.maxSide || 1080);
    const quality = Number(options.quality || 0.68);
    const outputType = options.outputType || "image/jpeg";

    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        try {
          const originalWidth = image.naturalWidth || image.width;
          const originalHeight = image.naturalHeight || image.height;

          if (!originalWidth || !originalHeight) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Image has empty size"));
            return;
          }

          const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
          const width = Math.max(1, Math.round(originalWidth * scale));
          const height = Math.max(1, Math.round(originalHeight * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d", { alpha: false });

          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Canvas context is not available"));
            return;
          }

          ctx.fillStyle = "#07110f";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);

          if (typeof canvas.toBlob === "function") {
            canvas.toBlob((blob) => {
              if (!blob) {
                try {
                  const fallbackDataUrl = canvas.toDataURL(outputType, quality);

                  URL.revokeObjectURL(objectUrl);

                  resolve({
                    dataUrl: fallbackDataUrl,
                    width,
                    height,
                    sizeKb: estimateDataUrlSizeKb(fallbackDataUrl)
                  });
                } catch (fallbackError) {
                  URL.revokeObjectURL(objectUrl);
                  reject(fallbackError);
                }

                return;
              }

              blobToDataUrl(blob)
                .then((dataUrl) => {
                  URL.revokeObjectURL(objectUrl);

                  resolve({
                    dataUrl,
                    width,
                    height,
                    sizeKb: Math.max(1, Math.round(blob.size / 1024))
                  });
                })
                .catch((error) => {
                  URL.revokeObjectURL(objectUrl);
                  reject(error);
                });
            }, outputType, quality);

            return;
          }

          const dataUrl = canvas.toDataURL(outputType, quality);
          const sizeKb = estimateDataUrlSizeKb(dataUrl);

          URL.revokeObjectURL(objectUrl);

          resolve({
            dataUrl,
            width,
            height,
            sizeKb
          });
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Image load error"));
      };

      image.decoding = "async";
      image.src = objectUrl;
    });
  }

  window.KlevbyProfileCore = {
    constants: {
      KLEVB_PROFILE_STORAGE_KEY,
      KLEVB_PROFILE_AVATAR_KEY,
      KLEVB_PROFILE_NAME_KEY,
      KLEVB_PROFILE_PHOTOS_KEY,
      KLEVB_PROFILE_MAX_PHOTOS,
      KLEVB_PROFILE_AVATAR_BUCKET,
      KLEVB_PROFILE_FEED_POSTS_TABLE,
      KLEVB_PROFILE_REST_TIMEOUT_MS,
      KLEVB_PROFILE_TOKEN_EXPIRY_GRACE_SECONDS
    },

    getDefaultProfileData,
    readProfileData,
    saveProfileData,
    readProfilePhotos,
    saveProfilePhotos,
    getProfileFeedItems,
    countUserPosts,
    makeLocalProfilePhoto,
    updateLocalPhotoWithFeedItem,

    getCurrentProfileUser,
    getProfileNameFromCurrentUser,
    getProfileNameFromInputs,

    parseProfileAuthStorageValue,
    getProfileStoredAuthData,
    getProfileSessionFromAuthData,
    decodeJwtPayload,
    getJwtExpiresAtMs,
    isProfileAccessTokenUsable,
    getProfileAccessTokenFromStoredAuth,
    getProfileUserFromStoredAuth,

    getProfileSupabaseClient,
    getProfileSupabaseUrl,
    getProfileSupabaseAnonKey,
    resolveCurrentProfileUser,

    dataUrlToBlobSafe,
    encodeStoragePath,
    promiseWithTimeout,
    fetchWithTimeout,
    getProfileRestAuthContext,
    getFreshProfileRestAuthContext,
    makeProfilePublicAvatarUrl,
    uploadProfileAvatarByRest,
    updateProfileAvatarRowByRest,
    updateFeedPostsAuthorAvatarByRest,
    updateFeedPostsAuthorAvatarBySdk,
    syncFeedPostsAuthorAvatar,
    syncFeedPostsAuthorAvatarSafe,
    readProfileAvatarRowByRest,
    uploadProfileAvatarToSupabase,
    loadProfileAvatarFromSupabase,

    waitForFrame,
    blobToDataUrl,
    estimateDataUrlSizeKb,
    compressImageFile,

    escapeHtml,
    formatTelegramLabel,
    isPublicUrl
  };

  console.log("Klevby profile core loaded", {
    version: "20260513-profile-storage-split-1"
  });
})();
