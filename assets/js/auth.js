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

const PENDING_SIGNUP_STORAGE_KEY = "klevby_pending_signup";
const PENDING_SIGNUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SIGNUP_RESEND_COOLDOWN_MS = 50 * 1000;
const RECENT_LOGOUT_STORAGE_KEY = "klevby_recent_logout";
const RECENT_LOGOUT_TTL_MS = 20 * 1000;
const PROFILE_LOGOUT_CLEAR_KEYS = [
  "klevby_author_name",
  "klevby_chat_username",
  "klevby_profile_name",
  "klevby_profile_avatar",
  "klevby_profile_settings"
];

let pendingSignupEmail = "";
let pendingSignupNickname = "";
let pendingSignupTimestamp = 0;
let lastSignupResendAt = 0;
let signupResendCooldownTimer = null;
let logoutInProgress = false;

function getPendingSignupStorage() {
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const email = String(parsed?.email || "").trim();
    const timestamp = Number(parsed?.timestamp || 0);

    if (!email || !timestamp || Date.now() - timestamp > PENDING_SIGNUP_MAX_AGE_MS) {
      localStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
      return null;
    }

    return {
      email,
      nickname: cleanDisplayName(parsed?.nickname || ""),
      timestamp
    };
  } catch (_) {
    localStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
    return null;
  }
}

function savePendingSignup(email, nickname = "") {
  pendingSignupEmail = String(email || "").trim();
  pendingSignupNickname = cleanDisplayName(nickname);
  pendingSignupTimestamp = Date.now();

  if (!pendingSignupEmail) return;

  localStorage.setItem(
    PENDING_SIGNUP_STORAGE_KEY,
    JSON.stringify({
      email: pendingSignupEmail,
      nickname: pendingSignupNickname,
      timestamp: pendingSignupTimestamp
    })
  );
}

function restorePendingSignup() {
  const pending = getPendingSignupStorage();
  if (!pending) return false;

  pendingSignupEmail = pending.email;
  pendingSignupNickname = pending.nickname;
  pendingSignupTimestamp = pending.timestamp;

  const emailInput = document.getElementById("emailInput");
  if (emailInput && !emailInput.value) {
    emailInput.value = pendingSignupEmail;
  }

  const usernameInput = document.getElementById("usernameInput");
  if (usernameInput && pendingSignupNickname && !usernameInput.value) {
    usernameInput.value = pendingSignupNickname;
  }

  return true;
}

function clearPendingSignup() {
  pendingSignupEmail = "";
  pendingSignupNickname = "";
  pendingSignupTimestamp = 0;
  localStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}

function getSupabaseAuthStorageKeys() {
  const keys = new Set([
    "supabase.auth.token",
    window.KLEVB_CONFIG?.SUPABASE_STORAGE_KEY || "",
    typeof SUPABASE_STORAGE_KEY !== "undefined" ? SUPABASE_STORAGE_KEY : ""
  ].filter(Boolean));

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";

      if (key === PENDING_SIGNUP_STORAGE_KEY || key === RECENT_LOGOUT_STORAGE_KEY) {
        continue;
      }

      if (key.startsWith("sb-") || key.includes("auth-token")) {
        keys.add(key);
      }
    }
  } catch (error) {
    console.warn("Klevby auth: не удалось прочитать localStorage для очистки auth.", error);
  }

  return Array.from(keys);
}

function clearSupabaseAuthStorage() {
  const keys = getSupabaseAuthStorageKeys();

  [localStorage, sessionStorage].forEach((storage) => {
    keys.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch (error) {
        console.warn("Klevby auth: не удалось очистить auth storage.", { key, error });
      }
    });
  });
}

function markRecentLogout() {
  try {
    localStorage.setItem(RECENT_LOGOUT_STORAGE_KEY, String(Date.now()));
  } catch (error) {
    console.warn("Klevby auth: recent logout marker не сохранился.", error);
  }
}

function clearRecentLogoutMarker() {
  try {
    localStorage.removeItem(RECENT_LOGOUT_STORAGE_KEY);
  } catch (_) {
    // no-op
  }
}

function hasRecentLogoutMarker() {
  try {
    const timestamp = Number(localStorage.getItem(RECENT_LOGOUT_STORAGE_KEY) || 0);

    if (!timestamp) return false;

    if (Date.now() - timestamp > RECENT_LOGOUT_TTL_MS) {
      clearRecentLogoutMarker();
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

function resetGuestProfileAfterLogout(options = {}) {
  const keepPendingSignup = Boolean(options.keepPendingSignup);

  PROFILE_LOGOUT_CLEAR_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Klevby auth: не удалось очистить профиль после выхода.", { key, error });
    }
  });

  const profileAvatarImage = document.getElementById("profileAvatarImage");
  const profileAvatarFallback = document.getElementById("profileAvatarFallback");
  const mobileProfileAvatarIcon = document.getElementById("mobileProfileAvatarIcon");

  if (profileAvatarImage) {
    profileAvatarImage.removeAttribute("src");
    profileAvatarImage.classList.add("hidden");
  }

  if (profileAvatarFallback) {
    profileAvatarFallback.classList.remove("hidden");
    profileAvatarFallback.textContent = "Р";
  }

  if (mobileProfileAvatarIcon) {
    mobileProfileAvatarIcon.style.backgroundImage = "";
    mobileProfileAvatarIcon.textContent = "👤";
  }

  const nameInput = document.getElementById("nameInput");
  const usernameInput = document.getElementById("usernameInput");

  if (nameInput) nameInput.value = "";
  if (usernameInput && !keepPendingSignup) usernameInput.value = "";

  if (typeof window.updateKlevbyProfileView === "function") {
    window.updateKlevbyProfileView();
  }
}

function applyLocalLogoutState(options = {}) {
  const keepPendingSignup = Boolean(options.keepPendingSignup);

  markRecentLogout();
  clearSupabaseAuthStorage();

  if (!keepPendingSignup) {
    clearPendingSignup();
  }

  resetGuestProfileAfterLogout({ keepPendingSignup });
  currentUser = null;
  authReady = true;
  window.klevbyAuthStatusNotice = "";
  syncGlobalAuthState({ notify: true, forceNotify: true });
}

function updateSignupResendButton() {
  const resendBtn = document.getElementById("authResendCodeBtn");
  if (!resendBtn) return;

  const remainingMs = Math.max(0, SIGNUP_RESEND_COOLDOWN_MS - (Date.now() - lastSignupResendAt));

  if (authMode !== "verify" || remainingMs <= 0) {
    resendBtn.disabled = false;
    resendBtn.textContent = "Отправить код ещё раз";
    clearTimeout(signupResendCooldownTimer);
    signupResendCooldownTimer = null;
    return;
  }

  resendBtn.disabled = true;
  resendBtn.textContent = `Отправить код ещё раз (${Math.ceil(remainingMs / 1000)}с)`;

  clearTimeout(signupResendCooldownTimer);
  signupResendCooldownTimer = setTimeout(updateSignupResendButton, 1000);
}

function setAuthMode(mode) {
  authMode = ["login", "verify"].includes(mode) ? mode : "register";

  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const usernameLabel = document.getElementById("usernameLabel");
  const usernameInput = document.getElementById("usernameInput");
  const passwordLabel = document.getElementById("passwordLabel");
  const passwordInput = document.getElementById("passwordInput");
  const codeLabel = document.getElementById("authCodeLabel");
  const codeInput = document.getElementById("authCodeInput");
  const createBtn = document.getElementById("authCreateBtn");
  const loginBtn = document.getElementById("authLoginBtn");
  const verifyBtn = document.getElementById("authVerifyCodeBtn");
  const resendBtn = document.getElementById("authResendCodeBtn");
  const switchText = document.getElementById("authSwitchText");

  if (!title || !subtitle || !usernameLabel || !usernameInput || !passwordLabel || !passwordInput || !codeLabel || !codeInput || !createBtn || !loginBtn || !verifyBtn || !resendBtn || !switchText) return;

  usernameLabel.classList.add("hidden");
  usernameInput.classList.add("hidden");
  passwordLabel.classList.add("hidden");
  passwordInput.classList.add("hidden");
  codeLabel.classList.add("hidden");
  codeInput.classList.add("hidden");
  createBtn.classList.add("hidden");
  loginBtn.classList.add("hidden");
  verifyBtn.classList.add("hidden");
  resendBtn.classList.add("hidden");

  if (authMode === "login") {
    title.textContent = "Войти в профиль";
    subtitle.textContent = "Войди через email и пароль. Если ты только зарегистрировался — подтверди email кодом из письма.";
    passwordLabel.classList.remove("hidden");
    passwordInput.classList.remove("hidden");
    passwordInput.setAttribute("autocomplete", "current-password");
    loginBtn.classList.remove("hidden");
    switchText.innerHTML = `
      Нет аккаунта?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('register')">Создать профиль</button>
    `;
  } else if (authMode === "verify") {
    restorePendingSignup();
    title.textContent = "Введите код из письма";
    subtitle.textContent = "Код может действовать ограниченное время. Если писем несколько — используйте последний код.";
    codeLabel.classList.remove("hidden");
    codeInput.classList.remove("hidden");
    verifyBtn.classList.remove("hidden");
    resendBtn.classList.remove("hidden");
    switchText.innerHTML = `
      Нужно изменить email или создать другой профиль?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('register')">Вернуться к регистрации</button>
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('login')">Войти паролем</button>
    `;
    updateSignupResendButton();
    codeInput.focus();
  } else {
    title.textContent = "Регистрация аккаунта Klevby";
    subtitle.textContent = "Зарегистрироваться можно через email и пароль. После регистрации код придёт на email — введите его здесь, чтобы подтвердить почту и войти.";
    usernameLabel.classList.remove("hidden");
    usernameInput.classList.remove("hidden");
    passwordLabel.classList.remove("hidden");
    passwordInput.classList.remove("hidden");
    passwordInput.setAttribute("autocomplete", "new-password");
    createBtn.classList.remove("hidden");
    switchText.innerHTML = `
      Уже есть аккаунт?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('login')">Войти</button>
    `;
  }
}

async function restoreAuthState(reason = "manual", reloadData = false) {
  if (hasRecentLogoutMarker()) {
    clearSupabaseAuthStorage();
    resetGuestProfileAfterLogout({ keepPendingSignup: true });
    currentUser = null;
    authReady = true;
    syncGlobalAuthState({ notify: true, forceNotify: true });
    updateAuthStatus();
    return currentUser;
  }

  if (!supabaseClient || authRestoreInProgress) return currentUser;

  const now = Date.now();

  if (!["init", "verify-email"].includes(reason) && now - lastAuthRestoreAt < 900) {
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

    currentUser = restoredUser;
    authReady = true;

    syncGlobalAuthState();
    updateAuthStatus();
    fillAuthorLocal();

    const newUserId = currentUser?.id || null;
    const userChanged = previousUserId !== newUserId;

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
  }
}

function scheduleAuthRestore(reason = "resume", reloadData = false) {
  clearTimeout(authRestoreTimer);

  authRestoreTimer = setTimeout(() => {
    restoreAuthState(reason, reloadData);
  }, 250);
}

function setupAuthResumeHandlers() {
  if (window.__klevbyCentralResumeRouter) {
    return;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleAuthRestore("visibilitychange", true);
    }
  });

  window.addEventListener("pageshow", () => {
    scheduleAuthRestore("pageshow", true);
  });

  window.addEventListener("focus", () => {
    scheduleAuthRestore("focus", false);
  });

  window.addEventListener("online", () => {
    scheduleAuthRestore("online", true);
  });
}

async function initAuth() {
  await restoreAuthState("init", false);

  if (window.location.hash.includes("access_token")) {
    const resetModal = document.getElementById("resetModal");
    if (resetModal) {
      resetModal.classList.remove("hidden");
    }
  }

  if (!currentUser && restorePendingSignup()) {
    window.klevbyAuthStatusNotice = "Введите код из последнего письма или отправьте код ещё раз.";
    setAuthMode("verify");
  } else {
    setAuthMode(currentUser ? "login" : "register");
  }

  updateAuthStatus();
  fillAuthorLocal();
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
  clearRecentLogoutMarker();
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
    const codeInput = document.getElementById("authCodeInput");
    if (codeInput) {
      codeInput.value = "";
    }

    window.klevbyAuthStatusNotice = "Код отправлен на почту. Введите код из письма.";
    setAuthMode("verify");
    updateAuthStatus();
    reloadPondsIfReady();
    return;
  }

  clearPendingSignup();
  window.klevbyAuthStatusNotice = "";
  updateAuthStatus();
  alert("Профиль создан. Ты вошёл в аккаунт.");
  await restoreAuthState("register", true);
  reloadPondsIfReady();
  showSection("home");
}

async function login() {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!email || !password) {
    return alert("Введи email и пароль.");
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    return alert("Проверьте email и пароль. Если вы только зарегистрировались — подтвердите email кодом из письма.");
  }

  clearRecentLogoutMarker();
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
  updateAuthStatus();
  fillAuthorLocal();
  reloadPondsIfReady();
  showSection("home");
}

async function verifySignupCode() {
  const email = (pendingSignupEmail || document.getElementById("emailInput")?.value || "").trim();
  const rawToken = String(document.getElementById("authCodeInput")?.value || "").trim();
  const tokenWithoutSpaces = rawToken.replace(/\s+/g, "");
  const tokenDigitsOnly = tokenWithoutSpaces.replace(/-/g, "");
  const tokenCandidates = [tokenWithoutSpaces];

  if (/^\d{8}$/.test(tokenDigitsOnly)) {
    tokenCandidates.push(`${tokenDigitsOnly.slice(0, 4)}-${tokenDigitsOnly.slice(4)}`);
  }

  tokenCandidates.push(tokenDigitsOnly);

  const uniqueTokenCandidates = tokenCandidates.filter((token, index, tokens) => (
    token && tokens.indexOf(token) === index
  ));

  if (!email) {
    window.klevbyAuthStatusNotice = "Введите email, на который отправлен код.";
    updateAuthStatus();
    return;
  }

  if (!tokenWithoutSpaces || !/^[\d\s-]+$/.test(rawToken) || !/^\d{6,}$/.test(tokenDigitsOnly)) {
    window.klevbyAuthStatusNotice = "Введите код из письма.";
    updateAuthStatus();
    return;
  }

  let verifyData = null;
  let verifyError = null;

  for (const token of uniqueTokenCandidates) {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email,
      token,
      type: "email"
    });

    if (!error) {
      verifyData = data;
      verifyError = null;
      break;
    }

    verifyError = error;
  }

  if (verifyError) {
    window.klevbyAuthStatusNotice = "Код неверный или истёк. Проверьте код или отправьте новый.";
    updateAuthStatus();
    return;
  }

  clearRecentLogoutMarker();
  currentUser = verifyData?.user || verifyData?.session?.user || currentUser;
  authReady = true;
  clearPendingSignup();
  window.klevbyAuthStatusNotice = "";
  syncGlobalAuthState();
  await restoreAuthState("verify-email", true);
  updateAuthStatus();
  fillAuthorLocal();
  reloadPondsIfReady();
  showSection("home");
}

async function resendSignupCode() {
  const email = (pendingSignupEmail || document.getElementById("emailInput")?.value || "").trim();

  if (!email) {
    window.klevbyAuthStatusNotice = "Введите email, на который нужно отправить код.";
    updateAuthStatus();
    return;
  }

  const remainingMs = SIGNUP_RESEND_COOLDOWN_MS - (Date.now() - lastSignupResendAt);
  if (remainingMs > 0) {
    window.klevbyAuthStatusNotice = `Отправить код ещё раз можно через ${Math.ceil(remainingMs / 1000)}с.`;
    updateAuthStatus();
    updateSignupResendButton();
    return;
  }

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email
  });

  lastSignupResendAt = Date.now();
  updateSignupResendButton();

  if (error) {
    window.klevbyAuthStatusNotice = "Если регистрация есть, мы отправили новый код. Используйте последний код из письма.";
    updateAuthStatus();
    return;
  }

  savePendingSignup(email, pendingSignupNickname);
  window.klevbyAuthStatusNotice = "Если регистрация есть, мы отправили новый код. Используйте последний код из письма.";
  updateAuthStatus();
}

async function logout() {
  if (logoutInProgress) return;

  logoutInProgress = true;

  try {
    markRecentLogout();

    if (supabaseClient?.auth && typeof supabaseClient.auth.signOut === "function") {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        console.warn("Klevby auth: Supabase signOut вернул ошибку, очищаем локальную сессию.", error);
      }
    }
  } catch (error) {
    console.warn("Klevby auth: выход через Supabase не завершился, очищаем локальную сессию.", error);
  } finally {
    applyLocalLogoutState();
    updateAuthStatus();
    setAuthMode("register");
    await loadPosts();
    reloadPondsIfReady();
    logoutInProgress = false;
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
window.scheduleAuthRestore = scheduleAuthRestore;
window.setupAuthResumeHandlers = setupAuthResumeHandlers;
window.initAuth = initAuth;
window.updateAuthStatus = updateAuthStatus;
window.register = register;
window.login = login;
window.verifySignupCode = verifySignupCode;
window.resendSignupCode = resendSignupCode;
window.clearSupabaseAuthStorage = clearSupabaseAuthStorage;
window.markRecentLogout = markRecentLogout;
window.clearRecentLogoutMarker = clearRecentLogoutMarker;
window.hasRecentLogoutMarker = hasRecentLogoutMarker;
window.applyLocalLogoutState = applyLocalLogoutState;
window.logout = logout;
window.sendRecovery = sendRecovery;
window.updatePassword = updatePassword;
window.closeResetModal = closeResetModal;
