const KLEVB_RECENT_LOGOUT_GUARD_MS = 10 * 60 * 1000;
const KLEVB_RECENT_LOGOUT_STORAGE_KEY = "klevby_recent_logout_at";
const KLEVB_AUTH_STORAGE_KEYS_TO_CLEAR = [
  "sb-oecdshvozssadztcokog-auth-token",
  "sb-klevby-auth-token",
  "supabase.auth.token"
];

const KLEVB_PROFILE_LOGOUT_STORAGE_KEYS_TO_CLEAR = [
  "klevby_profile_settings",
  "klevby_profile_avatar",
  "klevby_profile_name",
  "klevby_profile_photos",
  "klevby_profile_city",
  "klevby_profile_telegram",
  "klevby_profile_about"
];
const KLEVB_PENDING_SIGNUP_STORAGE_KEY = "klevby_pending_signup";
const KLEVB_PENDING_SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;
const KLEVB_SIGNUP_CODE_RESEND_COOLDOWN_MS = 55 * 1000;

let signupCodeResendUntil = 0;
let klevbyLoginInProgress = false;
let klevbySignupVerifyInProgress = false;

function getLogoutGuardNow() {
  return Date.now();
}

function writeRecentLogoutMarker(timestamp = getLogoutGuardNow()) {
  lastLogoutAt = timestamp;
  window.klevbyLastLogoutAt = timestamp;

  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((store) => {
    try {
      store.setItem(KLEVB_RECENT_LOGOUT_STORAGE_KEY, String(timestamp));
    } catch (error) {
      console.warn("Не удалось записать recent logout marker:", error);
    }
  });
}

function readRecentLogoutMarker() {
  const values = [lastLogoutAt, window.klevbyLastLogoutAt];

  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((store) => {
    try {
      values.push(Number(store.getItem(KLEVB_RECENT_LOGOUT_STORAGE_KEY) || 0));
    } catch (_) {}
  });

  return Math.max(...values.map((value) => Number(value || 0)).filter(Number.isFinite), 0);
}

function clearRecentLogoutMarker() {
  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((store) => {
    try {
      store.removeItem(KLEVB_RECENT_LOGOUT_STORAGE_KEY);
    } catch (_) {}
  });
}

function markAuthLogoutStarted() {
  const now = getLogoutGuardNow();
  window.klevbyForceGuestProfileUi = true;
  authLogoutInProgress = true;
  window.klevbyAuthLogoutInProgress = true;
  writeRecentLogoutMarker(now);
}

function markAuthLogoutFinished() {
  const now = getLogoutGuardNow();
  authLogoutInProgress = false;
  window.klevbyAuthLogoutInProgress = false;
  writeRecentLogoutMarker(Math.max(Number(lastLogoutAt || 0), now));
}

function clearAuthLogoutGuardForFreshLogin() {
  window.klevbyForceGuestProfileUi = false;
  authLogoutInProgress = false;
  lastLogoutAt = 0;
  window.klevbyAuthLogoutInProgress = false;
  window.klevbyLastLogoutAt = 0;
  clearRecentLogoutMarker();
}

function prepareAuthForExplicitLogin() {
  clearPendingAuthRestore();
  clearAuthLogoutGuardForFreshLogin();
  window.klevbyExplicitLoginInProgress = true;
}

function finishAuthExplicitLogin() {
  window.klevbyExplicitLoginInProgress = false;
  clearAuthLogoutGuardForFreshLogin();
}

function isAuthLogoutGuardActive() {
  if (window.klevbyExplicitLoginInProgress) return false;

  const marker = readRecentLogoutMarker();

  if (authLogoutInProgress || window.klevbyAuthLogoutInProgress) {
    return true;
  }

  if (!marker) return false;

  const age = getLogoutGuardNow() - marker;

  return age >= 0 && age < KLEVB_RECENT_LOGOUT_GUARD_MS;
}

function clearPendingAuthRestore() {
  if (authRestoreTimer) {
    clearTimeout(authRestoreTimer);
    authRestoreTimer = null;
  }
}

function getAuthStorageStores() {
  return [
    { name: "localStorage", store: window.localStorage },
    { name: "sessionStorage", store: window.sessionStorage }
  ].filter((entry) => entry.store);
}

function getKnownAuthStorageKeySet() {
  const configuredKeys = [
    window.KLEVB_CONFIG?.SUPABASE_STORAGE_KEY,
    window.SUPABASE_STORAGE_KEY,
    typeof SUPABASE_STORAGE_KEY !== "undefined" ? SUPABASE_STORAGE_KEY : ""
  ];

  return new Set(
    [...configuredKeys, ...KLEVB_AUTH_STORAGE_KEYS_TO_CLEAR]
      .map((key) => String(key || "").trim())
      .filter(Boolean)
  );
}

function isSupabaseAuthStorageKey(key, knownKeys = getKnownAuthStorageKeySet()) {
  const cleanKey = String(key || "").trim();

  if (!cleanKey) return false;
  if (knownKeys.has(cleanKey)) return true;

  return /^sb-.+-auth-token$/i.test(cleanKey);
}

function listAuthStorageKeys() {
  const knownKeys = getKnownAuthStorageKeySet();
  const result = [];

  getAuthStorageStores().forEach(({ name, store }) => {
    try {
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index) || "";

        if (isSupabaseAuthStorageKey(key, knownKeys)) {
          result.push({ storeName: name, store, key });
        }
      }
    } catch (error) {
      console.warn("Не удалось прочитать auth storage keys:", name, error);
    }
  });

  return result;
}

function clearKnownAuthStorageKeys() {
  const knownKeys = getKnownAuthStorageKeySet();
  const keysToRemove = new Set([...knownKeys]);
  const beforeKeys = listAuthStorageKeys();

  beforeKeys.forEach(({ key }) => keysToRemove.add(key));

  getAuthStorageStores().forEach(({ name, store }) => {
    keysToRemove.forEach((key) => {
      try {
        store.removeItem(key);
      } catch (error) {
        console.warn("Не удалось очистить auth storage key:", name, key, error);
      }
    });
  });

  const remainingKeys = listAuthStorageKeys();

  if (remainingKeys.length) {
    console.warn("Auth storage keys остались после logout cleanup:", remainingKeys.map(({ storeName, key }) => `${storeName}:${key}`));
  } else if (beforeKeys.length || keysToRemove.size) {
    console.info("Auth storage keys очищены после logout:", [...keysToRemove]);
  }

  return {
    before: beforeKeys.map(({ storeName, key }) => ({ storeName, key })),
    removed: [...keysToRemove],
    remaining: remainingKeys.map(({ storeName, key }) => ({ storeName, key }))
  };
}

function clearProfileStorageAfterLogout() {
  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((store) => {
    KLEVB_PROFILE_LOGOUT_STORAGE_KEYS_TO_CLEAR.forEach((key) => {
      try {
        store.removeItem(key);
      } catch (error) {
        console.warn("Не удалось очистить profile storage key после logout:", key, error);
      }
    });
  });
}


function clearAuthCredentialFields(options = {}) {
  const fields = {
    emailInput: Boolean(options.email),
    passwordInput: options.password !== false,
    signupCodeInput: options.code !== false,
    usernameInput: Boolean(options.username)
  };

  Object.entries(fields).forEach(([id, shouldClear]) => {
    if (!shouldClear) return;
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
}


function reloadProfilePhotosAfterFreshLogin() {
  const photos = window.KlevbyProfilePhotos;
  const reload =
    (typeof photos?.markProfilePhotosDirtyAfterLogin === "function" && photos.markProfilePhotosDirtyAfterLogin) ||
    (typeof photos?.reloadProfilePhotosAfterLogin === "function" && photos.reloadProfilePhotosAfterLogin) ||
    (typeof photos?.ensureProfilePhotosLoaded === "function" && photos.ensureProfilePhotosLoaded) ||
    null;

  if (!reload) return;

  Promise.resolve()
    .then(() => reload.call(photos))
    .then(() => {
      if (typeof window.updateKlevbyProfileView === "function") {
        window.updateKlevbyProfileView();
      }
    })
    .catch((error) => {
      console.warn("Klevby auth: фото профиля не перезагрузились после входа", error);
    });
}

let klevbyLastKnownProfileUserId = null;

function normalizeProfileUserId(userId) {
  return String(userId || "").trim();
}

function handleProfileStorageOnAccountSwitch(previousUserId, nextUserId) {
  const previousId = normalizeProfileUserId(previousUserId);
  const nextId = normalizeProfileUserId(nextUserId);

  if (!previousId || !nextId || previousId === nextId) {
    return false;
  }

  clearProfileStorageAfterLogout();
  reloadProfilePhotosAfterFreshLogin();

  console.info("Klevby auth: profile storage reset after account switch.", {
    previousUserId: previousId,
    nextUserId: nextId
  });

  return true;
}

function syncKnownProfileUserId(nextUserId) {
  const nextId = normalizeProfileUserId(nextUserId);
  klevbyLastKnownProfileUserId = nextId || null;
}

function bindProfileAccountSwitchGuard() {
  if (window.__klevbyProfileAccountSwitchBound) return;

  window.__klevbyProfileAccountSwitchBound = true;

  window.addEventListener("klevby-auth-changed", () => {
    const nextUser =
      (typeof window.klevbyGetCurrentUser === "function" && window.klevbyGetCurrentUser()) ||
      window.currentUser ||
      window.klevbyCurrentUser ||
      window.klevbyUser ||
      null;
    const nextUserId = nextUser?.id || null;
    const previousId = klevbyLastKnownProfileUserId;

    handleProfileStorageOnAccountSwitch(previousId, nextUserId);
    syncKnownProfileUserId(nextUserId);
  });
}

bindProfileAccountSwitchGuard();

function setLoginLoadingState(isLoading, statusText = "") {
  const loginBtn = document.getElementById("authLoginBtn");

  if (loginBtn) {
    loginBtn.disabled = Boolean(isLoading);
    loginBtn.textContent = isLoading ? "Входим..." : "Войти";
  }

  if (statusText) {
    window.klevbyAuthStatusNotice = statusText;
    const status = document.getElementById("authStatus");
    if (status && !currentUser) {
      status.textContent = statusText;
    }
  }
}

function isAuthSectionVisible() {
  const authSection = document.getElementById("authSection");
  return Boolean(authSection && !authSection.classList.contains("hidden"));
}

function resetAuthFormUiState() {
  klevbyLoginInProgress = false;
  klevbySignupVerifyInProgress = false;
  setLoginLoadingState(false);

  const verifyBtn = document.getElementById("authVerifyBtn");
  if (verifyBtn) {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Подтвердить код";
  }
}

function maybeResetAuthFormUiAfterRestore() {
  if (!isAuthSectionVisible()) return;
  if (currentUser && currentUser.id) return;

  if (klevbyLoginInProgress || klevbySignupVerifyInProgress) {
    if (!isAuthLogoutGuardActive()) return;
  }

  resetAuthFormUiState();
}

function resetLiveProfileDomAfterLogout() {
  const textResets = {
    profileNameText: "Гость",
    profileStatusText: "Войдите, чтобы открыть свой профиль Klevgo.",
    profileAvatarFallback: "👤",
    profilePhotosCount: "0",
    profileReportsCount: "0",
    profileTripsCount: "0",
    profileFriendsCount: "0"
  };

  Object.entries(textResets).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });

  const avatarImage = document.getElementById("profileAvatarImage");
  if (avatarImage) {
    avatarImage.removeAttribute("src");
    avatarImage.classList.add("hidden");
  }

  const avatarFallback = document.getElementById("profileAvatarFallback");
  if (avatarFallback) {
    avatarFallback.classList.remove("hidden");
  }

  document.querySelectorAll(".profile-photo-gallery").forEach((gallery) => {
    gallery.remove();
  });

  document.querySelectorAll(".profile-empty-state").forEach((emptyState) => {
    emptyState.classList.remove("hidden");
  });
}

function resetProfileAvatarUiAfterLogout() {
  if (typeof window.KlevbyProfileAvatar?.resetProfileAvatarUi === "function") {
    window.KlevbyProfileAvatar.resetProfileAvatarUi();
    return;
  }

  const image = document.getElementById("profileAvatarImage");
  const fallback = document.getElementById("profileAvatarFallback");
  const mobileIcon = document.getElementById("mobileProfileAvatarIcon");

  if (image) {
    image.removeAttribute("src");
    image.classList.add("hidden");
  }

  if (fallback) {
    fallback.textContent = "👤";
    fallback.classList.remove("hidden");
  }

  if (mobileIcon) {
    mobileIcon.textContent = "👤";
    mobileIcon.style.backgroundImage = "";
    mobileIcon.style.backgroundSize = "";
    mobileIcon.style.backgroundPosition = "";
    mobileIcon.style.backgroundRepeat = "";
  }
}

function authCredentialInputsAreActive() {
  const ids = ["usernameInput", "emailInput", "passwordInput", "signupCodeInput"];
  const active = document.activeElement;

  return ids.some((id) => {
    const input = document.getElementById(id);
    if (!input) return false;
    if (input === active) return true;
    return String(input.value || "").trim().length > 0;
  });
}

function isGuestAuthSessionState() {
  return !(
    currentUser ||
    window.currentUser ||
    window.klevbyCurrentUser ||
    window.klevbyUser
  );
}

function shouldPreserveAuthCredentialsDuringLogoutGuard(options = {}) {
  if (Boolean(options.preserveCredentials)) return true;
  if (Boolean(options.forceClearCredentials)) return false;
  if (typeof isAuthLogoutGuardActive !== "function" || !isAuthLogoutGuardActive()) return false;
  if (authLogoutInProgress || window.klevbyAuthLogoutInProgress) return false;
  return authCredentialInputsAreActive();
}

function refreshGuestStateDuringLogoutGuard() {
  clearKnownAuthStorageKeys();

  if (
    isGuestAuthSessionState() &&
    !authLogoutInProgress &&
    !window.klevbyAuthLogoutInProgress &&
    authCredentialInputsAreActive()
  ) {
    currentUser = null;
    authReady = true;
    window.currentUser = null;
    window.klevbyCurrentUser = null;
    window.klevbyUser = null;
    window.klevbyAuthReady = true;
    window.klevbyForceGuestProfileUi = true;
    updateAuthStatus();
    return;
  }

  forceGuestAuthState();
}

function resetGuestProfileAfterLogout(options = {}) {
  const preserveCredentials = shouldPreserveAuthCredentialsDuringLogoutGuard(options);

  window.klevbyForceGuestProfileUi = true;

  if (!preserveCredentials) {
    clearAuthCredentialFields({
      email: true,
      password: true,
      code: true,
      username: true
    });
    clearProfileStorageAfterLogout();
    resetLiveProfileDomAfterLogout();
    resetProfileAvatarUiAfterLogout();

    if (typeof window.KlevbyProfilePhotos?.resetProfilePhotosAfterLogout === "function") {
      window.KlevbyProfilePhotos.resetProfilePhotosAfterLogout();
    } else if (typeof window.KlevbyProfilePhotos?.renderProfilePhotos === "function") {
      window.KlevbyProfilePhotos.renderProfilePhotos();
    }

    if (typeof window.renderProfileFeed === "function") {
      window.renderProfileFeed();
    }
  }

  if (typeof window.updateKlevbyProfileView === "function") {
    window.updateKlevbyProfileView();
  }
}

function forceGuestAuthState() {
  currentUser = null;
  authReady = true;
  window.currentUser = null;
  window.klevbyCurrentUser = null;
  window.klevbyUser = null;
  window.klevbyAuthReady = true;
  window.klevbyAuthStatusNotice = "";
  resetGuestProfileAfterLogout();
  syncGlobalAuthState({ notify: true, forceNotify: true });
  updateAuthStatus();
}

function withAuthLogoutTimeout(promise, timeoutMs, label) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label || "AUTH_LOGOUT_TIMEOUT")), timeoutMs);
    })
  ]);
}

async function signOutSupabaseClientLocalFirst() {
  if (!supabaseClient?.auth?.signOut) {
    return;
  }

  try {
    const { error } = await withAuthLogoutTimeout(
      supabaseClient.auth.signOut({ scope: "local" }),
      3500,
      "AUTH_LOCAL_SIGNOUT_TIMEOUT"
    );

    if (error) {
      console.warn("Supabase local signOut завершился с ошибкой:", error);
    }
  } catch (error) {
    console.warn("Не удалось выполнить local Supabase signOut:", error);
  }

  try {
    const { error } = await withAuthLogoutTimeout(
      supabaseClient.auth.signOut(),
      3500,
      "AUTH_SIGNOUT_TIMEOUT"
    );

    if (error) {
      console.warn("Supabase signOut завершился с ошибкой:", error);
    }
  } catch (error) {
    console.warn("Не удалось выйти из Supabase:", error);
  }
}

async function verifySupabaseSessionClearedAfterLogout() {
  if (!supabaseClient?.auth?.getSession) {
    return true;
  }

  try {
    const { data, error } = await withAuthLogoutTimeout(
      supabaseClient.auth.getSession(),
      2500,
      "AUTH_GET_SESSION_AFTER_LOGOUT_TIMEOUT"
    );

    if (error) {
      console.warn("Не удалось проверить Supabase session после logout:", error);
      return false;
    }

    if (data?.session) {
      console.warn("Supabase session всё ещё доступна после logout cleanup; повторно чистим local auth storage.");
      clearKnownAuthStorageKeys();
      return false;
    }

    console.info("Supabase session очищена после logout.");
    return true;
  } catch (error) {
    console.warn("Проверка Supabase session после logout не завершилась:", error);
    return false;
  }
}

function cleanDisplayName(value) {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function getUserNickname() {
  if (!currentUser) return "";

  const meta = currentUser.user_metadata || {};

  return cleanDisplayName(
    meta.nickname ||
    meta.username ||
    meta.display_name ||
    meta.name ||
    meta.full_name ||
    ""
  );
}

function getUserDisplayName() {
  return getUserNickname();
}

function getPendingSignupNow() {
  return Date.now();
}

function normalizePendingSignup(rawSignup) {
  const email = String(rawSignup?.email || "").trim();
  const nickname = cleanDisplayName(rawSignup?.nickname || "");
  const timestamp = Number(rawSignup?.timestamp || 0);

  if (!email || !timestamp || getPendingSignupNow() - timestamp > KLEVB_PENDING_SIGNUP_TTL_MS) {
    return null;
  }

  return { email, nickname, timestamp };
}

function getPendingSignup() {
  try {
    const savedSignup = localStorage.getItem(KLEVB_PENDING_SIGNUP_STORAGE_KEY);
    if (!savedSignup) return null;

    const pendingSignup = normalizePendingSignup(JSON.parse(savedSignup));
    if (!pendingSignup) {
      clearPendingSignup();
    }

    return pendingSignup;
  } catch (error) {
    console.warn("Не удалось прочитать pending signup:", error);
    clearPendingSignup();
    return null;
  }
}

function savePendingSignup(email, nickname) {
  const pendingSignup = normalizePendingSignup({
    email,
    nickname,
    timestamp: getPendingSignupNow()
  });

  if (!pendingSignup) return null;

  localStorage.setItem(KLEVB_PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(pendingSignup));
  return pendingSignup;
}

function clearPendingSignup() {
  try {
    localStorage.removeItem(KLEVB_PENDING_SIGNUP_STORAGE_KEY);
  } catch (error) {
    console.warn("Не удалось очистить pending signup:", error);
  }
}

function fillPendingSignupInputs(pendingSignup = getPendingSignup()) {
  if (!pendingSignup) return;

  const emailInput = document.getElementById("emailInput");
  const usernameInput = document.getElementById("usernameInput");

  if (emailInput && !emailInput.value) {
    emailInput.value = pendingSignup.email;
  }

  if (usernameInput && pendingSignup.nickname && !usernameInput.value) {
    usernameInput.value = pendingSignup.nickname;
  }
}

function getSignupCodeTokenVariants(codeValue) {
  const withoutSpaces = String(codeValue || "").trim().replace(/\s+/g, "");
  const digitsOnly = withoutSpaces.replace(/-/g, "");
  const variants = [withoutSpaces, digitsOnly];

  if (/^\d{8}$/.test(digitsOnly)) {
    variants.push(`${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`);
  }

  return [...new Set(variants.filter(Boolean))];
}

function setSignupCodeResendCooldown() {
  signupCodeResendUntil = Date.now() + KLEVB_SIGNUP_CODE_RESEND_COOLDOWN_MS;
  updateSignupCodeResendButton();
}

function updateSignupCodeResendButton() {
  const resendBtn = document.getElementById("authResendBtn");
  if (!resendBtn) return;

  const secondsLeft = Math.ceil((signupCodeResendUntil - Date.now()) / 1000);

  if (secondsLeft > 0) {
    resendBtn.disabled = true;
    resendBtn.textContent = `Отправить код ещё раз (${secondsLeft})`;
    setTimeout(updateSignupCodeResendButton, 1000);
  } else {
    resendBtn.disabled = false;
    resendBtn.textContent = "Отправить код ещё раз";
  }
}

function fillAuthorLocal() {
  const savedName = localStorage.getItem("klevby_author_name") || "";
  const savedTelegram = localStorage.getItem("klevby_author_telegram") || "";
  const profileName = getUserDisplayName();

  const nameInput = document.getElementById("nameInput");
  const telegramInput = document.getElementById("telegramInput");

  if (nameInput && (savedName || profileName) && !nameInput.value) {
    nameInput.value = savedName || profileName;
  }

  if (telegramInput && savedTelegram && !telegramInput.value) {
    telegramInput.value = savedTelegram;
  }

  const usernameInput = document.getElementById("usernameInput");
  if (usernameInput && profileName && !usernameInput.value && authMode === "register") {
    usernameInput.value = profileName;
  }
}

function setAuthMode(mode) {
  resetAuthFormUiState();

  authMode = ["login", "register", "verify"].includes(mode) ? mode : "register";

  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const usernameLabel = document.getElementById("usernameLabel");
  const usernameInput = document.getElementById("usernameInput");
  const passwordLabel = document.getElementById("passwordLabel");
  const passwordInput = document.getElementById("passwordInput");
  const codeLabel = document.getElementById("signupCodeLabel");
  const codeInput = document.getElementById("signupCodeInput");
  const createBtn = document.getElementById("authCreateBtn");
  const loginBtn = document.getElementById("authLoginBtn");
  const verifyBtn = document.getElementById("authVerifyBtn");
  const resendBtn = document.getElementById("authResendBtn");
  const switchText = document.getElementById("authSwitchText");

  if (!title || !subtitle || !usernameLabel || !usernameInput || !passwordInput || !createBtn || !loginBtn || !switchText) return;

  usernameLabel.classList.add("hidden");
  usernameInput.classList.add("hidden");
  passwordLabel?.classList.remove("hidden");
  passwordInput.classList.remove("hidden");
  codeLabel?.classList.add("hidden");
  codeInput?.classList.add("hidden");
  createBtn.classList.add("hidden");
  loginBtn.classList.add("hidden");
  verifyBtn?.classList.add("hidden");
  resendBtn?.classList.add("hidden");

  if (authMode === "login") {
    title.textContent = "Вход";
    subtitle.textContent = "Сохраняй профиль, пиши в чат,\nсоздавай выезды и объявления.";
    passwordInput.setAttribute("autocomplete", "current-password");
    loginBtn.classList.remove("hidden");
    switchText.innerHTML = `
      Нет аккаунта?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('register')">Создать аккаунт</button>
    `;
  } else if (authMode === "verify") {
    fillPendingSignupInputs();
    title.textContent = "Подтверди email";
    subtitle.textContent = "Введи код из письма,\nчтобы завершить регистрацию.";
    passwordLabel?.classList.add("hidden");
    passwordInput.classList.add("hidden");
    codeLabel?.classList.remove("hidden");
    codeInput?.classList.remove("hidden");
    verifyBtn?.classList.remove("hidden");
    resendBtn?.classList.remove("hidden");
    updateSignupCodeResendButton();
    switchText.innerHTML = `
      Уже подтвердили email?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('login')">Войти</button>
    `;
    codeInput?.focus();
  } else {
    title.textContent = "Регистрация";
    subtitle.textContent = "Придумай ник, укажи email\nи подтверди код из письма.";
    usernameLabel.classList.remove("hidden");
    usernameInput.classList.remove("hidden");
    passwordInput.setAttribute("autocomplete", "new-password");
    createBtn.classList.remove("hidden");
    switchText.innerHTML = `
      Уже есть аккаунт?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('login')">Войти</button>
    `;
  }
}

async function restoreAuthState(reason = "manual", reloadData = false) {
  if (!supabaseClient || authRestoreInProgress) return currentUser;

  if (isAuthLogoutGuardActive()) {
    refreshGuestStateDuringLogoutGuard();
    if (reloadData) {
      await loadPosts();
      reloadPondsIfReady();
    }
    maybeResetAuthFormUiAfterRestore();
    return null;
  }

  const now = Date.now();

  if (reason !== "init" && now - lastAuthRestoreAt < 900) {
    return currentUser;
  }

  authRestoreInProgress = true;
  lastAuthRestoreAt = now;

  const previousUserId = currentUser?.id || null;

  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError) {
      console.warn("Не удалось получить Supabase session:", sessionError);
    }

    let restoredUser = sessionData?.session?.user || null;

    if (!restoredUser) {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();

      if (userError) {
        console.warn("Не удалось получить Supabase user:", userError);
      }

      restoredUser = userData?.user || null;
    }

    if (isAuthLogoutGuardActive()) {
      refreshGuestStateDuringLogoutGuard();
      return null;
    }

    currentUser = restoredUser;
    authReady = true;

    syncGlobalAuthState();
    updateAuthStatus();
    fillAuthorLocal();

    const newUserId = currentUser?.id || null;
    const userChanged = previousUserId !== newUserId;

    handleProfileStorageOnAccountSwitch(previousUserId, newUserId);
    syncKnownProfileUserId(newUserId);

    if (reloadData || userChanged) {
      await loadPosts();
      reloadPondsIfReady();
    } else {
      renderPosts();
      reloadPondsIfReady();
    }

    return currentUser;
  } catch (error) {
    console.warn("Ошибка восстановления входа:", reason, error);
    authReady = true;
    syncGlobalAuthState();
    updateAuthStatus();
    return currentUser;
  } finally {
    authRestoreInProgress = false;
    maybeResetAuthFormUiAfterRestore();
  }
}

function scheduleAuthRestore(reason = "resume", reloadData = false) {
  clearPendingAuthRestore();

  if (isAuthLogoutGuardActive()) {
    refreshGuestStateDuringLogoutGuard();
    return false;
  }

  authRestoreTimer = setTimeout(() => {
    authRestoreTimer = null;
    restoreAuthState(reason, reloadData);
  }, 250);

  return true;
}

async function initAuth() {
  await restoreAuthState("init", false);

  if (window.location.hash.includes("access_token")) {
    const resetModal = document.getElementById("resetModal");
    if (resetModal) {
      resetModal.classList.remove("hidden");
    }
  }

  const pendingSignup = currentUser ? null : getPendingSignup();
  if (pendingSignup) {
    fillPendingSignupInputs(pendingSignup);
    window.klevbyAuthStatusNotice = "Введите код из письма. Если писем несколько — используйте последний код.";
  }

  setAuthMode(currentUser ? "login" : (pendingSignup ? "verify" : "register"));
  updateAuthStatus();
  fillAuthorLocal();

  if (!currentUser && typeof showSection === "function") {
    showSection("auth");
  }

  await loadPosts();
  reloadPondsIfReady();
}

function updateAuthStatus() {
  const status = document.getElementById("authStatus");
  if (!status) return;

  if (!authReady) {
    status.textContent = "Проверяем вход...";
    return;
  }

  if (currentUser) {
    window.klevbyAuthStatusNotice = "";
    const nickname = getUserNickname();
    status.textContent =
      "Ты вошёл: " +
      currentUser.email +
      (nickname ? " | Nickname: " + nickname : "") +
      (isAdmin() ? " | Админ включён" : "");
  } else if (window.klevbyAuthStatusNotice) {
    status.textContent = window.klevbyAuthStatusNotice;
  } else {
    status.textContent = "Ты не вошёл. Чтобы создать объявление — создай профиль или войди.";
  }
}

async function register() {
  const nickname = cleanDisplayName(document.getElementById("usernameInput").value);
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!nickname || !email || !password) {
    return alert("Введи Nickname, email и пароль.");
  }

  if (nickname.length < 2) {
    return alert("Nickname должен быть минимум 2 символа.");
  }

  if (password.length < 6) {
    return alert("Пароль должен быть минимум 6 символов.");
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname,
        username: nickname,
        display_name: nickname
      }
    }
  });

  if (error) {
    return alert("Не удалось создать профиль: " + error.message);
  }

  const activeSession = data?.session || null;
  if (activeSession?.user) {
    clearPendingSignup();
    clearAuthLogoutGuardForFreshLogin();
  }
  currentUser = activeSession?.user || null;
  authReady = true;
  syncGlobalAuthState();

  if (currentUser) {
    const updateResult = await supabaseClient.auth.updateUser({
      data: {
        nickname,
        username: nickname,
        display_name: nickname
      }
    });

    if (!updateResult.error) {
      currentUser = updateResult.data?.user || currentUser;
      syncGlobalAuthState();
    }
  }

  localStorage.setItem("klevby_author_name", nickname);
  localStorage.setItem("klevby_chat_username", nickname);

  const nameInput = document.getElementById("nameInput");
  if (nameInput && !nameInput.value) {
    nameInput.value = nickname;
  }

  if (!activeSession) {
    savePendingSignup(email, nickname);
    clearAuthCredentialFields({ password: true, code: false });
    window.klevbyAuthStatusNotice = "Письмо отправлено. Введите код из письма. Если писем несколько — используйте последний код.";
    setAuthMode("verify");
    updateAuthStatus();
    reloadPondsIfReady();
    return;
  }

  window.klevbyAuthStatusNotice = "";
  clearAuthCredentialFields({
    email: true,
    password: true,
    code: true,
    username: true
  });
  updateAuthStatus();
  alert("Профиль создан. Ты вошёл в аккаунт.");
  await restoreAuthState("register", true);
  reloadPondsIfReady();
  showSection("home");
}

async function verifySignupCode() {
  if (klevbySignupVerifyInProgress) return;

  const pendingSignup = getPendingSignup();
  const email = String(pendingSignup?.email || document.getElementById("emailInput")?.value || "").trim();
  const codeInput = document.getElementById("signupCodeInput");
  const rawCode = String(codeInput?.value || "").trim();
  const compactCode = rawCode.replace(/\s+/g, "");
  const digitsOnly = compactCode.replace(/-/g, "");
  const verifyBtn = document.getElementById("authVerifyBtn");

  if (!email) {
    return alert("Введите email для подтверждения.");
  }

  if (!rawCode) {
    return alert("Введите код из письма.");
  }

  if (/[^\d\s-]/.test(rawCode) || digitsOnly.length < 6) {
    return alert("Код должен содержать только цифры, пробелы или дефис. Проверьте код из последнего письма.");
  }

  klevbySignupVerifyInProgress = true;

  if (verifyBtn) {
    verifyBtn.disabled = true;
  }

  try {
    const tokenVariants = getSignupCodeTokenVariants(rawCode);
    let lastError = null;
    let verifiedData = null;

    for (const token of tokenVariants) {
      const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: "signup"
      });

      if (!error) {
        verifiedData = data;
        lastError = null;
        break;
      }

      lastError = error;
    }

    if (lastError) {
      const normalizedEmail = email.toLowerCase();
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const sessionUser = sessionData?.session?.user || null;
      const sessionEmail = String(sessionUser?.email || "").trim().toLowerCase();

      if (sessionUser && sessionEmail === normalizedEmail) {
        verifiedData = {
          session: sessionData.session,
          user: sessionUser
        };
        lastError = null;
      }
    }

    if (lastError) {
      window.klevbyAuthStatusNotice = "Код не подошёл. Проверьте последний код из письма или отправьте код ещё раз.";
      updateAuthStatus();
      return alert("Код не подошёл: " + lastError.message);
    }

    clearPendingSignup();
    clearAuthLogoutGuardForFreshLogin();
    currentUser = verifiedData?.session?.user || verifiedData?.user || null;
    authReady = true;
    syncGlobalAuthState();

    if (currentUser && pendingSignup?.nickname) {
      const updateResult = await supabaseClient.auth.updateUser({
        data: {
          nickname: pendingSignup.nickname,
          username: pendingSignup.nickname,
          display_name: pendingSignup.nickname
        }
      });

      if (!updateResult.error) {
        currentUser = updateResult.data?.user || currentUser;
        syncGlobalAuthState();
      }

      localStorage.setItem("klevby_author_name", pendingSignup.nickname);
      localStorage.setItem("klevby_chat_username", pendingSignup.nickname);
    }

    window.klevbyAuthStatusNotice = "";
    await restoreAuthState("verify", true);
    clearAuthCredentialFields({
      email: true,
      password: true,
      code: true,
      username: true
    });
    updateAuthStatus();
    fillAuthorLocal();
    reloadPondsIfReady();
    alert("Email подтверждён. Ты вошёл в аккаунт.");
    showSection("home");
  } finally {
    klevbySignupVerifyInProgress = false;

    if (verifyBtn) {
      verifyBtn.disabled = false;
    }
  }
}

async function resendSignupCode() {
  const pendingSignup = getPendingSignup();
  const email = String(pendingSignup?.email || document.getElementById("emailInput")?.value || "").trim();
  const secondsLeft = Math.ceil((signupCodeResendUntil - Date.now()) / 1000);

  if (!email) {
    return alert("Введите email, чтобы отправить код ещё раз.");
  }

  if (secondsLeft > 0) {
    return alert(`Подождите ${secondsLeft} сек. перед повторной отправкой.`);
  }

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email
  });

  if (error) {
    return alert("Не получилось отправить код ещё раз: " + error.message);
  }

  if (pendingSignup) {
    savePendingSignup(email, pendingSignup.nickname);
  }

  setSignupCodeResendCooldown();
  window.klevbyAuthStatusNotice = "Код отправлен ещё раз. Если писем несколько — используйте последний код.";
  updateAuthStatus();
  alert("Код отправлен ещё раз. Если писем несколько — используйте последний код.");
}

async function login() {
  if (klevbyLoginInProgress) return;

  const email = document.getElementById("emailInput").value.trim();
  const passwordInput = document.getElementById("passwordInput");
  const password = passwordInput ? passwordInput.value.trim() : "";

  if (!email || !password) {
    return alert("Введи email и пароль.");
  }

  klevbyLoginInProgress = true;
  setLoginLoadingState(true, "Входим...");
  prepareAuthForExplicitLogin();

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      window.klevbyExplicitLoginInProgress = false;
      clearAuthCredentialFields({ password: true });
      window.klevbyAuthStatusNotice = "Не удалось войти. Проверьте email и пароль.";
      updateAuthStatus();
      return alert("Проверьте email и пароль. Если вы только зарегистрировались — сначала подтвердите письмо на почте.");
    }

    clearPendingSignup();
    finishAuthExplicitLogin();
    clearAuthCredentialFields({ password: true, code: true });
    currentUser = data.user;
    authReady = true;
    window.klevbyAuthStatusNotice = "";
    syncGlobalAuthState();

    const nickname = getUserNickname();

    if (nickname) {
      localStorage.setItem("klevby_author_name", nickname);
      localStorage.setItem("klevby_chat_username", nickname);
    }

    await restoreAuthState("login", true);
    reloadProfilePhotosAfterFreshLogin();
    updateAuthStatus();
    fillAuthorLocal();
    reloadPondsIfReady();
    showSection("home");
  } catch (error) {
    window.klevbyExplicitLoginInProgress = false;
    clearAuthCredentialFields({ password: true });
    window.klevbyAuthStatusNotice = "Не удалось войти. Проверьте подключение и попробуйте ещё раз.";
    updateAuthStatus();
    console.warn("Ошибка входа:", error);
    alert("Не удалось войти. Проверьте подключение и попробуйте ещё раз.");
  } finally {
    klevbyLoginInProgress = false;
    setLoginLoadingState(false);
  }
}

async function logout() {
  markAuthLogoutStarted();
  clearPendingAuthRestore();
  forceGuestAuthState();

  try {
    await signOutSupabaseClientLocalFirst();
  } finally {
    const cleanupResult = clearKnownAuthStorageKeys();
    await verifySupabaseSessionClearedAfterLogout();
    forceGuestAuthState();
    resetAuthFormUiState();
    setAuthMode("register");
    await loadPosts();
    reloadPondsIfReady();
    markAuthLogoutFinished();

    if (cleanupResult.remaining.length) {
      console.warn("Logout завершён, но часть auth storage keys осталась:", cleanupResult.remaining);
    }

    if (typeof showSection === "function") {
      showSection("auth");
    }
  }

  alert("Ты вышел.");
}

async function sendRecovery() {
  const email = document.getElementById("emailInput").value.trim();

  if (!email) {
    return alert("Введи email.");
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "https://klevby.com"
  });

  if (error) {
    return alert("Не получилось отправить письмо: " + error.message);
  }

  alert("Письмо для сброса пароля отправлено.");
}

async function updatePassword() {
  const newPassword = document.getElementById("newPasswordInput").value.trim();

  if (!newPassword) {
    return alert("Введи новый пароль.");
  }

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  if (error) {
    document.getElementById("resetMessage").textContent = "Ошибка: " + error.message;
    return;
  }

  document.getElementById("resetMessage").textContent = "Пароль обновлён.";

  setTimeout(() => {
    closeResetModal();
    window.history.replaceState(null, "", window.location.pathname);
  }, 1000);
}

function closeResetModal() {
  const resetModal = document.getElementById("resetModal");
  if (!resetModal) return;

  resetModal.classList.add("hidden");
}

window.cleanDisplayName = cleanDisplayName;
window.getUserNickname = getUserNickname;
window.getUserDisplayName = getUserDisplayName;
window.fillAuthorLocal = fillAuthorLocal;
window.setAuthMode = setAuthMode;
window.restoreAuthState = restoreAuthState;
window.isAuthLogoutGuardActive = isAuthLogoutGuardActive;
window.clearAuthLogoutGuardForFreshLogin = clearAuthLogoutGuardForFreshLogin;
window.clearKnownAuthStorageKeys = clearKnownAuthStorageKeys;
window.listAuthStorageKeys = listAuthStorageKeys;
window.scheduleAuthRestore = scheduleAuthRestore;
window.initAuth = initAuth;
window.updateAuthStatus = updateAuthStatus;
window.resetGuestProfileAfterLogout = resetGuestProfileAfterLogout;
window.reloadProfilePhotosAfterFreshLogin = reloadProfilePhotosAfterFreshLogin;
window.register = register;
window.verifySignupCode = verifySignupCode;
window.resendSignupCode = resendSignupCode;
window.login = login;
window.logout = logout;
window.sendRecovery = sendRecovery;
window.updatePassword = updatePassword;
window.closeResetModal = closeResetModal;


// TEMP auth skip button: remove when auth wall flow is finalized
(function initTemporaryAuthSkipButton() {
  function bindTemporaryAuthSkipButton() {
    const skipBtn = document.getElementById("authSkipBtn");
    if (!skipBtn || skipBtn.dataset.bound === "1") return;

    skipBtn.dataset.bound = "1";
    skipBtn.addEventListener("click", () => {
      if (typeof showSection === "function") {
        showSection("home");
        return;
      }

      document.getElementById("authSection")?.classList.add("hidden");
      document.getElementById("homeSection")?.classList.remove("hidden");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTemporaryAuthSkipButton, { once: true });
  } else {
    bindTemporaryAuthSkipButton();
  }
})();
// /TEMP auth skip button

