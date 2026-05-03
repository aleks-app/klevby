
    const SUPABASE_URL = "https://oecdshvozssadztcokog.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_lyYIaXcnAG21RaNJuVYRgA_yuRjselS";
    const SUPABASE_STORAGE_KEY = "sb-oecdshvozssadztcokog-auth-token";
    const TELEGRAM_GROUP = "https://t.me/+W6eAuefzcJwwODEy";
    const ADMIN_EMAIL = "al822alex@gmail.com";
    const WEATHER_API_KEY = "2b08e3fec07f3dd6a25cf6862ab4b030";

    window.klevbyAdminEmail = ADMIN_EMAIL;
    window.KLEVB_ADMIN_EMAIL = ADMIN_EMAIL;
    window.ADMIN_EMAIL = ADMIN_EMAIL;

    const CARD_IMAGES = [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80"
    ];

    let supabaseClient = null;
    let posts = [];
    let currentUser = null;
    let viewMode = "all";
    let editingId = null;
    let deferredInstallPrompt = null;
    let installBannerShown = false;
    let activeModalPost = null;
    let postModalCloseTimer = null;
    let authMode = "register";
    let authRestoreTimer = null;
    let authRestoreInProgress = false;
    let lastAuthRestoreAt = 0;
    let authReady = false;

    const splashStartedAt = Date.now();

    function hideAppSplash() {
      const splash = document.getElementById("appSplash");
      if (!splash) return;

      const minVisibleTime = 2500;
      const elapsed = Date.now() - splashStartedAt;
      const delay = Math.max(0, minVisibleTime - elapsed);

      setTimeout(() => {
        splash.classList.add("hide");
        setTimeout(() => {
          splash.remove();
        }, 800);
      }, delay);
    }

    window.addEventListener("load", hideAppSplash);
    setTimeout(hideAppSplash, 5200);

    function isAdmin() {
      return Boolean(currentUser && currentUser.email === ADMIN_EMAIL);
    }

    function syncGlobalAuthState() {
      window.klevbySupabase = supabaseClient;
      window.supabaseClient = supabaseClient;

      window.klevbyCurrentUser = currentUser;
      window.currentUser = currentUser;
      window.klevbyUser = currentUser;

      window.klevbyAdminEmail = ADMIN_EMAIL;
      window.KLEVB_ADMIN_EMAIL = ADMIN_EMAIL;
      window.ADMIN_EMAIL = ADMIN_EMAIL;

      window.klevbyIsCurrentUserAdmin = isAdmin();
      window.isKlevbyAdmin = isAdmin();

      window.dispatchEvent(new CustomEvent("klevby-auth-changed", {
        detail: {
          user: currentUser,
          isAdmin: isAdmin(),
          adminEmail: ADMIN_EMAIL,
          supabase: supabaseClient
        }
      }));
    }

    function reloadPondsIfReady() {
      syncGlobalAuthState();

      if (typeof window.klevbyLoadPonds === "function") {
        window.klevbyLoadPonds();
      }

      if (typeof window.klevbyInitPonds === "function") {
        window.klevbyInitPonds();
      }

      if (typeof window.loadPonds === "function") {
        window.loadPonds();
      }
    }

    function initSupabase() {
      if (!window.supabase) {
        showStatus("Supabase не загрузился. Обнови страницу.", true);
        return false;
      }

      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: SUPABASE_STORAGE_KEY,
          flowType: "pkce"
        },
        global: {
          fetch: (...args) => fetch(...args)
        }
      });

      window.klevbySupabase = supabaseClient;
      window.supabaseClient = supabaseClient;

      window.klevbyGetSupabase = function () {
        return supabaseClient;
      };

      window.klevbyGetCurrentUser = function () {
        return currentUser;
      };

      window.klevbyIsAdmin = function () {
        return isAdmin();
      };

      if (supabaseClient.auth && typeof supabaseClient.auth.onAuthStateChange === "function") {
        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
          currentUser = session?.user || currentUser || null;
          authReady = true;

          if (!session?.user && _event === "SIGNED_OUT") {
            currentUser = null;
          }

          syncGlobalAuthState();
          updateAuthStatus();
          fillAuthorLocal();
          renderPosts();
          reloadPondsIfReady();
        });
      }

      syncGlobalAuthState();
      return true;
    }

    function toggleMobileMenu() {
      const menu = document.getElementById("mobileMenu");
      const btn = document.getElementById("burgerBtn");
      if (!menu || !btn) return;

      const isOpen = menu.classList.toggle("open");
      btn.classList.toggle("open", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
    }

    function closeMobileMenu() {
      const menu = document.getElementById("mobileMenu");
      const btn = document.getElementById("burgerBtn");
      if (!menu || !btn) return;

      menu.classList.remove("open");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }

    function getOwnerId() {
      return currentUser ? currentUser.id : null;
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

    function showStatus(message, isError = false) {
      const status = document.getElementById("statusLine");
      if (!status) return;
      status.textContent = message;
      status.classList.toggle("error-line", isError);
    }

    function showFormMessage(message, isError = false) {
      const el = document.getElementById("formMessage");
      if (!el) return;
      el.textContent = message;
      el.style.color = isError ? "#ffd2d2" : "rgba(245,245,245,0.66)";
    }

    function openTelegram() {
      window.open(TELEGRAM_GROUP, "_blank");
    }

    function updateHomeFloatButton() {
      const btn = document.getElementById("homeFloatBtn");
      const homeSection = document.getElementById("homeSection");

      if (!btn || !homeSection) return;

      const isNotHome = homeSection.classList.contains("hidden");
      const isScrolledDown = window.scrollY > 300;

      btn.classList.toggle("show", isNotHome || isScrolledDown);
    }

    function goHomeTop() {
      setMobileTabActive(0);
      showSection("home");

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        updateHomeFloatButton();
      }, 80);
    }

    window.addEventListener("scroll", updateHomeFloatButton, { passive: true });
    window.addEventListener("resize", updateHomeFloatButton);

    function showSection(section) {
      document.getElementById("homeSection").classList.toggle("hidden", section !== "home");
      document.getElementById("marketSection").classList.toggle("hidden", section !== "market");
      document.getElementById("pondsSection").classList.toggle("hidden", section !== "ponds");
      document.getElementById("mapSection").classList.toggle("hidden", section !== "map");
      document.getElementById("authSection").classList.toggle("hidden", section !== "auth");

      syncGlobalAuthState();

      if (section === "auth") {
        setAuthMode(currentUser ? "login" : authMode);
        scheduleAuthRestore("open_auth", false);
      }

      if (section === "market" && typeof window.klevbyLoadMarket === "function") {
        window.klevbyLoadMarket();
      }

      if (section === "ponds") {
        reloadPondsIfReady();
      }

      if (section === "map" && typeof window.klevbyReloadMap === "function") {
        setTimeout(() => window.klevbyReloadMap(), 300);
      }

      setTimeout(updateHomeFloatButton, 80);

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function scrollToPosts() {
      document.getElementById("postsSection").scrollIntoView({ behavior: "smooth" });
    }

    function mobileScrollTo(id) {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        setTimeout(updateHomeFloatButton, 120);
      }, 80);
    }

    function setMobileTabActive(index) {
      const buttons = document.querySelectorAll(".mobile-tab-btn");
      buttons.forEach((button, i) => {
        button.classList.toggle("active", i === index);
      });
    }

    function goMobileFeed() {
      setMobileTabActive(0);
      showSection("home");
      mobileScrollTo("postsSection");
    }

    function goMobileCreate() {
      setMobileTabActive(2);
      showSection("home");
      mobileScrollTo("createPanel");
    }

    function goMobileMap() {
      setMobileTabActive(1);
      showSection("map");
    }

    function goMobileWeather() {
      setMobileTabActive(3);
      showSection("home");
      mobileScrollTo("forecastPanel");
    }

    function goMobileProfile() {
      setMobileTabActive(4);
      showSection("auth");
    }

    function setMode(mode) {
      viewMode = mode;
      showSection("home");
      renderPosts();
    }

    function resetFilters() {
      const searchInput = document.getElementById("searchInput");
      const citySelect = document.getElementById("citySelect");
      const typeSelect = document.getElementById("typeSelect");
      const telegramOnly = document.getElementById("telegramOnly");

      if (searchInput) searchInput.value = "";
      if (citySelect) citySelect.value = "";
      if (typeSelect) typeSelect.value = "";
      if (telegramOnly) telegramOnly.checked = false;

      renderPosts();
    }

    function cleanTelegram(value) {
      let v = String(value || "").trim();

      v = v.replace(/^@/, "");
      v = v.replace(/^https?:\/\/t\.me\//i, "");
      v = v.replace(/^https?:\/\/telegram\.me\//i, "");
      v = v.replace(/^t\.me\//i, "");
      v = v.split("?")[0];
      v = v.split("/")[0];
      v = v.replace(/[^a-zA-Z0-9_]/g, "");

      return v;
    }

    function normalizeText(value) {
      return String(value || "").toLowerCase().trim();
    }

    function escapeHtml(text) {
      return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function getFishingTypeClass(type) {
      const t = normalizeText(type);

      if (t.includes("спин")) return "type-spinning";
      if (t.includes("фидер")) return "type-feeder";
      if (t.includes("поплав")) return "type-float";
      if (t.includes("карп")) return "type-carp";
      if (t.includes("зим")) return "type-winter";

      return "";
    }

    function getBiteForecastByPressure(pressureMm) {
      const pressure = Number(pressureMm);

      if (!Number.isFinite(pressure)) {
        return {
          text: "Прогноз средний, нужно пробовать.",
          lineClass: "bite-medium-line"
        };
      }

      if (pressure >= 755 && pressure <= 765) {
        return {
          text: "Прогноз отличный! 🎣",
          lineClass: "bite-good-line"
        };
      }

      return {
        text: "Прогноз средний, нужно пробовать.",
        lineClass: "bite-medium-line"
      };
    }

    function updateBiteForecast(pressureMm) {
      const el = document.getElementById("biteForecast");
      if (!el) return;

      const result = getBiteForecastByPressure(pressureMm);

      el.className = `bite-line ${result.lineClass}`;
      el.textContent = result.text;
    }

    function getCardImage(post) {
      const key = String(post.id || post.created_at || post.name || Math.random());
      let sum = 0;

      for (let i = 0; i < key.length; i++) {
        sum += key.charCodeAt(i);
      }

      return CARD_IMAGES[sum % CARD_IMAGES.length];
    }

    function saveAuthorLocal(name, telegram) {
      localStorage.setItem("klevby_author_name", name || "");
      localStorage.setItem("klevby_author_telegram", telegram || "");
    }

    function fillAuthorLocal() {
      const savedName = localStorage.getItem("klevby_author_name") || "";
      const savedTelegram = localStorage.getItem("klevby_author_telegram") || "";
      const profileName = getUserDisplayName();

      if ((savedName || profileName) && !document.getElementById("nameInput").value) {
        document.getElementById("nameInput").value = savedName || profileName;
      }

      if (savedTelegram && !document.getElementById("telegramInput").value) {
        document.getElementById("telegramInput").value = savedTelegram;
      }

      const usernameInput = document.getElementById("usernameInput");
      if (usernameInput && profileName && !usernameInput.value && authMode === "register") {
        usernameInput.value = profileName;
      }
    }

    function getMoonPhaseName() {
      const now = new Date();
      const knownNewMoon = new Date("2000-01-06T18:14:00Z");
      const lunarCycle = 29.53058867;
      const days = (now - knownNewMoon) / 86400000;
      const phase = ((days % lunarCycle) + lunarCycle) % lunarCycle;

      if (phase < 1.85) return "Новолуние";
      if (phase < 5.54) return "Растущий серп";
      if (phase < 9.23) return "Первая четверть";
      if (phase < 12.92) return "Растущая луна";
      if (phase < 16.61) return "Полнолуние";
      if (phase < 20.30) return "Убывающая луна";
      if (phase < 23.99) return "Последняя четверть";
      if (phase < 27.68) return "Убывающий серп";
      return "Новолуние";
    }

    function windDirection(deg) {
      if (deg === undefined || deg === null) return "";
      const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
      return dirs[Math.round(deg / 45) % 8];
    }

    function setWeatherAnimation(main, description) {
      const panel = document.getElementById("forecastPanel");
      const mobileCondition = document.getElementById("mobileWeatherCondition");
      if (!panel) return;

      const text = `${main || ""} ${description || ""}`.toLowerCase();

      panel.classList.remove("weather-sunny", "weather-cloudy", "weather-rainy");

      if (text.includes("rain") || text.includes("drizzle") || text.includes("дожд")) {
        panel.classList.add("weather-rainy");
        if (mobileCondition) mobileCondition.textContent = "🌧️ Дождь";
      } else if (
        text.includes("cloud") ||
        text.includes("облач") ||
        text.includes("пасмур") ||
        text.includes("туман") ||
        text.includes("mist") ||
        text.includes("fog")
      ) {
        panel.classList.add("weather-cloudy");
        if (mobileCondition) mobileCondition.textContent = "☁️ Облачно";
      } else {
        panel.classList.add("weather-sunny");
        if (mobileCondition) mobileCondition.textContent = "☀️ Солнце";
      }
    }

    async function fetchWeather() {
      const status = document.getElementById("weatherStatus");
      const tempEl = document.getElementById("weatherTemp");
      const windEl = document.getElementById("weatherWind");
      const pressureEl = document.getElementById("weatherPressure");
      const moonEl = document.getElementById("weatherMoon");

      try {
        status.textContent = "Обновляем погоду для Минска...";
        moonEl.textContent = getMoonPhaseName();

        const url = `https://api.openweathermap.org/data/2.5/weather?q=Minsk,BY&appid=${WEATHER_API_KEY}&units=metric&lang=ru`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("weather_error");
        }

        const data = await response.json();

        const temp = Math.round(data.main.temp);
        const wind = data.wind?.speed ?? 0;
        const windDeg = data.wind?.deg;
        const pressureHpa = data.main.pressure;
        const pressureMm = Math.round(pressureHpa * 0.75006);
        const description = data.weather?.[0]?.description || "погода обновлена";
        const main = data.weather?.[0]?.main || "";

        tempEl.textContent = `${temp > 0 ? "+" : ""}${temp}°C`;
        windEl.textContent = `${Math.round(wind)} м/с ${windDirection(windDeg)}`;
        pressureEl.textContent = `${pressureMm} мм`;
        moonEl.textContent = getMoonPhaseName();
        status.textContent = `Минск: ${description}. Данные обновляются автоматически.`;

        updateBiteForecast(pressureMm);
        setWeatherAnimation(main, description);
      } catch (error) {
        console.error(error);
        status.textContent = "Погоду не удалось загрузить. Показываем ориентировочные значения.";
        tempEl.textContent = "+14°C";
        windEl.textContent = "3 м/с СЗ";
        pressureEl.textContent = "752 мм";
        moonEl.textContent = getMoonPhaseName();
        updateBiteForecast(752);
        setWeatherAnimation("Clouds", "облачно");
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
        subtitle.textContent = "Войди через email и пароль. Никнейм подтянется из профиля.";
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
        title.textContent = "Создать профиль рыбака";
        subtitle.textContent = "Никнейм будет виден в объявлениях и чате. Почта нужна для входа и подтверждения аккаунта.";
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
        document.getElementById("resetModal").classList.remove("hidden");
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
        const nickname = getUserNickname();
        status.textContent =
          "Ты вошёл: " +
          currentUser.email +
          (nickname ? " | Nickname: " + nickname : "") +
          (isAdmin() ? " | Админ включён" : "");
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

      currentUser = data?.user || null;
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

      updateAuthStatus();
      alert("Профиль создан. Если придёт письмо — подтверди почту, потом войди в аккаунт.");
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
        return alert("Не получилось войти. Проверь email и пароль.");
      }

      currentUser = data.user;
      authReady = true;
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
      document.getElementById("resetModal").classList.add("hidden");
    }

    async function loadPosts() {
      showStatus("Загрузка объявлений...");
      document.getElementById("postsSection").innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      `;

      const { data, error } = await supabaseClient
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        showStatus("Не удалось загрузить объявления. Проверь таблицу posts и RLS.", true);
        document.getElementById("postsSection").innerHTML = "";
        return;
      }

      posts = data || [];
      renderPosts();
    }

    function renderPosts() {
      const list = document.getElementById("postsSection");
      const search = normalizeText(document.getElementById("searchInput")?.value);
      const selectedCity = normalizeText(document.getElementById("citySelect")?.value);
      const selectedType = normalizeText(document.getElementById("typeSelect")?.value);
      const telegramOnly = document.getElementById("telegramOnly")?.checked;
      const ownerId = getOwnerId();

      let filtered = [...posts];

      if (viewMode === "mine") {
        filtered = filtered.filter(post => ownerId && post.owner_id === ownerId);
        showStatus("Сейчас показаны: мои объявления.");
      } else {
        showStatus("Сейчас показаны: все объявления.");
      }

      if (search) {
        filtered = filtered.filter(post =>
          normalizeText(post.name).includes(search) ||
          normalizeText(post.city).includes(search) ||
          normalizeText(post.destination).includes(search) ||
          normalizeText(post.trip_time).includes(search) ||
          normalizeText(post.transport).includes(search) ||
          normalizeText(post.seats).includes(search) ||
          normalizeText(post.text).includes(search) ||
          normalizeText(post.fishing_type).includes(search)
        );
      }

      if (selectedCity) {
        filtered = filtered.filter(post => normalizeText(post.city).includes(selectedCity));
      }

      if (selectedType) {
        filtered = filtered.filter(post => normalizeText(post.fishing_type).includes(selectedType));
      }

      if (telegramOnly) {
        filtered = filtered.filter(post => cleanTelegram(post.telegram));
      }

      if (!filtered.length) {
        list.innerHTML = '<div class="info-line">Пока объявлений нет.</div>';
        return;
      }

      list.innerHTML = filtered.map(cardHtml).join("");
      setTimeout(updateHomeFloatButton, 80);
    }

    function cardHtml(post) {
      const tg = cleanTelegram(post.telegram);
      const ownerId = getOwnerId();
      const canManage = isAdmin() || (ownerId && post.owner_id === ownerId);
      const isFull = Boolean(post.crew_full);
      const image = getCardImage(post);
      const fishingType = post.fishing_type || "";
      const fishingTypeClass = getFishingTypeClass(fishingType);

      const name = post.name || "Рыбак";
      const city = post.city || "";
      const destination = post.destination || "";
      const tripTime = post.trip_time || "";
      const transport = post.transport || "";
      const seats = post.seats || "";
      const titleDestination = destination || city || "рыбалку";

      const tgButton = isFull
        ? `<button class="small-btn disabled" disabled onclick="event.stopPropagation()">Экипаж набран</button>`
        : tg
          ? `<button class="small-btn green" onclick="event.stopPropagation(); window.open('https://t.me/${escapeHtml(tg)}','_blank')">Написать автору</button>`
          : `<button class="small-btn green" onclick="event.stopPropagation(); openTelegram()">Написать в общий чат</button>`;

      const fullBtn = canManage
        ? `<button class="small-btn ${isFull ? "gray" : "blue"}" onclick="event.stopPropagation(); toggleCrewFull('${post.id}', ${isFull ? "false" : "true"})">${isFull ? "Снова ищу" : "Экипаж набран"}</button>`
        : "";

      const editBtn = canManage
        ? `<button class="small-btn yellow" onclick="event.stopPropagation(); editPost('${post.id}')">Редактировать</button>`
        : "";

      const deleteBtn = canManage
        ? `<button class="small-btn red" onclick="event.stopPropagation(); deletePost('${post.id}')">Удалить</button>`
        : "";

      const date = post.created_at
        ? new Date(post.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : "";

      return `
        <div class="card ${isFull ? "full" : ""}" onclick="openPostModal('${post.id}')">
          <div class="card-img" style="background-image: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.35)), url('${image}')"></div>

          <div class="card-body">
            <div class="trip-title">
              <span class="trip-name">${escapeHtml(name)}</span>
              <span> едет на </span>
              <span class="trip-destination">${escapeHtml(titleDestination)}</span>
            </div>

            <div class="trip-facts">
              <div class="trip-fact">
                <div class="trip-fact-label">Когда</div>
                <div class="trip-fact-value">${escapeHtml(tripTime || date || "Не указано")}</div>
              </div>

              <div class="trip-fact">
                <div class="trip-fact-label">Тип</div>
                <div class="trip-fact-value">${escapeHtml(fishingType || "Не указано")}</div>
              </div>

              <div class="trip-fact">
                <div class="trip-fact-label">Транспорт</div>
                <div class="trip-fact-value">${escapeHtml(transport || "Не указано")}</div>
              </div>

              <div class="trip-fact">
                <div class="trip-fact-label">Места</div>
                <div class="trip-fact-value">${escapeHtml(seats || (isFull ? "Экипаж набран" : "Уточнить"))}</div>
              </div>
            </div>

            <p class="trip-description">${escapeHtml(post.text || "")}</p>

            <div class="tags">
              <span class="tag">🎣 выезд</span>
              ${city ? `<span class="tag">📍 ${escapeHtml(city)}</span>` : ""}
              ${fishingType ? `<span class="tag fishing-type ${fishingTypeClass}">${escapeHtml(fishingType)}</span>` : ""}
              ${isFull ? '<span class="tag full">экипаж набран</span>' : ''}
              ${tg ? '<span class="tag">Telegram</span>' : ''}
              ${ownerId && post.owner_id === ownerId ? '<span class="tag">моё</span>' : ''}
            </div>

            <div class="actions">
              ${tgButton}
              ${fullBtn}
              ${editBtn}
              ${deleteBtn}
            </div>
          </div>
        </div>
      `;
    }

    function openPostModal(id) {
      const post = posts.find(p => String(p.id) === String(id));
      if (!post) return;

      activeModalPost = post;

      const modal = document.getElementById("postModal");
      const imageEl = document.getElementById("postModalImage");
      const titleEl = document.getElementById("postModalTitle");
      const metaEl = document.getElementById("postModalMeta");
      const textEl = document.getElementById("postModalText");
      const writeBtn = document.getElementById("postModalWriteBtn");

      if (!modal || !imageEl || !titleEl || !metaEl || !textEl || !writeBtn) return;

      const image = getCardImage(post);
      const tg = cleanTelegram(post.telegram);
      const isFull = Boolean(post.crew_full);
      const date = post.created_at
        ? new Date(post.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })
        : "";
      const fishingType = post.fishing_type || "";
      const destination = post.destination || post.city || "рыбалку";

      imageEl.style.backgroundImage = `url('${image}')`;
      titleEl.textContent = `${post.name || "Рыбак"} едет на ${destination}`;
      textEl.textContent = post.text || "Описание не указано.";

      metaEl.innerHTML = `
        ${post.city ? `<span class="post-modal-pill">📍 Откуда: ${escapeHtml(post.city)}</span>` : ""}
        ${post.destination ? `<span class="post-modal-pill">🗺️ Куда: ${escapeHtml(post.destination)}</span>` : ""}
        ${post.trip_time ? `<span class="post-modal-pill">🕒 Когда: ${escapeHtml(post.trip_time)}</span>` : ""}
        ${fishingType ? `<span class="post-modal-pill">🎣 ${escapeHtml(fishingType)}</span>` : ""}
        ${post.transport ? `<span class="post-modal-pill">🚗 ${escapeHtml(post.transport)}</span>` : ""}
        ${post.seats ? `<span class="post-modal-pill">👥 ${escapeHtml(post.seats)}</span>` : ""}
        ${date ? `<span class="post-modal-pill">Создано: ${escapeHtml(date)}</span>` : ""}
        ${tg ? `<span class="post-modal-pill">Telegram</span>` : ""}
        ${isFull ? `<span class="post-modal-pill">Экипаж набран</span>` : ""}
      `;

      if (isFull) {
        writeBtn.textContent = "Экипаж уже набран";
        writeBtn.disabled = true;
      } else {
        writeBtn.textContent = "Написать";
        writeBtn.disabled = false;
      }

      clearTimeout(postModalCloseTimer);
      modal.classList.remove("hidden");

      requestAnimationFrame(() => {
        modal.classList.add("open");
        document.body.classList.add("post-modal-open");
      });
    }

    function closePostModal() {
      const modal = document.getElementById("postModal");
      if (!modal) return;

      modal.classList.remove("open");
      document.body.classList.remove("post-modal-open");

      postModalCloseTimer = setTimeout(() => {
        modal.classList.add("hidden");
        activeModalPost = null;
      }, 360);
    }

    function handlePostModalBackdrop(event) {
      if (event.target && event.target.id === "postModal") {
        closePostModal();
      }
    }

    function writePostAuthor() {
      if (!activeModalPost) return;

      const tg = cleanTelegram(activeModalPost.telegram);

      if (tg) {
        window.open(`https://t.me/${tg}`, "_blank");
      } else {
        openTelegram();
      }
    }

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closePostModal();
      }
    });

    async function savePost() {
      if (!authReady) {
        await restoreAuthState("before_save", false);
      }

      const name = document.getElementById("nameInput").value.trim();
      const city = document.getElementById("cityInput").value.trim();
      const destination = document.getElementById("destinationInput").value.trim();
      const tripTime = document.getElementById("tripTimeInput").value.trim();
      const fishingType = document.getElementById("fishingTypeInput").value.trim();
      const transport = document.getElementById("transportInput").value.trim();
      const seats = document.getElementById("seatsInput").value.trim();
      const text = document.getElementById("textInput").value.trim();
      const telegram = cleanTelegram(document.getElementById("telegramInput").value);

      if (!currentUser) {
        await restoreAuthState("save_post_retry", false);
      }

      if (!currentUser) {
        showSection("auth");
        alert("Сначала создай профиль или войди. Так объявления будут защищены от удаления чужими людьми.");
        return;
      }

      if (!name || !city || !destination || !tripTime || !text) {
        showFormMessage("Заполни Nickname, город, куда едешь, когда и описание.", true);
        return;
      }

      saveAuthorLocal(name, telegram);

      const payload = {
        name,
        city,
        destination,
        trip_time: tripTime,
        fishing_type: fishingType,
        transport,
        seats,
        text,
        telegram,
        owner_id: currentUser.id
      };

      let result;

      if (editingId) {
        result = await supabaseClient
          .from("posts")
          .update(payload)
          .eq("id", editingId);
      } else {
        result = await supabaseClient
          .from("posts")
          .insert([{ ...payload, crew_full: false }]);
      }

      if (result.error) {
        showFormMessage("Не получилось сохранить. Проверь поля destination, trip_time, transport, seats в таблице posts.", true);
        console.error(result.error);
        return;
      }

      const wasEditing = Boolean(editingId);

      clearForm();
      fillAuthorLocal();
      editingId = null;
      document.getElementById("formTitle").innerText = "Создать выезд";
      document.getElementById("cancelEditBtn").classList.add("hidden");
      showFormMessage(wasEditing ? "Выезд обновлён." : "Выезд создан.");

      await loadPosts();

      if (typeof window.klevbyReloadMap === "function") {
        window.klevbyReloadMap();
      }
    }

    function editPost(id) {
      const post = posts.find(p => String(p.id) === String(id));
      if (!post) return;

      editingId = id;

      document.getElementById("nameInput").value = post.name || "";
      document.getElementById("cityInput").value = post.city || "";
      document.getElementById("destinationInput").value = post.destination || "";
      document.getElementById("tripTimeInput").value = post.trip_time || "";
      document.getElementById("fishingTypeInput").value = post.fishing_type || "";
      document.getElementById("transportInput").value = post.transport || "";
      document.getElementById("seatsInput").value = post.seats || "";
      document.getElementById("textInput").value = post.text || "";
      document.getElementById("telegramInput").value = post.telegram || "";

      document.getElementById("formTitle").innerText = "Редактировать выезд";
      document.getElementById("cancelEditBtn").classList.remove("hidden");
      document.getElementById("createPanel").scrollIntoView({ behavior: "smooth" });
      setTimeout(updateHomeFloatButton, 120);
    }

    function cancelEdit() {
      editingId = null;
      clearForm();
      fillAuthorLocal();
      document.getElementById("formTitle").innerText = "Создать выезд";
      document.getElementById("cancelEditBtn").classList.add("hidden");
      showFormMessage("");
    }

    function clearForm() {
      document.getElementById("nameInput").value = "";
      document.getElementById("cityInput").value = "";
      document.getElementById("destinationInput").value = "";
      document.getElementById("tripTimeInput").value = "";
      document.getElementById("fishingTypeInput").value = "";
      document.getElementById("transportInput").value = "";
      document.getElementById("seatsInput").value = "";
      document.getElementById("textInput").value = "";
      document.getElementById("telegramInput").value = "";
    }

    async function toggleCrewFull(id, value) {
      const { error } = await supabaseClient
        .from("posts")
        .update({ crew_full: value })
        .eq("id", id);

      if (error) {
        alert("Не получилось изменить статус. Проверь поле crew_full и RLS.");
        console.error(error);
        return;
      }

      await loadPosts();
    }

    async function deletePost(id) {
      if (!confirm("Удалить объявление? Это действие нельзя отменить.")) return;

      const { error } = await supabaseClient
        .from("posts")
        .delete()
        .eq("id", id);

      if (error) {
        alert("Не получилось удалить. Удалять может только владелец объявления или админ.");
        console.error(error);
        return;
      }

      await loadPosts();

      if (typeof window.klevbyReloadMap === "function") {
        window.klevbyReloadMap();
      }
    }

    function isStandaloneMode() {
      return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }

    function isIosDevice() {
      return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }

    function updatePwaInstallVisibility() {
      if (isStandaloneMode()) {
        document.documentElement.classList.add("pwa-standalone");
        document.body.classList.add("pwa-installed");
      } else {
        document.documentElement.classList.remove("pwa-standalone");
        document.body.classList.remove("pwa-installed");
      }
    }

    function shouldShowInstallBanner() {
      const closedAt = Number(localStorage.getItem("klevby_install_banner_closed_at") || "0");
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (closedAt && Date.now() - closedAt < sevenDays) {
        return false;
      }

      if (isStandaloneMode()) {
        return false;
      }

      return true;
    }

    function showInstallBanner() {
      if (installBannerShown || !shouldShowInstallBanner()) return;

      if (!deferredInstallPrompt && !isIosDevice()) return;

      const banner = document.getElementById("installBanner");
      if (!banner) return;

      installBannerShown = true;
      banner.classList.remove("hidden");

      requestAnimationFrame(() => {
        banner.classList.add("show");
      });
    }

    function hideInstallBanner(saveClose = false) {
      const banner = document.getElementById("installBanner");
      if (!banner) return;

      if (saveClose) {
        localStorage.setItem("klevby_install_banner_closed_at", String(Date.now()));
      }

      banner.classList.remove("show");

      setTimeout(() => {
        banner.classList.add("hidden");
      }, 350);
    }

    function openIosInstallModal() {
      hideInstallBanner(false);
      document.getElementById("iosInstallModal").classList.remove("hidden");
    }

    function closeIosInstallModal() {
      document.getElementById("iosInstallModal").classList.add("hidden");
    }

    async function handleInstallClick() {
      if (isStandaloneMode()) {
        updatePwaInstallVisibility();
        return;
      }

      if (isIosDevice()) {
        openIosInstallModal();
        return;
      }

      if (!deferredInstallPrompt) {
        alert("Если окно установки не появилось, открой сайт в Chrome или Edge и попробуй ещё раз. Иногда браузер показывает установку только после нескольких посещений сайта.");
        return;
      }

      deferredInstallPrompt.prompt();

      try {
        await deferredInstallPrompt.userChoice;
      } catch (error) {
        console.warn("Install prompt closed:", error);
      }

      deferredInstallPrompt = null;
      hideInstallBanner(true);
      updatePwaInstallVisibility();
    }

    function initInstallPrompt() {
      updatePwaInstallVisibility();

      window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;

        if (!shouldShowInstallBanner()) return;

        setTimeout(showInstallBanner, 2200);

        const showOnScroll = function () {
          showInstallBanner();
          window.removeEventListener("scroll", showOnScroll);
        };

        window.addEventListener("scroll", showOnScroll, { passive: true });
      });

      window.addEventListener("appinstalled", function () {
        deferredInstallPrompt = null;
        hideInstallBanner(true);
        document.documentElement.classList.add("pwa-standalone");
        document.body.classList.add("pwa-installed");
      });

      if (isIosDevice() && shouldShowInstallBanner()) {
        setTimeout(showInstallBanner, 2600);
      }
    }

    async function forceAppUpdate() {
      try {
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }

        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();

          await Promise.all(
            registrations.map(async (registration) => {
              try {
                await registration.update();

                if (registration.waiting) {
                  registration.waiting.postMessage({ type: "SKIP_WAITING" });
                }
              } catch (error) {
                console.warn("Не удалось обновить Service Worker:", error);
              }
            })
          );
        }
      } catch (error) {
        console.warn("Ошибка обновления приложения:", error);
      }

      const url = new URL(window.location.href);
      url.searchParams.set("update", Date.now().toString());
      window.location.replace(url.toString());
    }

    async function registerPwaServiceWorker() {
      if (!("serviceWorker" in navigator)) return;
      if (!window.isSecureContext) return;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none"
        });

        await registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        navigator.serviceWorker.addEventListener("controllerchange", function () {
          console.log("Klevby Service Worker обновлён.");
        });

        console.log("Klevby Service Worker зарегистрирован: /sw.js");
      } catch (error) {
        console.warn("Service Worker не зарегистрирован. Проверь, что файл /sw.js лежит в корневой папке сайта.", error);
      }
    }

    document.addEventListener("DOMContentLoaded", async function () {
      const ok = initSupabase();
      if (!ok) return;

      setupAuthResumeHandlers();
      setAuthMode("register");
      fillAuthorLocal();
      updateBiteForecast(752);
      fetchWeather();
      setInterval(fetchWeather, 1800000);
      initInstallPrompt();
      registerPwaServiceWorker();
      await initAuth();
      updateHomeFloatButton();
    });
