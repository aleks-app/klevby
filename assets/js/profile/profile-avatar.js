(function () {
  const PROFILE_AVATAR_VERSION = "20260512-profile-avatar-split-1";

  const KLEVB_PROFILE_AVATAR_KEY = "klevby_profile_avatar";
  const KLEVB_PROFILE_AVATAR_MAX_SIDE = 520;
  const KLEVB_PROFILE_AVATAR_QUALITY = 0.78;

  function getCore() {
    return window.KlevbyProfileCore || {};
  }

  function requireCoreMethod(name) {
    const core = getCore();

    if (core && typeof core[name] === "function") {
      return core[name].bind(core);
    }

    const error = new Error(`KlevbyProfileCore.${name} is not available`);
    console.error("[KlevbyProfileAvatar] profile-core.js не готов или функция не найдена:", name, error);
    throw error;
  }

  function compressImageFile(file, options = {}) {
    return requireCoreMethod("compressImageFile")(file, options);
  }

  function getProfileSupabaseClient() {
    return requireCoreMethod("getProfileSupabaseClient")();
  }

  function resolveCurrentProfileUser(supabase = null) {
    return requireCoreMethod("resolveCurrentProfileUser")(supabase);
  }

  function readProfileAvatarRowByRest(userId) {
    return requireCoreMethod("readProfileAvatarRowByRest")(userId);
  }

  function uploadProfileAvatarToSupabase(dataUrl) {
    return requireCoreMethod("uploadProfileAvatarToSupabase")(dataUrl);
  }

  function promiseWithTimeout(promise, timeoutMs, message = "Timeout") {
    return requireCoreMethod("promiseWithTimeout")(promise, timeoutMs, message);
  }

  async function handleLocalAvatarUpload(event) {
    const file = event?.target?.files?.[0];

    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Выбери изображение для аватарки.");
      return;
    }

    try {
      const compressedAvatar = await compressImageFile(file, {
        maxSide: KLEVB_PROFILE_AVATAR_MAX_SIDE,
        quality: KLEVB_PROFILE_AVATAR_QUALITY,
        outputType: "image/jpeg"
      });

      try {
        localStorage.setItem(KLEVB_PROFILE_AVATAR_KEY, compressedAvatar.dataUrl);
      } catch (error) {
        console.warn("Klevby profile: аватар не сохранился", error);
        alert("Аватар не сохранился. Попробуй фото меньшего размера.");
        return;
      }

      setProfileAvatar(compressedAvatar.dataUrl);
      showProfileAvatarSavedMessage();
      console.info("[KlevbyProfile] Локальный аватар обновлён.");

      uploadProfileAvatarToSupabase(compressedAvatar.dataUrl)
        .then((result) => {
          if (!result?.avatarUrl) return;

          setProfileAvatar(result.avatarUrl);
          console.info("[KlevbyProfile] Аватар загружен в Supabase Storage и профиль обновлён.");
        })
        .catch((uploadError) => {
          console.warn("[KlevbyProfile] Upload аватара в Supabase не удался, оставляем local fallback.", uploadError);
        });

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
    } catch (error) {
      console.warn("Klevby profile: аватар не обработался", error);
      alert("Не получилось обработать аватар. Попробуй другое фото.");
    } finally {
      if (event?.target) {
        event.target.value = "";
      }
    }
  }

  function showProfileAvatarSavedMessage() {
    const message = document.getElementById("profileSettingsMessage");

    if (!message) return;

    message.classList.remove("error-line");
    message.textContent = "✅ Аватар обновлён.";
  }

  function restoreLocalProfileAvatar() {
    try {
      const savedAvatar = localStorage.getItem(KLEVB_PROFILE_AVATAR_KEY);

      if (savedAvatar) {
        setProfileAvatar(savedAvatar);
      } else {
        resetMobileProfileAvatar();
      }
    } catch (error) {
      console.warn("Klevby profile: аватар не восстановился", error);
    }

    loadProfileAvatarFromSupabase().catch((error) => {
      console.warn("[KlevbyProfile] Не удалось подтянуть avatar_url из profiles, используем localStorage.", error);
    });
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
        setProfileAvatar(avatarUrlFromRest);
        console.info("[KlevbyProfile] Загружен avatar_url из profiles через REST.");
        return avatarUrlFromRest;
      }
    } catch (restError) {
      console.warn("[KlevbyProfile] REST avatar_url read не сработал, пробуем SDK fallback.", restError);
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

    setProfileAvatar(avatarUrl);
    console.info("[KlevbyProfile] Загружен avatar_url из profiles.");
    return avatarUrl;
  }

  function setProfileAvatar(src) {
    if (!src) return;

    const image = document.getElementById("profileAvatarImage");
    const fallback = document.getElementById("profileAvatarFallback");
    const mobileIcon = document.getElementById("mobileProfileAvatarIcon");

    if (image && fallback) {
      image.src = src;
      image.classList.remove("hidden");
      fallback.classList.add("hidden");
    }

    if (mobileIcon) {
      mobileIcon.textContent = "";
      mobileIcon.style.backgroundImage = `url("${src}")`;
      mobileIcon.style.backgroundSize = "cover";
      mobileIcon.style.backgroundPosition = "center";
      mobileIcon.style.backgroundRepeat = "no-repeat";
    }
  }

  function resetMobileProfileAvatar() {
    const mobileIcon = document.getElementById("mobileProfileAvatarIcon");

    if (!mobileIcon) return;

    mobileIcon.textContent = "👤";
    mobileIcon.style.backgroundImage = "";
    mobileIcon.style.backgroundSize = "";
    mobileIcon.style.backgroundPosition = "";
    mobileIcon.style.backgroundRepeat = "";
  }

  window.KlevbyProfileAvatar = {
    version: PROFILE_AVATAR_VERSION,
    handleLocalAvatarUpload,
    showProfileAvatarSavedMessage,
    restoreLocalProfileAvatar,
    loadProfileAvatarFromSupabase,
    setProfileAvatar,
    resetMobileProfileAvatar
  };

  console.log("Klevby profile avatar module loaded", {
    version: PROFILE_AVATAR_VERSION
  });
})();
