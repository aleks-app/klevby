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

function setAuthMode(mode) {
  authMode = mode === "login" ? "login" : "register";

  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const usernameLabel = document.getElementById("usernameLabel");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const createBtn = document.getElementById("authCreateBtn");
  const loginBtn = document.getElementById("authLoginBtn");
  const switchText = document.getElementById("authSwitchText");

  if (!title || !subtitle || !usernameLabel || !usernameInput || !passwordInput || !createBtn || !loginBtn || !switchText) return;

  if (authMode === "login") {
    title.textContent = "Войти в профиль";
    subtitle.textContent = "Войди через email и пароль. Если ты только зарегистрировался — сначала подтверди email по ссылке из письма, потом вернись в Klevby и войди.";
    usernameLabel.classList.add("hidden");
    usernameInput.classList.add("hidden");
    passwordInput.setAttribute("autocomplete", "current-password");
    createBtn.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    switchText.innerHTML = `
      Нет аккаунта?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('register')">Создать профиль</button>
    `;
  } else {
    title.textContent = "Регистрация аккаунта Klevby";
    subtitle.textContent = "Создай аккаунт через email и пароль. После регистрации открой письмо, подтверди email по ссылке (она может открыться в браузере), затем вернись в Klevby и войди.";
    usernameLabel.classList.remove("hidden");
    usernameInput.classList.remove("hidden");
    passwordInput.setAttribute("autocomplete", "new-password");
    createBtn.classList.remove("hidden");
    loginBtn.classList.add("hidden");
    switchText.innerHTML = `
      Уже есть аккаунт?
      <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('login')">Войти</button>
    `;
  }
}

async function restoreAuthState(reason = "manual", reloadData = false) {
  if (!supabaseClient || authRestoreInProgress) return currentUser;

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

  setAuthMode(currentUser ? "login" : "register");
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
    window.klevbyAuthStatusNotice = "Письмо отправлено. Откройте почту, подтвердите email, потом вернитесь в Klevby и войдите.";
    setAuthMode("login");

    const switchText = document.getElementById("authSwitchText");
    if (switchText) {
      switchText.innerHTML = `
        После подтверждения email нажмите «Войти».
        <button class="small-btn gray" style="min-height:36px;padding:8px 12px;margin-left:8px;" onclick="setAuthMode('register')">Создать другой профиль</button>
      `;
    }

    updateAuthStatus();
    reloadPondsIfReady();
    return;
  }

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
    return alert("Проверьте email и пароль. Если вы только зарегистрировались — сначала подтвердите письмо на почте.");
  }

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

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  authReady = true;
  window.klevbyAuthStatusNotice = "";
  syncGlobalAuthState();
  updateAuthStatus();
  setAuthMode("register");
  await loadPosts();
  reloadPondsIfReady();
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
window.logout = logout;
window.sendRecovery = sendRecovery;
window.updatePassword = updatePassword;
window.closeResetModal = closeResetModal;
