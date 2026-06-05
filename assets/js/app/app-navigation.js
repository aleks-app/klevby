(function () {
  function getAppSections() {
    return [
      "homeSection",
      "feedSection",
      "tripsSection",
      "createSection",
      "marketSection",
      "pondsSection",
      "mapSection",
      "authSection",
      "profileSection"
    ];
  }

  function hideAllAppSectionsExcept(activeId) {
    getAppSections().forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;

      section.classList.toggle("hidden", id !== activeId);
    });
  }

  function clearProfileChromeIfNeeded(section) {
    if (section === "profile") return;

    try {
      if (typeof window.setProfileScreenChrome === "function") {
        window.setProfileScreenChrome(false);
      }

      if (typeof window.restoreMainTabbar === "function") {
        window.restoreMainTabbar();
      }

      sessionStorage.removeItem("klevby_profile_return_mode");
      window.__klevbyProfileReturnMode = false;
    } catch (error) {
      window.__klevbyProfileReturnMode = false;
    }
  }

  function setMobileTabVisual(index) {
    const buttons = Array.from(document.querySelectorAll(".mobile-tabbar .mobile-tab-btn"));

    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("active", Number.isInteger(index) && buttonIndex === index);
    });
  }

  function getVisibleSectionName() {
    if (!document.getElementById("homeSection")?.classList.contains("hidden")) return "home";
    if (!document.getElementById("feedSection")?.classList.contains("hidden")) return "feed";
    if (!document.getElementById("tripsSection")?.classList.contains("hidden")) return "trips";
    if (!document.getElementById("createSection")?.classList.contains("hidden")) return "create";
    if (!document.getElementById("mapSection")?.classList.contains("hidden")) return "map";
    if (!document.getElementById("marketSection")?.classList.contains("hidden")) return "market";
    if (!document.getElementById("pondsSection")?.classList.contains("hidden")) return "ponds";
    if (!document.getElementById("authSection")?.classList.contains("hidden")) return "auth";
    if (!document.getElementById("profileSection")?.classList.contains("hidden")) return "profile";

    return "home";
  }

  function closeMobileMenuForChrome() {
    try {
      if (typeof window.closeMobileMenuSafe === "function") {
        window.closeMobileMenuSafe();
        return;
      }

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
    } catch (_) {}
  }

  function setAppChromeMode(mode) {
    const cleanMode =
      mode === "feed" ? "feed" :
      mode === "inner" ? "inner" :
      "home";
    const header = document.querySelector("header");

    if (header) {
      header.setAttribute("data-chrome-mode", cleanMode);
    }

    document.body.setAttribute("data-app-chrome-mode", cleanMode);

    if (cleanMode === "feed") {
      closeMobileMenuForChrome();
    }

    return cleanMode;
  }

  window.KlevbyAppNavigation = {
    getAppSections,
    hideAllAppSectionsExcept,
    clearProfileChromeIfNeeded,
    setMobileTabVisual,
    getVisibleSectionName,
    setAppChromeMode
  };

  console.log("Klevby app navigation loaded");
})();
