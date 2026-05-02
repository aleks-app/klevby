(function () {
  const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  window.klevbySupabase = supabaseClient;

  // ===== СОЗДАНИЕ UI =====

  const authHTML = `
  <div id="authModal" class="auth-modal hidden">
    <div class="auth-box">

      <div class="auth-tabs">
        <button id="loginTab" class="active">Вход</button>
        <button id="registerTab">Регистрация</button>
      </div>

      <input id="authNickname" placeholder="Ник (как в Telegram)" />
      <input id="authEmail" placeholder="Email" />
      <input id="authPassword" type="password" placeholder="Пароль" />

      <button id="authSubmit">Продолжить</button>

      <div id="authError" class="auth-error"></div>

    </div>
  </div>
  `;

  document.body.insertAdjacentHTML("beforeend", authHTML);

  const modal = document.getElementById("authModal");
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");

  const nicknameInput = document.getElementById("authNickname");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const submitBtn = document.getElementById("authSubmit");
  const errorBox = document.getElementById("authError");

  let mode = "login";

  loginTab.onclick = () => {
    mode = "login";
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    nicknameInput.style.display = "none";
  };

  registerTab.onclick = () => {
    mode = "register";
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    nicknameInput.style.display = "block";
  };

  nicknameInput.style.display = "none";

  // ===== ОТКРЫТИЕ =====

  window.openAuth = function () {
    modal.classList.remove("hidden");
  };

  window.closeAuth = function () {
    modal.classList.add("hidden");
  };

  // ===== РЕГИСТРАЦИЯ =====

  async function register() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const nickname = nicknameInput.value.trim();

    if (!email || !password || !nickname) {
      errorBox.textContent = "Заполни все поля";
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    const user = data.user;

    if (user) {
      await supabaseClient.from("profiles").upsert([
        {
          id: user.id,
          nickname: nickname
        }
      ]);
    }

    location.reload();
  }

  // ===== ВХОД =====

  async function login() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      errorBox.textContent = "Введи email и пароль";
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorBox.textContent = "Неверный логин или пароль";
      return;
    }

    location.reload();
  }

  submitBtn.onclick = () => {
    errorBox.textContent = "";

    if (mode === "login") {
      login();
    } else {
      register();
    }
  };

  // ===== ПРОВЕРКА АВТОРИЗАЦИИ =====

  async function checkUser() {
    const { data } = await supabaseClient.auth.getUser();

    if (!data.user) {
      return;
    }

    window.klevbyCurrentUser = data.user;
  }

  checkUser();
})();
