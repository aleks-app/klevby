(function () {
  const PROFILE_SETTINGS_VERSION = "20260512-profile-settings-split-1";

  function getCore() {
    return window.KlevbyProfileCore || {};
  }

  function requireCoreMethod(name) {
    const core = getCore();

    if (core && typeof core[name] === "function") {
      return core[name].bind(core);
    }

    const error = new Error(`KlevbyProfileCore.${name} is not available`);
    console.error("[KlevbyProfileSettings] profile-core.js не готов или функция не найдена:", name, error);
    throw error;
  }

  function getUi() {
    return window.KlevbyProfileUi || {};
  }

  function requireUiMethod(name) {
    const ui = getUi();

    if (ui && typeof ui[name] === "function") {
      return ui[name].bind(ui);
    }

    const error = new Error(`KlevbyProfileUi.${name} is not available`);
    console.error("[KlevbyProfileSettings] profile-ui.js не готов или функция не найдена:", name, error);
    throw error;
  }

  function readProfileData() {
    return requireCoreMethod("readProfileData")();
  }

  function saveProfileData(data) {
    return requireCoreMethod("saveProfileData")(data);
  }

  function setProfileScreenChrome(isActive) {
    return requireUiMethod("setProfileScreenChrome")(isActive);
  }

  function applyProfileTabbar() {
    return requireUiMethod("applyProfileTabbar")();
  }

  function setProfileTabActive(index) {
    return requireUiMethod("setProfileTabActive")(index);
  }

  function updateProfileHomeFloatButton() {
    return requireUiMethod("updateProfileHomeFloatButton")();
  }


  function isProfileGuestState() {
    const recentLogout =
      typeof window.isAuthLogoutGuardActive === "function"
        ? window.isAuthLogoutGuardActive()
        : Boolean(window.klevbyAuthLogoutInProgress);
    const user = window.currentUser || window.klevbyCurrentUser || window.klevbyUser || null;

    return Boolean((window.klevbyAuthReady || window.authReady || recentLogout) && !user);
  }

  function openAuthFromGuestProfile() {
    if (typeof window.showSection === "function") {
      window.showSection("auth");
    }
  }

  function updateKlevbyProfileViewSafe() {
    if (typeof window.updateKlevbyProfileView === "function") {
      window.updateKlevbyProfileView();
      return;
    }

    if (window.KlevbyProfile && typeof window.KlevbyProfile.updateKlevbyProfileView === "function") {
      window.KlevbyProfile.updateKlevbyProfileView();
    }
  }

  function openKlevbyProfileSafe() {
    if (typeof window.openKlevbyProfile === "function") {
      window.openKlevbyProfile();
      return;
    }

    if (window.KlevbyProfile && typeof window.KlevbyProfile.openKlevbyProfile === "function") {
      window.KlevbyProfile.openKlevbyProfile();
    }
  }

  function openProfileSettingsModal() {
    if (isProfileGuestState()) {
      openAuthFromGuestProfile();
      return;
    }

    const modal = document.getElementById("profileSettingsModal");
    const message = document.getElementById("profileSettingsMessage");

    if (!modal) return;

    setProfileScreenChrome(true);
    fillProfileSettingsForm();

    if (message) {
      message.textContent = "";
      message.classList.remove("error-line");
    }

    modal.classList.remove("hidden");
    document.body.classList.add("post-modal-open");

    applyProfileTabbar();
    setProfileTabActive(3);
    updateProfileHomeFloatButton();

    setTimeout(() => {
      const nameInput = document.getElementById("profileSettingsNameInput");
      if (nameInput) nameInput.focus({ preventScroll: true });
    }, 120);
  }

  function closeProfileSettingsModal(updateButton = true) {
    const modal = document.getElementById("profileSettingsModal");

    if (modal) {
      modal.classList.add("hidden");
    }

    document.body.classList.remove("post-modal-open");

    if (updateButton) {
      setTimeout(updateProfileHomeFloatButton, 80);
    }
  }

  function handleProfileSettingsBackdrop(event) {
    if (!event || event.target?.id !== "profileSettingsModal") return;
    closeProfileSettingsModal(true);
  }

  function fillProfileSettingsForm() {
    const data = readProfileData();

    const nameInput = document.getElementById("profileSettingsNameInput");
    const telegramInput = document.getElementById("profileSettingsTelegramInput");
    const cityInput = document.getElementById("profileSettingsCityInput");
    const aboutInput = document.getElementById("profileSettingsAboutInput");

    if (nameInput) nameInput.value = data.name || "";
    if (telegramInput) telegramInput.value = data.telegram || "";
    if (cityInput) cityInput.value = data.city || "";
    if (aboutInput) aboutInput.value = data.about || "";
  }

  function saveProfileSettings() {
    const message = document.getElementById("profileSettingsMessage");

    const nameInput = document.getElementById("profileSettingsNameInput");
    const telegramInput = document.getElementById("profileSettingsTelegramInput");
    const cityInput = document.getElementById("profileSettingsCityInput");
    const aboutInput = document.getElementById("profileSettingsAboutInput");

    const name = nameInput ? nameInput.value.trim() : "";
    const telegram = telegramInput ? telegramInput.value.trim() : "";
    const city = cityInput ? cityInput.value.trim() : "";
    const about = aboutInput ? aboutInput.value.trim() : "";

    if (!name) {
      if (message) {
        message.textContent = "Укажи никнейм, чтобы профиль нормально отображался.";
        message.classList.add("error-line");
      }

      if (nameInput) nameInput.focus();
      return;
    }

    const saved = saveProfileData({
      name,
      telegram,
      city,
      about
    });

    syncProfileDataToMainInputs(saved);
    updateKlevbyProfileViewSafe();
    pulseProfileSaved();

    if (message) {
      message.classList.remove("error-line");
      message.textContent = "✅ Анкета сохранена.";
    }

    if (navigator.vibrate) {
      navigator.vibrate(18);
    }

    setTimeout(() => {
      closeProfileSettingsModal(false);
      openKlevbyProfileSafe();
    }, 420);
  }

  function syncProfileDataToMainInputs(data) {
    const nameInput = document.getElementById("nameInput");
    const cityInput = document.getElementById("cityInput");
    const telegramInput = document.getElementById("telegramInput");
    const usernameInput = document.getElementById("usernameInput");

    if (data.name) {
      if (nameInput && !nameInput.value.trim()) nameInput.value = data.name;
      if (usernameInput && !usernameInput.value.trim()) usernameInput.value = data.name;
    }

    if (data.city && cityInput && !cityInput.value.trim()) {
      cityInput.value = data.city;
    }

    if (data.telegram && telegramInput && !telegramInput.value.trim()) {
      telegramInput.value = data.telegram;
    }
  }

  function pulseProfileSaved() {
    const card = document.querySelector(".profile-main-card");

    if (!card) return;

    card.classList.remove("profile-saved-pulse");

    requestAnimationFrame(() => {
      card.classList.add("profile-saved-pulse");

      setTimeout(() => {
        card.classList.remove("profile-saved-pulse");
      }, 700);
    });
  }

  function logoutFromProfileSettings() {
    try {
      if (typeof window.logout === "function") {
        window.logout();
      } else if (typeof logout === "function") {
        logout();
      }
    } catch (error) {
      console.warn("Klevby profile: выход не сработал", error);
    }

    closeProfileSettingsModal(true);
  }

  function bindProfileInputSync() {
    const nameInput = document.getElementById("nameInput");
    const usernameInput = document.getElementById("usernameInput");

    [nameInput, usernameInput].forEach((input) => {
      if (!input) return;

      input.addEventListener("input", () => {
        const value = input.value.trim();

        if (!value) return;

        const current = readProfileData();

        if (!current.name) {
          saveProfileData({
            ...current,
            name: value
          });

          updateKlevbyProfileViewSafe();
        }
      });
    });
  }

  window.KlevbyProfileSettings = {
    version: PROFILE_SETTINGS_VERSION,
    openProfileSettingsModal,
    closeProfileSettingsModal,
    handleProfileSettingsBackdrop,
    fillProfileSettingsForm,
    saveProfileSettings,
    syncProfileDataToMainInputs,
    pulseProfileSaved,
    logoutFromProfileSettings,
    bindProfileInputSync
  };

  console.log("Klevby profile settings module loaded", {
    version: PROFILE_SETTINGS_VERSION
  });
})();
