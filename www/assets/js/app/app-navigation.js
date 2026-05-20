(function () {
  function getAppSections() {
    return [
      "homeSection",
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
    if (!document.getElementById("tripsSection")?.classList.contains("hidden")) return "trips";
    if (!document.getElementById("createSection")?.classList.contains("hidden")) return "create";
    if (!document.getElementById("mapSection")?.classList.contains("hidden")) return "map";
    if (!document.getElementById("marketSection")?.classList.contains("hidden")) return "market";
    if (!document.getElementById("pondsSection")?.classList.contains("hidden")) return "ponds";
    if (!document.getElementById("authSection")?.classList.contains("hidden")) return "auth";
    if (!document.getElementById("profileSection")?.classList.contains("hidden")) return "profile";

    return "home";
  }

  window.KlevbyAppNavigation = {
    getAppSections,
    hideAllAppSectionsExcept,
    clearProfileChromeIfNeeded,
    setMobileTabVisual,
    getVisibleSectionName
  };

  console.log("Klevby app navigation loaded");
})();
