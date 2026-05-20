(function () {
  const ADMIN_EMAIL =
    window.KLEVB_ADMIN_EMAIL ||
    window.ADMIN_EMAIL ||
    window.klevbyAdminEmail ||
    window.KLEVB_CONFIG?.ADMIN_EMAIL ||
    "al822alex@gmail.com";

  let authDb = null;
  let currentMode = "register";
  let currentUser = null;
  let authProfileInitialized = false;
  let authProfileWaitTimer = null;
  let authProfileStateSubscription = null;

  function getExistingSupabaseClient() {
    if (typeof window.klevbyGetSupabase === "function") {
      try {
        const client = window.klevbyGetSupabase();
        if (client) return client;
      } catch (error) {
        console.warn("Klevby auth profile: klevbyGetSupabase не вернул клиент.", error);
      }
    }

    if (window.supabaseClient) return window.supabaseClient;
    if (window.klevbySupabase) return window.klevbySupabase;

    return null;
  }

  function waitForSupabase(callback) {
    let tries = 0;

    clearInterval(authProfileWaitTimer);

    const tryAttach = () => {
      tries += 1;

      const existingClient = getExistingSupabaseClient();

      if (existingClient) {
        clearInterval(authProfileWaitTimer);
        authProfileWaitTimer = null;
        authDb = existingClient;
        callback();
        return;
      }

      if (tries > 80) {
        clearInterval(authProfileWaitTimer);
        authProfileWaitTimer = null;
        console.warn("Klevby auth profile: основной Supabase client не найден. Второй client не создаём.");
      }
    };

    tryAttach();

    if (authDb) return;

    authProfileWaitTimer = setInterval(tryAttach, 250);
  }

  function cleanNickname(value) {
    return String(value || "")
      .trim()
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 32);
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function showMessage(text, isError = false) {
    const box = getEl("klevbyAuthMessage");
    if (!box) return;

    box.textContent = text || "";
    box.classList.toggle("error", Boolean(isError));
    box.classList.toggle("success", Boolean(text && !isError));
  }

  function setLoading(isLoading) {
    const btn = getEl("klevbyAuthSubmit");
    if (!btn) return;

    btn.disabled = Boolean(isLoading);
    btn.textContent = isLoading
      ? "Подожди..."
      : currentMode === "register"
        ? "Создать профиль"
        : "Войти";
  }

  function setMode(mode) {
    currentMode = mode === "login" ? "login" : "register";

    const registerTab = getEl("klevbyRegisterTab");
    const loginTab = getEl("klevbyLoginTab");
    const nicknameRow = getEl("klevbyNicknameRow");
    const title = getEl("klevbyAuthTitle");
    const subtitle = getEl("klevbyAuthSubtitle");
    const submit = getEl("klevbyAuthSubmit");
    const switchText = getEl("klevbyAuthSwitchText");
    const switchBtn = getEl("klevbyAuthSwitchBtn");
    const passwordInput = getEl("passwordInput");

    if (registerTab) registerTab.classList.toggle("active", currentMode === "register");
    if (loginTab) loginTab.classList.toggle("active", currentMode === "login");

    if (nicknameRow) {
      nicknameRow.classList.toggle("hidden", currentMode === "login");
    }

    if (title) {
      title.textContent = currentMode === "register"
        ? "Создать профиль рыбака"
        : "Войти в профиль";
    }

    if (subtitle) {
      subtitle.textContent = currentMode === "register"
        ? "Никнейм, email и пароль. Почта нужна для подтверждения и восстановления доступа."
        : "Войди по email и паролю, чтобы писать, создавать объявления и пользоваться личкой.";
    }

    if (submit) {
      submit.textContent = currentMode === "register" ? "Создать профиль" : "Войти";
    }

    if (switchText) {
      switchText.textContent = currentMode === "register"
        ? "Уже есть аккаунт?"
        : "Ещё нет аккаунта?";
    }

    if (switchBtn) {
      switchBtn.textContent = currentMode === "register" ? "Войти" : "Создать профиль";
    }

    if (passwordInput) {
      passwordInput.setAttribute(
        "autocomplete",
        currentMode === "register" ? "new-password" : "current-password"
      );
    }

    showMessage("");
  }

  function buildAuthUI() {
    const authSection = getEl("authSection");
    if (!authSection) return false;

    authSection.innerHTML = `
      <div class="klevby-auth-profile-card">
        <div class="klevby-auth-top">
          <div class="klevby-auth-icon">🎣</div>
          <div>
            <h2 id="klevbyAuthTitle">Создать профиль рыбака</h2>
            <p id="klevbyAuthSubtitle">
              Никнейм, email и пароль. Почта нужна для подтверждения и восстановления доступа.
            </p>
          </div>
        </div>

        <div class="klevby-auth-tabs">
          <button id="klevbyRegisterTab" class="active" type="button">Регистрация</button>
          <button id="klevbyLoginTab" type="button">Вход</button>
        </div>

        <div id="klevbyNicknameRow" class="klevby-auth-field">
          <label for="usernameInput">Nickname</label>
          <input id="usernameInput" type="text" placeholder="Например: alex822alex" autocomplete="nickname" maxlength="32" />
        </div>

        <div class="klevby-auth-field">
          <label for="emailInput">Email</label>
          <input id="emailInput" type="email" placeholder="example@gmail.com" autocomplete="email" />
        </div>

        <div class="klevby-auth-field">
          <label for="passwordInput">Пароль</label>
          <input id="passwordInput" type="password" placeholder="Минимум 6 символов" autocomplete="new-password" />
        </div>

        <button id="klevbyAuthSubmit" class="klevby-auth-main-btn" type="button">
          Создать профиль
        </button>

        <div class="klevby-auth-switch">
          <span id="klevbyAuthSwitchText">Уже есть аккаунт?</span>
          <button id="klevbyAuthSwitchBtn" type="button">Войти</button>
        </div>

        <div class="klevby-auth-extra-actions">
          <button id="klevbyRecoverBtn" type="button">Сбросить пароль</button>
          <button id="klevbyLogoutBtn" type="button">Выйти</button>
        </div>

        <div id="klevbyAuthMessage" class="klevby-auth-message"></div>
        <div id="authStatus" class="klevby-auth-status">Проверяем вход...</div>
      </div>
    `;

    return true;
  }

  function injectStyles() {
    const old = document.getElementById("klevby-auth-profile-styles");
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = "klevby-auth-profile-styles";

    style.textContent = `
      .klevby-auth-profile-card {
        width: min(100%, 620px);
        margin: 18px auto 46px;
        padding: 26px;
        border-radius: 28px;
        background:
          radial-gradient(circle at 0% 0%, rgba(87,230,178,0.14), transparent 34%),
          rgba(13, 28, 31, 0.86);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 22px 70px rgba(0,0,0,0.38);
        color: #f4fbf7;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .klevby-auth-top {
        display: grid;
        grid-template-columns: 58px 1fr;
        gap: 14px;
        align-items: center;
        margin-bottom: 18px;
      }

      .klevby-auth-icon {
        width: 58px;
        height: 58px;
        border-radius: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(87,230,178,0.14);
        font-size: 28px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .klevby-auth-top h2 {
        margin: 0;
        font-size: clamp(30px, 6vw, 46px);
        line-height: 1.05;
        letter-spacing: -1px;
        font-weight: 900 !important;
        color: #ffffff;
      }

      .klevby-auth-top p {
        margin: 8px 0 0;
        color: rgba(244,251,247,0.62);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.5;
      }

      .klevby-auth-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 18px 0 16px;
      }

      .klevby-auth-tabs button {
        min-height: 48px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        background: rgba(255,255,255,0.06);
        color: rgba(244,251,247,0.68);
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .klevby-auth-tabs button.active {
        background: rgba(87,230,178,0.16);
        border-color: rgba(87,230,178,0.28);
        color: #c8ffe0;
        box-shadow: 0 0 24px rgba(87,230,178,0.14);
      }

      .klevby-auth-field {
        margin: 13px 0;
      }

      .klevby-auth-field label {
        display: block;
        margin: 0 0 7px;
        color: rgba(244,251,247,0.74);
        font-size: 13px;
        font-weight: 900;
      }

      .klevby-auth-field input {
        width: 100%;
        height: 58px;
        margin: 0;
        padding: 0 17px;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.09);
        background: rgba(255,255,255,0.075);
        color: #ffffff;
        font-size: 17px;
        font-weight: 600;
        outline: none;
      }

      .klevby-auth-field input:focus {
        border-color: rgba(87,230,178,0.42);
        box-shadow: 0 0 0 4px rgba(87,230,178,0.10);
      }

      .klevby-auth-main-btn {
        width: 100%;
        min-height: 58px;
        margin-top: 14px;
        border: 0;
        border-radius: 20px;
        background: linear-gradient(135deg, #57e6b2, #28c990);
        color: #03150c;
        font-size: 17px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 14px 38px rgba(87,230,178,0.22);
      }

      .klevby-auth-main-btn:disabled {
        opacity: 0.62;
        cursor: not-allowed;
      }

      .klevby-auth-switch {
        margin-top: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: rgba(244,251,247,0.58);
        font-size: 14px;
        font-weight: 700;
      }

      .klevby-auth-switch button,
      .klevby-auth-extra-actions button {
        border: 0;
        background: transparent;
        color: #9ff3cc;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .klevby-auth-extra-actions {
        margin-top: 14px;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .klevby-auth-extra-actions button {
        min-height: 38px;
        padding: 0 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        color: rgba(244,251,247,0.72);
      }

      .klevby-auth-message,
      .klevby-auth-status {
        margin-top: 14px;
        color: rgba(244,251,247,0.62);
        font-size: 14px;
        line-height: 1.5;
        font-weight: 600;
        text-align: center;
      }

      .klevby-auth-message.error {
        color: #ffd2d2;
      }

      .klevby-auth-message.success {
        color: #c8ffe0;
      }

      .klevby-auth-status {
        text-align: left;
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.045);
      }

      .hidden {
        display: none !important;
      }

      @media (max-width: 520px) {
        .klevby-auth-profile-card {
          padding: 20px;
          border-radius: 26px;
          margin-top: 12px;
        }

        .klevby-auth-top {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .klevby-auth-icon {
          width: 54px;
          height: 54px;
        }

        .klevby-auth-field input {
          height: 56px;
          font-size: 16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function refreshUser() {
    if (!authDb) return null;

    try {
      const { data: sessionData } = await authDb.auth.getSession();
      currentUser = sessionData?.session?.user || null;

      if (!currentUser) {
        const { data: userData } = await authDb.auth.getUser();
        currentUser = userData?.user || null;
      }

      updateStatus();
      return currentUser;
    } catch (error) {
      currentUser = null;
      updateStatus();
      return null;
    }
  }

  function updateStatus() {
    const status = getEl("authStatus");
    if (!status) return;

    if (!currentUser) {
      status.textContent = "Ты не вошёл. Создай профиль или войди в аккаунт.";
      return;
    }

    const meta = currentUser.user_metadata || {};
    const nickname = cleanNickname(
      meta.nickname ||
      meta.username ||
      meta.display_name ||
      localStorage.getItem("klevby_author_name") ||
      ""
    );

    status.textContent =
      "Ты вошёл: " +
      currentUser.email +
      (nickname ? " | Nickname: " + nickname : "") +
      (isCurrentUserAdmin() ? " | Админ включён" : "");
  }

  function isCurrentUserAdmin() {
    return Boolean(
      currentUser &&
      ADMIN_EMAIL &&
      String(currentUser.email || "").toLowerCase() === String(ADMIN_EMAIL).toLowerCase()
    );
  }

  function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent("klevby-auth-changed", {
      detail: {
        user: currentUser,
        isAdmin: isCurrentUserAdmin()
      }
    }));
  }

  async function restoreMainAuthState(reason = "auth_profile") {
    if (typeof window.restoreAuthState === "function") {
      try {
        await window.restoreAuthState(reason, true);
      } catch (error) {
        console.warn("Klevby auth profile: основной auth state не восстановился.", error);
      }
    }
  }

  async function saveProfile(user, nickname) {
    if (!user || !user.id || !nickname) return;

    localStorage.setItem("klevby_author_name", nickname);
    localStorage.setItem("klevby_chat_username", nickname);

    try {
      await authDb.from("profiles").upsert(
        [
          {
            id: user.id,
            nickname: nickname,
            username: nickname,
            display_name: nickname,
            email: user.email || "",
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: "id" }
      );
    } catch (error) {
      console.warn("Klevby auth profile: профиль не сохранён в profiles.", error);
    }
  }

  async function registerProfile() {
    const nickname = cleanNickname(getEl("usernameInput")?.value);
    const email = String(getEl("emailInput")?.value || "").trim();
    const password = String(getEl("passwordInput")?.value || "").trim();

    if (!authDb) {
      showMessage("Supabase ещё не готов. Обнови страницу.", true);
      return;
    }

    if (!nickname || nickname.length < 2) {
      showMessage("Введи Nickname минимум 2 символа.", true);
      return;
    }

    if (!email || !password) {
      showMessage("Введи email и пароль.", true);
      return;
    }

    if (password.length < 6) {
      showMessage("Пароль должен быть минимум 6 символов.", true);
      return;
    }

    setLoading(true);

    const { data, error } = await authDb.auth.signUp({
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

    setLoading(false);

    if (error) {
      showMessage("Не удалось создать профиль: " + error.message, true);
      return;
    }

    currentUser = data?.user || null;

    if (currentUser) {
      await saveProfile(currentUser, nickname);

      try {
        const updateResult = await authDb.auth.updateUser({
          data: {
            nickname,
            username: nickname,
            display_name: nickname
          }
        });

        currentUser = updateResult.data?.user || currentUser;
      } catch (error) {
        console.warn("Klevby auth profile: metadata не обновились.", error);
      }
    }

    updateStatus();
    notifyAuthChanged();
    await restoreMainAuthState("auth_profile_register");

    showMessage("Профиль создан. Если Supabase попросит подтверждение — открой письмо на email.", false);
  }

  async function loginProfile() {
    const email = String(getEl("emailInput")?.value || "").trim();
    const password = String(getEl("passwordInput")?.value || "").trim();

    if (!authDb) {
      showMessage("Supabase ещё не готов. Обнови страницу.", true);
      return;
    }

    if (!email || !password) {
      showMessage("Введи email и пароль.", true);
      return;
    }

    setLoading(true);

    const { data, error } = await authDb.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (error) {
      showMessage("Не получилось войти. Проверь email и пароль.", true);
      return;
    }

    currentUser = data?.user || null;

    const nicknameFromInput = cleanNickname(getEl("usernameInput")?.value);
    const nicknameFromMeta = cleanNickname(
      currentUser?.user_metadata?.nickname ||
      currentUser?.user_metadata?.username ||
      currentUser?.user_metadata?.display_name ||
      ""
    );

    if (currentUser && (nicknameFromInput || nicknameFromMeta)) {
      await saveProfile(currentUser, nicknameFromInput || nicknameFromMeta);
    }

    updateStatus();
    notifyAuthChanged();
    await restoreMainAuthState("auth_profile_login");

    showMessage("Вход выполнен.", false);
  }

  async function sendRecoveryProfile() {
    const email = String(getEl("emailInput")?.value || "").trim();

    if (!authDb) {
      showMessage("Supabase ещё не готов. Обнови страницу.", true);
      return;
    }

    if (!email) {
      showMessage("Введи email для сброса пароля.", true);
      return;
    }

    setLoading(true);

    const { error } = await authDb.auth.resetPasswordForEmail(email, {
      redirectTo: "https://klevby.com"
    });

    setLoading(false);

    if (error) {
      showMessage("Не получилось отправить письмо: " + error.message, true);
      return;
    }

    showMessage("Письмо для сброса пароля отправлено.", false);
  }

  async function logoutProfile() {
    if (!authDb) {
      showMessage("Supabase ещё не готов. Обнови страницу.", true);
      return;
    }

    setLoading(true);
    await authDb.auth.signOut();
    setLoading(false);

    currentUser = null;
    updateStatus();
    notifyAuthChanged();
    await restoreMainAuthState("auth_profile_logout");

    showMessage("Ты вышел из аккаунта.", false);
  }

  function bindEvents() {
    const registerTab = getEl("klevbyRegisterTab");
    const loginTab = getEl("klevbyLoginTab");
    const submit = getEl("klevbyAuthSubmit");
    const switchBtn = getEl("klevbyAuthSwitchBtn");
    const recoverBtn = getEl("klevbyRecoverBtn");
    const logoutBtn = getEl("klevbyLogoutBtn");

    if (registerTab) {
      registerTab.addEventListener("click", () => setMode("register"));
    }

    if (loginTab) {
      loginTab.addEventListener("click", () => setMode("login"));
    }

    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        setMode(currentMode === "register" ? "login" : "register");
      });
    }

    if (submit) {
      submit.addEventListener("click", async () => {
        showMessage("");

        if (currentMode === "register") {
          await registerProfile();
        } else {
          await loginProfile();
        }
      });
    }

    if (recoverBtn) {
      recoverBtn.addEventListener("click", sendRecoveryProfile);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", logoutProfile);
    }

    ["usernameInput", "emailInput", "passwordInput"].forEach((id) => {
      const input = getEl(id);

      if (!input) return;

      input.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") return;

        event.preventDefault();
        showMessage("");

        if (currentMode === "register") {
          await registerProfile();
        } else {
          await loginProfile();
        }
      });
    });
  }

  function bindAuthStateListener() {
    if (!authDb || !authDb.auth || typeof authDb.auth.onAuthStateChange !== "function") return;
    if (authProfileStateSubscription) return;

    const result = authDb.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      updateStatus();
    });

    authProfileStateSubscription = result?.data?.subscription || result?.subscription || true;
  }

  function init() {
    if (authProfileInitialized) {
      refreshUser();
      return;
    }

    if (!authDb) {
      console.warn("Klevby auth profile: Supabase client отсутствует.");
      return;
    }

    const ok = buildAuthUI();

    if (!ok) {
      console.warn("Klevby auth profile: authSection не найден.");
      return;
    }

    authProfileInitialized = true;

    injectStyles();
    bindEvents();
    setMode("register");
    refreshUser();
    bindAuthStateListener();
  }

  window.klevbyInitAuthProfile = function () {
    waitForSupabase(init);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      waitForSupabase(init);
    });
  } else {
    waitForSupabase(init);
  }
})();
