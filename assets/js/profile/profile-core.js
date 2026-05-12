(function () {
  const KLEVB_PROFILE_STORAGE_KEY = "klevby_profile_settings";
  const KLEVB_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_PROFILE_NAME_KEY = "klevby_profile_name";
  const KLEVB_PROFILE_PHOTOS_KEY = "klevby_profile_photos";

  const KLEVB_PROFILE_MAX_PHOTOS = 8;
  const KLEVB_PROFILE_AVATAR_BUCKET = "profile-avatars";
  const KLEVB_PROFILE_REST_TIMEOUT_MS = 12000;

  function getDefaultProfileData() {
    return {
      name: "",
      city: "",
      telegram: "",
      about: ""
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTelegramLabel(value) {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) return "";

    if (cleanValue.startsWith("@")) return cleanValue;

    const match = cleanValue.match(/t\.me\/([^/?#]+)/i);
    if (match && match[1]) return `@${match[1]}`;

    return cleanValue;
  }

  function waitForFrame() {
    return new Promise((resolve) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
        return;
      }

      setTimeout(resolve, 0);
    });
  }

  function parseProfileAuthStorageValue(raw) {
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

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

  function getProfileAccessTokenFromStoredAuth() {
    const authData = getProfileStoredAuthData();

    return (
      authData?.access_token ||
      authData?.currentSession?.access_token ||
      authData?.session?.access_token ||
      authData?.data?.session?.access_token ||
      ""
    );
  }

  function getProfileUserFromStoredAuth() {
    const authData = getProfileStoredAuthData();

    return (
      authData?.user ||
      authData?.currentSession?.user ||
      authData?.session?.user ||
      authData?.data?.session?.user ||
      null
    );
  }

  function getCurrentProfileUser() {
    return (
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      (typeof window.klevbyGetCurrentUser === "function" ? window.klevbyGetCurrentUser() : null) ||
      getProfileUserFromStoredAuth() ||
      null
    );
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
    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};

      return {
        ...getDefaultProfileData(),
        ...parsed,
        name:
          parsed.name ||
          localStorage.getItem(KLEVB_PROFILE_NAME_KEY) ||
          getProfileNameFromInputs() ||
          getProfileNameFromCurrentUser() ||
          ""
      };
    } catch (error) {
      console.warn("Klevby profile core: не удалось прочитать профиль", error);

      return {
        ...getDefaultProfileData(),
        name: getProfileNameFromInputs() || getProfileNameFromCurrentUser() || ""
      };
    }
  }

  function saveProfileData(data) {
    const cleanData = {
      name: String(data?.name || "").trim(),
      city: String(data?.city || "").trim(),
      telegram: String(data?.telegram || "").trim(),
      about: String(data?.about || "").trim()
    };

    try {
      localStorage.setItem(KLEVB_PROFILE_STORAGE_KEY, JSON.stringify(cleanData));

      if (cleanData.name) {
        localStorage.setItem(KLEVB_PROFILE_NAME_KEY, cleanData.name);
      }
    } catch (error) {
      console.warn("Klevby profile core: не удалось сохранить профиль", error);
    }

    return cleanData;
  }

  function readProfilePhotos() {
    try {
      const raw = localStorage.getItem(KLEVB_PROFILE_PHOTOS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Klevby profile core: не удалось прочитать фото", error);
      return [];
    }
  }

  function saveProfilePhotos(photos) {
    const safePhotos = Array.isArray(photos)
      ? photos.slice(0, KLEVB_PROFILE_MAX_PHOTOS)
      : [];

    try {
      localStorage.setItem(KLEVB_PROFILE_PHOTOS_KEY, JSON.stringify(safePhotos));
    } catch (error) {
      console.warn("Klevby profile core: не удалось сохранить фото", error);
      alert("Фото не сохранилось. Память браузера заполнена. Удали старые фото или выбери другое.");
    }

    return safePhotos;
  }

  function getProfileFeedItems() {
    const data = readProfileData();
    const photos = readProfilePhotos();

    return photos.map((photo) => {
      return {
        type: "profile_photo",
        id: photo.feedPostId || photo.id,
        localId: photo.id,
        feedPostId: photo.feedPostId || "",
        feedImagePath: photo.feedImagePath || "",
        authorName: data.name || getProfileNameFromCurrentUser() || "Рыбак",
        authorCity: data.city || "",
        authorTelegram: data.telegram || "",
        image: photo.feedImageUrl || photo.src || "",
        title: photo.title || "Фото с рыбалки",
        createdAt: photo.createdAt || "",
        savedSizeKb: photo.savedSizeKb || 0,
        width: photo.width || 0,
        height: photo.height || 0,
        source: photo.feedPostId ? "supabase" : (photo.source || "local")
      };
    });
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

    const storedUser = getProfileUserFromStoredAuth();

    if (storedUser?.id) {
      return storedUser;
    }

    const client = supabase || getProfileSupabaseClient();

    if (!client?.auth || typeof client.auth.getUser !== "function") {
      console.info("[KlevbyProfileCore] Пользователь не найден локально, Supabase auth недоступен.");
      return null;
    }

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
        console.warn("[KlevbyProfileCore] auth.getUser не вернул пользователя.", error);
      }
    } catch (error) {
      console.warn("[KlevbyProfileCore] Ошибка auth.getUser.", error);
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

  function encodeStoragePath(path) {
    return String(path || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function promiseWithTimeout(promise, timeoutMs, message = "Timeout") {
    let timer = null;

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = KLEVB_PROFILE_REST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function getProfileRestAuthContext() {
    const supabaseUrl = getProfileSupabaseUrl();
    const anonKey = getProfileSupabaseAnonKey();
    const accessToken = getProfileAccessTokenFromStoredAuth();

    return {
      supabaseUrl,
      anonKey,
      accessToken
    };
  }

  function makeProfilePublicAvatarUrl(supabaseUrl, avatarPath) {
    const cleanUrl = String(supabaseUrl || "").replace(/\/+$/, "");
    const encodedPath = encodeStoragePath(avatarPath);

    return `${cleanUrl}/storage/v1/object/public/${KLEVB_PROFILE_AVATAR_BUCKET}/${encodedPath}?v=${Date.now()}`;
  }

  async function uploadProfileAvatarByRest(avatarBlob, avatarPath) {
    const { supabaseUrl, anonKey, accessToken } = getProfileRestAuthContext();

    if (!supabaseUrl || !anonKey || !accessToken) {
      throw new Error("Нет Supabase URL, anon key или access token для REST upload.");
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
    const { supabaseUrl, anonKey, accessToken } = getProfileRestAuthContext();

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

  async function readProfileAvatarRowByRest(userId) {
    const { supabaseUrl, anonKey, accessToken } = getProfileRestAuthContext();

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

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result || ""));
      };

      reader.onerror = () => {
        reject(new Error("FileReader error"));
      };

      reader.readAsDataURL(blob);
    });
  }

  function estimateDataUrlSizeKb(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const padding = (base64.match(/=+$/) || [""])[0].length;
    const bytes = Math.max(0, Math.round((base64.length * 3) / 4) - padding);

    return Math.round(bytes / 1024);
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
      KLEVB_PROFILE_REST_TIMEOUT_MS
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
    makeProfilePublicAvatarUrl,
    uploadProfileAvatarByRest,
    updateProfileAvatarRowByRest,
    readProfileAvatarRowByRest,
    uploadProfileAvatarToSupabase,
    loadProfileAvatarFromSupabase,

    waitForFrame,
    blobToDataUrl,
    estimateDataUrlSizeKb,
    compressImageFile,

    escapeHtml,
    formatTelegramLabel
  };

  console.log("Klevby profile core loaded", {
    version: "20260512-profile-core-2"
  });
})();
