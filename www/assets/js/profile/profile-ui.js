(function () {
  const KLEVB_PROFILE_RETURN_KEY = "klevby_profile_return_mode";

  let klevbyMainTabbarSnapshot = null;
  let klevbyOriginalGoHomeTop = null;
  let klevbyOriginalUpdateHomeFloatButton = null;
  let klevbyHeaderDisplaySnapshot = null;

  function setProfileScreenChrome(isActive) {
    const html = document.documentElement;
    const body = document.body;
    const header = document.querySelector("header");

    if (html) {
      html.classList.toggle("profile-screen-open", Boolean(isActive));
    }

    if (body) {
      body.classList.toggle("profile-screen-open", Boolean(isActive));
    }

    if (!header) return;

    if (isActive) {
      if (klevbyHeaderDisplaySnapshot === null) {
        klevbyHeaderDisplaySnapshot = header.style.display || "";
      }

      header.style.display = "none";
      header.setAttribute("aria-hidden", "true");
      header.dataset.profileHidden = "1";
      return;
    }

    if (header.dataset.profileHidden === "1") {
      header.style.display = klevbyHeaderDisplaySnapshot || "";
      header.removeAttribute("aria-hidden");
      delete header.dataset.profileHidden;
    }
  }

  function closeMobileMenuSafe() {
    try {
      if (typeof window.closeMobileMenu === "function") {
        window.closeMobileMenu();
        return;
      }

      const menu = document.getElementById("mobileMenu");
      const burger = document.getElementById("burgerBtn");

      if (menu) menu.classList.remove("open");

      if (burger) {
        burger.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      }
    } catch (error) {
      console.warn("Klevby profile UI: меню не закрылось", error);
    }
  }

  function hideProfileTopGearButton() {
    const gearButton = document.querySelector(".profile-gear-btn");

    if (gearButton) {
      gearButton.classList.add("hidden");
      gearButton.setAttribute("aria-hidden", "true");
      gearButton.tabIndex = -1;
    }
  }

  function saveMainTabbarSnapshot() {
    if (klevbyMainTabbarSnapshot) return;

    const tabbar = document.querySelector(".mobile-tabbar");
    if (!tabbar) return;

    const buttons = Array.from(tabbar.querySelectorAll(".mobile-tab-btn"));

    klevbyMainTabbarSnapshot = buttons.map((button) => {
      return {
        html: button.innerHTML,
        className: button.className,
        onclick: button.getAttribute("onclick"),
        id: button.id || ""
      };
    });
  }

  function restoreMainTabbar() {
    const tabbar = document.querySelector(".mobile-tabbar");
    if (!tabbar || !klevbyMainTabbarSnapshot) return;

    const buttons = Array.from(tabbar.querySelectorAll(".mobile-tab-btn"));

    buttons.forEach((button, index) => {
      const saved = klevbyMainTabbarSnapshot[index];
      if (!saved) return;

      button.innerHTML = saved.html;
      button.className = saved.className;

      if (saved.id) {
        button.id = saved.id;
      }

      if (saved.onclick) {
        button.setAttribute("onclick", saved.onclick);
      } else {
        button.removeAttribute("onclick");
      }

      button.classList.remove("profile-tab-active");
    });
  }

  function applyProfileTabbar() {
    saveMainTabbarSnapshot();

    const tabbar = document.querySelector(".mobile-tabbar");
    if (!tabbar) return;

    const buttons = Array.from(tabbar.querySelectorAll(".mobile-tab-btn"));
    if (buttons.length < 5) return;

    setProfileTabButton(buttons[0], "▧", "Фото", "openProfilePhotoAction()");
    setProfileTabButton(buttons[1], "▣", "Выезды", "openProfileTripsView()");
    setProfileTabButton(buttons[2], "+", "Создать", "openProfileCreateView()", true);
    setProfileTabButton(buttons[3], "⚙", "Анкета", "openProfileSettingsModal()");

    const chatButton = buttons[4];
    chatButton.innerHTML = '<span class="mobile-tab-icon">☵</span><span class="mobile-tab-text">Чат</span>';
    chatButton.classList.remove("active");
    chatButton.classList.remove("profile-tab-active");

    if (!chatButton.id) {
      chatButton.id = "nav-chat";
    }
  }

  function setProfileTabButton(button, icon, text, action, isCreate = false) {
    if (!button) return;

    button.className = isCreate
      ? "mobile-tab-btn mobile-tab-create"
      : "mobile-tab-btn";

    button.innerHTML = `<span class="mobile-tab-icon">${icon}</span><span class="mobile-tab-text">${text}</span>`;
    button.setAttribute("onclick", action);
  }

  function setProfileTabActive(index) {
    const buttons = document.querySelectorAll(".mobile-tab-btn");

    buttons.forEach((button, i) => {
      button.classList.toggle("active", Number.isInteger(index) && i === index);
    });
  }

  function hideProfileSectionOnly() {
    const profileSection = document.getElementById("profileSection");

    if (profileSection) {
      profileSection.classList.add("hidden");
    }

    if (typeof window.closeProfileSettingsModal === "function") {
      window.closeProfileSettingsModal(false);
    }
  }

  function setProfileReturnMode(isActive) {
    try {
      if (isActive) {
        sessionStorage.setItem(KLEVB_PROFILE_RETURN_KEY, "1");
      } else {
        sessionStorage.removeItem(KLEVB_PROFILE_RETURN_KEY);
      }
    } catch (error) {
      window.__klevbyProfileReturnMode = Boolean(isActive);
    }

    window.__klevbyProfileReturnMode = Boolean(isActive);
    updateProfileHomeFloatButton();
  }

  function isProfileReturnMode() {
    try {
      return sessionStorage.getItem(KLEVB_PROFILE_RETURN_KEY) === "1";
    } catch (error) {
      return Boolean(window.__klevbyProfileReturnMode);
    }
  }

  function isProfileSectionVisible() {
    const profileSection = document.getElementById("profileSection");

    return Boolean(profileSection && !profileSection.classList.contains("hidden"));
  }

  function isProfileSettingsModalVisible() {
    const modal = document.getElementById("profileSettingsModal");

    return Boolean(modal && !modal.classList.contains("hidden"));
  }

  function shouldShowProfileBackButton() {
    return isProfileReturnMode() || isProfileSettingsModalVisible();
  }

  function setFloatButtonBackToProfile(btn) {
    if (!btn) return;

    btn.textContent = "←";
    btn.dataset.floatMode = "back";
    btn.dataset.floatIcon = "←";
    btn.setAttribute("aria-label", "Вернуться в профиль");
    btn.setAttribute("title", "В профиль");
    btn.classList.add("show");
  }

  function setFloatButtonBackToFeed(btn) {
    if (!btn) return;

    btn.textContent = "←";
    btn.dataset.floatMode = "back";
    btn.dataset.floatIcon = "←";
    btn.setAttribute("aria-label", "Вернуться в ленту");
    btn.setAttribute("title", "В ленту");
    btn.classList.add("show");
  }

  function updateProfileHomeFloatButton() {
    const btn = document.getElementById("homeFloatBtn");

    if (!btn) return;

    if (shouldShowProfileBackButton()) {
      setFloatButtonBackToProfile(btn);
      return;
    }

    if (isProfileSectionVisible()) {
      setFloatButtonBackToFeed(btn);
      return;
    }

    if (typeof klevbyOriginalUpdateHomeFloatButton === "function") {
      try {
        klevbyOriginalUpdateHomeFloatButton();
      } catch (error) {
        console.warn("Klevby profile UI: home float update skipped", error);
      }
    }
  }

  function patchHomeFloatButton() {
    if (typeof window.goHomeTop === "function" && !klevbyOriginalGoHomeTop) {
      klevbyOriginalGoHomeTop = window.goHomeTop;

      window.goHomeTop = function patchedGoHomeTop() {
        if (shouldShowProfileBackButton()) {
          if (typeof window.closeProfileSettingsModal === "function") {
            window.closeProfileSettingsModal(false);
          }

          if (typeof window.openKlevbyProfile === "function") {
            window.openKlevbyProfile();
          }

          return;
        }

        if (isProfileSectionVisible()) {
          setProfileReturnMode(false);
          setProfileScreenChrome(false);
          restoreMainTabbar();

          if (typeof klevbyOriginalGoHomeTop === "function") {
            return klevbyOriginalGoHomeTop.apply(this, arguments);
          }

          showHomeSectionFallback();
          return;
        }

        setProfileScreenChrome(false);
        restoreMainTabbar();

        if (typeof klevbyOriginalGoHomeTop === "function") {
          return klevbyOriginalGoHomeTop.apply(this, arguments);
        }

        showHomeSectionFallback();
        return;
      };
    }

    if (typeof window.updateHomeFloatButton === "function" && !klevbyOriginalUpdateHomeFloatButton) {
      klevbyOriginalUpdateHomeFloatButton = window.updateHomeFloatButton;

      window.updateHomeFloatButton = function patchedUpdateHomeFloatButton() {
        if (shouldShowProfileBackButton() || isProfileSectionVisible()) {
          updateProfileHomeFloatButton();
          return;
        }

        if (typeof klevbyOriginalUpdateHomeFloatButton === "function") {
          const result = klevbyOriginalUpdateHomeFloatButton.apply(this, arguments);
          updateProfileHomeFloatButton();
          return result;
        }

        return undefined;
      };
    }
  }

  function showHomeSectionFallback() {
    const sectionIds = [
      "homeSection",
      "tripsSection",
      "createSection",
      "marketSection",
      "pondsSection",
      "mapSection",
      "authSection",
      "profileSection"
    ];

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;

      if (id === "homeSection") {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });

    setProfileReturnMode(false);
    setProfileScreenChrome(false);
    restoreMainTabbar();

    if (typeof window.setMobileTabActive === "function") {
      window.setMobileTabActive(0);
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    setTimeout(updateProfileHomeFloatButton, 120);
  }

  window.KlevbyProfileUi = {
    setProfileScreenChrome,
    closeMobileMenuSafe,
    hideProfileTopGearButton,
    saveMainTabbarSnapshot,
    restoreMainTabbar,
    applyProfileTabbar,
    setProfileTabButton,
    setProfileTabActive,
    hideProfileSectionOnly,
    setProfileReturnMode,
    isProfileReturnMode,
    isProfileSectionVisible,
    isProfileSettingsModalVisible,
    shouldShowProfileBackButton,
    updateProfileHomeFloatButton,
    patchHomeFloatButton,
    showHomeSectionFallback
  };

  console.log("Klevby profile UI loaded");
})();
